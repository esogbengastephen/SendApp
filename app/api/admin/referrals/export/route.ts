import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userEmails } = body;

    if (!userEmails || !Array.isArray(userEmails) || userEmails.length === 0) {
      return NextResponse.json(
        { success: false, error: "No users selected for export" },
        { status: 400 }
      );
    }

    // Fetch selected users
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email, referral_code, referral_count, referred_by, created_at")
      .in("email", userEmails);

    if (usersError) {
      console.error("Error fetching users for export:", usersError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    // Fetch detailed metrics for each user
    const usersWithData = await Promise.all(
      (users || []).map(async (user) => {
        // Get referred users
        const { data: referredUsers } = await supabase
          .from("users")
          .select("id, email, created_at")
          .eq("referred_by", user.referral_code);

        // Calculate transaction metrics for their referrals
        let activeReferralsCount = 0;
        let totalReferralSpending = 0;
        let totalReferralTransactions = 0;
        let firstReferralDate = "";
        let lastReferralDate = "";

        const referredEmails = (referredUsers || []).map(ru => ru.email).join("; ");

        if (referredUsers && referredUsers.length > 0) {
          // Sort to get first and last referral dates
          const sortedByDate = [...referredUsers].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          firstReferralDate = sortedByDate[0]?.created_at 
            ? new Date(sortedByDate[0].created_at).toLocaleDateString() 
            : "";
          lastReferralDate = sortedByDate[sortedByDate.length - 1]?.created_at 
            ? new Date(sortedByDate[sortedByDate.length - 1].created_at).toLocaleDateString() 
            : "";

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
          email: user.email || "",
          referralCode: user.referral_code || "",
          totalReferrals: user.referral_count || 0,
          activeReferrals: activeReferralsCount,
          referralTransactions: totalReferralTransactions,
          referralRevenue: totalReferralSpending.toFixed(2),
          userOwnTransactions: userOwnTransactionCount,
          userOwnSpending: userOwnSpending.toFixed(2),
          referredBy: user.referred_by || "",
          accountCreated: new Date(user.created_at).toLocaleDateString(),
          firstReferralDate,
          lastReferralDate,
          referredEmails,
        };
      })
    );

    // Generate CSV
    const headers = [
      "Email",
      "Referral Code",
      "Total Referrals",
      "Active Referrals",
      "Referral Transactions",
      "Referral Revenue (₦)",
      "User's Own Transactions",
      "User's Own Spending (₦)",
      "Referred By",
      "Account Created",
      "First Referral Date",
      "Last Referral Date",
      "Referred Users (Emails)",
    ];

    const csvRows = [
      headers.join(","),
      ...usersWithData.map(user => [
        `"${user.email}"`,
        `"${user.referralCode}"`,
        user.totalReferrals,
        user.activeReferrals,
        user.referralTransactions,
        user.referralRevenue,
        user.userOwnTransactions,
        user.userOwnSpending,
        `"${user.referredBy}"`,
        `"${user.accountCreated}"`,
        `"${user.firstReferralDate}"`,
        `"${user.lastReferralDate}"`,
        `"${user.referredEmails}"`,
      ].join(","))
    ];

    const csvContent = csvRows.join("\n");

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="referrals-export-${Date.now()}.csv"`,
      },
    });

  } catch (error: any) {
    console.error("Error exporting referrals:", error);
    return NextResponse.json(
      { success: false, error: "Failed to export referrals" },
      { status: 500 }
    );
  }
}
