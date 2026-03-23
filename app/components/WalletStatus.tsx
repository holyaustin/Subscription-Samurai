'use client';

import { useState, useEffect, useRef } from 'react';
import { saveWallet, loadWallet, clearWallet, type StoredWallet } from '@/app/lib/userWallet';

interface BalanceData {
  address: string;
  balance: {
    balances: { ETH: string; USDT: string };
  };
}

const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://sepolia.etherscan.io';

export default function WalletStatus() {
  const [wallet, setWallet] = useState<StoredWallet | null>(null);
  const [balances, setBalances] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importPhrase, setImportPhrase] = useState('');
  const [copied, setCopied] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // On mount: load wallet from localStorage
  useEffect(() => {
    const stored = loadWallet();
    if (stored) {
      setWallet(stored);
      fetchBalances(stored.mnemonic);
    } else {
      setLoading(false);
    }
  }, []);

  // Auto-refresh balances every 30s
  useEffect(() => {
    if (!wallet) return;
    const id = setInterval(() => fetchBalances(wallet.mnemonic, true), 30_000);
    return () => clearInterval(id);
  }, [wallet?.mnemonic]);

  const fetchBalances = async (mnemonic: string, isRefresh = false) => {
    if (!mountedRef.current) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // POST the mnemonic so server can derive the address and fetch balances
      const res = await fetch('/api/wallet/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mnemonic }),
        cache: 'no-store',
      });

      const data = await res.json();
      if (!mountedRef.current) return;

      if (data.success) {
        setBalances(data);
        setLastUpdated(new Date());

        // Update stored address if it changed
        const stored = loadWallet();
        if (stored && stored.address !== data.address) {
          saveWallet({ ...stored, address: data.address });
          setWallet({ ...stored, address: data.address });
        }
      } else {
        setError(data.error || 'Failed to fetch balance');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError('Could not reach server');
    } finally {
      if (mountedRef.current) { setLoading(false); setRefreshing(false); }
    }
  };

  const createWallet = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/wallet/create', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        const newWallet: StoredWallet = {
          mnemonic: data.mnemonic,
          address: data.address,
          createdAt: new Date().toISOString(),
        };
        saveWallet(newWallet);
        setWallet(newWallet);
        setShowMnemonic(true); // Force user to see the backup warning
        await fetchBalances(data.mnemonic);
      } else {
        setError(data.error || 'Failed to create wallet');
      }
    } catch (err) {
      setError('Failed to create wallet');
    } finally {
      setCreating(false);
    }
  };

  const importWallet = async () => {
    const phrase = importPhrase.trim();
    if (!phrase || phrase.split(' ').length < 12) {
      setError('Please enter a valid 12-word seed phrase');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      // Derive address from the provided mnemonic
      const res = await fetch('/api/wallet/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mnemonic: phrase }),
      });
      const data = await res.json();

      if (data.success) {
        const imported: StoredWallet = {
          mnemonic: phrase,
          address: data.address,
          createdAt: new Date().toISOString(),
        };
        saveWallet(imported);
        setWallet(imported);
        setBalances(data);
        setLastUpdated(new Date());
        setShowImport(false);
        setImportPhrase('');
      } else {
        setError(data.error || 'Invalid seed phrase');
      }
    } catch {
      setError('Failed to import wallet');
    } finally {
      setCreating(false);
    }
  };

  const forgetWallet = () => {
    if (confirm('Remove wallet from this browser? Make sure you have backed up your seed phrase.')) {
      clearWallet();
      setWallet(null);
      setBalances(null);
      setLastUpdated(null);
    }
  };

  const copyMnemonic = async () => {
    if (!wallet?.mnemonic) return;
    await navigator.clipboard.writeText(wallet.mnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Loading skeleton ────────────────────────────────────────────────────────
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

  // ── Wallet exists ───────────────────────────────────────────────────────────
  if (wallet && balances) {
    const eth  = balances.balance?.balances?.ETH  ?? '0.0000';
    const usdt = balances.balance?.balances?.USDT ?? '0.000000';
    const hasUsdt = parseFloat(usdt) > 0;

    return (
      <div className="card space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
            <span>💰</span> My Wallet
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={() => fetchBalances(wallet.mnemonic, true)} disabled={refreshing}
              title="Refresh" className="text-gray-400 hover:text-gray-600 disabled:opacity-40">
              <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}

        {/* Mnemonic backup warning (shown after creation) */}
        {showMnemonic && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-2">
            <p className="text-xs font-bold text-amber-800">⚠️ Back up your seed phrase NOW</p>
            <p className="text-xs text-amber-700">
              This is the only way to recover your wallet. Write it down and store it safely.
              It is stored in your browser — clearing browser data will lose access.
            </p>
            <div className="bg-white border border-amber-200 rounded p-2 flex items-center gap-2">
              <code className="text-xs text-gray-800 flex-1 break-all select-all">{wallet.mnemonic}</code>
              <button onClick={copyMnemonic}
                className="text-xs bg-amber-500 text-white px-2 py-1 rounded hover:bg-amber-600 shrink-0">
                {copied ? '✅' : 'Copy'}
              </button>
            </div>
            <button onClick={() => setShowMnemonic(false)}
              className="text-xs text-amber-700 underline">
              I've saved my seed phrase
            </button>
          </div>
        )}

        {/* Address */}
        <div>
          <p className="text-xs font-medium text-gray-300 mb-1 uppercase tracking-wide">Address</p>
          <p className="font-mono text-xs bg-gray-50 p-2 rounded-lg break-all border border-gray-200 select-all text-gray-900">
            {balances.address}
          </p>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
            <p className="text-xs font-medium text-blue-600 mb-1">ETH</p>
            <p className="text-xl font-bold text-blue-700 tabular-nums">{eth}</p>
            <p className="text-xs text-blue-500">ETH</p>
          </div>
          <div className={`rounded-xl p-3 border ${hasUsdt ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
            <p className={`text-xs font-medium mb-1 ${hasUsdt ? 'text-green-600' : 'text-gray-500'}`}>USDT</p>
            <p className={`text-xl font-bold tabular-nums ${hasUsdt ? 'text-green-800' : 'text-gray-400'}`}>
              {parseFloat(usdt).toFixed(2)}
            </p>
            <p className={`text-xs ${hasUsdt ? 'text-green-500' : 'text-gray-400'}`}>USDT</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          {lastUpdated && (
            <p className="text-xs text-gray-400">
              Updated {lastUpdated.toLocaleTimeString()}{refreshing && ' · refreshing…'}
            </p>
          )}
          <a href={`${EXPLORER_URL}/address/${balances.address}`}
            target="_blank" rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 text-xs ml-auto">
            Etherscan ↗
          </a>
        </div>

        {/* Wallet actions */}
        <div className="flex gap-2 pt-1 border-t border-gray-100">
          <button onClick={() => setShowMnemonic(!showMnemonic)}
            className="text-xs text-gray-500 hover:text-gray-700 underline">
            {showMnemonic ? 'Hide' : 'Show'} seed phrase
          </button>
          <span className="text-gray-300">|</span>
          <button onClick={forgetWallet}
            className="text-xs text-red-400 hover:text-red-600 underline">
            Forget wallet
          </button>
        </div>
      </div>
    );
  }

  // ── No wallet yet ───────────────────────────────────────────────────────────
  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 flex items-center gap-2">
        <span>💰</span> Wallet
      </h2>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-3">{error}</p>}

      {/* Import existing wallet */}
      {showImport ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Enter your 12-word seed phrase:</p>
          <textarea
            value={importPhrase}
            onChange={(e) => setImportPhrase(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="word1 word2 word3 ... word12"
          />
          <div className="flex gap-2">
            <button onClick={importWallet} disabled={creating}
              className="btn btn-primary flex-1 text-sm">
              {creating ? 'Importing…' : 'Import Wallet'}
            </button>
            <button onClick={() => { setShowImport(false); setImportPhrase(''); setError(null); }}
              className="btn flex-1 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 space-y-4">
          <div className="text-4xl">🔐</div>
          <div>
            <p className="text-gray-700 font-medium mb-1">No wallet in this browser</p>
            <p className="text-xs text-gray-400">
              Create a new wallet or import an existing one.<br />
              Your keys stay in your browser — fully self-custodial.
            </p>
          </div>
          <div className="space-y-2">
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
              ) : '🔑 Create New Wallet'}
            </button>
            <button onClick={() => setShowImport(true)}
              className="btn w-full bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm">
              📥 Import Existing Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}