'use strict';

/**
 * agent-scripts/subscription-agent.js
 *
 * KEY FIXES in this version:
 *
 * 1. DOUBLE-FIRING FIX — lastPayment is saved to disk BEFORE the transfer,
 *    not after. This means if the agent re-runs (every minute) before the
 *    previous run finishes, it won't see the subscription as due again.
 *
 * 2. REPLACEMENT_UNDERPRICED FIX — subscriptions are processed ONE AT A TIME
 *    with awaited saves between each, so each tx gets a fresh nonce from the
 *    network. Sending two txs in rapid succession reuses the same nonce.
 *
 * 3. NEW SUBSCRIPTION FIRST PAYMENT — when lastPayment is null/undefined,
 *    the subscription fires immediately (correct), then lastPayment is set
 *    so subsequent runs respect the frequency interval.
 *
 * 4. AGENT IS DATA-ONLY — it only reads/writes data/subscriptions.json.
 *    Subscriptions come exclusively from the UI (Dashboard → SubscriptionForm
 *    → POST /api/agent/start). The agent never creates subscriptions itself.
 *
 * CJS require pattern (verified):
 *   require('@tetherto/wdk').default            → WDK class
 *   require('@tetherto/wdk-wallet-evm').default  → WalletManagerEvm class
 */

const cron = require('node-cron');
const fs   = require('fs').promises;
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const WDK            = require('@tetherto/wdk').default;
const WalletManagerEvm = require('@tetherto/wdk-wallet-evm').default;

const DATA_DIR     = path.join(__dirname, '../data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const CONFIG_FILE  = path.join(DATA_DIR, 'subscriptions.json');

const USDT_ADDRESS  = process.env.USDT_CONTRACT_ADDRESS || '0xd077a400968890eacc75cdc901f0356c943e4fdb';
const USDT_DECIMALS = parseInt(process.env.USDT_DECIMALS || '6', 10);

// Prevent concurrent runs — if one check cycle is still running, skip the next
let isRunning = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadSubscriptions() {
  try {
    return JSON.parse(await fs.readFile(CONFIG_FILE, 'utf8'));
  } catch {
    return { subscriptions: [] };
  }
}

async function saveSubscriptions(subscriptions) {
  await fs.writeFile(CONFIG_FILE, JSON.stringify({ subscriptions }, null, 2));
}

async function saveTransaction(tx) {
  let history = { transactions: [] };
  try { history = JSON.parse(await fs.readFile(HISTORY_FILE, 'utf8')); } catch { /* first run */ }
  history.transactions.unshift(tx);
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function getNextDueDate(lastPaymentDate, frequency) {
  const next = new Date(lastPaymentDate);
  switch (frequency) {
    case 'every_minute':     next.setMinutes(next.getMinutes() + 1);   break;
    case 'every_5_minutes':  next.setMinutes(next.getMinutes() + 5);   break;
    case 'every_10_minutes': next.setMinutes(next.getMinutes() + 10);  break;
    case 'every_30_minutes': next.setMinutes(next.getMinutes() + 30);  break;
    case 'hourly':           next.setHours(next.getHours() + 1);       break;
    case 'daily':            next.setDate(next.getDate() + 1);         break;
    case 'weekly':           next.setDate(next.getDate() + 7);         break;
    case 'monthly':          next.setMonth(next.getMonth() + 1);       break;
    case 'yearly':           next.setFullYear(next.getFullYear() + 1); break;
    default:
      console.warn(`[agent] Unknown frequency "${frequency}" — defaulting to daily`);
      next.setDate(next.getDate() + 1);
  }
  return next;
}

// ── Core ──────────────────────────────────────────────────────────────────────

async function processSubscriptions() {
  // Skip if previous cycle is still running (prevents nonce collisions)
  if (isRunning) {
    console.log('[agent] ⏭️  Previous cycle still running — skipping this tick');
    return;
  }
  isRunning = true;

  try {
    console.log(`[agent] 🤖 Checking subscriptions… ${new Date().toISOString()}`);
    await ensureDataDir();

    const mnemonic = process.env.WALLET_MNEMONIC;
    if (!mnemonic) {
      console.error('[agent] ❌ WALLET_MNEMONIC not set in .env.local');
      return;
    }

    const provider = process.env.RPC_URL || 'https://ethereum-sepolia-public.nodies.app';

    const wdkInstance = new WDK(mnemonic)
      .registerWallet('ethereum', WalletManagerEvm, { provider });

    const account = await wdkInstance.getAccount('ethereum', 0);
    const address = await account.getAddress();

    const ethWei = await account.getBalance();
    const ethBal = Number(ethWei) / 1e18;

    let usdtBal = 0;
    try {
      const usdtUnits = await account.getTokenBalance(USDT_ADDRESS);
      usdtBal = Number(usdtUnits) / Math.pow(10, USDT_DECIMALS);
    } catch (err) {
      console.warn('[agent] Could not fetch USDT balance:', err.message);
    }

    console.log(`[agent] 💼 Address : ${address}`);
    // console.log(`[agent] ⛽ ETH     : ${ethBal.toFixed(6)} (gas only)`);
    console.log(`[agent] 💵 USDT    : ${usdtBal.toFixed(USDT_DECIMALS)}`);

    if (ethBal === 0) {
      console.warn('[agent] ⚠️  No ETH for gas — transfers will fail.');
    }

    const { subscriptions } = await loadSubscriptions();
    let anyChanges = false;

    // Process ONE subscription at a time — sequential awaits prevent nonce collisions
    for (const sub of subscriptions) {
      if (!sub.active) continue;

      const now = new Date();

      // First payment: lastPayment is null/undefined → treat as epoch so it fires immediately
      const lastPayment = sub.lastPayment ? new Date(sub.lastPayment) : new Date(0);
      const nextDue     = getNextDueDate(lastPayment, sub.frequency);

      console.log(`[agent] --- ${sub.recipient.slice(0, 10)}… | ${sub.amount} USDT | ${sub.frequency}`);
      console.log(`[agent]     Last paid : ${sub.lastPayment || 'never'}`);
      console.log(`[agent]     Next due  : ${nextDue.toISOString()}`);

      if (now < nextDue) {
        const secsLeft = Math.round((nextDue - now) / 1000);
        console.log(`[agent]     ⏳ Not due — ${secsLeft}s remaining`);
        continue;
      }

      console.log(`[agent]     📅 PAYMENT DUE: ${sub.amount} USDT → ${sub.recipient}`);

      if (usdtBal < sub.amount) {
        console.warn(`[agent]     ❌ Insufficient USDT (have ${usdtBal.toFixed(2)}, need ${sub.amount})`);
        await saveTransaction({
          type: 'failed',
          recipient: sub.recipient,
          amount: sub.amount,
          frequency: sub.frequency,
          reason: 'insufficient_balance',
          timestamp: now.toISOString(),
        });
        continue;
      }

      // ── CRITICAL: Set lastPayment BEFORE sending ─────────────────────────
      // This prevents the agent from firing again on the next cron tick
      // if the transfer takes longer than the cron interval.
      sub.lastPayment = now.toISOString();
      anyChanges = true;
      await saveSubscriptions(subscriptions); // persist immediately

      // ── Execute transfer ─────────────────────────────────────────────────
      try {
        const amountUnits = BigInt(Math.round(sub.amount * Math.pow(10, USDT_DECIMALS)));

        const result = await account.transfer({
          token: USDT_ADDRESS,
          recipient: sub.recipient,
          amount: amountUnits,
        });

        // Update local balance tracker so next sub in this loop sees correct balance
        usdtBal -= sub.amount;

        console.log(`[agent]     ✅ TX: ${result.hash}`);
        console.log(`[agent]     💸 Fee: ${(Number(result.fee) / 1e18).toFixed(8)} ETH`);

        await saveTransaction({
          type: 'success',
          txId: result.hash,
          recipient: sub.recipient,
          amount: sub.amount,
          frequency: sub.frequency,
          feeWei: result.fee.toString(),
          timestamp: now.toISOString(),
        });

      } catch (err) {
        console.error(`[agent]     ❌ Transfer failed:`, err.message);

        // Revert lastPayment so the subscription retries next cycle
        sub.lastPayment = null;
        await saveSubscriptions(subscriptions);

        await saveTransaction({
          type: 'error',
          recipient: sub.recipient,
          amount: sub.amount,
          frequency: sub.frequency,
          error: err.message,
          timestamp: now.toISOString(),
        });
      }
    }

    if (!anyChanges) {
      console.log('[agent] ✨ No payments due this cycle');
    }

  } finally {
    isRunning = false;
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

async function startAgent() {
  console.log('[agent] 🚀 Subscription Agent Starting...');
  console.log('[agent] 📋 Subscriptions come from the UI only (data/subscriptions.json)');
  await processSubscriptions();

  const schedule = process.env.AGENT_CHECK_INTERVAL || '*/5 * * * *';
  cron.schedule(schedule, processSubscriptions);
  console.log(`[agent] ⏰ Scheduled: "${schedule}"`);
}

process.on('SIGINT', () => {
  console.log('\n[agent] 👋 Shutting down...');
  process.exit(0);
});

if (require.main === module) {
  startAgent().catch((err) => {
    console.error('[agent] Fatal error:', err.message);
    process.exit(1);
  });
}

module.exports = { startAgent, processSubscriptions };