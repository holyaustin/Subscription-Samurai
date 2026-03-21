'use client';

import { useState, useEffect } from 'react';

interface Transaction {
  type: 'success' | 'failed' | 'error';
  txId?: string;
  recipient: string;
  amount: number;
  timestamp: string;
  reason?: string;
  error?: string;
}

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
    // Refresh every 30 seconds
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/agent/history');
      const data = await res.json();
      if (data.success) {
        setTransactions(data.history.transactions || []);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
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
      <h2 className="text-xl font-semibold mb-4 text-gray-800">📜 Transaction History</h2>
      
      {transactions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No transactions yet</p>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx, index) => (
            <div
              key={index}
              className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="text-xl">{getStatusIcon(tx.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="font-medium">
                      {tx.amount} USDT → {tx.recipient.slice(0, 6)}...{tx.recipient.slice(-4)}
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
                      View transaction →
                    </a>
                  )}
                  
                  {(tx.type === 'failed' || tx.type === 'error') && (
                    <p className="text-xs text-red-500 mt-1">
                      {tx.reason || tx.error}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}