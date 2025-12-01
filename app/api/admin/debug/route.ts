import { NextResponse } from "next/server";
import { ADMIN_WALLETS } from "@/lib/supabase";

export async function GET() {
  // Only show in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Debug endpoint not available in production" },
      { status: 403 }
    );
  }

  return NextResponse.json({
    envVar: process.env.NEXT_PUBLIC_ADMIN_WALLETS,
    parsedWallets: ADMIN_WALLETS,
    count: ADMIN_WALLETS.length,
  });
}

