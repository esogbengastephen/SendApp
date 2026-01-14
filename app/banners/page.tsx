"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import BottomNavigation from "@/components/BottomNavigation";

interface Banner {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  click_count: number;
}

export default function BannersPage() {
  const router = useRouter();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const response = await fetch("/api/banners");
      const data = await response.json();
      
      if (data.success) {
        setBanners(data.banners || []);
      }
    } catch (error) {
      console.error("Error fetching banners:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBannerClick = async (banner: Banner) => {
    // Track click
    try {
      await fetch(`/api/banners/${banner.id}/click`, {
        method: "POST",
      });
    } catch (error) {
      console.error("Error tracking click:", error);
    }

    // Navigate if link exists
    if (banner.link_url) {
      if (banner.link_url.startsWith("http")) {
        window.open(banner.link_url, "_blank", "noopener,noreferrer");
      } else {
        router.push(banner.link_url);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-accent-blue to-accent-green pb-20">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="mb-4 flex items-center gap-2 text-white/80 hover:text-white transition"
          >
            <span className="material-icons-outlined">arrow_back</span>
            <span>Back</span>
          </button>
          <h1 className="text-2xl font-bold text-white">Banners</h1>
          <p className="text-white/70 text-sm mt-1">Discover featured content</p>
        </div>

        {/* Banners Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-white">Loading banners...</div>
          </div>
        ) : banners.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/70">
            <span className="material-icons-outlined text-6xl mb-4 opacity-50">
              image
            </span>
            <p>No banners available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {banners.map((banner) => (
              <div
                key={banner.id}
                onClick={() => handleBannerClick(banner)}
                className={`relative rounded-xl overflow-hidden shadow-lg transition-transform hover:scale-[1.02] ${
                  banner.link_url ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <div className="relative w-full aspect-[16/9] bg-slate-200 dark:bg-slate-700">
                  <Image
                    src={banner.image_url}
                    alt={banner.title || "Banner"}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  {banner.title && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                      <h3 className="text-white font-semibold">{banner.title}</h3>
                    </div>
                  )}
                  {banner.link_url && (
                    <div className="absolute top-2 right-2 bg-white/90 dark:bg-slate-800/90 rounded-full p-1.5">
                      <span className="material-icons-outlined text-sm text-primary">
                        open_in_new
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}
