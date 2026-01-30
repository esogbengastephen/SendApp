"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PaymentForm from "@/components/PaymentForm";
import { isUserLoggedIn } from "@/lib/session";
import BottomNavigation from "@/components/BottomNavigation";

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const network = (searchParams.get("network") || "send").toLowerCase();
  const validNetwork = network === "base" || network === "solana" ? network : "send";

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
    }
  }, [router]);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background-light dark:bg-background-dark flex flex-col items-center justify-start overflow-x-hidden pt-6 pb-24 sm:pt-8 px-4 sm:px-6">
      <div className="w-full max-w-lg mx-auto flex flex-col flex-1">
        <PaymentForm network={validNetwork} />
      </div>
      <BottomNavigation />
    </div>
  );
}
