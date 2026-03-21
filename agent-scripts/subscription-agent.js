const cron = require('node-cron');
const { WDK } = require('@tetherto/wdk');
const { WalletEvm } = require('@tetherto/wdk-wallet-evm');
const fs = require('fs').promises;
const path = require('path');

// Load environment
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// Store for subscriptions and history
const DATA_DIR = path.join(__dirname, '../data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const CONFIG_FILE = path.join(DATA_DIR, 'subscriptions.json');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    // Directory exists
  }
}

// Load subscriptions
async function loadSubscriptions() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { subscriptions: [] };
  }
}

// Save transaction history
async function saveTransaction(transaction) {
  try {
    let history = { transactions: [] };
    try {
      const data = await fs.readFile(HISTORY_FILE, 'utf8');
      history = JSON.parse(data);
    } catch (error) {
      // File doesn't exist
    }
    
    history.transactions.unshift(transaction);
    await fs.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('Failed to save transaction:', error);
  }
}

// Process subscription payments
async function processSubscriptions() {
  console.log('🤖 Agent checking subscriptions...', new Date().toISOString());
  
  try {
    await ensureDataDir();
    
    // Initialize WDK
    const wdk = new WDK();
    wdk.registerWallet('evm', new WalletEvm({
      network: process.env.NETWORK || 'sepolia'
    }));

    // Restore wallet
    const wallet = await wdk.fromMnemonic(process.env.WALLET_MNEMONIC);
    const account = await wallet.getAccount(0);
    const address = await account.getAddress();

    // Check balance first
    const balanceResponse = await fetch(
      `${process.env.INDEXER_API_URL}/balances?address=${address}&token=USDT`
    );
    const balanceData = await balanceResponse.json();
    const currentBalance = parseFloat(balanceData.balances?.USDT || '0');

    console.log(`💰 Current balance: ${currentBalance} USDT`);

    // Load subscriptions
    const { subscriptions } = await loadSubscriptions();

    for (const sub of subscriptions) {
      if (!sub.active) continue;

      const now = new Date();
      const lastPayment = sub.lastPayment ? new Date(sub.lastPayment) : new Date(0);
      const nextPaymentDue = new Date(lastPayment);
      
      // Calculate next payment based on frequency
      switch (sub.frequency) {
        case 'daily':
          nextPaymentDue.setDate(nextPaymentDue.getDate() + 1);
          break;
        case 'weekly':
          nextPaymentDue.setDate(nextPaymentDue.getDate() + 7);
          break;
        case 'monthly':
          nextPaymentDue.setMonth(nextPaymentDue.getMonth() + 1);
          break;
      }

      // Check if payment is due
      if (now >= nextPaymentDue) {
        console.log(`📅 Payment due for ${sub.recipient}: ${sub.amount} USDT`);

        // Check if sufficient balance
        if (currentBalance < sub.amount) {
          console.log(`❌ Insufficient balance for ${sub.recipient}`);
          await saveTransaction({
            type: 'failed',
            recipient: sub.recipient,
            amount: sub.amount,
            reason: 'insufficient_balance',
            timestamp: now.toISOString()
          });
          continue;
        }

        try {
          // Execute payment using WDK
          const tx = await account.transfer({
            to: sub.recipient,
            amount: sub.amount.toString(),
            token: 'USDT'
          });

          const result = await tx.send();

          // Update subscription
          sub.lastPayment = now.toISOString();
          
          // Save successful transaction
          await saveTransaction({
            type: 'success',
            txId: result.hash,
            recipient: sub.recipient,
            amount: sub.amount,
            timestamp: now.toISOString()
          });

          console.log(`✅ Payment sent! TX: ${result.hash}`);
        } catch (error) {
          console.error(`❌ Payment failed for ${sub.recipient}:`, error);
          await saveTransaction({
            type: 'error',
            recipient: sub.recipient,
            amount: sub.amount,
            error: error.message,
            timestamp: now.toISOString()
          });
        }
      }
    }

    // Save updated subscriptions
    await fs.writeFile(CONFIG_FILE, JSON.stringify({ subscriptions }, null, 2));

  } catch (error) {
    console.error('❌ Agent error:', error);
  }
}

// Initialize and start agent
async function startAgent() {
  console.log('🚀 Subscription Agent Starting...');
  
  // Process immediately on start
  await processSubscriptions();

  // Schedule based on environment variable or default to every 5 minutes
  const schedule = process.env.AGENT_CHECK_INTERVAL || '*/5 * * * *';
  
  cron.schedule(schedule, async () => {
    await processSubscriptions();
  });

  console.log(`⏰ Agent scheduled with pattern: ${schedule}`);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Agent shutting down...');
  process.exit();
});

// Start if run directly
if (require.main === module) {
  startAgent();
}

module.exports = { startAgent, processSubscriptions };