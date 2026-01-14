"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import UtilityForm from "@/components/UtilityForm";
import { isUserLoggedIn } from "@/lib/session";
import BottomNavigation from "@/components/BottomNavigation";

export default function TVSubPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
    }
  }, [router]);

  return (
    <>
      <UtilityForm
        serviceId="tv"
        serviceName="TV Subscription"
        icon="tv"
        networks={["DStv", "GOtv", "Startimes"]}
        placeholder="Enter smart card number"
        showPackageDropdown={true}
      />
      <BottomNavigation />
    </>
  );
}

