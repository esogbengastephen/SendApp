/**
 * Transaction tracking utilities
 * In production, this should use a database (PostgreSQL, MongoDB, etc.)
 * For now, we'll use in-memory storage as a placeholder
 */

export interface Transaction {
  transactionId: string;
  paystackReference: string;
  ngnAmount: number;
  sendAmount: string;
  walletAddress: string;
  status: "pending" | "completed" | "failed";
  createdAt: Date;
  completedAt?: Date;
  txHash?: string; // Blockchain transaction hash
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
export function createTransaction(data: Omit<Transaction, "createdAt" | "status">): Transaction {
  const transaction: Transaction = {
    ...data,
    status: "pending",
    createdAt: new Date(),
  };
  transactions.set(data.transactionId, transaction);
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

