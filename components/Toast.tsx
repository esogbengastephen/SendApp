"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export default function Toast({
  message,
  type = "info",
  isVisible,
  onClose,
  duration = 3000,
}: ToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const typeStyles = {
    success: "bg-green-500 text-white",
    error: "bg-red-500 text-white",
    info: "bg-blue-500 text-white",
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div
        className={`${typeStyles[type]} px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 min-w-[300px]`}
      >
        <span className="material-icons-outlined text-xl">
          {type === "success" && "check_circle"}
          {type === "error" && "error"}
          {type === "info" && "info"}
        </span>
        <span className="flex-1">{message}</span>
        <button
          onClick={onClose}
          className="ml-2 hover:opacity-70 transition-opacity"
        >
          <span className="material-icons-outlined text-sm">close</span>
        </button>
      </div>
    </div>
  );
}

