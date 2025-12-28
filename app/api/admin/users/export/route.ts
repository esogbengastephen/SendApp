import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userIds, includeTransactions = true } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No users selected for export" },
        { status: 400 }
      );
    }

    // Fetch selected users
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email, referral_code, referral_count, referred_by, created_at, sendtag, is_blocked")
      .in("id", userIds);

    if (usersError) {
      console.error("Error fetching users for export:", usersError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    // Fetch transaction data for each user
    const usersWithData = await Promise.all(
      (users || []).map(async (user) => {
        // Get user's transaction statistics
        const { data: userTransactions } = await supabase
          .from("transactions")
          .select("status, ngn_amount, send_amount, created_at")
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
        );

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
          .eq("user_id", user.id);

        return {
          email: user.email || "",
          walletAddress: linkedWallets?.map(w => w.wallet_address).join("; ") || "",
          referralCode: user.referral_code || "",
          referralCount: user.referral_count || 0,
          referredBy: user.referred_by || "",
          sendtag: user.sendtag || "",
          totalTransactions,
          totalSpentNGN: totalSpentNGN.toFixed(2),
          totalReceivedSEND: totalReceivedSEND.toFixed(2),
          firstTransactionDate: firstTransaction?.created_at ? new Date(firstTransaction.created_at).toLocaleDateString() : "",
          lastTransactionDate: lastTransaction?.created_at ? new Date(lastTransaction.created_at).toLocaleDateString() : "",
          accountCreated: new Date(user.created_at).toLocaleDateString(),
          status: user.is_blocked ? "Blocked" : "Active",
        };
      })
    );

    // Generate CSV
    const headers = [
      "Email",
      "Wallet Address",
      "Referral Code",
      "Referral Count",
      "Referred By",
      "SendTag",
      "Total Transactions",
      "Total Spent (NGN)",
      "Total Received (SEND)",
      "First Transaction",
      "Last Transaction",
      "Account Created",
      "Status",
    ];

    const csvRows = [
      headers.join(","),
      ...usersWithData.map(user => [
        `"${user.email}"`,
        `"${user.walletAddress}"`,
        `"${user.referralCode}"`,
        user.referralCount,
        `"${user.referredBy}"`,
        `"${user.sendtag}"`,
        user.totalTransactions,
        user.totalSpentNGN,
        user.totalReceivedSEND,
        `"${user.firstTransactionDate}"`,
        `"${user.lastTransactionDate}"`,
        `"${user.accountCreated}"`,
        `"${user.status}"`,
      ].join(","))
    ];

    const csvContent = csvRows.join("\n");

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="users-export-${Date.now()}.csv"`,
      },
    });

  } catch (error: any) {
    console.error("Error exporting users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to export users" },
      { status: 500 }
    );
  }
}
