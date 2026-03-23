/**
 * GET /api/agent/cron
 *
 * Called by cron-job.org (free) every minute.
 * Setup: https://cron-job.org → URL: https://your-app.vercel.app/api/agent/cron?secret=YOUR_CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import {
  isAgentActive,
  getSubscriptions,
  updateSubscription,
  addTransaction,
  type Subscription,
} from '@/app/lib/store';

const USDT_ADDRESS  = process.env.USDT_CONTRACT_ADDRESS || '0xd077a400968890eacc75cdc901f0356c943e4fdb';
const USDT_DECIMALS = parseInt(process.env.USDT_DECIMALS || '6', 10);

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const querySecret = request.nextUrl.searchParams.get('secret');
  if (querySecret === secret) return true;
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${secret}`) return true;
  return false;
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
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isAgentActive()) {
    return NextResponse.json({
      success: true,
      message: 'Agent is stopped. Start it from the UI first.',
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

    // Get current USDT balance
    let usdtBal = 0;
    try {
      const usdtUnits: bigint = await account.getTokenBalance(USDT_ADDRESS);
      usdtBal = Number(usdtUnits) / Math.pow(10, USDT_DECIMALS);
    } catch { /* non-fatal */ }

    const subscriptions = getSubscriptions();

    for (let i = 0; i < subscriptions.length; i++) {
      const sub = subscriptions[i];
      if (!sub.active) continue;

      const now         = new Date();
      const lastPayment = sub.lastPayment ? new Date(sub.lastPayment) : new Date(0);
      const nextDue     = getNextDueDate(lastPayment, sub.frequency);

      if (now < nextDue) {
        results.skipped.push({ recipient: sub.recipient, nextDue: nextDue.toISOString() });
        continue;
      }

      if (usdtBal < sub.amount) {
        addTransaction({
          type: 'failed',
          recipient: sub.recipient,
          amount: sub.amount,
          frequency: sub.frequency,
          reason: 'insufficient_balance',
          timestamp: now.toISOString(),
        });
        results.errors.push({ recipient: sub.recipient, reason: 'insufficient_balance' });
        continue;
      }

      // Mark paid BEFORE sending to prevent double-fire
      updateSubscription(i, { lastPayment: now.toISOString() });

      try {
        const amountUnits = BigInt(Math.round(sub.amount * Math.pow(10, USDT_DECIMALS)));
        const result = await account.transfer({
          token: USDT_ADDRESS,
          recipient: sub.recipient,
          amount: amountUnits,
        });

        usdtBal -= sub.amount;

        addTransaction({
          type: 'success',
          txId: result.hash,
          recipient: sub.recipient,
          amount: sub.amount,
          frequency: sub.frequency,
          feeWei: result.fee.toString(),
          timestamp: now.toISOString(),
        });

        results.processed.push({ recipient: sub.recipient, amount: sub.amount, txId: result.hash });

      } catch (err) {
        // Revert lastPayment so it retries next cron run
        updateSubscription(i, { lastPayment: sub.lastPayment });

        const msg = err instanceof Error ? err.message : String(err);
        addTransaction({
          type: 'error',
          recipient: sub.recipient,
          amount: sub.amount,
          frequency: sub.frequency,
          error: msg,
          timestamp: now.toISOString(),
        });
        results.errors.push({ recipient: sub.recipient, error: msg });
      }
    }

    return NextResponse.json({ success: true, ...results });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}