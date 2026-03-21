'use strict';

/**
 * agent-scripts/subscription-agent.js
 *
 * Handles all frequency values defined in SubscriptionForm.tsx:
 *   every_minute | every_5_minutes | every_10_minutes | every_30_minutes
 *   hourly | daily | weekly | monthly | yearly
 *
 * To test minute-level payments:
 *   1. Set AGENT_CHECK_INTERVAL=* * * * * in .env.local  (run every minute)
 *   2. npm run agent  (in a second terminal)
 *   3. Add a subscription with frequency = every_minute
 *   4. Watch the Transaction History panel update
 */

const cron = require('node-cron');
const fs   = require('fs').promises;
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const WalletManagerEvm = require('@tetherto/wdk-wallet-evm');

const DATA_DIR     = path.join(__dirname, '../data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const CONFIG_FILE  = path.join(DATA_DIR, 'subscriptions.json');

const USDT_ADDRESS =
  process.env.USDT_CONTRACT_ADDRESS || '0xd077a400968890eacc75cdc901f0356c943e4fdb';
const USDT_DECIMALS = parseInt(process.env.USDT_DECIMALS || '6', 10);

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

async function saveTransaction(tx) {
  let history = { transactions: [] };
  try { history = JSON.parse(await fs.readFile(HISTORY_FILE, 'utf8')); } catch { /* ok */ }
  history.transactions.unshift(tx);
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}

/**
 * Returns the Date when the next payment is due, given the last payment date
 * and the chosen frequency.
 *
 * Supports every new frequency value from SubscriptionForm.tsx.
 */
function getNextDueDate(lastPaymentDate, frequency) {
  const next = new Date(lastPaymentDate);

  switch (frequency) {
    // ── Testing frequencies ────────────────────────────────────────────────
    case 'every_minute':
      next.setMinutes(next.getMinutes() + 1);
      break;
    case 'every_5_minutes':
      next.setMinutes(next.getMinutes() + 5);
      break;
    case 'every_10_minutes':
      next.setMinutes(next.getMinutes() + 10);
      break;
    case 'every_30_minutes':
      next.setMinutes(next.getMinutes() + 30);
      break;

    // ── Production frequencies ─────────────────────────────────────────────
    case 'hourly':
      next.setHours(next.getHours() + 1);
      break;
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;

    default:
      console.warn(`[agent] Unknown frequency "${frequency}" — treating as daily`);
      next.setDate(next.getDate() + 1);
  }

  return next;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function processSubscriptions() {
  console.log(`[agent] 🤖 Checking subscriptions… ${new Date().toISOString()}`);
  await ensureDataDir();

  const mnemonic = process.env.WALLET_MNEMONIC;
  if (!mnemonic) {
    console.error('[agent] ❌ WALLET_MNEMONIC not set in .env.local');
    return;
  }

  const walletManager = new WalletManagerEvm(mnemonic, {
    provider: process.env.RPC_URL || 'https://ethereum-sepolia-public.nodies.app',
  });

  let account;
  try {
    account = await walletManager.getAccount(0);
    const address = await account.getAddress();

    // Current balances
    const ethWei   = await account.getBalance();
    const ethBal   = Number(ethWei) / 1e18;

    let usdtBal = 0;
    try {
      const usdtUnits = await account.getTokenBalance(USDT_ADDRESS);
      usdtBal = Number(usdtUnits) / Math.pow(10, USDT_DECIMALS);
    } catch { /* token check optional */ }

    console.log(`[agent] 💼 ${address}`);
    console.log(`[agent] 💰 ${ethBal.toFixed(6)} ETH  |  ${usdtBal.toFixed(2)} USDT`);

    const { subscriptions } = await loadSubscriptions();

    for (const sub of subscriptions) {
      if (!sub.active) continue;

      const now         = new Date();
      const lastPayment = sub.lastPayment ? new Date(sub.lastPayment) : new Date(0);
      const nextDue     = getNextDueDate(lastPayment, sub.frequency);

      console.log(`[agent] Sub ${sub.recipient.slice(0, 8)}… | freq: ${sub.frequency} | next due: ${nextDue.toISOString()}`);

      if (now < nextDue) {
        const secsLeft = Math.round((nextDue - now) / 1000);
        console.log(`[agent]   ⏳ Not due yet — ${secsLeft}s remaining`);
        continue;
      }

      console.log(`[agent]   📅 PAYMENT DUE: ${sub.amount} ${sub.token || 'USDT'} → ${sub.recipient}`);

      // ── Balance check ────────────────────────────────────────────────────
      const isUSDT   = (sub.token || 'USDT').toUpperCase() === 'USDT';
      const balance  = isUSDT ? usdtBal : ethBal;

      if (balance < sub.amount) {
        console.warn(`[agent]   ❌ Insufficient ${isUSDT ? 'USDT' : 'ETH'} (have ${balance}, need ${sub.amount})`);
        await saveTransaction({
          type: 'failed',
          recipient: sub.recipient,
          amount: sub.amount,
          token: sub.token || 'USDT',
          frequency: sub.frequency,
          reason: 'insufficient_balance',
          timestamp: now.toISOString(),
        });
        continue;
      }

      // ── Execute payment ──────────────────────────────────────────────────
      try {
        let result;
        if (isUSDT) {
          const amountUnits = BigInt(Math.round(sub.amount * Math.pow(10, USDT_DECIMALS)));
          result = await account.transfer({
            token: USDT_ADDRESS,
            recipient: sub.recipient,
            amount: amountUnits,
          });
        } else {
          const valueWei = BigInt(Math.round(sub.amount * 1e18));
          result = await account.sendTransaction({ to: sub.recipient, value: valueWei });
        }

        sub.lastPayment = now.toISOString();
        console.log(`[agent]   ✅ TX sent: ${result.hash}`);

        await saveTransaction({
          type: 'success',
          txId: result.hash,
          recipient: sub.recipient,
          amount: sub.amount,
          token: sub.token || 'USDT',
          frequency: sub.frequency,
          feeWei: result.fee?.toString(),
          timestamp: now.toISOString(),
        });

      } catch (err) {
        console.error(`[agent]   ❌ Payment failed:`, err.message);
        await saveTransaction({
          type: 'error',
          recipient: sub.recipient,
          amount: sub.amount,
          token: sub.token || 'USDT',
          frequency: sub.frequency,
          error: err.message,
          timestamp: now.toISOString(),
        });
      }
    }

    await fs.writeFile(CONFIG_FILE, JSON.stringify({ subscriptions }, null, 2));

  } finally {
    walletManager.dispose();
  }
}

async function startAgent() {
  console.log('[agent] 🚀 Subscription Samurai Agent starting…');
  await processSubscriptions();

  // Default: every 5 min. For testing use: AGENT_CHECK_INTERVAL=* * * * *
  const schedule = process.env.AGENT_CHECK_INTERVAL || '*/5 * * * *';
  cron.schedule(schedule, processSubscriptions);
  console.log(`[agent] ⏰ Scheduled: "${schedule}"`);
  console.log('[agent] 💡 For minute-level testing, set AGENT_CHECK_INTERVAL=* * * * * in .env.local');
}

process.on('SIGINT', () => {
  console.log('\n[agent] 👋 Shutting down…');
  process.exit(0);
});

if (require.main === module) {
  startAgent().catch((err) => {
    console.error('[agent] Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { startAgent, processSubscriptions };