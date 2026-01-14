"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import UtilityForm from "@/components/UtilityForm";
import { isUserLoggedIn } from "@/lib/session";
import BottomNavigation from "@/components/BottomNavigation";

export default function BuyDataPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
    }
  }, [router]);

  return (
    <>
      <UtilityForm
        serviceId="data"
        serviceName="Buy Data"
        icon="data_usage"
        networks={["MTN", "Airtel", "Glo", "9mobile"]}
        placeholder="Enter phone number"
        showPackageDropdown={true}
      />
      <BottomNavigation />
    </>
  );
}

