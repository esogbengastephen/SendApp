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
  comingSoon?: boolean;
}

export const WalletCard: React.FC<WalletCardProps> = ({
  label,
  currency,
  amount,
  isHidden,
  onToggleVisibility,
  accountNumber,
  icon,
  onViewAssets,
  comingSoon = false,
}) => {
  return (
    <div className={`min-w-0 bg-ds-surface-strong dark:bg-ds-dark-surface rounded-ds-lg p-3 sm:p-ds-5 flex flex-col justify-between border border-ds-border dark:border-white/10 shadow-ds-soft relative overflow-hidden group min-h-[120px] sm:min-h-[140px] animate-card-enter ${comingSoon ? "opacity-70 pointer-events-none cursor-not-allowed" : ""}`}>
      <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/20 dark:bg-white/5 rounded-full" aria-hidden></div>

      <div className="flex justify-between items-start mb-2 min-w-0">
        <div className="flex items-center gap-1.5 text-ds-text-primary min-w-0">
          <span className="material-icons-outlined text-lg shrink-0">{icon}</span>
          <span className="font-bold text-sm truncate">{label}</span>
        </div>
        {!comingSoon && (
          <div className="flex items-center gap-2 shrink-0">
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
        )}
      </div>

      <div className="mb-3 min-w-0 overflow-hidden">
        {comingSoon ? (
          <p className="text-xs font-semibold text-ds-text-muted uppercase tracking-wide">Coming soon</p>
        ) : (
          <h2 className="text-lg sm:text-xl font-extrabold text-ds-text-primary tracking-tight truncate">
            {isHidden ? '••••••••' : amount}
          </h2>
        )}
      </div>

      {comingSoon ? (
        <div className="h-8"></div>
      ) : accountNumber ? (
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
