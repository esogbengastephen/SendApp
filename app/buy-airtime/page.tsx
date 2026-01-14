"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import UtilityForm from "@/components/UtilityForm";
import { isUserLoggedIn } from "@/lib/session";
import BottomNavigation from "@/components/BottomNavigation";

export default function BuyAirtimePage() {
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
    }
  }, [router]);

  return (
    <>
      <UtilityForm
        serviceId="airtime"
        serviceName="Buy Airtime"
        icon="phone_android"
        networks={["MTN", "Airtel", "Glo", "9mobile"]}
        placeholder="Enter phone number"
      />
      <BottomNavigation />
    </>
  );
}

