"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import WalletConnect from "./WalletConnect";
import { useRouter } from "next/navigation";

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

export default function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkAuth();
  }, [address, isConnected]);


  const checkAuth = async () => {
    setIsChecking(true);
    
    // Check localStorage for session
    const session = localStorage.getItem("admin_session");
    if (session) {
      const sessionData = JSON.parse(session);
      const walletAddress = sessionData.address;
      
      // Check if session is still valid (24 hours)
      const sessionAge = Date.now() - sessionData.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (sessionAge < maxAge && walletAddress === address?.toLowerCase()) {
        setIsAuthenticated(true);
        setIsChecking(false);
        return;
      } else {
        // Session expired or wallet changed
        localStorage.removeItem("admin_session");
        localStorage.removeItem("admin_wallet");
      }
    }

    // If wallet is connected, verify admin access
    if (isConnected && address) {
      const storedWallet = localStorage.getItem("admin_wallet");
      if (storedWallet?.toLowerCase() === address.toLowerCase()) {
        setIsAuthenticated(true);
      }
    }

    setIsChecking(false);
  };

  const handleAuthSuccess = (walletAddress: string) => {
    // Immediately check auth with the new session
    const session = localStorage.getItem("admin_session");
    if (session) {
      const sessionData = JSON.parse(session);
      if (sessionData.address === walletAddress.toLowerCase()) {
        setIsAuthenticated(true);
        setIsChecking(false);
      }
    }
  };

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark p-8">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 p-8 rounded-xl shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-primary p-3 rounded-lg">
              <span className="text-2xl font-bold text-slate-900">/s</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Admin Access Required
            </h1>
          </div>
          <WalletConnect onAuthSuccess={handleAuthSuccess} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

