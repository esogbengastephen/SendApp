import { supabase, supabaseAdmin } from "./supabase";
import { nanoid } from "nanoid";

export interface AuthUser {
  id: string;
  email: string;
  walletAddress?: string; // Can be linked later
  referralCode: string;
  referredBy?: string;
  emailVerified: boolean;
  createdAt: Date;
  // Transaction stats (from existing user system)
  firstTransactionAt?: Date;
  lastTransactionAt?: Date;
  totalTransactions: number;
  totalSpentNGN: number;
  totalReceivedSEND: string;
  sendtag?: string;
}

/**
 * Generate a 6-digit confirmation code
 */
export function generateConfirmationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a unique referral code
 */
export function generateReferralCode(): string {
  return nanoid(8).toUpperCase();
}

/**
 * Send confirmation code to email
 */
export async function sendConfirmationCode(
  email: string
): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: "Invalid email address" };
    }

    const code = generateConfirmationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Code expires in 10 minutes

    // Store code in Supabase
    const { error: dbError, data } = await supabase
      .from("confirmation_codes")
      .insert({
        email: email.toLowerCase().trim(),
        code,
        expires_at: expiresAt.toISOString(),
        used: false,
      })
      .select();

    if (dbError) {
      console.error("[Auth] Error storing confirmation code:", dbError);
      console.error("[Auth] Error code:", dbError.code);
      console.error("[Auth] Error message:", dbError.message);
      console.error("[Auth] Error details:", dbError.details);
      console.error("[Auth] Error hint:", dbError.hint);
      
      // Provide more helpful error messages
      if (dbError.code === "42P01" || dbError.message?.includes("does not exist")) {
        return { 
          success: false, 
          error: "Database table not found. Please run the migration: supabase/migrations/002_create_auth_tables.sql" 
        };
      }
      
      // Only check for actual API key errors (specific error codes)
      if (dbError.code === "PGRST301" || dbError.code === "PGRST302" || 
          (dbError.message?.includes("Invalid API key") && !dbError.message?.includes("row-level security"))) {
        return {
          success: false,
          error: "Invalid Supabase API key. Please check your NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local and restart the server."
        };
      }
      
      if (dbError.code === "42501" || dbError.message?.includes("permission denied") || dbError.message?.includes("row-level security")) {
        return { 
          success: false, 
          error: "Database permission error. Please run: supabase/migrations/003_fix_rls_policies.sql" 
        };
      }
      
      return { 
        success: false, 
        error: `Failed to generate confirmation code: ${dbError.message || "Database error"}` 
      };
    }
    
    console.log("[Auth] ✅ Confirmation code stored successfully");

    // Note: Email sending is handled by the API route that calls this function
    // This function only stores the code in the database
    return { success: true, code };
  } catch (error: any) {
    console.error("Error sending confirmation code:", error);
    return { success: false, error: error.message || "Internal server error" };
  }
}

/**
 * Verify confirmation code
 */
export async function verifyConfirmationCode(
  email: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("confirmation_codes")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .eq("code", code)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: "Invalid or expired confirmation code" };
    }

    // Mark code as used
    await supabase
      .from("confirmation_codes")
      .update({ used: true })
      .eq("id", data.id);

    return { success: true };
  } catch (error: any) {
    console.error("Error verifying confirmation code:", error);
    return { success: false, error: error.message || "Internal server error" };
  }
}

/**
 * Check if referral code exists
 */
export async function checkReferralCode(
  referralCode: string
): Promise<{ exists: boolean; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("referral_code")
      .eq("referral_code", referralCode.toUpperCase().trim())
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      return { exists: false, error: "Error checking referral code" };
    }

    return { exists: !!data };
  } catch (error: any) {
    return { exists: false, error: error.message };
  }
}

/**
 * Create user account in Supabase
 */
export async function createUser(
  email: string,
  referralCode?: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  try {
    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking existing user:", checkError);
      if (checkError.code === "42P01" || checkError.message?.includes("does not exist")) {
        return { 
          success: false, 
          error: "Database table not found. Please run the migration: supabase/migrations/002_create_auth_tables.sql" 
        };
      }
    }

    if (existingUser) {
      return { success: false, error: "User already exists" };
    }

    // Validate referral code if provided
    let referredBy: string | undefined;
    if (referralCode) {
      const referralCheck = await checkReferralCode(referralCode);
      if (!referralCheck.exists) {
        return { success: false, error: "Invalid referral code" };
      }
      referredBy = referralCode.toUpperCase().trim();
    }

    // Generate unique referral code for new user
    let userReferralCode = generateReferralCode();
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      const { data } = await supabase
        .from("users")
        .select("referral_code")
        .eq("referral_code", userReferralCode)
        .maybeSingle();
      
      if (!data) {
        isUnique = true;
      } else {
        userReferralCode = generateReferralCode();
        attempts++;
      }
    }

    // Check if we're using service role key or falling back to anon key
    const isUsingServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY && 
                                !process.env.SUPABASE_SERVICE_ROLE_KEY.includes("placeholder");
    
    if (!isUsingServiceRole) {
      console.warn("[Auth] WARNING: SUPABASE_SERVICE_ROLE_KEY not set. Using anon key which may be blocked by RLS policies.");
      console.warn("[Auth] For user creation, either set SUPABASE_SERVICE_ROLE_KEY or ensure RLS policies allow public insert.");
    }

    // Create user in Supabase (use admin client to bypass RLS if available)
    console.log("[Auth] Attempting to create user with", isUsingServiceRole ? "service role key" : "anon key");
    const { data: newUser, error } = await supabaseAdmin
      .from("users")
      .insert({
        email: email.toLowerCase().trim(),
        referral_code: userReferralCode,
        referred_by: referredBy,
        email_verified: true, // Verified via confirmation code
        total_transactions: 0,
        total_spent_ngn: 0,
        total_received_send: "0.00",
      })
      .select()
      .single();

    if (error) {
      console.error("[Auth] ========== FULL ERROR DETAILS ==========");
      console.error("[Auth] Error creating user:", error);
      console.error("[Auth] Error code:", error.code);
      console.error("[Auth] Error message:", error.message);
      console.error("[Auth] Error details:", error.details);
      console.error("[Auth] Error hint:", error.hint);
      console.error("[Auth] Full error object:", JSON.stringify(error, null, 2));
      console.error("[Auth] ========================================");
      
      // Check for RLS errors first (most common issue)
      if (error.message?.includes("row-level security") || 
          error.message?.includes("policy") || 
          error.code === "42501" ||
          error.message?.includes("permission denied") ||
          error.message?.includes("new row violates row-level security")) {
        return {
          success: false,
          error: "Database permission error. Please run the RLS fix in Supabase SQL Editor: supabase/migrations/004_complete_rls_fix.sql"
        };
      }
      
      // Check for table not found
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return { 
          success: false, 
          error: "Database table not found. Please run: supabase/migrations/002_create_auth_tables.sql" 
        };
      }
      
      // Check for API key errors (only specific error codes, not generic JWT messages)
      if (error.code === "PGRST301" || 
          error.code === "PGRST302" ||
          (error.message?.includes("Invalid API key") && !error.message?.includes("row-level security"))) {
        return {
          success: false,
          error: "Invalid Supabase API key. Please check your NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
        };
      }
      
      return { 
        success: false, 
        error: `Failed to create user account: ${error.message || "Database error"}` 
      };
    }

    return {
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        walletAddress: newUser.wallet_address,
        referralCode: newUser.referral_code,
        referredBy: newUser.referred_by,
        emailVerified: newUser.email_verified,
        createdAt: new Date(newUser.created_at),
        totalTransactions: newUser.total_transactions || 0,
        totalSpentNGN: parseFloat(newUser.total_spent_ngn?.toString() || "0"),
        totalReceivedSEND: newUser.total_received_send || "0.00",
        firstTransactionAt: newUser.first_transaction_at ? new Date(newUser.first_transaction_at) : undefined,
        lastTransactionAt: newUser.last_transaction_at ? new Date(newUser.last_transaction_at) : undefined,
        sendtag: newUser.sendtag,
      },
    };
  } catch (error: any) {
    console.error("Error creating user:", error);
    return { success: false, error: error.message || "Internal server error" };
  }
}

/**
 * Get user by email from Supabase
 */
export async function getUserByEmail(
  email: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: "User not found" };
    }

    return {
      success: true,
      user: {
        id: data.id,
        email: data.email,
        walletAddress: data.wallet_address,
        referralCode: data.referral_code,
        referredBy: data.referred_by,
        emailVerified: data.email_verified,
        createdAt: new Date(data.created_at),
        totalTransactions: data.total_transactions || 0,
        totalSpentNGN: parseFloat(data.total_spent_ngn?.toString() || "0"),
        totalReceivedSEND: data.total_received_send || "0.00",
        firstTransactionAt: data.first_transaction_at ? new Date(data.first_transaction_at) : undefined,
        lastTransactionAt: data.last_transaction_at ? new Date(data.last_transaction_at) : undefined,
        sendtag: data.sendtag,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Link wallet address to email user (for future use)
 */
export async function linkWalletToUser(
  email: string,
  walletAddress: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("users")
      .update({ wallet_address: walletAddress.toLowerCase().trim() })
      .eq("email", email.toLowerCase().trim());

    if (error) {
      return { success: false, error: "Failed to link wallet address" };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

