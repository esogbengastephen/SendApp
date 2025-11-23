/**
 * Transaction tracking utilities
 * In production, this should use a database (PostgreSQL, MongoDB, etc.)
 * For now, we'll use in-memory storage as a placeholder
 */

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
  userId?: string; // Wallet address of the user (for linking to user record)
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
}

// In-memory storage (replace with database in production)
const transactions = new Map<string, Transaction>();

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
 * Store a new transaction
 */
export function createTransaction(data: Omit<Transaction, "createdAt" | "status" | "idempotencyKey" | "verificationAttempts" | "verificationHistory" | "userId">): Transaction {
  // Check idempotency: if transaction ID already exists, return existing transaction
  const existing = transactions.get(data.transactionId);
  if (existing) {
    console.log(`[Transaction Storage] Transaction ${data.transactionId} already exists (idempotency check). Returning existing transaction.`);
    return existing;
  }

  // Set userId to wallet address for linking to user record
  const transaction: Transaction = {
    ...data,
    idempotencyKey: data.transactionId, // Same as transactionId for idempotency (always set for new transactions)
    status: "pending",
    createdAt: new Date(),
    initializedAt: data.initializedAt || new Date(),
    verificationAttempts: 0, // Always start at 0 for new transactions
    userId: data.walletAddress.toLowerCase().trim(),
  };
  transactions.set(data.transactionId, transaction);
  console.log(`[Transaction Storage] Created new transaction: ${data.transactionId} for wallet ${data.walletAddress}`);
  return transaction;
}

/**
 * Get a transaction by ID
 */
export function getTransaction(transactionId: string): Transaction | undefined {
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
 * Update transaction status
 */
export function updateTransaction(
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

