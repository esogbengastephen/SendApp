import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";

export const metadata: Metadata = {
  title: "FlipPay",
  description: "Deposit Naira and receive $SEND tokens on Base",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="favicon-switcher" strategy="afterInteractive">
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
      </head>
      <body className="bg-background-light dark:bg-background-dark font-display">
        {children}
      </body>
    </html>
  );
}

