import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import SplashScreen from "@/components/SplashScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
        {/* Add fallback handling for Material Icons loading failures */}
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
        {/* Fallback script to detect Material Icons loading failures */}
        <Script id="material-icons-fallback" strategy="afterInteractive">
          {`
            (function() {
              try {
                if (typeof document === 'undefined') return;
                
                // Check if Material Icons loaded after a delay
                setTimeout(function() {
                  try {
                    const testEl = document.createElement('span');
                    testEl.className = 'material-icons-outlined';
                    testEl.textContent = 'check';
                    testEl.style.position = 'absolute';
                    testEl.style.visibility = 'hidden';
                    document.body.appendChild(testEl);
                    
                    const computedStyle = window.getComputedStyle(testEl);
                    const fontFamily = computedStyle.fontFamily;
                    
                    // If font didn't load, add fallback CSS
                    if (!fontFamily.includes('Material Icons')) {
                      console.warn('Material Icons failed to load, using fallback');
                      const style = document.createElement('style');
                      style.textContent = \`
                        .material-icons-outlined,
                        .material-icons-round {
                          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                        }
                        .material-icons-outlined::before,
                        .material-icons-round::before {
                          content: attr(data-icon);
                          font-weight: bold;
                        }
                      \`;
                      document.head.appendChild(style);
                    }
                    
                    document.body.removeChild(testEl);
                  } catch (e) {
                    console.warn('Error checking Material Icons:', e);
                  }
                }, 2000);
              } catch (e) {
                console.warn('Error in Material Icons fallback check:', e);
              }
            })();
          `}
        </Script>
        
        <link rel="manifest" href="/manifest.json" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <Script id="favicon-switcher" strategy="lazyOnload">
          {`
            (function() {
              try {
                // Guard against mobile browser issues
                if (typeof window === 'undefined' || typeof document === 'undefined') return;
                
                const updateFavicon = () => {
                  try {
                    const isDark = document.documentElement.classList.contains('dark');
                    const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
                    link.type = 'image/png';
                    link.rel = 'shortcut icon';
                    link.href = isDark ? '/favicon.png' : '/whitefavicon.png';
                    const head = document.getElementsByTagName('head')[0];
                    if (head) {
                      head.appendChild(link);
                    }
                  } catch (e) {
                    console.warn('Error updating favicon:', e);
                  }
                };
                
                // Check on load - safely access localStorage
                try {
                  if (typeof localStorage !== 'undefined') {
                    const darkMode = localStorage.getItem("darkMode") === "true";
                    if (darkMode) {
                      document.documentElement.classList.add("dark");
                    }
                  }
                } catch (e) {
                  console.warn('Error accessing localStorage:', e);
                }
                
                updateFavicon();
                
                // Watch for changes
                if (typeof MutationObserver !== 'undefined') {
                  const observer = new MutationObserver(updateFavicon);
                  observer.observe(document.documentElement, {
                    attributes: true,
                    attributeFilter: ['class']
                  });
                }
              } catch (e) {
                console.warn('Error in favicon switcher:', e);
              }
            })();
          `}
        </Script>
        <Script id="disable-right-click" strategy="lazyOnload">
          {`
            (function() {
              try {
                // Guard against mobile browser issues
                if (typeof window === 'undefined' || typeof document === 'undefined') return;
                
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
              } catch (e) {
                console.warn('Error in right-click handler:', e);
              }
            })();
          `}
        </Script>
        <Script id="global-error-handler" strategy="afterInteractive">
          {`
            (function() {
              // Global error handler for unhandled errors
              if (typeof window !== 'undefined') {
                // Handle synchronous errors
                window.addEventListener('error', function(event) {
                  console.error('Global error caught:', {
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    error: event.error
                  });
                  
                  // Handle WebSocket security errors gracefully
                  if (event.error && event.error.message) {
                    const errorMsg = event.error.message.toLowerCase();
                    
                    // WebSocket security errors - these are non-critical, app can work without realtime
                    if (errorMsg.includes('websocket') && 
                        (errorMsg.includes('insecure') || 
                         errorMsg.includes('not available') ||
                         errorMsg.includes('operation is insecure'))) {
                      console.warn('WebSocket not available, app will use polling fallback');
                      event.preventDefault(); // Prevent error from crashing the app
                      return;
                    }
                    
                    // Ignore other known non-critical errors
                    if (errorMsg.includes('script error') || 
                        errorMsg.includes('non-error promise rejection') ||
                        errorMsg.includes('resizeobserver')) {
                      event.preventDefault();
                      return;
                    }
                  }
                  
                  // Don't prevent default for critical errors - let ErrorBoundary handle them
                }, true); // Use capture phase
                
                // Handle unhandled promise rejections
                window.addEventListener('unhandledrejection', function(event) {
                  console.error('Unhandled promise rejection:', {
                    reason: event.reason,
                    promise: event.promise
                  });
                  
                  // Handle WebSocket promise rejections
                  if (event.reason && typeof event.reason === 'object') {
                    const reasonMsg = (event.reason.message || String(event.reason)).toLowerCase();
                    
                    // WebSocket errors - non-critical, prevent from crashing
                    if (reasonMsg.includes('websocket') && 
                        (reasonMsg.includes('insecure') || 
                         reasonMsg.includes('not available') ||
                         reasonMsg.includes('operation is insecure'))) {
                      console.warn('WebSocket promise rejection, app will use polling fallback');
                      event.preventDefault();
                      return;
                    }
                    
                    // Network errors that are handled by the app
                    if (reasonMsg.includes('network') || 
                        reasonMsg.includes('fetch') ||
                        reasonMsg.includes('timeout')) {
                      // These are handled by the app, don't show default error
                      event.preventDefault();
                      return;
                    }
                  }
                });
                
                // Handle React errors that escape ErrorBoundary
                const originalConsoleError = console.error;
                console.error = function(...args) {
                  // Log original error
                  originalConsoleError.apply(console, args);
                  
                  // Check if it's a React error
                  const errorStr = args.join(' ');
                  if (errorStr.includes('Error:') && errorStr.includes('React')) {
                    console.warn('React error detected, ErrorBoundary should handle it');
                  }
                };
              }
            })();
          `}
        </Script>
      </head>
      <body className="bg-background-light dark:bg-background-dark font-display" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
        <ErrorBoundary>
          <SplashScreen />
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}

