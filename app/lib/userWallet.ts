/**
 * app/lib/userWallet.ts
 *
 * Client-side wallet management.
 *
 * Each user's mnemonic is stored in their own browser localStorage.
 * It never touches the server's environment variables.
 * This gives every user their own self-custodial WDK wallet.
 *
 * Security model:
 * - Mnemonic stored in localStorage (client-side only, never sent to server logs)
 * - Sent over HTTPS in request body when needed for signing/balance queries
 * - Server never persists it — uses it only for the duration of the API call
 * - User can export/backup their mnemonic from the UI
 */

const STORAGE_KEY = 'subscription_samurai_wallet';

export interface StoredWallet {
  mnemonic: string;
  address: string;
  createdAt: string;
}

/** Save wallet to localStorage */
export function saveWallet(wallet: StoredWallet): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet));
}

/** Load wallet from localStorage */
export function loadWallet(): StoredWallet | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredWallet;
  } catch {
    return null;
  }
}

/** Clear wallet from localStorage */
export function clearWallet(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

/** Check if user has a wallet */
export function hasWallet(): boolean {
  return loadWallet() !== null;
}