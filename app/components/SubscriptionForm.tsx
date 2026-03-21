'use client';

import { useState } from 'react';

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
  active: boolean;
}

const FREQUENCY_OPTIONS: { value: Frequency; label: string; badge?: string }[] = [
  { value: 'every_minute',     label: 'Every Minute',     badge: 'testing' },
  { value: 'every_5_minutes',  label: 'Every 5 Minutes',  badge: 'testing' },
  { value: 'every_10_minutes', label: 'Every 10 Minutes', badge: 'testing' },
  { value: 'every_30_minutes', label: 'Every 30 Minutes', badge: 'testing' },
  { value: 'hourly',           label: 'Hourly' },
  { value: 'daily',            label: 'Daily' },
  { value: 'weekly',           label: 'Weekly' },
  { value: 'monthly',          label: 'Monthly' },
  { value: 'yearly',           label: 'Yearly' },
];

const INPUT_CLASS = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm text-gray-800";
const NUMBER_CLASS = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800";
const SELECT_CLASS = "w-full px-3 py-2 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function SubscriptionForm({
  onSubscribe,
}: {
  onSubscribe: (sub: Subscription) => void;
}) {
  const [formData, setFormData] = useState<Subscription>({
    recipient: '',
    amount: 1,
    frequency: 'weekly',
    active: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubscribe(formData);
    setFormData({ recipient: '', amount: 1, frequency: 'weekly', active: true });
  };

  const isTestFrequency = (
    ['every_minute', 'every_5_minutes', 'every_10_minutes', 'every_30_minutes'] as Frequency[]
  ).includes(formData.frequency);

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">➕ New Subscription</h2>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Recipient */}
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1">
            Recipient Address
          </label>
          <input
            type="text"
            value={formData.recipient}
            onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
            className={INPUT_CLASS}
            placeholder="0x..."
            required
          />
        </div>

        {/* Amount — USDT only */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount (USDT)
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
            className={NUMBER_CLASS}
            required
          />
        </div>

        {/* Frequency */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Frequency
          </label>
          <select
            value={formData.frequency}
            onChange={(e) => setFormData({ ...formData, frequency: e.target.value as Frequency })}
            className={SELECT_CLASS}
          >
            {FREQUENCY_OPTIONS.map(({ value, label, badge }) => (
              <option key={value} value={value}>
                {label}{badge ? ` (${badge})` : ''}
              </option>
            ))}
          </select>

          {/* Testing warning */}
          {isTestFrequency && (
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              ⚠️ <strong>Testing only.</strong>

            </p>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors font-medium"
        >
          Add Subscription
        </button>
      </form>
    </div>
  );
}