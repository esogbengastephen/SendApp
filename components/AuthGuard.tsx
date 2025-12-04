"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isUserLoggedIn, getUserFromStorage, clearUserSession } from "@/lib/session";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const loggedIn = isUserLoggedIn();
    
    if (!loggedIn) {
      router.push("/auth");
      return;
    }

    // Get user from storage
    const currentUser = getUserFromStorage();
    if (!currentUser) {
      clearUserSession();
      router.push("/auth");
      return;
    }

    // CRITICAL: Verify user exists in database
    try {
      const response = await fetch("/api/auth/verify-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUser.email }),
      });

      const data = await response.json();

      if (!data.success || !data.exists) {
        // User doesn't exist in database - log them out immediately
        console.log(`[AuthGuard] User ${currentUser.email} not found in database. Logging out...`);
        clearUserSession();
        router.push("/auth");
        return;
      }

      // User exists in database - allow access
      setIsAuthenticated(true);
      setIsChecking(false);
    } catch (error) {
      console.error("Error verifying user in database:", error);
      // On error, log out for security
      clearUserSession();
      router.push("/auth");
    }
  };

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to /auth
  }

  return <>{children}</>;
}

