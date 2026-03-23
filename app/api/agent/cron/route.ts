import { NextRequest, NextResponse } from 'next/server';
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import { userStates, addTransaction, getTransactionStats, type UserAgentState, type Subscription } from '@/app/lib/agentStore';

// Helper to process a single user's subscriptions
async function processUserSubscriptions(state: UserAgentState) {
  const { address, mnemonic, subscriptions } = state;
  const now = new Date();
  const results = [];

  // Initialize WDK for this user
  const provider = process.env.RPC_URL || 'https://ethereum-sepolia-public.nodies.app';
  const wdk = new WDK(mnemonic).registerWallet('ethereum', WalletManagerEvm, { provider });
  const account = await wdk.getAccount('ethereum', 0);
  
  // Check current balance
  const balanceWei = await account.getBalance();
  const balance = Number(balanceWei) / 1e18;

  console.log(`🔍 Processing ${subscriptions.length} subscriptions for ${address} (balance: ${balance.toFixed(4)} USDT)`);

  for (const sub of subscriptions) {
    if (!sub.active) {
      console.log(`⏸️ Skipping inactive subscription for ${sub.recipient}`);
      continue;
    }

    const lastPayment = sub.lastPayment ? new Date(sub.lastPayment) : null;
    let shouldPay = false;

    // Check if payment is due
    if (!lastPayment) {
      shouldPay = true;
      console.log(`📅 First time payment due for ${sub.recipient}`);
    } else {
      const daysSinceLast = (now.getTime() - lastPayment.getTime()) / (1000 * 60 * 60 * 24);
      switch (sub.frequency) {
        case 'daily':
          shouldPay = daysSinceLast >= 1;
          break;
        case 'weekly':
          shouldPay = daysSinceLast >= 7;
          break;
        case 'monthly':
          shouldPay = daysSinceLast >= 30;
          break;
      }
      if (shouldPay) {
        console.log(`📅 Payment due for ${sub.recipient} (${daysSinceLast.toFixed(1)} days since last)`);
      }
    }

    if (shouldPay) {
      // Check if sufficient balance
      if (balance < sub.amount) {
        console.log(`❌ Insufficient balance for ${sub.recipient}: ${balance.toFixed(4)} < ${sub.amount}`);
        
        // Record FAILED transaction
        addTransaction({
          type: 'failed',
          recipient: sub.recipient,
          amount: sub.amount,
          frequency: sub.frequency,
          reason: `Insufficient balance: ${balance.toFixed(4)} USDT < ${sub.amount} USDT`,
          timestamp: now.toISOString()
        });
        results.push({ sub, success: false, reason: 'insufficient balance' });
        continue;
      }

      try {
        // Execute payment
        const value = BigInt(Math.floor(sub.amount * 1e18));
        console.log(`💸 Sending ${sub.amount} USDT to ${sub.recipient}...`);
        
        const tx = await account.sendTransaction({
          to: sub.recipient,
          value
        });
        
        console.log(`✅ Transaction sent: ${tx.hash}`);
        
        // Record SUCCESS transaction
        addTransaction({
          type: 'success',
          txId: tx.hash,
          recipient: sub.recipient,
          amount: sub.amount,
          frequency: sub.frequency,
          timestamp: now.toISOString()
        });
        
        // Update last payment date
        sub.lastPayment = now.toISOString();
        results.push({ sub, success: true, txHash: tx.hash });
        
      } catch (error) {
        // Record ERROR transaction
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Payment failed for ${sub.recipient}:`, errorMsg);
        
        addTransaction({
          type: 'error',
          recipient: sub.recipient,
          amount: sub.amount,
          frequency: sub.frequency,
          error: errorMsg,
          timestamp: now.toISOString()
        });
        results.push({ sub, success: false, error: errorMsg });
      }
    }
  }

  return { address, results, processedAt: now.toISOString(), balance };
}

export async function GET(request: NextRequest) {
  try {
    console.log('🕐 Cron job triggered at:', new Date().toISOString());
    
    // Verify secret (add CRON_SECRET to your .env.local)
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET;
    
    if (expectedSecret && secret !== expectedSecret) {
      console.warn('⚠️ Unauthorized cron attempt');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const results = [];
    let activeUsers = 0;
    
    // Process all active users
    for (const [address, state] of userStates.entries()) {
      if (state.active) {
        activeUsers++;
        console.log(`👤 Processing user: ${address} (started at ${state.startedAt})`);
        const result = await processUserSubscriptions(state);
        results.push(result);
      }
    }
    
    console.log(`✅ Cron completed: Processed ${activeUsers} active users, ${results.length} total results`);
    
    // Get transaction stats for response
    const stats = getTransactionStats();
    
    return NextResponse.json({
      success: true,
      message: `Processed ${activeUsers} active users`,
      stats,
      results
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Cron error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}