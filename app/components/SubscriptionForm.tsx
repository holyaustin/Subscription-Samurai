'use client';

import { useState } from 'react';

// ── Frequency type — keep in sync with Dashboard.tsx and subscription-agent.js ──
export type Frequency =
  | 'every_minute'
  | 'every_5_minutes'
  | 'every_10_minutes'
  | 'every_30_minutes'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly';

export interface Subscription {
  recipient: string;
  amount: number;
  frequency: Frequency;
  token: 'ETH' | 'USDT';
  active: boolean;
}

// Human-readable labels for each frequency
const FREQUENCY_OPTIONS: { value: Frequency; label: string; badge?: string }[] = [
  { value: 'every_minute',    label: 'Every Minute',    badge: 'testing' },
  { value: 'every_5_minutes', label: 'Every 5 Minutes', badge: 'testing' },
  { value: 'every_10_minutes',label: 'Every 10 Minutes',badge: 'testing' },
  { value: 'every_30_minutes',label: 'Every 30 Minutes',badge: 'testing' },
  { value: 'hourly',          label: 'Hourly' },
  { value: 'daily',           label: 'Daily' },
  { value: 'weekly',          label: 'Weekly' },
  { value: 'monthly',         label: 'Monthly' },
  { value: 'yearly',          label: 'Yearly' },
];

export default function SubscriptionForm({
  onSubscribe,
}: {
  onSubscribe: (sub: Subscription) => void;
}) {
  const [formData, setFormData] = useState<Subscription>({
    recipient: '',
    amount: 1,
    frequency: 'weekly',
    token: 'USDT',
    active: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubscribe(formData);
    setFormData({
      recipient: '',
      amount: 1,
      frequency: 'weekly',
      token: 'USDT',
      active: true,
    });
  };

  const isTestFrequency = ['every_minute', 'every_5_minutes', 'every_10_minutes', 'every_30_minutes']
    .includes(formData.frequency);

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
        <span>➕</span> New Subscription
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Recipient */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Recipient Address
          </label>
          <input
            type="text"
            value={formData.recipient}
            onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       font-mono text-sm text-gray-800 dark:text-gray-100
                       bg-white dark:bg-gray-800"
            placeholder="0x..."
            required
          />
        </div>

        {/* Amount + Token side by side */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount
            </label>
            <input
              type="number"
              min="0.000001"
              step="0.000001"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: parseFloat(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500
                         text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Token
            </label>
            <select
              value={formData.token}
              onChange={(e) =>
                setFormData({ ...formData, token: e.target.value as 'ETH' | 'USDT' })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-blue-500
                         text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800"
            >
              <option value="USDT">USDT</option>
              <option value="ETH">ETH</option>
            </select>
          </div>
        </div>

        {/* Frequency */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Frequency
          </label>
          <select
            value={formData.frequency}
            onChange={(e) =>
              setFormData({ ...formData, frequency: e.target.value as Frequency })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800"
          >
            {FREQUENCY_OPTIONS.map(({ value, label, badge }) => (
              <option key={value} value={value}>
                {label}{badge ? ` (${badge})` : ''}
              </option>
            ))}
          </select>

          {/* Testing warning banner */}
          {isTestFrequency && (
            <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200
                            dark:border-amber-700 rounded-lg flex items-start gap-2">
              <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                <strong>Testing only.</strong> The agent checks every 5 minutes by default.
                Set <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">
                AGENT_CHECK_INTERVAL=* * * * *</code> in <code>.env.local</code> to run
                the agent every minute so minute-level frequencies fire correctly.
              </p>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4
                     rounded-lg transition-colors font-medium"
        >
          Add Subscription
        </button>
      </form>
    </div>
  );
}