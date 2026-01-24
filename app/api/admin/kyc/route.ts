import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { KYC_TIERS } from "@/lib/kyc-tiers";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get("tier");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("users")
      .select("id, email, display_name, flutterwave_kyc_tier, flutterwave_nin, created_at", { count: "exact" })
      .order("created_at", { ascending: false });

    // Filter by tier
    if (tier) {
      const tierNum = parseInt(tier);
      if (tierNum === 1) {
        query = query.or(`flutterwave_kyc_tier.is.null,flutterwave_kyc_tier.eq.1`);
      } else {
        query = query.eq("flutterwave_kyc_tier", tierNum);
      }
    }

    // Search by email or display name
    if (search) {
      query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: users, error, count } = await query;

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    // Enrich with KYC tier info
    const enrichedUsers = (users || []).map((user) => {
      const tier = user.flutterwave_kyc_tier || 1;
      const tierInfo = KYC_TIERS[tier as keyof typeof KYC_TIERS];
      return {
        ...user,
        kycTierInfo: tierInfo,
        hasBVN: !!user.flutterwave_nin,
        canUpgrade: tier < 3,
      };
    });

    return NextResponse.json({
      success: true,
      users: enrichedUsers,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error("Error fetching KYC data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch KYC data", details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, tier } = body;

    if (!userId || !tier) {
      return NextResponse.json(
        { success: false, error: "userId and tier are required" },
        { status: 400 }
      );
    }

    const tierNum = parseInt(tier);
    if (![1, 2, 3].includes(tierNum)) {
      return NextResponse.json(
        { success: false, error: "tier must be 1, 2, or 3" },
        { status: 400 }
      );
    }

    // Update user KYC tier
    const { data, error } = await supabase
      .from("users")
      .update({ flutterwave_kyc_tier: tierNum })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    const tierInfo = KYC_TIERS[tierNum as keyof typeof KYC_TIERS];

    return NextResponse.json({
      success: true,
      user: {
        ...data,
        kycTierInfo: tierInfo,
      },
      message: `KYC tier updated to ${tierInfo.name}`,
    });
  } catch (error: any) {
    console.error("Error updating KYC tier:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update KYC tier", details: error.message },
      { status: 500 }
    );
  }
}
