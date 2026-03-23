/**
 * app/lib/agentStore.ts
 * 
 * Shared in-memory store for all agent state using globalThis
 * This ensures data persists across serverless function invocations
 * within the same instance (temporary fix for Vercel)
 */

export interface Subscription {
  recipient: string;
  amount: number;
  frequency: string;
  active: boolean;
  lastPayment: string | null;
}

export interface UserAgentState {
  active: boolean;
  mnemonic: string;
  address: string;
  subscriptions: Subscription[];
  startedAt: string;
}

export interface Transaction {
  type: 'success' | 'failed' | 'error';
  txId?: string;
  recipient: string;
  amount: number;
  frequency?: string;
  reason?: string;
  error?: string;
  feeWei?: string;
  timestamp: string;
}

export interface TransactionStats {
  total: number;
  success: number;
  failed: number;
  error: number;
  totalAmount: number;
}

// Use globalThis to persist across serverless function instances
const globalForAgentStore = globalThis as unknown as {
  userStates: Map<string, UserAgentState>;
  transactions: Transaction[];
};

// Initialize userStates if not exists
if (!globalForAgentStore.userStates) {
  globalForAgentStore.userStates = new Map<string, UserAgentState>();
}

// Initialize transactions array if not exists
if (!globalForAgentStore.transactions) {
  globalForAgentStore.transactions = [];
}

// Export the shared instances
export const userStates = globalForAgentStore.userStates;
export const transactions = globalForAgentStore.transactions;

/**
 * Add a transaction to the global store
 * Transactions are stored with newest first
 */
export function addTransaction(tx: Transaction): void {
  // Add to beginning of array (newest first)
  transactions.unshift(tx);
  
  // Keep only last 200 transactions to prevent memory issues
  if (transactions.length > 200) {
    transactions.pop();
  }
  
  // Optional: Log for debugging
  console.log(`📝 Transaction added: ${tx.type} - ${tx.amount} USDT to ${tx.recipient.slice(0, 8)}...`);
}

/**
 * Get all transactions (newest first)
 */
export function getTransactions(): Transaction[] {
  return transactions;
}

/**
 * Clear all transactions (useful for testing)
 */
export function clearTransactions(): void {
  transactions.length = 0;
  console.log('🗑️ All transactions cleared');
}

/**
 * Get transactions for a specific recipient
 */
export function getTransactionsByRecipient(recipient: string): Transaction[] {
  return transactions.filter(tx => 
    tx.recipient.toLowerCase() === recipient.toLowerCase()
  );
}

/**
 * Get recent transactions (last N)
 */
export function getRecentTransactions(limit: number = 50): Transaction[] {
  return transactions.slice(0, limit);
}

/**
 * Get transaction statistics
 */
export function getTransactionStats(): TransactionStats {
  const stats = {
    total: transactions.length,
    success: transactions.filter(tx => tx.type === 'success').length,
    failed: transactions.filter(tx => tx.type === 'failed').length,
    error: transactions.filter(tx => tx.type === 'error').length,
    totalAmount: transactions
      .filter(tx => tx.type === 'success')
      .reduce((sum, tx) => sum + tx.amount, 0)
  };
  return stats;
}