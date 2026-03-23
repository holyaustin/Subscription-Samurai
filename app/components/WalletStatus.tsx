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

interface CreateResponse {
  success: boolean;
  address?: string;
  message?: string;
  error?: string;
  vercel_action_required?: boolean;
  instructions?: string[];
  WALLET_MNEMONIC?: string;
}

const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://sepolia.etherscan.io';

export default function WalletStatus() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [vercelSetup, setVercelSetup] = useState<CreateResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchWallet = async (isRefresh = false) => {
    if (!mountedRef.current) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/wallet/balance', { cache: 'no-store' });
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        setError(`Server error (${res.status}) — check Vercel logs`);
        return;
      }
      const data = await res.json();
      if (!mountedRef.current) return;
      if (data.success) {
        setWallet(data);
        setLastUpdated(new Date());
      } else {
        setWallet(null);
        setError(data.error ?? 'Failed to fetch wallet');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError('Could not reach the server.');
    } finally {
      if (mountedRef.current) { setLoading(false); setRefreshing(false); }
    }
  };

  useEffect(() => { fetchWallet(); }, []);
  useEffect(() => {
    if (!wallet) return;
    const id = setInterval(() => fetchWallet(true), 30_000);
    return () => clearInterval(id);
  }, [wallet?.address]);

  const createWallet = async () => {
    setCreating(true);
    setError(null);
    setVercelSetup(null);
    try {
      const res = await fetch('/api/wallet/create', { method: 'POST' });
      const data: CreateResponse = await res.json();

      if (data.vercel_action_required) {
        // Show the Vercel setup instructions instead of normal flow
        setVercelSetup(data);
      } else if (data.success) {
        await fetchWallet();
      } else {
        setError(data.error ?? 'Failed to create wallet');
      }
    } catch (err) {
      setError('Failed to create wallet. Check the logs.');
    } finally {
      setCreating(false);
    }
  };

  const copyMnemonic = async () => {
    if (!vercelSetup?.WALLET_MNEMONIC) return;
    await navigator.clipboard.writeText(vercelSetup.WALLET_MNEMONIC);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-gray-200 rounded-xl" />
            <div className="h-20 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // ── Vercel setup instructions ──────────────────────────────────────────────
  if (vercelSetup?.vercel_action_required) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">💰 Wallet Setup</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-800">
            ✅ Wallet address generated: <span className="font-mono">{vercelSetup.address}</span>
          </p>
          <p className="text-sm text-blue-700 font-medium">
            One-time setup required for Vercel:
          </p>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            {vercelSetup.instructions?.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>

          {/* Mnemonic copy box */}
          <div className="mt-3">
            <p className="text-xs font-medium text-blue-800 mb-1">
              WALLET_MNEMONIC value (copy this):
            </p>
            <div className="bg-white border border-blue-300 rounded p-2 flex items-center gap-2">
              <code className="text-xs text-gray-800 flex-1 break-all">
                {vercelSetup.WALLET_MNEMONIC}
              </code>
              <button
                onClick={copyMnemonic}
                className="shrink-0 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors"
              >
                {copied ? '✅ Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-red-600 mt-1">
              ⚠️ Save this phrase securely — it controls your wallet funds.
            </p>
          </div>

          <button
            onClick={() => { setVercelSetup(null); fetchWallet(); }}
            className="w-full text-sm bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors mt-2"
          >
            I've added it to Vercel → Check wallet
          </button>
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <span>💰</span> Wallet Status
          </h2>
          <div className="flex items-center gap-2">
            <a href="/api/wallet/debug" target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-gray-600 underline">debug</a>
            <button onClick={() => fetchWallet(true)} disabled={refreshing}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40">
              <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Wallet Address</p>
            <p className="font-mono text-xs bg-gray-50 p-3 rounded-lg break-all border border-gray-200 select-all cursor-text text-gray-800">
              {wallet.address}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
              <p className="text-xs font-medium text-blue-600 mb-1">ETH (Sepolia)</p>
              <p className="text-xl font-bold text-blue-700 leading-tight tabular-nums">{ethBalance}</p>
              <p className="text-xs text-blue-500 mt-0.5">ETH</p>
            </div>
            <div className={`rounded-xl p-3 border ${hasUsdt ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
              <p className={`text-xs font-medium mb-1 ${hasUsdt ? 'text-green-600' : 'text-gray-500'}`}>USDT (Sepolia)</p>
              <p className={`text-xl font-bold leading-tight tabular-nums ${hasUsdt ? 'text-green-700' : 'text-gray-400'}`}>
                {parseFloat(usdtBalance).toFixed(2)}
              </p>
              <p className={`text-xs mt-0.5 ${hasUsdt ? 'text-green-500' : 'text-gray-400'}`}>USDT</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
            {lastUpdated && (
              <p className="text-xs text-gray-400">
                Updated {lastUpdated.toLocaleTimeString()}{refreshing && ' · refreshing…'}
              </p>
            )}
            <a href={`${EXPLORER_URL}/address/${wallet.address}`} target="_blank" rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 text-xs flex items-center gap-1 ml-auto">
              Sepolia Etherscan ↗
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── No wallet ──────────────────────────────────────────────────────────────
  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 flex items-center gap-2">
        <span>💰</span> Wallet Status
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
          <a href="/api/wallet/debug" target="_blank" rel="noopener noreferrer"
            className="text-xs text-blue-500 underline mt-1 block">
            Open diagnostic report →
          </a>
        </div>
      )}

      <div className="text-center py-8">
        <div className="text-4xl mb-3">🔐</div>
        <p className="text-gray-700 mb-1 font-medium">No wallet found</p>
        <p className="text-xs text-gray-400 mb-5">
          Create a wallet to get a Sepolia address<br />and start managing subscriptions.
        </p>
        <button onClick={createWallet} disabled={creating} className="btn btn-primary w-full">
          {creating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Creating…
            </span>
          ) : '🔑 Create Wallet'}
        </button>
      </div>
    </div>
  );
}