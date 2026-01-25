import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import SplashScreen from "@/components/SplashScreen";

// Optimize font loading with Next.js font optimization
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  preload: true,
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "FlipPay",
  description: "Deposit Naira and receive $SEND tokens on Base",
  manifest: "/manifest.json",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FlipPay",
  },
  icons: {
    icon: [
      { url: "/whitefavicon.png", sizes: "any", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/favicon.png", sizes: "any", type: "image/png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [
      { url: "/whitefavicon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Resource hints for faster external resource loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://assets.coingecko.com" />
        <link rel="dns-prefetch" href="https://api.coingecko.com" />
        
        {/* Load Material Icons - critical for icon rendering */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/icon?family=Material+Icons+Round"
          crossOrigin="anonymous"
        />
        
        <link rel="manifest" href="/manifest.json" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <Script id="favicon-switcher" strategy="lazyOnload">
          {`
            (function() {
              const updateFavicon = () => {
                const isDark = document.documentElement.classList.contains('dark');
                const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
                link.type = 'image/png';
                link.rel = 'shortcut icon';
                link.href = isDark ? '/favicon.png' : '/whitefavicon.png';
                document.getElementsByTagName('head')[0].appendChild(link);
              };
              
              // Check on load
              const darkMode = localStorage.getItem("darkMode") === "true";
              if (darkMode) {
                document.documentElement.classList.add("dark");
              }
              updateFavicon();
              
              // Watch for changes
              const observer = new MutationObserver(updateFavicon);
              observer.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['class']
              });
            })();
          `}
        </Script>
        <Script id="disable-right-click" strategy="lazyOnload">
          {`
            (function() {
              // Check if we're on an admin page
              const isAdminPage = window.location.pathname.startsWith('/admin');
              
              // Only disable right-click if NOT on admin page
              if (!isAdminPage) {
                // Disable right-click context menu
                document.addEventListener('contextmenu', function(e) {
                  e.preventDefault();
                  return false;
                });
              }
            })();
          `}
        </Script>
      </head>
      <body className="bg-background-light dark:bg-background-dark font-display" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}

