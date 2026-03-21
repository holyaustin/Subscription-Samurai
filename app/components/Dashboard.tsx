'use client';

import { useState } from 'react';
import WalletStatus from './WalletStatus';
import SubscriptionForm from './SubscriptionForm';
import TransactionHistory from './TransactionHistory';

interface Subscription {
  recipient: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  active: boolean;
}

export default function Dashboard() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [starting, setStarting] = useState(false);

  const handleSubscribe = (subscription: Subscription) => {
    setSubscriptions([...subscriptions, subscription]);
  };

  const startAgent = async () => {
    setStarting(true);
    try {
      const res = await fetch('/api/agent/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptions })
      });
      
      const data = await res.json();
      if (data.success) {
        setAgentRunning(true);
      }
    } catch (error) {
      console.error('Failed to start agent:', error);
    } finally {
      setStarting(false);
    }
  };

  const stopAgent = async () => {
    try {
      const res = await fetch('/api/agent/start', {
        method: 'DELETE'
      });
      
      const data = await res.json();
      if (data.success) {
        setAgentRunning(false);
      }
    } catch (error) {
      console.error('Failed to stop agent:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        {/* Header with gradient text */}
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
                      ? 'Actively monitoring and processing subscriptions' 
                      : 'Configure subscriptions and start the agent'}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 w-full sm:w-auto">
                {!agentRunning ? (
                  <button
                    onClick={startAgent}
                    disabled={starting || subscriptions.length === 0}
                    className="btn btn-primary w-full sm:w-auto"
                  >
                    {starting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Starting...
                      </>
                    ) : (
                      <>🚀 Start Agent</>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={stopAgent}
                    className="btn btn-danger w-full sm:w-auto"
                  >
                    ⏹️ Stop Agent
                  </button>
                )}
              </div>
            </div>

            {/* Subscriptions preview */}
            {subscriptions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Active Subscriptions:</p>
                <div className="flex flex-wrap gap-2">
                  {subscriptions.map((sub, index) => (
                    <div key={index} className="badge text-xs">
                      {sub.amount} USDT • {sub.frequency} • {sub.recipient.slice(0, 6)}...
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Grid - Responsive layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left Column */}
          <div className="space-y-6 lg:col-span-1">
            <WalletStatus />
            <SubscriptionForm onSubscribe={handleSubscribe} />
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2">
            <TransactionHistory />
          </div>
        </div>

        {/* Quick Demo Guide */}
        <div className="mt-8 card bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/10 dark:to-amber-900/10 border-yellow-200 dark:border-yellow-800">
          <div className="p-4 sm:p-6">
            <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-3 flex items-center gap-2">
              <span>🎯</span> Quick Demo Guide
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 dark:text-yellow-400 font-bold">1.</span>
                <span className="text-yellow-700 dark:text-yellow-300">Create wallet</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 dark:text-yellow-400 font-bold">2.</span>
                <span className="text-yellow-700 dark:text-yellow-300">Get test USDT</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 dark:text-yellow-400 font-bold">3.</span>
                <span className="text-yellow-700 dark:text-yellow-300">Add subscriptions</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 dark:text-yellow-400 font-bold">4.</span>
                <span className="text-yellow-700 dark:text-yellow-300">Start agent</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 dark:text-yellow-400 font-bold">5.</span>
                <span className="text-yellow-700 dark:text-yellow-300">Watch it work!</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}