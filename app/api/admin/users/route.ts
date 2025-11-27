import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getAllUsers, getUserStats, getTopUsersBySpending } from "@/lib/users";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const top = searchParams.get("top");
    const stats = searchParams.get("stats");

    // Return user statistics
    if (stats === "true") {
      // Get email-based users from Supabase
      const { data: emailUsers, error: emailError } = await supabase
        .from("users")
        .select("id, email, created_at, total_transactions, total_spent_ngn")
        .not("email", "is", null);

      // Get wallet-based users from memory
      const walletUsers = getAllUsers();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Count new email users today
      const newEmailUsersToday = (emailUsers || []).filter(
        (user) => new Date(user.created_at) >= today
      ).length;

      // Count new wallet users today
      const newWalletUsersToday = walletUsers.filter(
        (user) => user.firstTransactionAt >= today
      ).length;

      // Calculate totals
      const totalEmailUsers = emailUsers?.length || 0;
      const totalWalletUsers = walletUsers.length;
      const totalUsers = totalEmailUsers + totalWalletUsers;
      const newUsersToday = newEmailUsersToday + newWalletUsersToday;

      const totalTransactions = 
        (emailUsers?.reduce((sum, u) => sum + (u.total_transactions || 0), 0) || 0) +
        walletUsers.reduce((sum, u) => sum + u.totalTransactions, 0);

      const totalRevenue = 
        (emailUsers?.reduce((sum, u) => sum + parseFloat(u.total_spent_ngn?.toString() || "0"), 0) || 0) +
        walletUsers.reduce((sum, u) => sum + u.totalSpentNGN, 0);

      return NextResponse.json({
        success: true,
        stats: {
          totalUsers,
          newUsersToday,
          totalTransactions,
          totalRevenue,
        },
      });
    }

    // Return top users by spending
    if (top) {
      const limit = parseInt(top) || 10;
      const topUsers = getTopUsersBySpending(limit);
      return NextResponse.json({
        success: true,
        users: topUsers.map((user) => ({
          ...user,
          firstTransactionAt: user.firstTransactionAt.toISOString(),
          lastTransactionAt: user.lastTransactionAt.toISOString(),
        })),
      });
    }

    // Return all users (email-based users only)
    const { data: emailUsers, error: emailError } = await supabase
      .from("users")
      .select("id, email, referral_code, referral_count, referred_by, created_at, total_transactions, total_spent_ngn, total_received_send, first_transaction_at, last_transaction_at, sendtag")
      .order("created_at", { ascending: false });

    const walletUsers = getAllUsers();

    // Combine and format users
    const allUsers: any[] = [];

    // Add email-based users
    if (emailUsers) {
      emailUsers.forEach((user) => {
        allUsers.push({
          id: user.id,
          email: user.email,
          // Note: walletAddress removed - users can have multiple wallets in user_wallets table
          referralCode: user.referral_code,
          referralCount: user.referral_count || 0,
          referredBy: user.referred_by || null,
          sendtag: user.sendtag || null,
          totalTransactions: user.total_transactions || 0,
          totalSpentNGN: parseFloat(user.total_spent_ngn?.toString() || "0"),
          totalReceivedSEND: user.total_received_send || "0.00",
          firstTransactionAt: user.first_transaction_at 
            ? new Date(user.first_transaction_at).toISOString()
            : user.created_at,
          lastTransactionAt: user.last_transaction_at 
            ? new Date(user.last_transaction_at).toISOString()
            : user.created_at,
          createdAt: user.created_at,
          userType: "email",
        });
      });
    }

    // Add wallet-based users (only if they don't have an email)
    walletUsers.forEach((walletUser) => {
      // Check if this wallet is already in email users
      const existsInEmail = emailUsers?.some(
        (eu) => eu.wallet_address?.toLowerCase() === walletUser.walletAddress.toLowerCase()
      );

      if (!existsInEmail) {
        allUsers.push({
          id: walletUser.walletAddress,
          email: null,
          walletAddress: walletUser.walletAddress,
          referralCode: null,
          referralCount: 0,
          referredBy: null,
          sendtag: walletUser.sendtag || null,
          totalTransactions: walletUser.totalTransactions,
          totalSpentNGN: walletUser.totalSpentNGN,
          totalReceivedSEND: walletUser.totalReceivedSEND,
          firstTransactionAt: walletUser.firstTransactionAt.toISOString(),
          lastTransactionAt: walletUser.lastTransactionAt.toISOString(),
          createdAt: walletUser.firstTransactionAt.toISOString(),
          userType: "wallet",
        });
      }
    });

    // Sort by last transaction or created date (newest first)
    allUsers.sort((a, b) => {
      const dateA = new Date(a.lastTransactionAt || a.createdAt).getTime();
      const dateB = new Date(b.lastTransactionAt || b.createdAt).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      success: true,
      users: allUsers,
    });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

