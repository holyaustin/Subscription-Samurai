'use client';

import { useState } from 'react';
import WalletStatus from './WalletStatus';
import SubscriptionForm, { type Subscription, type Frequency } from './SubscriptionForm';
import TransactionHistory from './TransactionHistory';
import { loadWallet } from '@/app/lib/userWallet';

export default function Dashboard() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  const handleSubscribe = (sub: Subscription) => {
    setSubscriptions((prev) => [...prev, sub]);
  };

  const removeSubscription = (index: number) => {
    setSubscriptions((prev) => prev.filter((_, i) => i !== index));
  };

  const startAgent = async () => {
    setStarting(true);
    setAgentError(null);

    // Get the user's mnemonic from localStorage
    const stored = loadWallet();
    if (!stored?.mnemonic) {
      setAgentError('Please create a wallet first');
      setStarting(false);
      return;
    }

    try {
      const res = await fetch('/api/agent/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send mnemonic so the server can identify and process this user's subscriptions
        body: JSON.stringify({ mnemonic: stored.mnemonic, subscriptions }),
      });
      const data = await res.json();
      if (data.success) {
        setAgentRunning(true);
      } else {
        setAgentError(data.error || 'Failed to start agent');
      }
    } catch {
      setAgentError('Could not reach the server.');
    } finally {
      setStarting(false);
    }
  };

  const stopAgent = async () => {
    const stored = loadWallet();
    try {
      await fetch('/api/agent/start', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mnemonic: stored?.mnemonic }),
      });
      setAgentRunning(false);
    } catch (err) {
      console.error('Failed to stop agent:', err);
    }
  };

  const frequencyLabel: Record<Frequency, string> = {
    every_minute: '1 min', every_5_minutes: '5 min', every_10_minutes: '10 min',
    every_30_minutes: '30 min', hourly: 'hourly', daily: 'daily',
    weekly: 'weekly', monthly: 'monthly', yearly: 'yearly',
  };

  const noSubscriptions = subscriptions.length === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">

        {/* Header */}
        <div className="text-center mb-8 lg:mb-12 animate-slide-up">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3">
            <span className="text-gradient">🤖 The Subscription Samurai</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base max-w-2xl mx-auto">
            Autonomous recurring payments powered by Tether WDK
          </p>
        </div>

        {/* Agent Control Card */}
        <div className="card mb-6 lg:mb-8 overflow-hidden">
          <div className={`p-4 sm:p-6 rounded-xl ${
            agentRunning
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20'
              : 'bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20'
          }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`status-dot ${agentRunning ? 'status-dot-active' : 'status-dot-inactive'}`} />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Agent Status: {agentRunning ? 'Running' : 'Stopped'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {agentRunning
                      ? 'Monitoring and processing your subscriptions'
                      : noSubscriptions
                        ? '👇 Add a subscription below, then start the agent'
                        : `${subscriptions.length} subscription${subscriptions.length > 1 ? 's' : ''} ready`}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full sm:w-auto">
                {!agentRunning ? (
                  <>
                    <button onClick={startAgent} disabled={starting || noSubscriptions}
                      className="btn btn-primary w-full sm:w-auto disabled:cursor-not-allowed">
                      {starting ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Starting…
                        </span>
                      ) : '🚀 Start Agent'}
                    </button>
                    {noSubscriptions && (
                      <p className="text-xs text-amber-600 text-center">
                        ⚠️ Add a subscription below to enable
                      </p>
                    )}
                  </>
                ) : (
                  <button onClick={stopAgent} className="btn btn-danger w-full sm:w-auto">
                    ⏹️ Stop Agent
                  </button>
                )}
              </div>
            </div>

            {agentError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">❌ {agentError}</p>
              </div>
            )}

            {subscriptions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-500 mb-2">Active Subscriptions:</p>
                <div className="flex flex-wrap gap-2">
                  {subscriptions.map((sub, i) => (
                    <div key={i} className="badge text-xs flex items-center gap-1.5">
                      <span>{sub.amount} USDT · {frequencyLabel[sub.frequency]} · {sub.recipient.slice(0, 6)}…</span>
                      {!agentRunning && (
                        <button onClick={() => removeSubscription(i)}
                          className="text-gray-400 hover:text-red-500 ml-0.5">×</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="space-y-6 lg:col-span-1">
            <WalletStatus />
            <SubscriptionForm onSubscribe={handleSubscribe} />
          </div>
          <div className="lg:col-span-2">
            <TransactionHistory />
          </div>
        </div>

        {/* Quick Start */}
        <div className="mt-8 card bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
          <div className="p-4 sm:p-6">
            <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
              <span>🎯</span> Quick Start Guide
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-sm">
              {[
                { step: '1', text: 'Create your wallet' },
                { step: '2', text: 'Fund with USDT + ETH' },
                { step: '3', text: 'Add subscriptions below' },
                { step: '4', text: 'Click Start Agent' },
                { step: '5', text: 'Agent pays automatically!' },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-start gap-2">
                  <span className="text-yellow-600 font-bold shrink-0">{step}.</span>
                  <span className="text-yellow-700">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}