import { NextRequest, NextResponse } from 'next/server';
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import { userStates, addTransaction, getTransactionStats, type UserAgentState, type Subscription } from '@/app/lib/agentStore';

// USDT Contract Address on Sepolia
const USDT_CONTRACT_ADDRESS = process.env.USDT_CONTRACT_ADDRESS || '0xd077a400968890eacc75cdc901f0356c943e4fdb';

// ERC-20 ABI for transfer function
const ERC20_ABI = [
  {
    "constant": false,
    "inputs": [
      { "name": "_to", "type": "address" },
      { "name": "_value", "type": "uint256" }
    ],
    "name": "transfer",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "type": "function"
  }
];

// Helper to get USDT balance
async function getUSDTBalance(account: any, walletAddress: string): Promise<number> {
  try {
    // Get the contract interface
    const contract = account.getContract(USDT_CONTRACT_ADDRESS, ERC20_ABI);
    const balanceWei = await contract.balanceOf(walletAddress);
    // USDT has 6 decimals (not 18 like ETH)
    const decimals = 6;
    const balance = Number(balanceWei) / 10 ** decimals;
    return balance;
  } catch (error) {
    console.error('Failed to get USDT balance:', error);
    return 0;
  }
}

// Helper to send USDT
async function sendUSDT(account: any, toAddress: string, amount: number): Promise<any> {
  // USDT has 6 decimals
  const decimals = 6;
  const amountWithDecimals = BigInt(Math.floor(amount * 10 ** decimals));
  
  // Get the contract interface
  const contract = account.getContract(USDT_CONTRACT_ADDRESS, ERC20_ABI);
  
  // Call transfer function on USDT contract
  const tx = await contract.transfer(toAddress, amountWithDecimals);
  
  return tx;
}

// Helper to get native ETH balance
async function getETHBalance(account: any): Promise<number> {
  const balanceWei = await account.getBalance();
  return Number(balanceWei) / 1e18;
}

// Helper to process a single user's subscriptions
async function processUserSubscriptions(state: UserAgentState) {
  const { address, mnemonic, subscriptions } = state;
  const now = new Date();
  const results = [];

  // Initialize WDK for this user
  const provider = process.env.RPC_URL || 'https://ethereum-sepolia-public.nodies.app';
  const wdk = new WDK(mnemonic).registerWallet('ethereum', WalletManagerEvm, { provider });
  const account = await wdk.getAccount('ethereum', 0);
  
  // Get both ETH and USDT balances
  const ethBalance = await getETHBalance(account);
  const usdtBalance = await getUSDTBalance(account, address);
  
  console.log(`🔍 Processing ${subscriptions.length} subscriptions for ${address}`);
  console.log(`   ETH Balance: ${ethBalance.toFixed(4)} ETH`);
  console.log(`   USDT Balance: ${usdtBalance.toFixed(2)} USDT`);

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
      // Check if sufficient USDT balance (not ETH)
      if (usdtBalance < sub.amount) {
        console.log(`❌ Insufficient USDT balance for ${sub.recipient}: ${usdtBalance.toFixed(2)} < ${sub.amount}`);
        
        // Record FAILED transaction
        addTransaction({
          type: 'failed',
          recipient: sub.recipient,
          amount: sub.amount,
          frequency: sub.frequency,
          reason: `Insufficient USDT balance: ${usdtBalance.toFixed(2)} USDT < ${sub.amount} USDT (ETH balance: ${ethBalance.toFixed(4)} ETH)`,
          timestamp: now.toISOString()
        });
        results.push({ sub, success: false, reason: 'insufficient USDT balance' });
        continue;
      }

      try {
        console.log(`💸 Sending ${sub.amount} USDT to ${sub.recipient}...`);
        
        // Send USDT (ERC-20 token)
        const tx = await sendUSDT(account, sub.recipient, sub.amount);
        
        console.log(`✅ USDT Transaction sent: ${tx.hash}`);
        
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

  return { 
    address, 
    results, 
    processedAt: now.toISOString(), 
    balances: {
      eth: ethBalance,
      usdt: usdtBalance
    }
  };
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