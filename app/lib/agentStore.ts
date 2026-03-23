/**
 * app/lib/agentStore.ts
 *
 * Shared in-memory store for all agent state.
 * Imported by both /api/agent/start and /api/agent/cron routes.
 *
 * Must live in a separate module — Next.js route files can only
 * export HTTP method handlers (GET, POST, DELETE, etc.).
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

// Keyed by wallet address — each user has their own state
export const userStates = new Map<string, UserAgentState>();

// Global transaction history (all users, newest first)
const transactions: Transaction[] = [];

export function addTransaction(tx: Transaction): void {
  transactions.unshift(tx);
  if (transactions.length > 200) transactions.splice(200);
}

export function getTransactions(): Transaction[] {
  return transactions;
}