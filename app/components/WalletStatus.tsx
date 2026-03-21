'use client';

import { useState, useEffect } from 'react';

interface WalletData {
  address: string;
  balance: {
    balances?: {
      USDT: string;
    };
  };
}

export default function WalletStatus() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/wallet/balance');
      const data = await res.json();
      
      if (data.success) {
        setWallet(data);
      } else {
        setError(data.error || 'Failed to fetch wallet');
      }
    } catch (error) {
      console.error('Failed to fetch wallet:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const createWallet = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/wallet/create', {
        method: 'POST'
      });
      const data = await res.json();
      
      if (data.success) {
        await fetchWallet();
      } else {
        setError(data.error || 'Failed to create wallet');
      }
    } catch (error) {
      console.error('Failed to create wallet:', error);
      setError('Failed to create wallet. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
        <span>💰</span> Wallet Status
      </h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      
      {wallet ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Address</p>
            <p className="font-mono text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg break-all border border-gray-200 dark:border-gray-700">
              {wallet.address}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Balance (USDT)</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {wallet.balance.balances?.USDT || '0.00'} USDT
            </p>
          </div>

          <div className="pt-2">
            <a 
              href={`https://sepolia.etherscan.io/address/${wallet.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-sm flex items-center gap-1 transition-colors"
            >
              View on Etherscan
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No wallet found</p>
          <button
            onClick={createWallet}
            disabled={creating}
            className="btn btn-primary w-full sm:w-auto"
          >
            {creating ? 'Creating...' : 'Create Wallet'}
          </button>
        </div>
      )}
    </div>
  );
}