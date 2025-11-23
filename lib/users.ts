/**
 * User tracking utilities
 * Each transaction is associated with a user
 * Users are identified by wallet address (unique)
 */

export interface User {
  walletAddress: string; // Primary key - unique wallet address
  firstTransactionAt: Date; // When user first made a transaction
  lastTransactionAt: Date; // Most recent transaction
  totalTransactions: number; // Count of all transactions
  totalSpentNGN: number; // Total NGN spent
  totalReceivedSEND: string; // Total SEND tokens received
  transactionIds: string[]; // Array of transaction IDs
  sendtag?: string; // If user used SendTag
}

// In-memory storage (replace with database in production)
const users = new Map<string, User>();

/**
 * Get all users
 */
export function getAllUsers(): User[] {
  return Array.from(users.values());
}

/**
 * Get a user by wallet address
 */
export function getUser(walletAddress: string): User | undefined {
  const normalizedWallet = walletAddress.toLowerCase().trim();
  return users.get(normalizedWallet);
}

/**
 * Create or update a user
 * If user exists, update their stats
 * If user doesn't exist, create new user
 */
export function createOrUpdateUser(
  walletAddress: string,
  transactionId: string,
  ngnAmount: number,
  sendAmount: string,
  sendtag?: string
): User {
  const normalizedWallet = walletAddress.toLowerCase().trim();
  const existingUser = users.get(normalizedWallet);

  if (existingUser) {
    // Update existing user
    const updatedUser: User = {
      ...existingUser,
      lastTransactionAt: new Date(),
      totalTransactions: existingUser.totalTransactions + 1,
      totalSpentNGN: existingUser.totalSpentNGN + ngnAmount,
      totalReceivedSEND: (
        parseFloat(existingUser.totalReceivedSEND) + parseFloat(sendAmount)
      ).toFixed(2),
      transactionIds: [...existingUser.transactionIds, transactionId],
      sendtag: sendtag || existingUser.sendtag,
    };
    users.set(normalizedWallet, updatedUser);
    console.log(`[User Storage] Updated user ${normalizedWallet}. Total transactions: ${updatedUser.totalTransactions}`);
    return updatedUser;
  } else {
    // Create new user
    const newUser: User = {
      walletAddress: normalizedWallet,
      firstTransactionAt: new Date(),
      lastTransactionAt: new Date(),
      totalTransactions: 1,
      totalSpentNGN: ngnAmount,
      totalReceivedSEND: sendAmount,
      transactionIds: [transactionId],
      sendtag: sendtag,
    };
    users.set(normalizedWallet, newUser);
    console.log(`[User Storage] Created new user ${normalizedWallet} with transaction ${transactionId}`);
    return newUser;
  }
}

/**
 * Get users by transaction count (for analytics)
 */
export function getUsersByTransactionCount(minTransactions: number = 1): User[] {
  return Array.from(users.values()).filter(
    (user) => user.totalTransactions >= minTransactions
  );
}

/**
 * Get top users by total spent
 */
export function getTopUsersBySpending(limit: number = 10): User[] {
  return Array.from(users.values())
    .sort((a, b) => b.totalSpentNGN - a.totalSpentNGN)
    .slice(0, limit);
}

/**
 * Get user statistics
 */
export function getUserStats(): {
  totalUsers: number;
  newUsersToday: number;
  totalTransactions: number;
  totalRevenue: number;
} {
  const allUsers = getAllUsers();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const newUsersToday = allUsers.filter(
    (user) => user.firstTransactionAt >= today
  ).length;

  const totalTransactions = allUsers.reduce(
    (sum, user) => sum + user.totalTransactions,
    0
  );

  const totalRevenue = allUsers.reduce(
    (sum, user) => sum + user.totalSpentNGN,
    0
  );

  return {
    totalUsers: allUsers.length,
    newUsersToday,
    totalTransactions,
    totalRevenue,
  };
}

