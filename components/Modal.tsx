"use client";

import { useEffect } from "react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: "success" | "error" | "info";
  children?: React.ReactNode;
  txHash?: string;
  explorerUrl?: string;
}

function Modal({
  isOpen,
  onClose,
  title,
  message,
  type = "info",
  children,
  txHash,
  explorerUrl,
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const typeStyles = {
    success: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    error: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
    info: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
  };

  const iconStyles = {
    success: "text-green-600 dark:text-green-400",
    error: "text-red-600 dark:text-red-400",
    info: "text-blue-600 dark:text-blue-400",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-sm">
      <div
        className={`bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6 border-2 ${typeStyles[type]}`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className={`material-icons-outlined text-3xl ${iconStyles[type]}`}>
              {type === "success" && "check_circle"}
              {type === "error" && "error"}
              {type === "info" && "info"}
            </span>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <span className="material-icons-outlined">close</span>
          </button>
        </div>
        <p className="text-slate-700 dark:text-slate-300 mb-4">{message}</p>
        {children && <div className="mb-4">{children}</div>}
        
        {/* Transaction Hash Link */}
        {txHash && explorerUrl && (
          <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Transaction Hash:</p>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono text-primary hover:underline break-all"
            >
              {txHash}
            </a>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
              Click to view on Basescan
            </p>
          </div>
        )}
        
        <button
          onClick={onClose}
          className="w-full bg-primary text-slate-900 font-bold py-2 px-4 rounded-md hover:opacity-90 transition-opacity"
        >
          OK
        </button>
      </div>
    </div>
  );
}

export default Modal;

