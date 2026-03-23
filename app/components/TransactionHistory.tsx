'use client';

import { useState, useEffect } from 'react';

// Define types locally to avoid import issues
interface Transaction {
  type: 'success' | 'failed' | 'error';
  txId?: string;
  recipient: string;
  amount: number;
  timestamp: string;
  reason?: string;
  error?: string;
}

interface Stats {
  total: number;
  success: number;
  failed: number;
  error: number;
  totalAmount: number;
}

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
    
    // Refresh every 30 seconds if auto-refresh is on
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchHistory, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchHistory = async () => {
    try {
      setError(null);
      const res = await fetch('/api/agent/history');
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      
      if (data.success) {
        setTransactions(data.history?.transactions || []);
        if (data.history?.stats) {
          setStats(data.history.stats);
        }
      } else {
        setError(data.error || 'Failed to fetch history');
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
      setError(error instanceof Error ? error.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'failed':
        return '❌';
      case 'error':
        return '⚠️';
      default:
        return '🔄';
    }
  };

  const getStatusColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'error':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-semibold text-gray-800">📜 Transaction History</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            Auto-refresh
          </label>
          <button
            onClick={fetchHistory}
            className="text-sm text-blue-500 hover:text-blue-600 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      
      {/* Stats Summary */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 p-3 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.success}</div>
            <div className="text-xs text-gray-500">Success</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-500">{stats.failed + stats.error}</div>
            <div className="text-xs text-gray-500">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalAmount.toFixed(2)}</div>
            <div className="text-xs text-gray-500">USDT Sent</div>
          </div>
        </div>
      )}
      
      {transactions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No transactions yet.</p>
          <p className="text-sm text-gray-400 mt-1">
            {stats?.total === 0 ? 'Start the agent to see payments.' : 'Waiting for agent to process...'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {transactions.map((tx, index) => (
            <div
              key={index}
              className={`border rounded-lg p-3 transition-colors ${getStatusColor(tx.type)} border-opacity-20`}
            >
              <div className="flex items-start gap-3">
                <div className="text-xl">{getStatusIcon(tx.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <p className="font-medium">
                      {tx.amount.toFixed(2)} USDT → {tx.recipient.slice(0, 6)}...{tx.recipient.slice(-4)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(tx.timestamp).toLocaleString()}
                    </p>
                  </div>
                  
                  {tx.type === 'success' && tx.txId && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${tx.txId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-600 mt-1 inline-block"
                    >
                      View on Etherscan →
                    </a>
                  )}
                  
                  {(tx.type === 'failed' || tx.type === 'error') && (
                    <p className="text-xs text-red-600 mt-1">
                      {tx.reason || tx.error}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Footer with info */}
      {transactions.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400 text-center">
          Showing last {transactions.length} transactions
        </div>
      )}
    </div>
  );
}