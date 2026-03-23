/**
 * app/lib/store.ts
 *
 * In-memory store for agent state, subscriptions, and transaction history.
 *
 * Replaces all file system reads/writes (data/subscriptions.json,
 * data/history.json, data/agent-state.json) which fail on Vercel
 * with EROFS: read-only file system errors.
 *
 * On Vercel: data lives in memory for the duration of the serverless
 * function instance. This is fine for a hackathon demo.
 *
 * Locally: same behaviour — the standalone agent script still uses
 * files directly since it runs as a long-lived Node process.
 */

export interface Subscription {
  recipient: string;
  amount: number;
  frequency: string;
  active: boolean;
  lastPayment: string | null;
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

export interface AgentState {
  active: boolean;
  subscriptions: Subscription[];
  startedAt: string | null;
}

// ── Module-level state ────────────────────────────────────────────────────────
// On Vercel these persist across requests within the same function instance.

const state: AgentState = {
  active: false,
  subscriptions: [],
  startedAt: null,
};

const transactions: Transaction[] = [];

// ── Agent state ───────────────────────────────────────────────────────────────

export function getAgentState(): AgentState {
  return state;
}

export function startAgent(subscriptions: Subscription[]): void {
  state.active = true;
  state.startedAt = new Date().toISOString();
  state.subscriptions = subscriptions.map(s => ({ ...s, lastPayment: s.lastPayment ?? null }));
}

export function stopAgent(): void {
  state.active = false;
}

export function isAgentActive(): boolean {
  return state.active;
}

export function getSubscriptions(): Subscription[] {
  return state.subscriptions;
}

export function updateSubscription(index: number, updates: Partial<Subscription>): void {
  if (state.subscriptions[index]) {
    state.subscriptions[index] = { ...state.subscriptions[index], ...updates };
  }
}

// ── Transaction history ───────────────────────────────────────────────────────

export function addTransaction(tx: Transaction): void {
  transactions.unshift(tx); // newest first
  // Keep max 100 transactions in memory
  if (transactions.length > 100) transactions.splice(100);
}

export function getTransactions(): Transaction[] {
  return transactions;
}