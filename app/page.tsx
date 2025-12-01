"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PaymentForm from "@/components/PaymentForm";
import DarkModeToggle from "@/components/DarkModeToggle";
import { isUserLoggedIn, getUserFromStorage, clearUserSession } from "@/lib/session";

export default function Home() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState(getUserFromStorage());

  useEffect(() => {
    // Check if user is logged in
    if (!isUserLoggedIn()) {
      router.push("/auth");
      return;
    }

    // Verify session is still valid
    const currentUser = getUserFromStorage();
    if (!currentUser) {
      clearUserSession();
      router.push("/auth");
      return;
    }

    setUser(currentUser);
    setIsChecking(false);
  }, [router]);

  const handleLogout = () => {
    clearUserSession();
    router.push("/auth");
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

  return (
    <div className="flex items-center justify-center min-h-screen relative">
      {/* Header with User Info and Logout */}
      <div className="absolute top-4 right-4 flex items-center gap-4 z-10">
        {user && (
          <div className="text-sm text-slate-700 dark:text-slate-300">
            {user.email}
          </div>
        )}
        <button
          onClick={handleLogout}
          className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-primary transition-colors"
        >
          Logout
        </button>
        <DarkModeToggle fixed={false} />
      </div>
      <PaymentForm />
    </div>
  );
}

