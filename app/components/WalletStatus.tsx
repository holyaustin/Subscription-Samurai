'use client';

import { useState, useEffect, useRef } from 'react';

interface WalletData {
  address: string;
  balance: {
    balances: {
      ETH: string;
      USDT: string;
    };
  };
}

const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://sepolia.etherscan.io';

export default function WalletStatus() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Track mount state to avoid setting state after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Core fetch ─────────────────────────────────────────────────────────────
  const fetchWallet = async (isRefresh = false) => {
    if (!mountedRef.current) return;

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/wallet/balance', {
        // Prevent browser from serving a stale cached response
        cache: 'no-store',
      });

      if (!mountedRef.current) return;

      // Guard against HTML error pages (means the API route crashed server-side)
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        setError(
          `Server error (HTTP ${res.status}) — open your terminal to see the crash reason, ` +
          'or visit /api/wallet/debug for a full diagnostic.'
        );
        return;
      }

      const data = await res.json();

      if (!mountedRef.current) return;

      if (data.success) {
        setWallet(data);
        setLastUpdated(new Date());
      } else {
        setWallet(null);
        setError(data.error ?? 'API returned success: false');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      // "Failed to fetch" means the dev server isn't up or the route threw before
      // responding — direct user to the debug endpoint
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Failed to fetch')) {
        setError(
          'Could not reach /api/wallet/balance. ' +
          'Make sure npm run dev is running and check the terminal for errors.'
        );
      } else {
        setError(msg);
      }
      console.error('[WalletStatus] fetchWallet error:', msg);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  // Initial load on mount
  useEffect(() => {
    fetchWallet();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh every 30 s — only starts AFTER the initial load succeeds
  useEffect(() => {
    if (!wallet) return; // don't poll if we have no wallet yet
    const id = setInterval(() => fetchWallet(true), 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.address]); // restart interval only if the address changes

  // ── Create wallet ──────────────────────────────────────────────────────────
  const createWallet = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/wallet/create', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchWallet();
      } else {
        setError(data.error ?? 'Failed to create wallet');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Failed to create wallet — check the terminal: ' + msg);
    } finally {
      setCreating(false);
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // ── Wallet loaded ──────────────────────────────────────────────────────────
  if (wallet) {
    const ethBalance  = wallet.balance?.balances?.ETH  ?? '0.0000';
    const usdtBalance = wallet.balance?.balances?.USDT ?? '0.000000';
    const hasUsdt = parseFloat(usdtBalance) > 0;

    return (
      <div className="card">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <span>💰</span> Wallet Status
          </h2>
          <div className="flex items-center gap-2">
            {/* Debug link — helpful during development */}
            <a
              href="/api/wallet/debug"
              target="_blank"
              rel="noopener noreferrer"
              title="Open debug report"
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
            >
              debug
            </a>
            {/* Refresh button */}
            <button
              onClick={() => fetchWallet(true)}
              disabled={refreshing}
              title="Refresh balances"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors disabled:opacity-40"
            >
              <svg
                className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Address */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
              Wallet Address
            </p>
            <p className="font-mono text-xs bg-gray-50 dark:bg-gray-800 p-3 rounded-lg break-all border border-gray-200 dark:border-gray-700 select-all cursor-text">
              {wallet.address}
            </p>
          </div>

          {/* Balance cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* ETH */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                ETH (Sepolia)
              </p>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300 leading-tight tabular-nums">
                {ethBalance}
              </p>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">ETH</p>
            </div>

            {/* USDT */}
            <div className={`rounded-xl p-3 border transition-colors ${
              hasUsdt
                ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800'
                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700'
            }`}>
              <p className={`text-xs font-medium mb-1 ${
                hasUsdt ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
              }`}>
                USDT (Sepolia)
              </p>
              <p className={`text-xl font-bold leading-tight tabular-nums ${
                hasUsdt ? 'text-green-700 dark:text-green-300' : 'text-gray-400 dark:text-gray-500'
              }`}>
                {parseFloat(usdtBalance).toFixed(2)}
              </p>
              <p className={`text-xs mt-0.5 ${
                hasUsdt ? 'text-green-500 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
              }`}>
                USDT
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
            {lastUpdated && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Updated {lastUpdated.toLocaleTimeString()}
                {refreshing && ' · refreshing…'}
              </p>
            )}
            <a
              href={`${EXPLORER_URL}/address/${wallet.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 text-xs flex items-center gap-1 ml-auto"
            >
              Sepolia Etherscan ↗
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── No wallet yet ──────────────────────────────────────────────────────────
  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
        <span>💰</span> Wallet Status
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <a
            href="/api/wallet/debug"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 underline mt-1 block"
          >
            Open diagnostic report →
          </a>
        </div>
      )}

      <div className="text-center py-8">
        <div className="text-4xl mb-3">🔐</div>
        <p className="text-gray-700 dark:text-gray-300 mb-1 font-medium">No wallet found</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
          Create a wallet to get a Sepolia address<br />and start managing subscriptions.
        </p>
        <button
          onClick={createWallet}
          disabled={creating}
          className="btn btn-primary w-full"
        >
          {creating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Creating wallet…
            </span>
          ) : (
            '🔑 Create Wallet'
          )}
        </button>
      </div>
    </div>
  );
}