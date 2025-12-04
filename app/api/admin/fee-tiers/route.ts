import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isAdminWallet } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const adminWallet = searchParams.get("adminWallet");

    if (!adminWallet) {
      return NextResponse.json(
        { success: false, error: "Admin wallet required" },
        { status: 400 }
      );
    }

    const isAdmin = await isAdminWallet(adminWallet);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from("transaction_fee_tiers")
      .select("*")
      .order("min_amount", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      tiers: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { adminWallet, tiers } = await request.json();

    if (!adminWallet) {
      return NextResponse.json(
        { success: false, error: "Admin wallet required" },
        { status: 400 }
      );
    }

    const isAdmin = await isAdminWallet(adminWallet);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    if (!tiers || !Array.isArray(tiers)) {
      return NextResponse.json(
        { success: false, error: "Tiers array is required" },
        { status: 400 }
      );
    }

    // Update each tier
    for (const tier of tiers) {
      if (!tier.tier_name || tier.fee_ngn === undefined) {
        return NextResponse.json(
          { success: false, error: "Each tier must have tier_name and fee_ngn" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("transaction_fee_tiers")
        .update({
          fee_ngn: parseFloat(tier.fee_ngn.toString()),
          updated_at: new Date().toISOString(),
          updated_by: adminWallet,
        })
        .eq("tier_name", tier.tier_name);

      if (error) {
        throw error;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Fee tiers updated successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

