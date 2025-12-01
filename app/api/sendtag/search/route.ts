import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Search for SendTags by name prefix
 * Returns a list of matching SendTags from the database
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!query || query.length < 1) {
      return NextResponse.json({
        success: true,
        tags: [],
      });
    }

    // Check if Supabase is configured
    const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    if (!hasSupabase) {
      return NextResponse.json({
        success: false,
        error: "SendTag search is not configured. Please configure Supabase credentials.",
      }, { status: 503 });
    }

    // Search for tags matching the query (case-insensitive)
    // Only return confirmed tags
    const { data: tagsData, error: tagsError } = await supabase
      .from("tags")
      .select("id, name, status")
      .ilike("name", `${query}%`) // Case-insensitive prefix match
      .eq("status", "confirmed") // Only confirmed tags
      .order("name", { ascending: true })
      .limit(limit);

    if (tagsError) {
      console.error("Error searching tags:", tagsError);
      return NextResponse.json({
        success: false,
        error: "Failed to search SendTags",
      }, { status: 500 });
    }

    // Format response: return tag names with / prefix
    const tags = (tagsData || []).map((tag) => ({
      name: `/${tag.name}`, // Add / prefix
      displayName: tag.name,
    }));

    return NextResponse.json({
      success: true,
      tags,
    });
  } catch (error: any) {
    console.error("SendTag search error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error while searching SendTags" },
      { status: 500 }
    );
  }
}

