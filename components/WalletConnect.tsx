"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { isAdminWallet } from "@/lib/supabase";

interface WalletConnectProps {
  onAuthSuccess: (address: string) => void;
}

export default function WalletConnect({ onAuthSuccess }: WalletConnectProps) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isConnected && address) {
      verifyAdmin(address);
    }
  }, [isConnected, address]);

  const verifyAdmin = async (walletAddress: string) => {
    setIsVerifying(true);
    setError(null);

    try {
      // Sign a message for authentication
      const message = `Sign in to Send Admin Panel\n\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`;
      const signature = await signMessageAsync({ message });

      // Verify if wallet is admin
      const response = await fetch("/api/admin/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress,
          signature,
          message,
        }),
      });

      const data = await response.json();
      
      console.log("Verification response:", data);

      if (data.success && data.isAdmin) {
        // Store session
        const sessionData = { address: walletAddress.toLowerCase(), timestamp: Date.now() };
        localStorage.setItem("admin_wallet", walletAddress.toLowerCase());
        localStorage.setItem("admin_session", JSON.stringify(sessionData));
        
        // Call success callback - this will trigger AdminAuthGuard to re-check
        onAuthSuccess(walletAddress);
      } else {
        const errorMsg = data.error || "This wallet is not authorized as an admin";
        console.error("Admin verification failed:", data);
        setError(errorMsg + (data.debug ? ` (Debug: ${JSON.stringify(data.debug)})` : ""));
        // Don't disconnect immediately - let user see the error
      }
    } catch (err: any) {
      console.error("Admin verification error:", err);
      setError(err.message || "Failed to verify admin access");
      disconnect();
    } finally {
      setIsVerifying(false);
    }
  };

  if (isConnected && address) {
    return (
      <div className="space-y-4">
        {isVerifying ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Verifying admin access...
            </p>
          </div>
        ) : (
          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              Connected Wallet
            </p>
            <p className="font-mono text-sm text-slate-900 dark:text-slate-100">
              {address.slice(0, 6)}...{address.slice(-4)}
            </p>
            <button
              onClick={() => disconnect()}
              className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              Disconnect
            </button>
          </div>
        )}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
        Connect Wallet to Access Admin Panel
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Please connect your wallet to verify admin access
      </p>
      <div className="space-y-2">
        {connectors.map((connector) => (
          <button
            key={connector.id}
            onClick={() => connect({ connector })}
            disabled={isPending}
            className="w-full bg-primary text-slate-900 font-bold py-3 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-900"></div>
                Connecting...
              </>
            ) : (
              <>
                <span className="material-icons-outlined">account_balance_wallet</span>
                Connect {connector.name}
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

