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

    let query = supabase
      .from("users")
      .select("id, email, referral_code, referral_count, referred_by, created_at", { count: "exact" })
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

    // Get total count
    const { count: totalCount } = await query;

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    const { data, error } = await query.range(from, to);

    if (error) {
      console.error("Error fetching referrals:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch referral data" },
        { status: 500 }
      );
    }

    // Get referred users for each user (for detailed view if needed)
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

    // Calculate overall stats (not just current page)
    const { data: allUsers } = await supabase
      .from("users")
      .select("referral_count")
      .not("email", "is", null);

    const totalReferrals = (allUsers || []).reduce((sum, u) => sum + (u.referral_count || 0), 0);
    
    // Get top referrer
    const { data: topReferrerData } = await supabase
      .from("users")
      .select("email, referral_count")
      .not("email", "is", null)
      .order("referral_count", { ascending: false })
      .limit(1);

    return NextResponse.json({
      success: true,
      users: usersWithReferred,
      pagination: {
        page,
        pageSize,
        totalCount: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / pageSize),
      },
      stats: {
        totalUsers: totalCount || 0,
        totalReferrals,
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
