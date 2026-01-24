import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("transactions")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq("status", status);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      transactions: transactions || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error("Error fetching onramp transactions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch onramp transactions", details: error.message },
      { status: 500 }
    );
  }
}
