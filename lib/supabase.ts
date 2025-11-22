import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ksdzzqdafodlstfkqzuv.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzZHp6cWRhZm9kbHN0ZmtxenV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4MjQ2NTAsImV4cCI6MjA1MDQwMDY1MH0.placeholder";

// Create Supabase client with fallback key if not provided
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzZHp6cWRhZm9kbHN0ZmtxenV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ4MjQ2NTAsImV4cCI6MjA1MDQwMDY1MH0.placeholder"
);

// Admin wallet addresses (in production, store in Supabase table)
export const ADMIN_WALLETS = process.env.NEXT_PUBLIC_ADMIN_WALLETS
  ?.split(",")
  .map((addr) => addr.trim().toLowerCase())
  .filter((addr) => addr.length > 0) || [];

/**
 * Verify if a wallet address is an admin
 */
export async function isAdminWallet(walletAddress: string): Promise<boolean> {
  const normalizedAddress = walletAddress.toLowerCase().trim();
  
  // Debug logging
  console.log("Checking admin wallet:", normalizedAddress);
  console.log("Admin wallets from env:", ADMIN_WALLETS);
  
  // Check environment variable first
  if (ADMIN_WALLETS.length > 0 && ADMIN_WALLETS.includes(normalizedAddress)) {
    console.log("Wallet found in ADMIN_WALLETS");
    return true;
  }

  // Check Supabase for admin wallets (if configured)
  try {
    const { data, error } = await supabase
      .from("admin_wallets")
      .select("wallet_address")
      .eq("wallet_address", walletAddress.toLowerCase())
      .eq("is_active", true)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" error, which is fine
      console.error("Error checking admin wallet:", error);
      // If table doesn't exist, fall back to env variable check
      const isInEnv = ADMIN_WALLETS.length > 0 && ADMIN_WALLETS.includes(normalizedAddress);
      console.log("Supabase error, falling back to env check:", isInEnv);
      return isInEnv;
    }

    if (data) {
      console.log("Wallet found in Supabase");
      return true;
    }
    
    // Not found in Supabase, check env again
    const isInEnv = ADMIN_WALLETS.length > 0 && ADMIN_WALLETS.includes(normalizedAddress);
    console.log("Not in Supabase, checking env:", isInEnv);
    return isInEnv;
  } catch (error) {
    console.error("Error checking admin wallet:", error);
    // Fall back to env variable check
    const isInEnv = ADMIN_WALLETS.length > 0 && ADMIN_WALLETS.includes(normalizedAddress);
    console.log("Exception, falling back to env check:", isInEnv);
    return isInEnv;
  }
}

/**
 * Create admin session
 */
export async function createAdminSession(walletAddress: string, signature?: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: `${walletAddress}@admin.local`,
      password: walletAddress, // In production, use proper authentication
    });

    if (error) {
      // If user doesn't exist, create one
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: `${walletAddress}@admin.local`,
        password: walletAddress,
      });

      if (signUpError) {
        throw signUpError;
      }

      return signUpData;
    }

    return data;
  } catch (error) {
    console.error("Error creating admin session:", error);
    throw error;
  }
}

