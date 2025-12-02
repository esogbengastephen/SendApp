import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlipPay",
  description: "Deposit Naira and receive $SEND tokens on Base",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-background-light dark:bg-background-dark font-display">
        {children}
      </body>
    </html>
  );
}

