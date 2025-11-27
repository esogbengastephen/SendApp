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
      .select("id, email, referral_code, referral_count, referred_by, created_at, sendtag", { count: "exact" });

    // Apply search filter
    if (search) {
      query = query.or(`email.ilike.%${search}%,referral_code.ilike.%${search}%`);
    }

    // Apply sorting
    const validSortColumns = ["created_at", "email", "referral_count"];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : "created_at";
    query = query.order(sortColumn, { ascending: sortOrder === "asc" });

    // Get total count
    const { count: totalCount } = await query;

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    const { data: emailUsers, error: emailError } = await query.range(from, to);

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
        // Get user's transaction statistics
        const { data: userTransactions } = await supabase
          .from("transactions")
          .select("status, ngn_amount, send_amount, created_at, tx_hash")
          .eq("user_id", user.id);

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
        };
      })
    );

    return NextResponse.json({
      success: true,
      users: usersWithStats,
      pagination: {
        page,
        pageSize,
        totalCount: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / pageSize),
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
