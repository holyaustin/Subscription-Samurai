import { NextRequest, NextResponse } from 'next/server';
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import { userStates, addTransaction, getTransactionStats, type UserAgentState } from '@/app/lib/agentStore';

const USDT_ADDRESS  = process.env.USDT_CONTRACT_ADDRESS || '0xd077a400968890eacc75cdc901f0356c943e4fdb';
const USDT_DECIMALS = parseInt(process.env.USDT_DECIMALS || '6', 10);

// ── Balance helpers ───────────────────────────────────────────────────────────

async function getETHBalance(account: any): Promise<number> {
  const wei: bigint = await account.getBalance();
  return Number(wei) / 1e18;
}

async function getUSDTBalance(account: any): Promise<number> {
  try {
    const units: bigint = await account.getTokenBalance(USDT_ADDRESS);
    return Number(units) / Math.pow(10, USDT_DECIMALS);
  } catch {
    return 0;
  }
}

// ── Send USDT using correct WDK API ──────────────────────────────────────────

/**
 * WDK docs: account.transfer({ token, recipient, amount: bigint })
 * → { hash: string, fee: bigint }
 *
 * USDT has 6 decimals: 1 USDT = 1_000_000 base units
 * account.getContract() does NOT exist in WDK — that was the bug.
 */
async function sendUSDT(account: any, toAddress: string, amount: number) {
  const amountUnits = BigInt(Math.round(amount * Math.pow(10, USDT_DECIMALS)));

  const result = await account.transfer({
    token: USDT_ADDRESS,
    recipient: toAddress,
    amount: amountUnits,
  });

  return result; // { hash: string, fee: bigint }
}

// ── Frequency → next due date ─────────────────────────────────────────────────

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

// ── Process one user's subscriptions ─────────────────────────────────────────

async function processUserSubscriptions(state: UserAgentState) {
  const { address, mnemonic, subscriptions } = state;
  const now     = new Date();
  const results = [];

  const provider = process.env.RPC_URL || 'https://ethereum-sepolia-public.nodies.app';
  const wdk = new WDK(mnemonic).registerWallet('ethereum', WalletManagerEvm, { provider });
  const account = await wdk.getAccount('ethereum', 0);

  const ethBalance  = await getETHBalance(account);
  const usdtBalance = await getUSDTBalance(account);

  console.log(`🔍 ${address} | ETH: ${ethBalance.toFixed(4)} | USDT: ${usdtBalance.toFixed(2)}`);

  for (const sub of subscriptions) {
    if (!sub.active) continue;

    // Determine if payment is due
    const lastPayment = sub.lastPayment ? new Date(sub.lastPayment) : new Date(0);
    const nextDue     = getNextDueDate(lastPayment, sub.frequency);

    if (now < nextDue) {
      const secsLeft = Math.round((nextDue.getTime() - now.getTime()) / 1000);
      console.log(`⏳ ${sub.recipient.slice(0, 8)}… — ${secsLeft}s until due`);
      continue;
    }

    console.log(`📅 Payment due: ${sub.amount} USDT → ${sub.recipient}`);

    // Insufficient USDT check
    if (usdtBalance < sub.amount) {
      console.log(`❌ Insufficient USDT: have ${usdtBalance.toFixed(2)}, need ${sub.amount}`);
      addTransaction({
        type: 'failed',
        recipient: sub.recipient,
        amount: sub.amount,
        frequency: sub.frequency,
        reason: `Insufficient USDT: ${usdtBalance.toFixed(2)} < ${sub.amount}`,
        timestamp: now.toISOString(),
      });
      results.push({ sub, success: false, reason: 'insufficient_balance' });
      continue;
    }

    // Mark paid BEFORE sending (prevents double-fire if cron overlaps)
    sub.lastPayment = now.toISOString();

    try {
      // ✅ Correct WDK API — account.transfer(), NOT account.getContract()
      const tx = await sendUSDT(account, sub.recipient, sub.amount);

      console.log(`✅ TX: ${tx.hash} | fee: ${Number(tx.fee) / 1e18} ETH`);

      addTransaction({
        type: 'success',
        txId: tx.hash,
        recipient: sub.recipient,
        amount: sub.amount,
        frequency: sub.frequency,
        feeWei: tx.fee.toString(),
        timestamp: now.toISOString(),
      });

      results.push({ sub, success: true, txHash: tx.hash });

    } catch (error) {
      // Revert lastPayment so it retries next cycle
      sub.lastPayment = lastPayment.getTime() === 0 ? null : lastPayment.toISOString();

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Payment failed for ${sub.recipient}:`, errorMsg);

      addTransaction({
        type: 'error',
        recipient: sub.recipient,
        amount: sub.amount,
        frequency: sub.frequency,
        error: errorMsg,
        timestamp: now.toISOString(),
      });

      results.push({ sub, success: false, error: errorMsg });
    }
  }

  return {
    address,
    results,
    processedAt: now.toISOString(),
    balances: { eth: ethBalance, usdt: usdtBalance },
  };
}

// ── Cron handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    console.log('🕐 Cron triggered:', new Date().toISOString());

    // Auth check
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const provided = request.nextUrl.searchParams.get('secret')
        ?? request.headers.get('authorization')?.replace('Bearer ', '');
      if (provided !== secret) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    const results = [];
    let activeUsers = 0;
    let totalSubs   = 0;

    for (const [address, state] of userStates.entries()) {
      if (!state.active) continue;
      activeUsers++;
      totalSubs += state.subscriptions.length;
      console.log(`👤 ${address} (${state.subscriptions.length} subs)`);
      results.push(await processUserSubscriptions(state));
    }

    console.log(`✅ Done: ${activeUsers} users, ${totalSubs} subscriptions checked`);

    const stats = getTransactionStats();

    return NextResponse.json({
      success: true,
      message: `Processed ${activeUsers} active users, ${totalSubs} subscriptions`,
      stats,
      results,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Cron error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}