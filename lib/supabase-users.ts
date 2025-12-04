/**
 * Supabase user and wallet management
 * 
 * Key Concepts:
 * - Users are identified by EMAIL (primary identifier)
 * - One user can have MULTIPLE wallets
 * - Multiple users CAN share the same wallet address
 * - Transaction stats are tracked per wallet AND aggregated per user
 */

import { supabase, supabaseAdmin } from "@/lib/supabase";

export interface SupabaseUser {
  id: string;
  email: string;
  referral_code: string;
  referred_by?: string;
  referral_count?: number;
  email_verified: boolean;
  total_transactions: number;
  total_spent_ngn: number;
  total_received_send: string;
  first_transaction_at?: string;
  last_transaction_at?: string;
  sendtag?: string;
  created_at: string;
  updated_at: string;
}

export interface UserWallet {
  id: string;
  user_id: string;
  wallet_address: string;
  sendtag?: string;
  total_transactions: number;
  total_spent_ngn: number;
  total_received_send: string;
  first_transaction_at?: string;
  last_transaction_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SupabaseTransaction {
  id: string;
  transaction_id: string;
  user_id?: string;
  wallet_address: string;
  paystack_reference?: string;
  ngn_amount: number;
  send_amount: string;
  status: "pending" | "completed" | "failed";
  tx_hash?: string;
  sendtag?: string;
  exchange_rate?: number;
  error_message?: string;
  verification_attempts: number;
  created_at: string;
  initialized_at?: string;
  completed_at?: string;
  last_checked_at?: string;
  expires_at?: string; // Timestamp when pending transaction expires (1 hour after creation)
  fee_ngn?: number; // Transaction fee in NGN
  fee_in_send?: string; // Transaction fee in $SEND
}

/**
 * Link a wallet to a user (or return existing if already linked)
 */
export async function linkWalletToUser(
  userId: string,
  walletAddress: string,
  sendtag?: string
): Promise<{ success: boolean; wallet?: UserWallet; error?: string }> {
  try {
    const normalizedWallet = walletAddress.toLowerCase().trim();

    console.log(`[Supabase Users] Linking wallet ${normalizedWallet} to user ${userId}`);

    // Check if this user already has this wallet
    const { data: existing, error: checkError } = await supabase
      .from("user_wallets")
      .select("*")
      .eq("user_id", userId)
      .eq("wallet_address", normalizedWallet)
      .maybeSingle();

    if (checkError) {
      console.error("[Supabase Users] Error checking existing wallet:", checkError);
      return { success: false, error: checkError.message };
    }

    if (existing) {
      console.log(`[Supabase Users] Wallet already linked to this user`);
      return { success: true, wallet: existing };
    }

    // Create new wallet link
    const { data, error } = await supabase
      .from("user_wallets")
      .insert({
        user_id: userId,
        wallet_address: normalizedWallet,
        sendtag: sendtag || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[Supabase Users] Error creating wallet link:", error);
      return { success: false, error: error.message };
    }

    console.log(`[Supabase Users] ✅ Successfully linked wallet to user`);
    return { success: true, wallet: data };
  } catch (error: any) {
    console.error("[Supabase Users] Exception in linkWalletToUser:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update wallet transaction stats
 * This automatically triggers user totals update via database trigger
 */
export async function updateWalletStats(
  userId: string,
  walletAddress: string,
  ngnAmount: number,
  sendAmount: string,
  sendtag?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedWallet = walletAddress.toLowerCase().trim();

    console.log(`[Supabase Users] Updating stats for wallet ${normalizedWallet}, user ${userId}`);

    // Get current wallet stats
    const { data: wallet, error: fetchError } = await supabase
      .from("user_wallets")
      .select("*")
      .eq("user_id", userId)
      .eq("wallet_address", normalizedWallet)
      .maybeSingle();

    if (fetchError) {
      console.error("[Supabase Users] Error fetching wallet:", fetchError);
      return { success: false, error: fetchError.message };
    }

    if (!wallet) {
      // Wallet doesn't exist, create it first
      console.log("[Supabase Users] Wallet not found, creating it");
      const linkResult = await linkWalletToUser(userId, normalizedWallet, sendtag);
      if (!linkResult.success) {
        return linkResult;
      }
      // Fetch the newly created wallet
      const { data: newWallet } = await supabase
        .from("user_wallets")
        .select("*")
        .eq("user_id", userId)
        .eq("wallet_address", normalizedWallet)
        .single();
      
      if (!newWallet) {
        return { success: false, error: "Failed to create wallet" };
      }
    }

    // Calculate new totals
    const currentTransactions = wallet?.total_transactions || 0;
    const currentSpentNGN = parseFloat(wallet?.total_spent_ngn?.toString() || "0");
    const currentReceivedSEND = parseFloat(wallet?.total_received_send || "0");

    const newTotalTransactions = currentTransactions + 1;
    const newTotalSpentNGN = currentSpentNGN + ngnAmount;
    const newTotalReceivedSEND = currentReceivedSEND + parseFloat(sendAmount);

    // Update wallet stats
    const { error: updateError } = await supabase
      .from("user_wallets")
      .update({
        total_transactions: newTotalTransactions,
        total_spent_ngn: newTotalSpentNGN.toFixed(2),
        total_received_send: newTotalReceivedSEND.toFixed(2),
        last_transaction_at: new Date().toISOString(),
        first_transaction_at: wallet?.first_transaction_at || new Date().toISOString(),
        sendtag: sendtag || wallet?.sendtag,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("wallet_address", normalizedWallet);

    if (updateError) {
      console.error("[Supabase Users] Error updating wallet stats:", updateError);
      return { success: false, error: updateError.message };
    }

    console.log(`[Supabase Users] ✅ Wallet stats updated. Transactions: ${newTotalTransactions}`);
    // User totals are auto-updated by database trigger
    return { success: true };
  } catch (error: any) {
    console.error("[Supabase Users] Exception in updateWalletStats:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user by email
 */
export async function getSupabaseUserByEmail(
  email: string
): Promise<{ success: boolean; user?: SupabaseUser; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { success: false, error: "User not found" };
      }
      return { success: false, error: error.message };
    }

    return { success: true, user: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get user by ID
 */
export async function getSupabaseUserById(
  userId: string
): Promise<{ success: boolean; user?: SupabaseUser; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, user: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get all wallets for a user
 */
export async function getUserWallets(
  userId: string
): Promise<{ success: boolean; wallets?: UserWallet[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("user_wallets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, wallets: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get wallet by wallet address and user ID
 */
export async function getWallet(
  userId: string,
  walletAddress: string
): Promise<{ success: boolean; wallet?: UserWallet; error?: string }> {
  try {
    const normalizedWallet = walletAddress.toLowerCase().trim();

    const { data, error } = await supabase
      .from("user_wallets")
      .select("*")
      .eq("user_id", userId)
      .eq("wallet_address", normalizedWallet)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "Wallet not found" };
    }

    return { success: true, wallet: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get all users who have used a specific wallet address
 */
export async function getUsersByWalletAddress(
  walletAddress: string
): Promise<{ success: boolean; users?: SupabaseUser[]; error?: string }> {
  try {
    const normalizedWallet = walletAddress.toLowerCase().trim();

    // Get all user_wallet records for this address
    const { data: walletRecords, error: walletError } = await supabase
      .from("user_wallets")
      .select("user_id")
      .eq("wallet_address", normalizedWallet);

    if (walletError) {
      return { success: false, error: walletError.message };
    }

    if (!walletRecords || walletRecords.length === 0) {
      return { success: true, users: [] };
    }

    // Get user details for all user IDs
    const userIds = walletRecords.map(record => record.user_id);
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("*")
      .in("id", userIds);

    if (usersError) {
      return { success: false, error: usersError.message };
    }

    return { success: true, users: users || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Create a transaction record in Supabase
 */
export async function createSupabaseTransaction(
  transactionData: {
    transaction_id: string;
    user_id?: string;
    wallet_address: string;
    paystack_reference?: string;
    ngn_amount: number;
    send_amount: string;
    status?: "pending" | "completed" | "failed";
    sendtag?: string;
    exchange_rate?: number;
    initialized_at?: string;
    fee_ngn?: number;
    fee_in_send?: string;
  }
): Promise<{ success: boolean; transaction?: SupabaseTransaction; error?: string }> {
  try {
    const normalizedWallet = transactionData.wallet_address.toLowerCase().trim();

    console.log(`[Supabase Transactions] Creating transaction ${transactionData.transaction_id}`);

    // Calculate expires_at: 1 hour from now for pending transactions
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
    const status = transactionData.status || "pending";
    
    // Only set expires_at for pending transactions
    const expiresAtValue = status === "pending" ? expiresAt.toISOString() : null;

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        transaction_id: transactionData.transaction_id,
        user_id: transactionData.user_id || null,
        wallet_address: normalizedWallet,
        paystack_reference: transactionData.paystack_reference || null,
        ngn_amount: transactionData.ngn_amount,
        send_amount: transactionData.send_amount,
        status: status,
        sendtag: transactionData.sendtag || null,
        exchange_rate: transactionData.exchange_rate || null,
        initialized_at: transactionData.initialized_at || now.toISOString(),
        expires_at: expiresAtValue,
        verification_attempts: 0,
        fee_ngn: transactionData.fee_ngn || null,
        fee_in_send: transactionData.fee_in_send || null,
      })
      .select()
      .single();

    if (error) {
      // Check if it's a duplicate
      if (error.code === "23505") {
        console.log(`[Supabase Transactions] Transaction already exists (idempotency)`);
        // Fetch existing transaction
        const { data: existing } = await supabase
          .from("transactions")
          .select("*")
          .eq("transaction_id", transactionData.transaction_id)
          .single();
        
        if (existing) {
          return { success: true, transaction: existing };
        }
      }
      console.error("[Supabase Transactions] Error creating transaction:", error);
      return { success: false, error: error.message };
    }

    console.log(`[Supabase Transactions] ✅ Transaction created successfully`);
    return { success: true, transaction: data };
  } catch (error: any) {
    console.error("[Supabase Transactions] Exception in createSupabaseTransaction:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update a transaction in Supabase
 */
export async function updateSupabaseTransaction(
  transactionId: string,
  updates: Partial<SupabaseTransaction>
): Promise<{ success: boolean; transaction?: SupabaseTransaction; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .update(updates)
      .eq("transaction_id", transactionId)
      .select()
      .single();

    if (error) {
      console.error("[Supabase Transactions] Error updating transaction:", error);
      return { success: false, error: error.message };
    }

    return { success: true, transaction: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get transaction by transaction ID
 */
export async function getSupabaseTransaction(
  transactionId: string
): Promise<{ success: boolean; transaction?: SupabaseTransaction; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_id", transactionId)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "Transaction not found" };
    }

    return { success: true, transaction: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get all transactions for a user
 */
export async function getUserTransactions(
  userId: string
): Promise<{ success: boolean; transactions?: SupabaseTransaction[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, transactions: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

