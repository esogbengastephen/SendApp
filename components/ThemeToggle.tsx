"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      // Check localStorage or system preference - with error handling for mobile
      if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
        const darkMode = localStorage.getItem("darkMode") === "true";
        setIsDark(darkMode);
        
        // Apply theme immediately
        if (typeof document !== "undefined") {
          if (darkMode) {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        }
      }
    } catch (e) {
      console.warn("Error initializing theme:", e);
    }
  }, []);

  const toggleTheme = () => {
    try {
      const newTheme = !isDark;
      setIsDark(newTheme);
      
      if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
        localStorage.setItem("darkMode", newTheme.toString());
      }
      
      if (typeof document !== "undefined") {
        if (newTheme) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
    } catch (e) {
      console.warn("Error toggling theme:", e);
    }
  };

  if (!mounted) {
    // Return a placeholder to prevent hydration mismatch
    return (
      <button
        className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-full"
        disabled
      >
        <span className="material-icons-outlined text-lg sm:text-xl">brightness_4</span>
        <span>Theme</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors w-full"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="material-icons-outlined text-lg sm:text-xl">
        {isDark ? "light_mode" : "dark_mode"}
      </span>
      <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
    </button>
  );
}

