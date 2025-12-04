/**
 * Transaction tracking utilities
 * Now uses Supabase for persistence with in-memory fallback for backward compatibility
 */

import {
  createSupabaseTransaction,
  updateSupabaseTransaction,
  getSupabaseTransaction,
  SupabaseTransaction,
} from "./supabase-users";

export interface VerificationAttempt {
  attemptNumber: number;
  point1Verified: boolean;
  point2Verified: boolean;
  point3Verified: boolean;
  allPointsVerified: boolean;
  paystackReference?: string;
  errorMessage?: string;
  createdAt: Date;
}

export interface Transaction {
  transactionId: string;
  idempotencyKey?: string; // Same as transactionId, used for idempotency
  paystackReference: string;
  ngnAmount: number;
  sendAmount: string;
  walletAddress: string;
  userId?: string; // User ID (UUID) from Supabase users table
  status: "pending" | "completed" | "failed";
  createdAt: Date;
  initializedAt?: Date; // When transaction ID was first created
  completedAt?: Date;
  lastCheckedAt?: Date; // Last payment verification attempt
  verificationAttempts?: number;
  verificationHistory?: VerificationAttempt[];
  txHash?: string; // Blockchain transaction hash
  errorMessage?: string;
  sendtag?: string; // If user used SendTag instead of wallet address
  exchangeRate?: number; // Exchange rate at time of transaction
  expiresAt?: Date; // Timestamp when pending transaction expires (1 hour after creation)
  fee_ngn?: number; // Transaction fee in NGN
  fee_in_send?: string; // Transaction fee in $SEND
}

// In-memory storage (kept for backward compatibility during migration)
const transactions = new Map<string, Transaction>();

/**
 * Convert Supabase transaction to Transaction interface
 */
function convertSupabaseTransaction(supabaseTx: SupabaseTransaction): Transaction {
  return {
    transactionId: supabaseTx.transaction_id,
    idempotencyKey: supabaseTx.transaction_id,
    paystackReference: supabaseTx.paystack_reference || "",
    ngnAmount: parseFloat(supabaseTx.ngn_amount.toString()),
    sendAmount: supabaseTx.send_amount,
    walletAddress: supabaseTx.wallet_address,
    userId: supabaseTx.user_id,
    status: supabaseTx.status,
    createdAt: new Date(supabaseTx.created_at),
    initializedAt: supabaseTx.initialized_at ? new Date(supabaseTx.initialized_at) : undefined,
    completedAt: supabaseTx.completed_at ? new Date(supabaseTx.completed_at) : undefined,
    lastCheckedAt: supabaseTx.last_checked_at ? new Date(supabaseTx.last_checked_at) : undefined,
    verificationAttempts: supabaseTx.verification_attempts,
    txHash: supabaseTx.tx_hash,
    errorMessage: supabaseTx.error_message,
    sendtag: supabaseTx.sendtag,
    exchangeRate: supabaseTx.exchange_rate ? parseFloat(supabaseTx.exchange_rate.toString()) : undefined,
    expiresAt: supabaseTx.expires_at ? new Date(supabaseTx.expires_at) : undefined,
    fee_ngn: supabaseTx.fee_ngn ? parseFloat(supabaseTx.fee_ngn.toString()) : undefined,
    fee_in_send: supabaseTx.fee_in_send,
  };
}

/**
 * Get all transactions
 */
export function getAllTransactions(): Transaction[] {
  return Array.from(transactions.values());
}

/**
 * Get transactions by status
 */
export function getTransactionsByStatus(status: Transaction["status"]): Transaction[] {
  return Array.from(transactions.values()).filter((tx) => tx.status === status);
}

/**
 * Store a new transaction (async - uses Supabase)
 * Falls back to in-memory if Supabase fails
 */
export async function createTransaction(
  data: Omit<Transaction, "createdAt" | "status" | "idempotencyKey" | "verificationAttempts" | "verificationHistory"> & { userId?: string }
): Promise<Transaction> {
  // Try Supabase first
  try {
    const supabaseResult = await createSupabaseTransaction({
      transaction_id: data.transactionId,
      user_id: data.userId,
      wallet_address: data.walletAddress,
      paystack_reference: data.paystackReference,
      ngn_amount: data.ngnAmount,
      send_amount: data.sendAmount,
      status: "pending",
      sendtag: data.sendtag,
      exchange_rate: data.exchangeRate,
      initialized_at: data.initializedAt?.toISOString(),
      fee_ngn: data.fee_ngn,
      fee_in_send: data.fee_in_send,
    });

    if (supabaseResult.success && supabaseResult.transaction) {
      console.log(`[Transaction Storage] ✅ Created transaction in Supabase: ${data.transactionId}`);
      const transaction = convertSupabaseTransaction(supabaseResult.transaction);
      // Cache in memory for verification and backward compatibility
      transactions.set(data.transactionId, transaction);
      console.log(`[Transaction Storage] ✅ Cached in memory: ${data.transactionId}`);
      return transaction;
    }
  } catch (error) {
    console.error(`[Transaction Storage] ⚠️ Supabase failed, falling back to in-memory:`, error);
  }

  // Fallback to in-memory
  const existing = transactions.get(data.transactionId);
  if (existing) {
    console.log(`[Transaction Storage] Transaction ${data.transactionId} already exists (idempotency check). Returning existing transaction.`);
    return existing;
  }

  const transaction: Transaction = {
    ...data,
    idempotencyKey: data.transactionId,
    status: "pending",
    createdAt: new Date(),
    initializedAt: data.initializedAt || new Date(),
    verificationAttempts: 0,
  };
  transactions.set(data.transactionId, transaction);
  console.log(`[Transaction Storage] Created new transaction in memory: ${data.transactionId} for wallet ${data.walletAddress}`);
  return transaction;
}

/**
 * Synchronous version for backward compatibility
 * @deprecated Use createTransaction (async) instead
 */
export function createTransactionSync(data: Omit<Transaction, "createdAt" | "status" | "idempotencyKey" | "verificationAttempts" | "verificationHistory" | "userId">): Transaction {
  const existing = transactions.get(data.transactionId);
  if (existing) {
    console.log(`[Transaction Storage] Transaction ${data.transactionId} already exists (idempotency check).`);
    return existing;
  }

  const transaction: Transaction = {
    ...data,
    idempotencyKey: data.transactionId,
    status: "pending",
    createdAt: new Date(),
    initializedAt: data.initializedAt || new Date(),
    verificationAttempts: 0,
    userId: data.walletAddress.toLowerCase().trim(),
  };
  transactions.set(data.transactionId, transaction);
  console.log(`[Transaction Storage] Created new transaction in memory: ${data.transactionId}`);
  return transaction;
}

/**
 * Get a transaction by ID (async - checks Supabase first, then in-memory)
 */
export async function getTransaction(transactionId: string): Promise<Transaction | undefined> {
  // Check in-memory cache first for speed
  const cached = transactions.get(transactionId);
  if (cached) {
    return cached;
  }

  // Try Supabase if not in cache
  try {
    const supabaseResult = await getSupabaseTransaction(transactionId);
    if (supabaseResult.success && supabaseResult.transaction) {
      const transaction = convertSupabaseTransaction(supabaseResult.transaction);
      // Cache in memory for future access
      transactions.set(transactionId, transaction);
      return transaction;
    }
  } catch (error) {
    console.error(`[Transaction Storage] Error fetching from Supabase:`, error);
  }

  return undefined;
}

/**
 * Get a transaction by ID (synchronous - in-memory only)
 * @deprecated Use getTransaction (async) instead
 */
export function getTransactionSync(transactionId: string): Transaction | undefined {
  return transactions.get(transactionId);
}

/**
 * Get a transaction by Paystack reference
 */
export function getTransactionByReference(reference: string): Transaction | undefined {
  for (const transaction of transactions.values()) {
    if (transaction.paystackReference === reference) {
      return transaction;
    }
  }
  return undefined;
}

/**
 * Update transaction status (async - updates Supabase)
 */
export async function updateTransaction(
  transactionId: string,
  updates: Partial<Transaction>
): Promise<Transaction | null> {
  // Try Supabase first
  try {
    const supabaseUpdates: any = {};
    
    if (updates.status) supabaseUpdates.status = updates.status;
    if (updates.ngnAmount) supabaseUpdates.ngn_amount = updates.ngnAmount;
    if (updates.sendAmount) supabaseUpdates.send_amount = updates.sendAmount;
    if (updates.walletAddress) supabaseUpdates.wallet_address = updates.walletAddress;
    if (updates.paystackReference) supabaseUpdates.paystack_reference = updates.paystackReference;
    if (updates.txHash) supabaseUpdates.tx_hash = updates.txHash;
    if (updates.sendtag) supabaseUpdates.sendtag = updates.sendtag;
    if (updates.exchangeRate) supabaseUpdates.exchange_rate = updates.exchangeRate;
    if (updates.fee_ngn !== undefined) supabaseUpdates.fee_ngn = updates.fee_ngn;
    if (updates.fee_in_send) supabaseUpdates.fee_in_send = updates.fee_in_send;
    if (updates.errorMessage) supabaseUpdates.error_message = updates.errorMessage;
    if (updates.verificationAttempts !== undefined) supabaseUpdates.verification_attempts = updates.verificationAttempts;
    if (updates.completedAt) supabaseUpdates.completed_at = updates.completedAt.toISOString();
    if (updates.lastCheckedAt) supabaseUpdates.last_checked_at = updates.lastCheckedAt.toISOString();
    
    // Auto-set completed_at if status is completed
    if (updates.status === "completed" && !updates.completedAt) {
      supabaseUpdates.completed_at = new Date().toISOString();
    }

    const supabaseResult = await updateSupabaseTransaction(transactionId, supabaseUpdates);
    if (supabaseResult.success && supabaseResult.transaction) {
      console.log(`[Transaction Storage] ✅ Updated transaction in Supabase: ${transactionId}`);
      const transaction = convertSupabaseTransaction(supabaseResult.transaction);
      // Update memory cache
      transactions.set(transactionId, transaction);
      console.log(`[Transaction Storage] ✅ Updated memory cache: ${transactionId}`);
      return transaction;
    }
  } catch (error) {
    console.error(`[Transaction Storage] ⚠️ Supabase update failed, falling back to in-memory:`, error);
  }

  // Fallback to in-memory
  const transaction = transactions.get(transactionId);
  if (!transaction) {
    return null;
  }

  const updated = {
    ...transaction,
    ...updates,
    completedAt: updates.status === "completed" ? new Date() : transaction.completedAt,
  };

  transactions.set(transactionId, updated);
  return updated;
}

/**
 * Update transaction (synchronous - in-memory only)
 * @deprecated Use updateTransaction (async) instead
 */
export function updateTransactionSync(
  transactionId: string,
  updates: Partial<Transaction>
): Transaction | null {
  const transaction = transactions.get(transactionId);
  if (!transaction) {
    return null;
  }

  const updated = {
    ...transaction,
    ...updates,
    completedAt: updates.status === "completed" ? new Date() : transaction.completedAt,
  };

  transactions.set(transactionId, updated);
  return updated;
}

/**
 * Check if a transaction has already been processed
 */
export function isTransactionProcessed(reference: string): boolean {
  const transaction = getTransactionByReference(reference);
  return transaction?.status === "completed" || false;
}

/**
 * Calculate sendAmount from ngnAmount and exchangeRate
 */
export function calculateSendAmount(ngnAmount: number, exchangeRate: number): string {
  // Validate inputs
  if (isNaN(ngnAmount) || ngnAmount <= 0) {
    console.error(`[calculateSendAmount] Invalid ngnAmount: ${ngnAmount}`);
    return "0.00";
  }
  if (isNaN(exchangeRate) || exchangeRate <= 0) {
    console.error(`[calculateSendAmount] Invalid exchangeRate: ${exchangeRate}`);
    return "0.00";
  }
  const result = (ngnAmount * exchangeRate).toFixed(2);
  return result;
}

/**
 * Get sendAmount for a transaction, calculating if missing
 */
export function getSendAmountForTransaction(transaction: Transaction): string {
  if (transaction.sendAmount && parseFloat(transaction.sendAmount) > 0) {
    return transaction.sendAmount;
  }
  
  // Calculate from stored exchangeRate if available
  if (transaction.exchangeRate && transaction.ngnAmount) {
    return calculateSendAmount(transaction.ngnAmount, transaction.exchangeRate);
  }
  
  return "0.00";
}

/**
 * Find pending transaction by wallet address and amount
 */
export function findPendingTransactionByWalletAndAmount(
  walletAddress: string,
  ngnAmount: number
): Transaction | undefined {
  const normalizedWallet = walletAddress.toLowerCase().trim();
  return getAllTransactions().find(
    (tx) =>
      tx.walletAddress.toLowerCase() === normalizedWallet &&
      tx.status === "pending" &&
      Math.abs(tx.ngnAmount - ngnAmount) < 0.01
  );
}

/**
 * Find completed transaction by wallet address and amount
 */
export function findCompletedTransactionByWalletAndAmount(
  walletAddress: string,
  ngnAmount: number
): Transaction | undefined {
  const normalizedWallet = walletAddress.toLowerCase().trim();
  return getAllTransactions().find(
    (tx) =>
      tx.walletAddress.toLowerCase() === normalizedWallet &&
      tx.status === "completed" &&
      Math.abs(tx.ngnAmount - ngnAmount) < 0.01
  );
}

/**
 * Check idempotency - ensure transaction ID hasn't been used
 */
export function checkIdempotency(transactionId: string): boolean {
  return !transactions.has(transactionId);
}

/**
 * Add verification attempt to transaction history
 */
export function addVerificationAttempt(
  transactionId: string,
  attempt: Omit<VerificationAttempt, "attemptNumber" | "createdAt">
): void {
  const transaction = transactions.get(transactionId);
  if (!transaction) {
    console.error(`[Verification] Transaction ${transactionId} not found for verification attempt`);
    return;
  }

  const attemptNumber = (transaction.verificationAttempts ?? 0) + 1;
  const verificationAttempt: VerificationAttempt = {
    ...attempt,
    attemptNumber,
    createdAt: new Date(),
  };

  const history = transaction.verificationHistory || [];
  history.push(verificationAttempt);

  updateTransaction(transactionId, {
    verificationAttempts: attemptNumber,
    verificationHistory: history,
    lastCheckedAt: new Date(),
  });

  console.log(`[Verification] Added attempt ${attemptNumber} for transaction ${transactionId}. All points verified: ${attempt.allPointsVerified}`);
}

/**
 * Get transactions by Paystack reference
 */
export function getTransactionsByPaystackReference(reference: string): Transaction[] {
  return getAllTransactions().filter((tx) => tx.paystackReference === reference);
}

