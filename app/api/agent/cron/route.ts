/**
 * GET /api/agent/cron
 *
 * Processes ALL active users' subscriptions in one call.
 * Triggered every minute by cron-job.org (free).
 * Setup: https://cron-job.org → URL: https://your-app.vercel.app/api/agent/cron?secret=CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import { userStates, addTransaction } from '@/app/lib/agentStore';

const USDT_ADDRESS  = process.env.USDT_CONTRACT_ADDRESS || '0xd077a400968890eacc75cdc901f0356c943e4fdb';
const USDT_DECIMALS = parseInt(process.env.USDT_DECIMALS || '6', 10);

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  if (request.nextUrl.searchParams.get('secret') === secret) return true;
  if (request.headers.get('authorization') === `Bearer ${secret}`) return true;
  return false;
}

function getNextDueDate(lastPayment: Date, frequency: string): Date {
  const next = new Date(lastPayment);
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

  const provider = process.env.RPC_URL || 'https://ethereum-sepolia-public.nodies.app';

  const summary = {
    timestamp: new Date().toISOString(),
    usersProcessed: 0,
    processed: [] as unknown[],
    errors: [] as unknown[],
  };

  for (const [address, state] of userStates.entries()) {
    if (!state.active || !state.subscriptions?.length) continue;

    summary.usersProcessed++;

    try {
      const wdk = new WDK(state.mnemonic)
        .registerWallet('ethereum', WalletManagerEvm, { provider });

      const account = await wdk.getAccount('ethereum', 0);

      let usdtBal = 0;
      try {
        const units: bigint = await account.getTokenBalance(USDT_ADDRESS);
        usdtBal = Number(units) / Math.pow(10, USDT_DECIMALS);
      } catch { /* non-fatal */ }

      for (let i = 0; i < state.subscriptions.length; i++) {
        const sub = state.subscriptions[i];
        if (!sub.active) continue;

        const now = new Date();
        const lastPayment = sub.lastPayment ? new Date(sub.lastPayment) : new Date(0);
        const nextDue = getNextDueDate(lastPayment, sub.frequency);

        if (now < nextDue) continue;

        if (usdtBal < sub.amount) {
          addTransaction({ type: 'failed', recipient: sub.recipient, amount: sub.amount, frequency: sub.frequency, reason: 'insufficient_balance', timestamp: now.toISOString() });
          summary.errors.push({ address, recipient: sub.recipient, reason: 'insufficient_balance' });
          continue;
        }

        // Mark paid BEFORE sending to prevent double-fire
        const updatedSubs = [...state.subscriptions];
        updatedSubs[i] = { ...sub, lastPayment: now.toISOString() };
        userStates.set(address, { ...state, subscriptions: updatedSubs });

        try {
          const amountUnits = BigInt(Math.round(sub.amount * Math.pow(10, USDT_DECIMALS)));
          const result = await account.transfer({ token: USDT_ADDRESS, recipient: sub.recipient, amount: amountUnits });

          usdtBal -= sub.amount;

          addTransaction({ type: 'success', txId: result.hash, recipient: sub.recipient, amount: sub.amount, frequency: sub.frequency, feeWei: result.fee.toString(), timestamp: now.toISOString() });
          summary.processed.push({ address, recipient: sub.recipient, txId: result.hash });

        } catch (err) {
          // Revert lastPayment on failure
          const revertedSubs = [...state.subscriptions];
          revertedSubs[i] = { ...sub, lastPayment: sub.lastPayment };
          userStates.set(address, { ...state, subscriptions: revertedSubs });

          const msg = err instanceof Error ? err.message : String(err);
          addTransaction({ type: 'error', recipient: sub.recipient, amount: sub.amount, frequency: sub.frequency, error: msg, timestamp: now.toISOString() });
          summary.errors.push({ address, recipient: sub.recipient, error: msg });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push({ address, error: msg });
    }
  }

  return NextResponse.json({ success: true, ...summary });
}