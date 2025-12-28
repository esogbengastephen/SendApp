import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const minReferrals = searchParams.get("minReferrals");
    const maxReferrals = searchParams.get("maxReferrals");
    const sortBy = searchParams.get("sortBy") || "referral_count";
    const order = searchParams.get("order") || "desc";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "25");
    
    // New filters
    const search = searchParams.get("search") || "";
    const minActiveReferrals = searchParams.get("minActiveReferrals");
    const minReferralSpending = searchParams.get("minReferralSpending");
    const accountDateFrom = searchParams.get("accountDateFrom");
    const accountDateTo = searchParams.get("accountDateTo");
    const referralStatus = searchParams.get("referralStatus") || "all"; // 'all', 'has_referrals', 'no_referrals'
    const hasTransactingReferrals = searchParams.get("hasTransactingReferrals") || "all"; // 'all', 'yes', 'no'
    const hasOwnTransactions = searchParams.get("hasOwnTransactions") || "all"; // 'all', 'yes', 'no' - NEW

    let query = supabase
      .from("users")
      .select("id, email, referral_code, referral_count, referred_by, created_at", { count: "exact" })
      .not("email", "is", null);

    // Apply search filter
    if (search) {
      query = query.or(`email.ilike.%${search}%,referral_code.ilike.%${search}%`);
    }

    // Filter by minimum referrals
    if (minReferrals) {
      query = query.gte("referral_count", parseInt(minReferrals));
    }

    // Filter by maximum referrals
    if (maxReferrals) {
      query = query.lte("referral_count", parseInt(maxReferrals));
    }
    
    // Filter by referral status
    if (referralStatus === "has_referrals") {
      query = query.gt("referral_count", 0);
    } else if (referralStatus === "no_referrals") {
      query = query.eq("referral_count", 0);
    }
    
    // Filter by account creation date
    if (accountDateFrom) {
      query = query.gte("created_at", accountDateFrom);
    }
    if (accountDateTo) {
      const endDate = new Date(accountDateTo);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt("created_at", endDate.toISOString());
    }

    // Sort
    query = query.order(sortBy, { ascending: order === "asc" });

    // Get total count for all users (before pagination)
    const { count: totalCount } = await query;

    // Get ALL users (we'll paginate after filtering)
    const { data, error } = await query;

    if (error) {
      console.error("Error fetching referrals:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch referral data" },
        { status: 500 }
      );
    }

    // Get referred users and transaction metrics for each user
    const usersWithMetrics = await Promise.all(
      (data || []).map(async (user) => {
        // Get referred users
        const { data: referredUsers } = await supabase
          .from("users")
          .select("id, email, created_at")
          .eq("referred_by", user.referral_code);

        // Calculate transaction metrics for their referrals
        let activeReferralsCount = 0;
        let totalReferralSpending = 0;
        let totalReferralTransactions = 0;

        if (referredUsers && referredUsers.length > 0) {
          const referredUserIds = referredUsers.map(ru => ru.id);
          
          // Get all transactions for referred users
          const { data: referralTransactions } = await supabase
            .from("transactions")
            .select("user_id, status, ngn_amount")
            .in("user_id", referredUserIds)
            .eq("status", "completed");

          if (referralTransactions && referralTransactions.length > 0) {
            // Count unique users who made transactions
            const usersWithTransactions = new Set(referralTransactions.map(t => t.user_id));
            activeReferralsCount = usersWithTransactions.size;
            
            // Sum total spending
            totalReferralSpending = referralTransactions.reduce(
              (sum, t) => sum + parseFloat(t.ngn_amount || "0"),
              0
            );
            
            totalReferralTransactions = referralTransactions.length;
          }
        }

        // Get USER'S OWN transaction metrics (NEW)
        const { data: userOwnTransactions } = await supabase
          .from("transactions")
          .select("status, ngn_amount")
          .eq("user_id", user.id)
          .eq("status", "completed");

        const userOwnTransactionCount = userOwnTransactions?.length || 0;
        const userOwnSpending = userOwnTransactions?.reduce(
          (sum, t) => sum + parseFloat(t.ngn_amount || "0"),
          0
        ) || 0;

        return {
          ...user,
          referredUsers: referredUsers || [],
          activeReferralsCount,
          totalReferralSpending,
          totalReferralTransactions,
          userOwnTransactionCount,
          userOwnSpending,
        };
      })
    );
    
    // Apply post-query filters
    let filteredUsers = usersWithMetrics;
    
    // Filter by minimum active referrals
    if (minActiveReferrals) {
      const min = parseInt(minActiveReferrals);
      filteredUsers = filteredUsers.filter(user => user.activeReferralsCount >= min);
    }
    
    // Filter by minimum referral spending
    if (minReferralSpending) {
      const min = parseFloat(minReferralSpending);
      filteredUsers = filteredUsers.filter(user => user.totalReferralSpending >= min);
    }
    
    // Filter by has transacting referrals
    if (hasTransactingReferrals === "yes") {
      filteredUsers = filteredUsers.filter(user => user.activeReferralsCount > 0);
    } else if (hasTransactingReferrals === "no") {
      filteredUsers = filteredUsers.filter(user => user.activeReferralsCount === 0);
    }
    
    // Filter by user's own transactions (NEW)
    if (hasOwnTransactions === "yes") {
      filteredUsers = filteredUsers.filter(user => user.userOwnTransactionCount > 0);
    } else if (hasOwnTransactions === "no") {
      filteredUsers = filteredUsers.filter(user => user.userOwnTransactionCount === 0);
    }
    
    // Apply pagination AFTER all filters
    const totalFiltered = filteredUsers.length;
    const totalPages = Math.ceil(totalFiltered / pageSize);
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    const paginatedUsers = filteredUsers.slice(from, to);

    // Calculate overall stats (not just current page)
    const { data: allUsers } = await supabase
      .from("users")
      .select("referral_count")
      .not("email", "is", null);

    const totalReferrals = (allUsers || []).reduce((sum, u) => sum + (u.referral_count || 0), 0);
    const activeReferrers = filteredUsers.filter(u => u.referral_count > 0).length;
    const totalReferralRevenue = filteredUsers.reduce((sum, u) => sum + u.totalReferralSpending, 0);
    const avgReferralsPerUser = allUsers && allUsers.length > 0 
      ? (totalReferrals / allUsers.length).toFixed(1) 
      : "0";
    
    // Get top referrer
    const { data: topReferrerData } = await supabase
      .from("users")
      .select("email, referral_count")
      .not("email", "is", null)
      .order("referral_count", { ascending: false })
      .limit(1);

    return NextResponse.json({
      success: true,
      users: paginatedUsers,
      pagination: {
        page,
        pageSize,
        totalCount: totalFiltered,
        totalPages: totalPages,
      },
      stats: {
        totalUsers: totalCount || 0,
        totalReferrals,
        activeReferrers,
        totalReferralRevenue,
        avgReferralsPerUser,
        topReferrer: topReferrerData && topReferrerData.length > 0 ? topReferrerData[0] : null,
      },
    });
  } catch (error: any) {
    console.error("Error in referrals API:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Send emails to users based on referral count
export async function POST(request: NextRequest) {
  try {
    const { minReferrals, subject, message, emailList } = await request.json();

    if (!subject || !message) {
      return NextResponse.json(
        { success: false, error: "Subject and message are required" },
        { status: 400 }
      );
    }

    // Get users to email
    let query = supabase
      .from("users")
      .select("email, referral_code, referral_count")
      .not("email", "is", null);

    if (minReferrals) {
      query = query.gte("referral_count", minReferrals);
    }

    if (emailList && Array.isArray(emailList) && emailList.length > 0) {
      query = query.in("email", emailList);
    }

    const { data: users, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    // Send emails (implement bulk email sending)
    const emailResults = await Promise.all(
      (users || []).map(async (user) => {
        try {
          const response = await fetch(`${request.nextUrl.origin}/api/admin/send-bulk-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              subject,
              message,
              referralCode: user.referral_code,
              referralCount: user.referral_count,
            }),
          });
          return { email: user.email, success: response.ok };
        } catch (err) {
          return { email: user.email, success: false };
        }
      })
    );

    return NextResponse.json({
      success: true,
      sent: emailResults.filter(r => r.success).length,
      total: emailResults.length,
      results: emailResults,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
