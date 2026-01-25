"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Guard against mobile browser issues
    if (typeof window === "undefined" || typeof document === "undefined") {
      setIsVisible(false);
      return;
    }

    // Show splash screen for minimum 500ms (reduced for faster load)
    const minDisplayTime = 500;
    const startTime = Date.now();

    const hideSplash = () => {
      try {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, minDisplayTime - elapsed);

        setTimeout(() => {
          setIsFading(true);
          setTimeout(() => {
            setIsVisible(false);
          }, 300); // Fade out duration
        }, remaining);
      } catch (e) {
        console.warn("Error hiding splash screen:", e);
        setIsVisible(false);
      }
    };

    // Hide splash when page is fully loaded
    try {
      if (document.readyState === "complete") {
        hideSplash();
      } else {
        window.addEventListener("load", hideSplash);
        return () => {
          try {
            window.removeEventListener("load", hideSplash);
          } catch (e) {
            console.warn("Error removing load listener:", e);
          }
        };
      }
    } catch (e) {
      console.warn("Error setting up splash screen:", e);
      // Fallback: hide splash after a delay
      setTimeout(() => setIsVisible(false), 1000);
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-300 ${
        isFading ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center justify-center space-y-6 animate-splash-fade-in">
        {/* Project logo (from /public) */}
        <div className="relative w-64 h-64 md:w-80 md:h-80 animate-splash-scale animate-splash-glow">
          <Image
            src="/logo.png"
            alt="FlipPay Logo"
            fill
            priority
            sizes="(min-width: 768px) 320px, 256px"
            className="object-contain"
          />
        </div>
        
        {/* Loading Spinner */}
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-secondary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-secondary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-secondary rounded-full animate-bounce"></div>
        </div>
      </div>
    </div>
  );
}

