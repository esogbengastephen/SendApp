import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    // Search for user by email
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, created_at, is_blocked, referral_count, sendtag")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Get linked wallets count
    const { data: wallets } = await supabase
      .from("user_wallets")
      .select("wallet_address")
      .eq("user_id", user.id);

    // Get transaction statistics
    const { data: transactions } = await supabase
      .from("transactions")
      .select("status, ngn_amount, send_amount")
      .eq("user_id", user.id);

    const completedTransactions = transactions?.filter(t => t.status === "completed") || [];
    const totalTransactions = completedTransactions.length;
    const totalSpentNGN = completedTransactions.reduce(
      (sum, t) => sum + parseFloat(t.ngn_amount || "0"),
      0
    );
    const totalReceivedSEND = completedTransactions.reduce(
      (sum, t) => sum + parseFloat(t.send_amount || "0"),
      0
    );

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        isBlocked: user.is_blocked || false,
        linkedWallets: wallets?.length || 0,
        totalTransactions,
        totalSpentNGN,
        totalReceivedSEND,
        referralCount: user.referral_count || 0,
        sendtag: user.sendtag,
      },
    });
  } catch (error: any) {
    console.error("Error searching user:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

