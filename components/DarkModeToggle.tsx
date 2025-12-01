"use client";

import { useEffect, useState } from "react";

interface DarkModeToggleProps {
  fixed?: boolean; // If true, uses fixed positioning. If false, uses relative positioning.
}

export default function DarkModeToggle({ fixed = true }: DarkModeToggleProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial theme
    const darkMode = localStorage.getItem("darkMode") === "true";
    setIsDark(darkMode);
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !isDark;
    setIsDark(newDarkMode);
    localStorage.setItem("darkMode", String(newDarkMode));
    
    if (newDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const positionClass = fixed ? "fixed top-4 right-4" : "";

  return (
    <button
      onClick={toggleDarkMode}
      className={`${positionClass} p-2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors`}
      aria-label="Toggle dark mode"
    >
      {isDark ? (
        <span className="material-icons-outlined">light_mode</span>
      ) : (
        <span className="material-icons-outlined">dark_mode</span>
      )}
    </button>
  );
}

