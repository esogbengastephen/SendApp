import { NextRequest, NextResponse } from "next/server";
import { isAdminWallet, supabaseAdmin } from "@/lib/supabase";

/**
 * GET - Get current token buy prices
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const walletAddress = authHeader.replace("Bearer ", "");
    const isAdmin = await isAdminWallet(walletAddress);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    // Fetch token prices from database
    const { data: prices, error } = await supabaseAdmin
      .from("token_buy_prices")
      .select("*")
      .order("token_symbol", { ascending: true });

    if (error) {
      console.error("Error fetching token prices:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch token prices" },
        { status: 500 }
      );
    }

    // Format prices for response
    const formattedPrices = {
      SEND: null as number | null,
      USDC: null as number | null,
      USDT: null as number | null,
    };

    const priceMap: Record<string, { price: number; updated_at: string; updated_by: string | null }> = {};

    if (prices) {
      prices.forEach((price) => {
        formattedPrices[price.token_symbol as keyof typeof formattedPrices] = parseFloat(price.buy_price_ngn);
        priceMap[price.token_symbol] = {
          price: parseFloat(price.buy_price_ngn),
          updated_at: price.updated_at,
          updated_by: price.updated_by,
        };
      });
    }

    return NextResponse.json({
      success: true,
      prices: formattedPrices,
      priceDetails: priceMap,
    });
  } catch (error: any) {
    console.error("Error fetching token prices:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update token buy prices
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { prices, walletAddress } = body;

    // Verify admin access
    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: "Wallet address required" },
        { status: 400 }
      );
    }

    const isAdmin = await isAdminWallet(walletAddress);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    // Validate prices object
    if (!prices || typeof prices !== "object") {
      return NextResponse.json(
        { success: false, error: "Prices object is required" },
        { status: 400 }
      );
    }

    const normalizedWallet = walletAddress.toLowerCase();
    const validTokens = ["SEND", "USDC", "USDT"];
    const updates: Array<{ token_symbol: string; buy_price_ngn: number; updated_by: string }> = [];

    // Validate and prepare updates
    for (const token of validTokens) {
      if (prices[token] !== undefined) {
        const price = parseFloat(prices[token]);
        if (isNaN(price) || price <= 0) {
          return NextResponse.json(
            { success: false, error: `Invalid price for ${token}. Must be a positive number.` },
            { status: 400 }
          );
        }
        updates.push({
          token_symbol: token,
          buy_price_ngn: price,
          updated_by: normalizedWallet,
        });
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one price must be provided" },
        { status: 400 }
      );
    }

    // Update prices using upsert (insert or update)
    const updatePromises = updates.map((update) =>
      supabaseAdmin
        .from("token_buy_prices")
        .upsert(
          {
            token_symbol: update.token_symbol,
            buy_price_ngn: update.buy_price_ngn,
            updated_by: update.updated_by,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "token_symbol",
          }
        )
    );

    const results = await Promise.all(updatePromises);
    const errors = results.filter((result) => result.error);

    if (errors.length > 0) {
      console.error("Error updating token prices:", errors);
      return NextResponse.json(
        { success: false, error: "Failed to update some prices" },
        { status: 500 }
      );
    }

    // Fetch updated prices
    const { data: updatedPrices, error: fetchError } = await supabaseAdmin
      .from("token_buy_prices")
      .select("*")
      .order("token_symbol", { ascending: true });

    if (fetchError) {
      console.error("Error fetching updated prices:", fetchError);
    }

    // Format response
    const formattedPrices = {
      SEND: null as number | null,
      USDC: null as number | null,
      USDT: null as number | null,
    };

    if (updatedPrices) {
      updatedPrices.forEach((price) => {
        formattedPrices[price.token_symbol as keyof typeof formattedPrices] = parseFloat(price.buy_price_ngn);
      });
    }

    return NextResponse.json({
      success: true,
      prices: formattedPrices,
      message: "Token prices updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating token prices:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
