"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import UtilityForm from "@/components/UtilityForm";
import { isUserLoggedIn } from "@/lib/session";
import BottomNavigation from "@/components/BottomNavigation";

interface GiftCardProduct {
  id: number;
  name: string;
  brandName: string;
  logoUrl?: string;
}

export default function GiftCardRedeemPage() {
  const router = useRouter();
  const [networks, setNetworks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [productMap, setProductMap] = useState<Record<string, GiftCardProduct>>({});

  useEffect(() => {
    if (!isUserLoggedIn()) {
      router.push("/auth");
      return;
    }

    // Fetch gift card products from Reloadly
    fetchGiftCardProducts();
  }, [router]);

  const fetchGiftCardProducts = async () => {
    try {
      const response = await fetch("/api/utility/gift-card-products");
      const data = await response.json();

      if (data.success && data.products && data.products.length > 0) {
        // Extract network names from products
        const networkNames = data.products.map((product: GiftCardProduct) => 
          product.brandName || product.name
        );
        
        // Create a map of product data for later use
        const map: Record<string, GiftCardProduct> = {};
        data.products.forEach((product: GiftCardProduct) => {
          const key = product.brandName || product.name;
          map[key] = product;
        });

        setNetworks(networkNames);
        setProductMap(map);
      } else {
        // Fallback to default networks
        setNetworks(["Amazon", "iTunes", "Google Play", "Steam", "Xbox", "PlayStation", "Netflix", "Spotify"]);
      }
    } catch (error) {
      console.error("Error fetching gift card products:", error);
      // Fallback to default networks on error
      setNetworks(["Amazon", "iTunes", "Google Play", "Steam", "Xbox", "PlayStation", "Netflix", "Spotify"]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading gift card products...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <UtilityForm
        serviceId="gift-card-redeem"
        serviceName="Redeem Gift Card"
        icon="card_giftcard"
        networks={networks}
        placeholder="Enter your gift card code"
        showPackageDropdown={false}
        productMap={productMap}
      />
      <BottomNavigation />
    </>
  );
}
