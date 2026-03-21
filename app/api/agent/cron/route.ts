/**
 * GET /api/agent/cron
 *
 * Called by Vercel Cron every minute (configured in vercel.json).
 * Also callable manually at http://localhost:3000/api/agent/cron
 *
 * Only processes payments when agent is marked active via POST /api/agent/start.
 * Stops processing when DELETE /api/agent/start is called.
 *
 * Vercel Cron docs: https://vercel.com/docs/cron-jobs
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';

interface Subscription {
  recipient: string;
  amount: number;
  frequency: string;
  active: boolean;
  lastPayment: string | null;
}

const DATA_DIR     = path.join(process.cwd(), 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const CONFIG_FILE  = path.join(DATA_DIR, 'subscriptions.json');
const STATE_FILE   = path.join(DATA_DIR, 'agent-state.json');

const USDT_ADDRESS  = process.env.USDT_CONTRACT_ADDRESS || '0xd077a400968890eacc75cdc901f0356c943e4fdb';
const USDT_DECIMALS = parseInt(process.env.USDT_DECIMALS || '6', 10);

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function isAgentActive(): Promise<boolean> {
  try {
    const state = JSON.parse(await fs.readFile(STATE_FILE, 'utf8'));
    return state.active === true;
  } catch {
    return false;
  }
}

async function loadSubscriptions(): Promise<{ subscriptions: Subscription[] }> {
  try {
    return JSON.parse(await fs.readFile(CONFIG_FILE, 'utf8'));
  } catch {
    return { subscriptions: [] };
  }
}

async function saveSubscriptions(subscriptions: Subscription[]) {
  await fs.writeFile(CONFIG_FILE, JSON.stringify({ subscriptions }, null, 2));
}

async function saveTransaction(tx: Record<string, unknown>) {
  let history: { transactions: unknown[] } = { transactions: [] };
  try { history = JSON.parse(await fs.readFile(HISTORY_FILE, 'utf8')); } catch { /* first run */ }
  history.transactions.unshift(tx);
  await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function getNextDueDate(lastPaymentDate: Date, frequency: string): Date {
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
    default:                 next.setDate(next.getDate() + 1);
  }
  return next;
}

export async function GET(request: NextRequest) {
  // Verify Vercel Cron secret (skipped locally if CRON_SECRET not set)
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  await ensureDataDir();

  const active = await isAgentActive();
  if (!active) {
    return NextResponse.json({
      success: true,
      message: 'Agent is stopped — start it from the UI first.',
    });
  }

  const results = {
    timestamp: new Date().toISOString(),
    processed: [] as unknown[],
    skipped:   [] as unknown[],
    errors:    [] as unknown[],
  };

  try {
    const mnemonic = process.env.WALLET_MNEMONIC;
    if (!mnemonic) {
      return NextResponse.json({ error: 'WALLET_MNEMONIC not set' }, { status: 500 });
    }

    const provider = process.env.RPC_URL || 'https://ethereum-sepolia-public.nodies.app';

    const wdkInstance = new WDK(mnemonic)
      .registerWallet('ethereum', WalletManagerEvm, { provider });

    const account = await wdkInstance.getAccount('ethereum', 0);

    let usdtBal = 0;
    try {
      const usdtUnits: bigint = await account.getTokenBalance(USDT_ADDRESS);
      usdtBal = Number(usdtUnits) / Math.pow(10, USDT_DECIMALS);
    } catch { /* non-fatal */ }

    const { subscriptions } = await loadSubscriptions();

    // Sequential processing — prevents nonce collisions between transfers
    for (const sub of subscriptions) {
      if (!sub.active) continue;

      const now         = new Date();
      const lastPayment = sub.lastPayment ? new Date(sub.lastPayment) : new Date(0);
      const nextDue     = getNextDueDate(lastPayment, sub.frequency);

      if (now < nextDue) {
        results.skipped.push({ recipient: sub.recipient, nextDue: nextDue.toISOString() });
        continue;
      }

      if (usdtBal < sub.amount) {
        await saveTransaction({ type: 'failed', recipient: sub.recipient, amount: sub.amount, frequency: sub.frequency, reason: 'insufficient_balance', timestamp: now.toISOString() });
        results.errors.push({ recipient: sub.recipient, reason: 'insufficient_balance' });
        continue;
      }

      // Save lastPayment BEFORE sending to prevent double-fire on retry
      sub.lastPayment = now.toISOString();
      await saveSubscriptions(subscriptions);

      try {
        const amountUnits = BigInt(Math.round(sub.amount * Math.pow(10, USDT_DECIMALS)));
        const result = await account.transfer({
          token: USDT_ADDRESS,
          recipient: sub.recipient,
          amount: amountUnits,
        });

        usdtBal -= sub.amount;

        await saveTransaction({ type: 'success', txId: result.hash, recipient: sub.recipient, amount: sub.amount, frequency: sub.frequency, feeWei: result.fee.toString(), timestamp: now.toISOString() });
        results.processed.push({ recipient: sub.recipient, amount: sub.amount, txId: result.hash });

      } catch (err) {
        // Revert lastPayment so it retries next cron run
        sub.lastPayment = null;
        await saveSubscriptions(subscriptions);

        const msg = err instanceof Error ? err.message : String(err);
        await saveTransaction({ type: 'error', recipient: sub.recipient, amount: sub.amount, frequency: sub.frequency, error: msg, timestamp: now.toISOString() });
        results.errors.push({ recipient: sub.recipient, error: msg });
      }
    }

    return NextResponse.json({ success: true, ...results });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}