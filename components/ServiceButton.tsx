"use client";

import React from 'react';

interface ServiceButtonProps {
  icon: string;
  label: string;
  onClick?: () => void;
  useCustomIcon?: boolean;
}

export const ServiceButton: React.FC<ServiceButtonProps> = ({ icon, label, onClick, useCustomIcon = false }) => {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-2 group w-full"
    >
      <div className="w-full aspect-square bg-primary rounded-2xl flex items-center justify-center shadow-sm group-active:scale-95 transition-all hover:bg-accent-green">
        {useCustomIcon ? (
          <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
            <span className="material-icons-round text-primary text-xl">{icon}</span>
          </div>
        ) : (
          <span className="material-icons-outlined text-secondary text-3xl">{icon}</span>
        )}
      </div>
      <span className="text-[10px] font-bold text-center leading-tight text-background-dark dark:text-white whitespace-pre-wrap">
        {label}
      </span>
    </button>
  );
};
