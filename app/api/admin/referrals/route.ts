import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const minReferrals = searchParams.get("minReferrals");
    const maxReferrals = searchParams.get("maxReferrals");
    const sortBy = searchParams.get("sortBy") || "referral_count";
    const order = searchParams.get("order") || "desc";

    let query = supabase
      .from("users")
      .select("id, email, referral_code, referral_count, referred_by, created_at")
      .not("email", "is", null);

    // Filter by minimum referrals
    if (minReferrals) {
      query = query.gte("referral_count", parseInt(minReferrals));
    }

    // Filter by maximum referrals
    if (maxReferrals) {
      query = query.lte("referral_count", parseInt(maxReferrals));
    }

    // Sort
    query = query.order(sortBy, { ascending: order === "asc" });

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching referrals:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch referral data" },
        { status: 500 }
      );
    }

    // Get referred users for each user
    const usersWithReferred = await Promise.all(
      (data || []).map(async (user) => {
        const { data: referredUsers } = await supabase
          .from("users")
          .select("id, email, created_at")
          .eq("referred_by", user.referral_code);

        return {
          ...user,
          referredUsers: referredUsers || [],
        };
      })
    );

    return NextResponse.json({
      success: true,
      users: usersWithReferred,
      stats: {
        totalUsers: usersWithReferred.length,
        totalReferrals: usersWithReferred.reduce((sum, u) => sum + (u.referral_count || 0), 0),
        topReferrer: usersWithReferred[0] || null,
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

