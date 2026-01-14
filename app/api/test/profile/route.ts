import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Simple test endpoint to verify Supabase connection
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: "User ID is required",
        test: "parameter_check"
      });
    }

    // Test 1: Check if supabaseAdmin is initialized
    if (!supabaseAdmin) {
      return NextResponse.json({
        success: false,
        error: "Supabase admin client not initialized",
        test: "client_check"
      });
    }

    // Test 2: Try a simple query
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, email")
      .eq("id", userId)
      .single();

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        test: "query_check"
      });
    }

    if (!data) {
      return NextResponse.json({
        success: false,
        error: "User not found",
        test: "data_check"
      });
    }

    return NextResponse.json({
      success: true,
      message: "All tests passed",
      user: {
        id: data.id,
        email: data.email
      },
      test: "success"
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      test: "exception_check"
    }, { status: 500 });
  }
}

