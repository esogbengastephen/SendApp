import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getAllUsers } from "@/lib/users";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const stats = searchParams.get("stats");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "25");
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    
    // Transaction filters
    const minTransactions = searchParams.get("minTransactions");
    const maxTransactions = searchParams.get("maxTransactions");
    const minSpent = searchParams.get("minSpent");
    const maxSpent = searchParams.get("maxSpent");
    const transactionDateFrom = searchParams.get("transactionDateFrom");
    const transactionDateTo = searchParams.get("transactionDateTo");
    const hasTransactions = searchParams.get("hasTransactions") || "all"; // 'all', 'yes', 'no'

    // Return user statistics
    if (stats === "true") {
      // Get all users
      const { data: emailUsers, error: emailError } = await supabase
        .from("users")
        .select("id, email, created_at");

      if (emailError) {
        console.error("Error fetching user stats:", emailError);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const newUsersToday = (emailUsers || []).filter(
        (user) => new Date(user.created_at) >= today
      ).length;

      const totalUsers = emailUsers?.length || 0;

      // Calculate stats from transactions table (accurate)
      const { data: transactions } = await supabase
        .from("transactions")
        .select("status, ngn_amount, send_amount");

      const totalTransactions = transactions?.filter(t => t.status === "completed").length || 0;
      const totalRevenue = transactions
        ?.filter(t => t.status === "completed")
        .reduce((sum, t) => sum + parseFloat(t.ngn_amount || "0"), 0) || 0;

      console.log(`[Users API Stats] ${totalUsers} users, ${newUsersToday} new today, ${totalTransactions} transactions, ₦${totalRevenue.toLocaleString()} revenue`);

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

    // Get all users with pagination
    let query = supabase
      .from("users")
      .select("id, email, referral_code, referral_count, referred_by, created_at, sendtag, is_blocked, requires_reset, blocked_at, blocked_reason", { count: "exact" });

    // Apply search filter
    if (search) {
      query = query.or(`email.ilike.%${search}%,referral_code.ilike.%${search}%`);
    }

    // Apply sorting
    const validSortColumns = ["created_at", "email", "referral_count"];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : "created_at";
    query = query.order(sortColumn, { ascending: sortOrder === "asc" });

    // Get total count for all users (before pagination)
    const { count: totalCount } = await query;

    // Get ALL users (we'll paginate after filtering)
    const { data: emailUsers, error: emailError } = await query;

    if (emailError) {
      console.error("Error fetching users:", emailError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    // For each user, calculate their stats from transactions table
    const usersWithStats = await Promise.all(
      (emailUsers || []).map(async (user) => {
        // Get user's transaction statistics with date filter if provided
        let transactionQuery = supabase
          .from("transactions")
          .select("status, ngn_amount, send_amount, created_at, tx_hash")
          .eq("user_id", user.id);
        
        // Apply date filters if provided
        if (transactionDateFrom) {
          transactionQuery = transactionQuery.gte("created_at", transactionDateFrom);
        }
        if (transactionDateTo) {
          // Add one day to include the entire end date
          const endDate = new Date(transactionDateTo);
          endDate.setDate(endDate.getDate() + 1);
          transactionQuery = transactionQuery.lt("created_at", endDate.toISOString());
        }
        
        const { data: userTransactions } = await transactionQuery;

        const completedTransactions = userTransactions?.filter(t => t.status === "completed") || [];
        
        const totalTransactions = completedTransactions.length;
        const totalSpentNGN = completedTransactions.reduce(
          (sum, t) => sum + parseFloat(t.ngn_amount || "0"),
          0
        );
        const totalReceivedSEND = completedTransactions.reduce(
          (sum, t) => sum + parseFloat(t.send_amount || "0"),
          0
        ).toFixed(2);

        const firstTransaction = completedTransactions.length > 0
          ? completedTransactions.sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )[0]
          : null;

        const lastTransaction = completedTransactions.length > 0
          ? completedTransactions.sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0]
          : null;

        // Get user's linked wallets
        const { data: linkedWallets } = await supabase
          .from("user_wallets")
          .select("wallet_address")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);

        return {
          id: user.id,
          email: user.email,
          walletAddress: linkedWallets && linkedWallets.length > 0 ? linkedWallets[0].wallet_address : null,
          referralCode: user.referral_code,
          referralCount: user.referral_count || 0,
          referredBy: user.referred_by || null,
          sendtag: user.sendtag || null,
          totalTransactions,
          totalSpentNGN,
          totalReceivedSEND,
          firstTransactionAt: firstTransaction?.created_at || null,
          lastTransactionAt: lastTransaction?.created_at || null,
          createdAt: user.created_at,
          userType: "email" as const,
          isBlocked: user.is_blocked || false,
          requiresReset: user.requires_reset || false,
          blockedAt: user.blocked_at,
          blockedReason: user.blocked_reason,
        };
      })
    );
    
    // Apply transaction filters
    let filteredUsers = usersWithStats;
    
    // Filter by transaction count
    if (minTransactions) {
      const min = parseInt(minTransactions);
      filteredUsers = filteredUsers.filter(user => user.totalTransactions >= min);
    }
    if (maxTransactions) {
      const max = parseInt(maxTransactions);
      filteredUsers = filteredUsers.filter(user => user.totalTransactions <= max);
    }
    
    // Filter by spent amount
    if (minSpent) {
      const min = parseFloat(minSpent);
      filteredUsers = filteredUsers.filter(user => user.totalSpentNGN >= min);
    }
    if (maxSpent) {
      const max = parseFloat(maxSpent);
      filteredUsers = filteredUsers.filter(user => user.totalSpentNGN <= max);
    }
    
    // Filter by has transactions
    if (hasTransactions === "yes") {
      filteredUsers = filteredUsers.filter(user => user.totalTransactions > 0);
    } else if (hasTransactions === "no") {
      filteredUsers = filteredUsers.filter(user => user.totalTransactions === 0);
    }
    
    // Apply pagination AFTER all filters
    const totalFiltered = filteredUsers.length;
    const totalPages = Math.ceil(totalFiltered / pageSize);
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    const paginatedUsers = filteredUsers.slice(from, to);

    return NextResponse.json({
      success: true,
      users: paginatedUsers,
      pagination: {
        page,
        pageSize,
        totalCount: totalFiltered,
        totalPages: totalPages,
      },
    });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
