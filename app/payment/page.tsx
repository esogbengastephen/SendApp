"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PaymentForm from "@/components/PaymentForm";
import { isUserLoggedIn } from "@/lib/session";
import BottomNavigation from "@/components/BottomNavigation";

export default function PaymentPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-start pt-8 pb-24 px-4">
      <PaymentForm />
      <BottomNavigation />
    </div>
  );
}
