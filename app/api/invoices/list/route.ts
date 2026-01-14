import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserByEmail } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const status = searchParams.get("status");

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    // Get user by email
    const userResult = await getUserByEmail(email);
    if (!userResult.success || !userResult.user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const userId = userResult.user.id;

    // Build query
    let query = supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // Filter by status if provided
    if (status) {
      query = query.eq("status", status);
    }

    const { data: invoices, error } = await query;

    if (error) {
      console.error("Error fetching invoices:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch invoices" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      invoices: invoices || [],
    });
  } catch (error: any) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
