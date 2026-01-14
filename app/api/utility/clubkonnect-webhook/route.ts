import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET - ClubKonnect Webhook/Callback Handler
 * 
 * ClubKonnect calls this endpoint after processing a transaction
 * Documentation: https://www.clubkonnect.com/APIParaGetAirTimeV1.asp
 * 
 * Query string format:
 * ?orderdate=22th-Jul-2023&orderid=6501321715&statuscode=200&orderstatus=ORDER_COMPLETED&orderremark=You have successfully topped up N100.00...
 * 
 * JSON format (if Accept: application/json header is sent):
 * {"orderdate":"22th-Jul-2023","orderid":"6501321715","requestid":"","statuscode":"200","orderstatus":"ORDER_COMPLETED","orderremark":"..."}
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get parameters from query string
    const orderId = searchParams.get("orderid") || searchParams.get("orderId");
    const statusCode = searchParams.get("statuscode") || searchParams.get("statusCode");
    const orderStatus = searchParams.get("orderstatus") || searchParams.get("orderStatus");
    const orderRemark = searchParams.get("orderremark") || searchParams.get("orderRemark");
    const orderDate = searchParams.get("orderdate") || searchParams.get("orderDate");
    const requestId = searchParams.get("requestid") || searchParams.get("requestId");
    
    console.log("[ClubKonnect Webhook] Received callback:", {
      orderId,
      statusCode,
      orderStatus,
      orderDate,
      requestId,
    });
    
    if (!orderId) {
      console.warn("[ClubKonnect Webhook] Missing orderid in callback");
      return NextResponse.json({ success: false, error: "Missing orderid" }, { status: 400 });
    }
    
    // Determine transaction status based on statuscode
    // statuscode "200" = ORDER_COMPLETED (success)
    // statuscode "100" = ORDER_RECEIVED (pending, still processing)
    // Other statuscodes = error/failed
    let transactionStatus = "failed";
    if (statusCode === "200") {
      transactionStatus = "completed";
    } else if (statusCode === "100") {
      transactionStatus = "pending";
    }
    
    // Prepare response data
    const webhookData = {
      orderid: orderId,
      orderdate: orderDate,
      requestid: requestId || "",
      statuscode: statusCode,
      orderstatus: orderStatus,
      orderremark: orderRemark || "",
    };
    
    // Update transaction in database
    const { data: updatedTransaction, error: updateError } = await supabaseAdmin
      .from("utility_transactions")
      .update({
        status: transactionStatus,
        clubkonnect_reference: orderId,
        clubkonnect_response: JSON.stringify(webhookData),
        error_message: transactionStatus === "failed" ? (orderRemark || orderStatus) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("clubkonnect_reference", orderId)
      .select()
      .single();
    
    if (updateError) {
      console.error("[ClubKonnect Webhook] Error updating transaction:", updateError);
      
      // Try to find by requestId if orderId didn't match
      if (requestId) {
        const { data: transactionByRequestId } = await supabaseAdmin
          .from("utility_transactions")
          .select("*")
          .eq("clubkonnect_response", `%${requestId}%`)
          .limit(1)
          .single();
        
        if (transactionByRequestId) {
          await supabaseAdmin
            .from("utility_transactions")
            .update({
              status: transactionStatus,
              clubkonnect_reference: orderId,
              clubkonnect_response: JSON.stringify(webhookData),
              error_message: transactionStatus === "failed" ? (orderRemark || orderStatus) : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", transactionByRequestId.id);
        }
      }
    } else {
      console.log("[ClubKonnect Webhook] Transaction updated:", updatedTransaction?.id);
    }
    
    // Return success response (ClubKonnect expects a response)
    return NextResponse.json({ 
      success: true, 
      message: "Webhook received",
      orderId,
      status: transactionStatus,
    });
  } catch (error: any) {
    console.error("[ClubKonnect Webhook] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST - Handle JSON format webhook (if ClubKonnect sends JSON)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const orderId = body.orderid || body.orderId;
    const statusCode = body.statuscode || body.statusCode;
    const orderStatus = body.orderstatus || body.orderStatus;
    const orderRemark = body.orderremark || body.orderRemark;
    const orderDate = body.orderdate || body.orderDate;
    const requestId = body.requestid || body.requestId;
    
    console.log("[ClubKonnect Webhook] Received JSON callback:", {
      orderId,
      statusCode,
      orderStatus,
      orderDate,
      requestId,
    });
    
    if (!orderId) {
      return NextResponse.json({ success: false, error: "Missing orderid" }, { status: 400 });
    }
    
    // Determine transaction status
    let transactionStatus = "failed";
    if (statusCode === "200") {
      transactionStatus = "completed";
    } else if (statusCode === "100") {
      transactionStatus = "pending";
    }
    
    // Update transaction
    await supabaseAdmin
      .from("utility_transactions")
      .update({
        status: transactionStatus,
        clubkonnect_reference: orderId,
        clubkonnect_response: JSON.stringify(body),
        error_message: transactionStatus === "failed" ? (orderRemark || orderStatus) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("clubkonnect_reference", orderId);
    
    return NextResponse.json({ 
      success: true, 
      message: "Webhook received",
      orderId,
      status: transactionStatus,
    });
  } catch (error: any) {
    console.error("[ClubKonnect Webhook] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

