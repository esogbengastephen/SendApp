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
    <div className="bg-ds-surface-strong dark:bg-ds-dark-surface rounded-ds-lg p-ds-5 flex flex-col justify-between border border-ds-border dark:border-white/10 shadow-ds-soft relative overflow-hidden group min-h-[140px] animate-card-enter">
      <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/20 dark:bg-white/5 rounded-full" aria-hidden></div>
      
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-1.5 text-ds-text-primary">
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
              <span className="material-icons-outlined text-ds-text-muted text-sm cursor-pointer hover:text-ds-text-primary transition-colors duration-motion-fast">
                list
              </span>
            </button>
          )}
          <button onClick={onToggleVisibility} className="focus:outline-none">
            <span className="material-icons-outlined text-ds-text-muted text-sm cursor-pointer hover:text-ds-text-primary transition-colors duration-motion-fast">
              {isHidden ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        </div>
      </div>

      <div className="mb-3">
        <h2 className="text-xl font-extrabold text-ds-text-primary tracking-tight">
          {isHidden ? '••••••••' : amount}
        </h2>
      </div>

      {accountNumber ? (
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-semibold text-ds-text-secondary">Account Details</p>
          <div className="flex items-center gap-1">
            <p className="text-xs font-bold text-ds-text-primary tracking-wider">{accountNumber}</p>
            <span 
              className="material-icons-outlined text-[10px] text-ds-text-muted cursor-pointer hover:text-ds-text-primary transition-colors duration-motion-fast"
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
