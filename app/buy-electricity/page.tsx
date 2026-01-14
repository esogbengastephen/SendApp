"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import UtilityForm from "@/components/UtilityForm";
import { isUserLoggedIn } from "@/lib/session";
import BottomNavigation from "@/components/BottomNavigation";

export default function BuyElectricityPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
    }
  }, [router]);

  return (
    <>
      <UtilityForm
        serviceId="electricity"
        serviceName="Buy Electricity"
        icon="bolt"
        networks={["EKEDC", "IKEDC", "AEDC", "PHED", "KEDCO", "EEDC", "IBEDC", "KAEDCO", "JED", "YEDC"]}
        placeholder="Enter meter number"
      />
      <BottomNavigation />
    </>
  );
}
