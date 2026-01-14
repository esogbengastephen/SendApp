"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import UtilityForm from "@/components/UtilityForm";
import { isUserLoggedIn } from "@/lib/session";
import BottomNavigation from "@/components/BottomNavigation";

export default function PayBettingPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
    }
  }, [router]);

  return (
    <>
      <UtilityForm
        serviceId="betting"
        serviceName="Pay Betting"
        icon="sports_esports"
        networks={["Bet9ja", "SportyBet", "1xBet", "NairaBet", "MerryBet"]}
        placeholder="Enter betting account number"
        showPackageDropdown={true}
      />
      <BottomNavigation />
    </>
  );
}

