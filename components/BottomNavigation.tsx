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

  return (
    <div className="fixed bottom-0 left-0 w-full z-50 px-4 pb-4">
      <div className="max-w-md mx-auto">
        {/* Dark grey rounded bar with animated blue highlight */}
        <div className="relative bg-background-dark dark:bg-background-dark rounded-2xl h-20 shadow-lg backdrop-blur-md overflow-visible border-2 dark:border-primary border-transparent">
          {/* Animated blue highlight circle with active icon inside */}
          <div 
            className={`absolute top-1/2 w-14 h-14 bg-primary rounded-full transition-all duration-500 ease-out shadow-lg flex flex-col items-center justify-center z-30 ${
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
            }}
            onAnimationEnd={() => setIsAnimating(false)}
          >
            {/* Inner glow effect for better visibility */}
            <div className="absolute inset-0 bg-primary/50 rounded-full blur-md"></div>
            
            {/* Active icon inside the blue circle */}
            <span className="material-icons-outlined text-2xl text-secondary relative z-10">
              {activeTab === "home" ? "home" :
               activeTab === "history" ? "history" :
               activeTab === "upload" ? "arrow_upward" :
               activeTab === "chart" ? "show_chart" :
               "language"}
            </span>
            {/* Active label */}
            <span className="text-[8px] font-bold text-secondary relative z-10 mt-0.5 uppercase tracking-tight">
              {activeTab === "home" ? "Home" :
               activeTab === "history" ? "History" :
               activeTab === "upload" ? "Send" :
               activeTab === "chart" ? "Chart" :
               "More"}
            </span>
          </div>

          {/* Icons container - inactive icons with labels */}
          <div className="relative flex justify-around items-center h-full px-2 pt-1">
            {/* Home */}
            <button 
              onClick={() => handleNavigation("home", "/")}
              className="relative z-10 flex flex-col items-center justify-center transition-all duration-300"
              aria-label="Home"
            >
              <span className={`material-icons-outlined text-xl transition-all duration-300 ${
                activeTab === "home" 
                  ? "opacity-0" 
                  : "text-secondary opacity-100"
              }`}>
                home
              </span>
              <span className={`text-[8px] font-semibold mt-0.5 uppercase tracking-tight transition-all duration-300 ${
                activeTab === "home" 
                  ? "opacity-0" 
                  : "text-secondary opacity-100"
              }`}>
                Home
              </span>
            </button>

            {/* History */}
            <button 
              onClick={() => handleNavigation("history", "/history")}
              className="relative z-10 flex flex-col items-center justify-center transition-all duration-300"
              aria-label="History"
            >
              <span className={`material-icons-outlined text-xl transition-all duration-300 ${
                activeTab === "history" 
                  ? "opacity-0" 
                  : "text-secondary opacity-100"
              }`}>
                history
              </span>
              <span className={`text-[8px] font-semibold mt-0.5 uppercase tracking-tight transition-all duration-300 ${
                activeTab === "history" 
                  ? "opacity-0" 
                  : "text-secondary opacity-100"
              }`}>
                History
              </span>
            </button>

            {/* Send */}
            <button 
              onClick={() => handleNavigation("upload", "/send")}
              className="relative z-10 flex flex-col items-center justify-center transition-all duration-300"
              aria-label="Send"
            >
              <span className={`material-icons-outlined text-xl transition-all duration-300 ${
                activeTab === "upload" 
                  ? "opacity-0" 
                  : "text-secondary opacity-100"
              }`}>
                arrow_upward
              </span>
              <span className={`text-[8px] font-semibold mt-0.5 uppercase tracking-tight transition-all duration-300 ${
                activeTab === "upload" 
                  ? "opacity-0" 
                  : "text-secondary opacity-100"
              }`}>
                Send
              </span>
            </button>

            {/* Chart */}
            <button 
              onClick={() => handleNavigation("chart", "/chart")}
              className="relative z-10 flex flex-col items-center justify-center transition-all duration-300"
              aria-label="Chart"
            >
              <span className={`material-icons-outlined text-xl transition-all duration-300 ${
                activeTab === "chart" 
                  ? "opacity-0" 
                  : "text-secondary opacity-100"
              }`}>
                show_chart
              </span>
              <span className={`text-[8px] font-semibold mt-0.5 uppercase tracking-tight transition-all duration-300 ${
                activeTab === "chart" 
                  ? "opacity-0" 
                  : "text-secondary opacity-100"
              }`}>
                Chart
              </span>
            </button>

            {/* More */}
            <button 
              onClick={() => handleNavigation("www", "/banners")}
              className="relative z-10 flex flex-col items-center justify-center transition-all duration-300"
              aria-label="More"
            >
              <span className={`material-icons-outlined text-xl transition-all duration-300 ${
                activeTab === "www" 
                  ? "opacity-0" 
                  : "text-secondary opacity-100"
              }`}>
                language
              </span>
              <span className={`text-[8px] font-semibold mt-0.5 uppercase tracking-tight transition-all duration-300 ${
                activeTab === "www" 
                  ? "opacity-0" 
                  : "text-secondary opacity-100"
              }`}>
                More
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
