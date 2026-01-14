import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST - Cancel ClubKonnect Transaction
 * 
 * Cancel a transaction that has status ORDER_RECEIVED or ORDER_ONHOLD
 * Documentation: https://www.clubkonnect.com/APIParaGetAirTimeV1.asp
 * 
 * Note: You can only cancel transactions with status ORDER_RECEIVED or ORDER_ONHOLD
 * 
 * Request body:
 * {
 *   "orderId": "789"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;
    
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId is required" },
        { status: 400 }
      );
    }
    
    const clubkonnectApiKey = process.env.CLUBKONNECT_API_KEY;
    const clubkonnectApiUsername = process.env.CLUBKONNECT_API_USERNAME;
    
    if (!clubkonnectApiKey || !clubkonnectApiUsername) {
      return NextResponse.json(
        { success: false, error: "ClubKonnect API credentials not configured" },
        { status: 500 }
      );
    }
    
    // First, check the transaction status in our database
    const { data: transaction } = await supabaseAdmin
      .from("utility_transactions")
      .select("*")
      .eq("clubkonnect_reference", orderId)
      .single();
    
    if (!transaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }
    
    // Check if transaction can be cancelled
    // Only ORDER_RECEIVED or ORDER_ONHOLD can be cancelled
    if (transaction.status === "completed" || transaction.status === "failed") {
      return NextResponse.json(
        { success: false, error: `Cannot cancel transaction with status: ${transaction.status}` },
        { status: 400 }
      );
    }
    
    console.log("[ClubKonnect Cancel] Cancelling transaction:", orderId);
    
    // Call ClubKonnect cancel API
    const cancelUrl = `https://www.nellobytesystems.com/APICancelV1.asp?UserID=${encodeURIComponent(clubkonnectApiUsername)}&APIKey=${encodeURIComponent(clubkonnectApiKey)}&OrderID=${encodeURIComponent(orderId)}`;
    
    try {
      const response = await fetch(cancelUrl, {
        method: "GET",
        headers: { 
          "Accept": "application/json, */*",
          "User-Agent": "Mozilla/5.0",
        },
      });
      
      const responseText = await response.text();
      console.log("[ClubKonnect Cancel] Raw response:", responseText);
      
      // Parse JSON response
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        // If not JSON, might be HTML error page
        if (responseText.includes("<!DOCTYPE") || responseText.includes("<html")) {
          return NextResponse.json(
            { success: false, error: "Invalid response from ClubKonnect API. Check your credentials and IP whitelisting." },
            { status: 400 }
          );
        }
        throw new Error("Invalid JSON response from ClubKonnect");
      }
      
      if (data.status === "ORDER_CANCELLED" || data.Status === "ORDER_CANCELLED") {
        // Update transaction in database
        await supabaseAdmin
          .from("utility_transactions")
          .update({
            status: "cancelled",
            clubkonnect_response: JSON.stringify(data),
            updated_at: new Date().toISOString(),
          })
          .eq("clubkonnect_reference", orderId);
        
        console.log("[ClubKonnect Cancel] Transaction cancelled successfully");
        
        return NextResponse.json({ 
          success: true, 
          message: "Transaction cancelled successfully",
          data: {
            orderid: data.orderid || data.orderId,
            status: data.status || data.Status,
          },
        });
      } else {
        // Transaction could not be cancelled
        const errorMessage = data.message || data.Message || data.error || "Failed to cancel transaction";
        return NextResponse.json(
          { success: false, error: errorMessage },
          { status: 400 }
        );
      }
    } catch (fetchError: any) {
      console.error("[ClubKonnect Cancel] Fetch error:", fetchError);
      return NextResponse.json(
        { success: false, error: `Failed to cancel transaction: ${fetchError.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[ClubKonnect Cancel] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

