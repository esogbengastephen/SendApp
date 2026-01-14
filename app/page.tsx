"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { isUserLoggedIn, getUserFromStorage, clearUserSession } from "@/lib/session";

// Lazy load UserDashboard to reduce initial bundle size
const UserDashboard = dynamic(() => import("@/components/UserDashboard"), {
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-primary">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-4"></div>
        <p className="text-secondary">Loading...</p>
      </div>
    </div>
  ),
  ssr: false,
});

export default function Home() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState(getUserFromStorage());

  useEffect(() => {
    const verifyUser = async () => {
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
          console.log(`[Auth] User ${currentUser.email} not found in database. Logging out...`);
          clearUserSession();
          router.push("/auth");
          return;
        }

        // Check if user has passkey - redirect to setup if not
        try {
          const passkeyResponse = await fetch(`/api/user/check-passkey?userId=${currentUser.id}`);
          const passkeyData = await passkeyResponse.json();

          if (passkeyData.success && passkeyData.needsPasskeySetup) {
            // User doesn't have passkey - redirect to setup
            router.push("/passkey-setup");
            return;
          }
        } catch (error) {
          console.error("Error checking passkey:", error);
          // Continue to dashboard if check fails
        }

        // User exists in database and has passkey - allow access
        setUser(currentUser);
        setIsChecking(false);
      } catch (error) {
        console.error("Error verifying user in database:", error);
        // On error, log out for security
        clearUserSession();
        router.push("/auth");
      }
    };

    verifyUser();
  }, [router]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-4"></div>
          <p className="text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return <UserDashboard />;
}

