"use client";

import { useEffect, useState } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Log error for debugging
    console.error("Next.js error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    if (error.digest) {
      console.error("Error digest:", error.digest);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 text-center">
        <div className="mb-4">
          {/* Fallback icon if Material Icons fail to load */}
          <div className="text-6xl text-red-500 mb-2">⚠️</div>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Something went wrong
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          We encountered an unexpected error. Please try again.
        </p>
        
        {/* Show error details toggle for production debugging */}
        {isClient && (
          <div className="mb-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-slate-500 dark:text-slate-400 underline mb-2"
            >
              {showDetails ? "Hide" : "Show"} Error Details
            </button>
            {showDetails && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-left mt-2">
                <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                  Error Details:
                </p>
                <p className="text-xs text-red-700 dark:text-red-400 font-mono break-all mb-2">
                  {error.message || "Unknown error"}
                </p>
                {error.digest && (
                  <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                    Error ID: {error.digest}
                  </p>
                )}
                {error.stack && (
                  <details className="mt-2">
                    <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer">
                      Stack Trace
                    </summary>
                    <pre className="text-xs text-red-700 dark:text-red-400 mt-2 overflow-auto max-h-40 whitespace-pre-wrap break-all">
                      {error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/";
              }
            }}
            className="px-6 py-3 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
