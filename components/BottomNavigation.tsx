"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState("home");
  const [isAnimating, setIsAnimating] = useState(false);

  // Determine active tab based on current pathname
  useEffect(() => {
    if (pathname === "/") {
      setActiveTab("home");
    } else if (pathname === "/send" || pathname.startsWith("/send")) {
      setActiveTab("upload");
    } else if (pathname === "/receive" || pathname.startsWith("/receive")) {
      setActiveTab("upload"); // Could be "receive" if we add it
    } else if (pathname === "/history" || pathname.startsWith("/history")) {
      setActiveTab("history");
    } else if (pathname === "/chart" || pathname.startsWith("/chart")) {
      setActiveTab("chart");
    } else if (pathname === "/banners" || pathname.startsWith("/banners")) {
      setActiveTab("www");
    } else if (pathname === "/settings" || pathname.startsWith("/settings")) {
      setActiveTab("www");
    } else if (pathname === "/profile" || pathname.startsWith("/profile")) {
      setActiveTab("www");
    } else {
      // For other pages, try to infer from pathname
      setActiveTab("home");
    }
  }, [pathname]);

  const handleNavigation = (tab: string, route: string) => {
    setIsAnimating(true);
    setActiveTab(tab);
    router.push(route);
  };

  const inactiveClass = "text-white/70";
  const transitionClass = "transition-all duration-motion-base ease-standard";

  return (
    <div className="fixed bottom-0 left-0 w-full z-50 px-4 pb-4">
      <div className="max-w-md mx-auto">
        <div className="relative bg-background-dark dark:bg-ds-dark-surface rounded-ds-xl h-20 shadow-ds-soft backdrop-blur-md overflow-visible border border-white/5">
          {/* Active tab pill */}
          <div
            className={`absolute top-1/2 w-14 h-14 bg-ds-primary rounded-full ${transitionClass} flex flex-col items-center justify-center pointer-events-none ${
              isAnimating ? "animate-popIn" : ""
            }`}
            style={{
              left: `calc(${
                activeTab === "home" ? "10%" :
                activeTab === "history" ? "30%" :
                activeTab === "upload" ? "50%" :
                activeTab === "chart" ? "70%" : "90%"
              } - 1.75rem)`,
              transform: "translateY(-50%)",
              zIndex: 20,
            }}
            onAnimationEnd={() => setIsAnimating(false)}
          >
            <span className="material-icons-outlined text-2xl text-secondary relative z-10">
              {activeTab === "home" ? "home" :
               activeTab === "history" ? "history" :
               activeTab === "upload" ? "arrow_upward" :
               activeTab === "chart" ? "show_chart" : "language"}
            </span>
            <span className="text-[8px] font-bold text-secondary relative z-10 mt-0.5 uppercase tracking-tight">
              {activeTab === "home" ? "Home" :
               activeTab === "history" ? "History" :
               activeTab === "upload" ? "Send" :
               activeTab === "chart" ? "Chart" : "More"}
            </span>
          </div>

          <div className="relative flex justify-around items-center h-full px-2 pt-1">
            <button
              onClick={() => handleNavigation("home", "/")}
              className={`relative z-30 flex flex-col items-center justify-center ${transitionClass}`}
              aria-label="Home"
            >
              <span className={`material-icons-outlined text-xl ${transitionClass} ${activeTab === "home" ? "opacity-0" : inactiveClass}`}>
                home
              </span>
              <span className={`text-[8px] font-semibold mt-0.5 uppercase tracking-tight ${transitionClass} ${activeTab === "home" ? "opacity-0" : inactiveClass}`}>
                Home
              </span>
            </button>

            <button
              onClick={() => handleNavigation("history", "/history")}
              className={`relative z-30 flex flex-col items-center justify-center ${transitionClass}`}
              aria-label="History"
            >
              <span className={`material-icons-outlined text-xl ${transitionClass} ${activeTab === "history" ? "opacity-0" : inactiveClass}`}>
                history
              </span>
              <span className={`text-[8px] font-semibold mt-0.5 uppercase tracking-tight ${transitionClass} ${activeTab === "history" ? "opacity-0" : inactiveClass}`}>
                History
              </span>
            </button>

            <button
              onClick={() => handleNavigation("upload", "/send")}
              className={`relative z-30 flex flex-col items-center justify-center ${transitionClass}`}
              aria-label="Send"
            >
              <span className={`material-icons-outlined text-xl ${transitionClass} ${activeTab === "upload" ? "opacity-0" : inactiveClass}`}>
                arrow_upward
              </span>
              <span className={`text-[8px] font-semibold mt-0.5 uppercase tracking-tight ${transitionClass} ${activeTab === "upload" ? "opacity-0" : inactiveClass}`}>
                Send
              </span>
            </button>

            <button
              onClick={() => handleNavigation("chart", "/chart")}
              className={`relative z-30 flex flex-col items-center justify-center ${transitionClass}`}
              aria-label="Chart"
            >
              <span className={`material-icons-outlined text-xl ${transitionClass} ${activeTab === "chart" ? "opacity-0" : inactiveClass}`}>
                show_chart
              </span>
              <span className={`text-[8px] font-semibold mt-0.5 uppercase tracking-tight ${transitionClass} ${activeTab === "chart" ? "opacity-0" : inactiveClass}`}>
                Chart
              </span>
            </button>

            <button
              onClick={() => handleNavigation("www", "/banners")}
              className={`relative z-30 flex flex-col items-center justify-center ${transitionClass}`}
              aria-label="More"
            >
              <span className={`material-icons-outlined text-xl ${transitionClass} ${activeTab === "www" ? "opacity-0" : inactiveClass}`}>
                language
              </span>
              <span className={`text-[8px] font-semibold mt-0.5 uppercase tracking-tight ${transitionClass} ${activeTab === "www" ? "opacity-0" : inactiveClass}`}>
                More
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
