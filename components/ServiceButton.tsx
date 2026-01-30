"use client";

import React from 'react';

interface ServiceButtonProps {
  icon: string;
  label: string;
  onClick?: () => void;
  useCustomIcon?: boolean;
  comingSoon?: boolean;
}

export const ServiceButton: React.FC<ServiceButtonProps> = ({
  icon,
  label,
  onClick,
  useCustomIcon = false,
  comingSoon = false,
}) => {
  return (
    <button
      type="button"
      onClick={comingSoon ? undefined : onClick}
      disabled={comingSoon}
      aria-disabled={comingSoon ? "true" : "false"}
      className={`flex flex-col items-center gap-2 group w-full relative ${comingSoon ? "cursor-not-allowed opacity-65" : ""}`}
    >
      <div className={`w-full aspect-square bg-ds-surface-soft dark:bg-ds-dark-surface-soft rounded-ds-lg flex items-center justify-center shadow-ds-soft border border-ds-border/50 dark:border-white/10 ${!comingSoon ? "group-active:scale-[0.98] transition-all duration-motion-fast ease-standard hover:opacity-90" : ""}`}>
        {useCustomIcon ? (
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/90 dark:bg-white/20">
            <span className="material-icons-round text-xl text-ds-primary">{icon}</span>
          </div>
        ) : (
          <span className="material-icons-outlined text-3xl text-ds-primary">{icon}</span>
        )}
      </div>
      <span className="text-[10px] font-bold text-center leading-tight text-ds-text-primary whitespace-pre-wrap">
        {label}
      </span>
      {comingSoon && (
        <span className="text-[8px] font-semibold uppercase tracking-wide text-ds-text-muted">
          Coming soon
        </span>
      )}
    </button>
  );
};
