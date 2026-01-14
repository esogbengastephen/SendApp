import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET - Query ClubKonnect Transaction Status
 * 
 * Query a transaction by OrderID or RequestID
 * Documentation: https://www.clubkonnect.com/APIParaGetAirTimeV1.asp
 * 
 * Usage:
 * /api/utility/query-transaction?orderId=789
 * /api/utility/query-transaction?requestId=REQ1234567890
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId") || searchParams.get("orderid");
    const requestId = searchParams.get("requestId") || searchParams.get("requestid");
    
    if (!orderId && !requestId) {
      return NextResponse.json(
        { success: false, error: "orderId or requestId is required" },
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
    
    // Build query URL based on what we have
    let queryUrl: string;
    if (orderId) {
      queryUrl = `https://www.nellobytesystems.com/APIQueryV1.asp?UserID=${encodeURIComponent(clubkonnectApiUsername)}&APIKey=${encodeURIComponent(clubkonnectApiKey)}&OrderID=${encodeURIComponent(orderId)}`;
    } else {
      queryUrl = `https://www.nellobytesystems.com/APIQueryV1.asp?UserID=${encodeURIComponent(clubkonnectApiUsername)}&APIKey=${encodeURIComponent(clubkonnectApiKey)}&RequestID=${encodeURIComponent(requestId!)}`;
    }
    
    console.log("[ClubKonnect Query] Querying transaction:", orderId || requestId);
    
    try {
      const response = await fetch(queryUrl, {
        method: "GET",
        headers: { 
          "Accept": "application/json, */*",
          "User-Agent": "Mozilla/5.0",
        },
      });
      
      const responseText = await response.text();
      console.log("[ClubKonnect Query] Raw response:", responseText.substring(0, 500));
      
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
      
      // Determine transaction status
      const statusCode = data.statuscode || data.statusCode;
      let transactionStatus = "failed";
      if (statusCode === "200" || statusCode === 200) {
        transactionStatus = "completed";
      } else if (statusCode === "100" || statusCode === 100) {
        transactionStatus = "pending";
      }
      
      // Update transaction in database if we have orderid
      if (data.orderid || data.orderId) {
        const orderIdFromResponse = data.orderid || data.orderId;
        
        await supabaseAdmin
          .from("utility_transactions")
          .update({
            status: transactionStatus,
            clubkonnect_reference: orderIdFromResponse,
            clubkonnect_response: JSON.stringify(data),
            error_message: transactionStatus === "failed" ? (data.remark || data.orderremark || data.status) : null,
            updated_at: new Date().toISOString(),
          })
          .eq("clubkonnect_reference", orderIdFromResponse);
        
        console.log("[ClubKonnect Query] Transaction updated in database");
      }
      
      return NextResponse.json({ 
        success: true, 
        data: {
          orderid: data.orderid || data.orderId,
          orderdate: data.date || data.orderdate,
          requestid: data.requestid || data.requestId || "",
          statuscode: data.statuscode || data.statusCode,
          status: data.status || data.orderstatus || data.orderStatus,
          remark: data.remark || data.orderremark || data.orderRemark || "",
          ordertype: data.ordertype || data.orderType || "",
          mobilenetwork: data.mobilenetwork || data.mobileNetwork || "",
          mobilenumber: data.mobilenumber || data.mobileNumber || "",
          amountcharged: data.amountcharged || data.amountCharged || "",
          walletbalance: data.walletbalance || data.walletBalance || "",
        },
        transactionStatus,
      });
    } catch (fetchError: any) {
      console.error("[ClubKonnect Query] Fetch error:", fetchError);
      return NextResponse.json(
        { success: false, error: `Failed to query transaction: ${fetchError.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[ClubKonnect Query] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

