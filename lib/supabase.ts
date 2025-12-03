import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ksdzzqdafodlstfkqzuv.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate that we have a valid anon key
let validAnonKey = supabaseAnonKey;
if (!validAnonKey || validAnonKey.trim() === "" || validAnonKey.includes("placeholder")) {
  console.error("[Supabase] ERROR: NEXT_PUBLIC_SUPABASE_ANON_KEY is not set or is invalid!");
  console.error("[Supabase] Current value:", validAnonKey ? `${validAnonKey.substring(0, 20)}...` : "undefined");
  console.error("[Supabase] Please set it in your .env.local file.");
  console.error("[Supabase] Get it from: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/settings/api");
  // Use a dummy key to prevent app crash, but operations will fail with clear error messages
  validAnonKey = "INVALID_KEY_PLEASE_SET_NEXT_PUBLIC_SUPABASE_ANON_KEY";
} else {
  // Check if it's a valid format (JWT or sb_ format)
  const isJWT = validAnonKey.startsWith("eyJ");
  const isNewFormat = validAnonKey.startsWith("sb_");
  
  if (!isJWT && !isNewFormat) {
    console.warn("[Supabase] WARNING: Key format might be invalid. Expected JWT (starts with 'eyJ') or new format (starts with 'sb_')");
  }
  
  console.log(`[Supabase] ✅ Anon key loaded successfully (${isJWT ? 'JWT' : isNewFormat ? 'New format' : 'Unknown format'})`);
}

// Create Supabase client - use anon key (required)
export const supabase = createClient(supabaseUrl, validAnonKey);

// Create server-side Supabase client with service role key (bypasses RLS)
// Use this for server-side operations that need to bypass RLS
// Falls back to anon key if service role key not available
export const supabaseAdmin = supabaseServiceRoleKey && !supabaseServiceRoleKey.includes("placeholder")
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : supabase; // Fallback to anon key if service role key not available

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
 * Get admin details (role and permissions)
 */
export async function getAdminDetails(walletAddress: string): Promise<{
  isAdmin: boolean;
  role?: "super_admin" | "admin";
  permissions?: string[];
}> {
  const normalizedAddress = walletAddress.toLowerCase().trim();
  
  // Check environment variable first (treat as super_admin)
  if (ADMIN_WALLETS.length > 0 && ADMIN_WALLETS.includes(normalizedAddress)) {
    return {
      isAdmin: true,
      role: "super_admin",
      permissions: [], // Super admin has all permissions
    };
  }

  // Check Supabase for admin wallets
  try {
    const { data, error } = await supabaseAdmin
      .from("admin_wallets")
      .select("role, permissions")
      .eq("wallet_address", normalizedAddress)
      .eq("is_active", true)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error checking admin wallet:", error);
      return { isAdmin: false };
    }

    if (data) {
      return {
        isAdmin: true,
        role: data.role as "super_admin" | "admin",
        permissions: (data.permissions as string[]) || [],
      };
    }
  } catch (error) {
    console.error("Error checking admin wallet:", error);
  }

  return { isAdmin: false };
}

/**
 * Check if wallet is a super admin
 */
export async function isSuperAdmin(walletAddress: string): Promise<boolean> {
  const normalizedAddress = walletAddress.toLowerCase().trim();
  
  // Check environment variable first (treat as super_admin)
  if (ADMIN_WALLETS.length > 0 && ADMIN_WALLETS.includes(normalizedAddress)) {
    return true;
  }

  // Check Supabase
  try {
    const { data, error } = await supabaseAdmin
      .from("admin_wallets")
      .select("role")
      .eq("wallet_address", normalizedAddress)
      .eq("is_active", true)
      .eq("role", "super_admin")
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error checking super admin:", error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error("Error checking super admin:", error);
    return false;
  }
}

/**
 * Check if admin has a specific permission
 * Super admins have all permissions automatically
 */
export async function hasAdminPermission(
  walletAddress: string,
  permission: string
): Promise<boolean> {
  const normalizedAddress = walletAddress.toLowerCase().trim();
  
  // Check if super admin first
  const isSuper = await isSuperAdmin(normalizedAddress);
  if (isSuper) {
    return true; // Super admin has all permissions
  }

  // Check specific permission
  try {
    const { data, error } = await supabaseAdmin
      .from("admin_wallets")
      .select("permissions")
      .eq("wallet_address", normalizedAddress)
      .eq("is_active", true)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error checking admin permission:", error);
      return false;
    }

    if (data && data.permissions) {
      const permissions = data.permissions as string[];
      return permissions.includes(permission);
    }
  } catch (error) {
    console.error("Error checking admin permission:", error);
  }

  return false;
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

/**
 * Update referral count when a user completes their first transaction
 * This is called as a backup to the database trigger
 * The trigger should handle it automatically, but this ensures it works
 */
export async function updateReferralCountOnTransaction(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the user's referred_by code
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("referred_by")
      .eq("id", userId)
      .maybeSingle();

    if (userError) {
      console.error("[Referral] Error fetching user:", userError);
      return { success: false, error: userError.message };
    }

    if (!user || !user.referred_by) {
      // User wasn't referred, nothing to do
      return { success: true };
    }

    // Check if this is the user's first completed transaction
    // Count all completed transactions for this user
    const { count: completedCount, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed");

    if (txError) {
      console.error("[Referral] Error checking previous transactions:", txError);
      return { success: false, error: txError.message };
    }

    // If there's more than 1 completed transaction, this is not the first one
    // (The current transaction is already marked as completed when this function is called)
    if (completedCount && completedCount > 1) {
      // Not the first transaction, referral already counted
      return { success: true };
    }

    // If count is 0 or 1, this is the first completed transaction
    // (0 shouldn't happen since transaction is already completed, but handle it)
    if (completedCount === 0) {
      console.warn("[Referral] No completed transactions found, but transaction should be completed");
      return { success: true }; // Don't increment if no completed transactions found
    }

    // This is the first completed transaction - increment referrer's count
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        referral_count: supabaseAdmin.raw("referral_count + 1"),
        updated_at: new Date().toISOString(),
      })
      .eq("referral_code", user.referred_by);

    if (updateError) {
      console.error("[Referral] Error updating referral count:", updateError);
      return { success: false, error: updateError.message };
    }

    console.log(`[Referral] ✅ Incremented referral count for referrer code: ${user.referred_by}`);
    return { success: true };
  } catch (error: any) {
    console.error("[Referral] Exception updating referral count:", error);
    return { success: false, error: error.message };
  }
}

