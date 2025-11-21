"use client";

import { useState } from "react";
import { DEPOSIT_ACCOUNT } from "@/lib/constants";

export default function SettingsPage() {
  const [exchangeRate, setExchangeRate] = useState("50");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // TODO: Save settings to API
    setTimeout(() => {
      setSaving(false);
      alert("Settings saved!");
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Settings
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Configure platform settings and parameters
        </p>
      </div>

      {/* Exchange Rate */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          Exchange Rate
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              NGN to SEND Exchange Rate
            </label>
            <input
              type="number"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              placeholder="50"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-4 py-2 focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              1 NGN = {exchangeRate} SEND
            </p>
          </div>
        </div>
      </div>

      {/* Deposit Account */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          Deposit Account
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Account Name
            </label>
            <p className="text-slate-900 dark:text-slate-100">{DEPOSIT_ACCOUNT.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Account Number
            </label>
            <p className="text-slate-900 dark:text-slate-100">{DEPOSIT_ACCOUNT.accountNumber}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Bank
            </label>
            <p className="text-slate-900 dark:text-slate-100">{DEPOSIT_ACCOUNT.bank}</p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-slate-900 font-bold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

