"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isUserLoggedIn } from "@/lib/session";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = () => {
    const loggedIn = isUserLoggedIn();
    
    if (!loggedIn) {
      router.push("/auth");
      return;
    }
    
    setIsAuthenticated(true);
    setIsChecking(false);
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

