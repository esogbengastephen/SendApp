"use client";

import React from 'react';

interface WalletCardProps {
  label: string;
  currency: 'NGN' | 'Crypto';
  amount: string;
  isHidden: boolean;
  onToggleVisibility: () => void;
  accountNumber?: string;
  icon: string;
  onViewAssets?: () => void;
}

export const WalletCard: React.FC<WalletCardProps> = ({
  label,
  currency,
  amount,
  isHidden,
  onToggleVisibility,
  accountNumber,
  icon,
  onViewAssets
}) => {
  return (
    <div className="bg-white/60 dark:bg-primary/90 rounded-2xl p-4 flex flex-col justify-between border border-white/40 shadow-sm relative overflow-hidden group min-h-[140px]">
      <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white opacity-20 rounded-full"></div>
      
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-1.5 text-background-dark dark:text-secondary">
          <span className="material-icons-outlined text-lg">{icon}</span>
          <span className="font-bold text-sm">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {currency === 'Crypto' && onViewAssets && (
            <button 
              onClick={onViewAssets} 
              className="focus:outline-none"
              title="View assets"
            >
              <span className="material-icons-outlined text-background-dark/60 dark:text-secondary/60 text-sm cursor-pointer hover:text-background-dark dark:hover:text-secondary transition-colors">
                list
              </span>
            </button>
          )}
          <button onClick={onToggleVisibility} className="focus:outline-none">
            <span className="material-icons-outlined text-background-dark/60 dark:text-secondary/60 text-sm cursor-pointer">
              {isHidden ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        </div>
      </div>

      <div className="mb-3">
        <h2 className="text-xl font-extrabold text-background-dark dark:text-secondary tracking-tight">
          {isHidden ? '••••••••' : amount}
        </h2>
      </div>

      {accountNumber ? (
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-semibold text-background-dark/70 dark:text-secondary/70">Account Details</p>
          <div className="flex items-center gap-1">
            <p className="text-xs font-bold text-background-dark dark:text-secondary tracking-wider">{accountNumber}</p>
            <span 
              className="material-icons-outlined text-[10px] text-background-dark/50 dark:text-secondary/50 cursor-pointer hover:text-background-dark dark:hover:text-secondary transition-colors"
              onClick={() => navigator.clipboard.writeText(accountNumber)}
            >
              content_copy
            </span>
          </div>
        </div>
      ) : (
        <div className="h-8"></div>
      )}
    </div>
  );
};
