import { NextRequest, NextResponse } from "next/server";
import { initializePayment } from "@/lib/flutterwave";

/**
 * Initialize Flutterwave payment (creates payment link)
 * Replaces Paystack payment initialization for on-ramp transactions
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for debugging
    const rawBody = await request.text();
    console.log(`[Flutterwave Initialize] Raw request body length: ${rawBody.length} bytes`);
    
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError: any) {
      console.error(`[Flutterwave Initialize] JSON parse error:`, parseError);
      console.error(`[Flutterwave Initialize] Raw body (first 500 chars):`, rawBody.substring(0, 500));
      return NextResponse.json(
        { success: false, error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { email, amount, txRef, callbackUrl, metadata } = body;

    console.log(`[Flutterwave Initialize] Parsed request:`, {
      email: email ? (email.length > 10 ? `${email.slice(0, 10)}...` : email) : 'missing',
      amount: amount !== undefined ? amount : 'missing',
      txRef: txRef ? (txRef.length > 10 ? `${txRef.slice(0, 10)}...` : txRef) : 'missing',
      hasCallbackUrl: !!callbackUrl,
      hasMetadata: !!metadata,
    });

    // Validate required fields with detailed error messages
    const missingFields: string[] = [];
    
    if (!email || email.trim() === "") {
      missingFields.push("email");
    }
    
    if (!amount || amount === null || amount === undefined) {
      missingFields.push("amount");
    }
    
    if (!txRef || txRef.trim() === "") {
      missingFields.push("txRef");
    }

    if (missingFields.length > 0) {
      console.error(`[Flutterwave Initialize] Missing fields: ${missingFields.join(", ")}`);
      console.error(`[Flutterwave Initialize] Received body:`, {
        email: email ? (email.length > 20 ? `${email.slice(0, 20)}...` : email) : "MISSING",
        amount: amount !== undefined ? amount : "MISSING",
        txRef: txRef ? (txRef.length > 20 ? `${txRef.slice(0, 20)}...` : txRef) : "MISSING",
      });
      return NextResponse.json(
        { 
          success: false, 
          error: `Missing required fields: ${missingFields.join(", ")}`,
          received: {
            hasEmail: !!email,
            hasAmount: amount !== undefined && amount !== null,
            hasTxRef: !!txRef,
          }
        },
        { status: 400 }
      );
    }

    // Validate amount
    const amountNum = parseFloat(amount.toString());
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid amount" },
        { status: 400 }
      );
    }

    // Use email from request body (user info comes from metadata if needed)
    const customerEmail = email.trim();
    const customerName = customerEmail.split("@")[0] || "Customer";
    const customerPhone = metadata?.user_phone || "";

    console.log(`[Flutterwave Initialize] Creating payment link: ${amountNum} NGN, txRef: ${txRef}, email: ${customerEmail}`);

    // Initialize Flutterwave payment
    const result = await initializePayment({
      email: customerEmail,
      amount: amountNum,
      txRef,
      callbackUrl,
      redirectUrl: callbackUrl,
      metadata: metadata || {},
      customer: {
        email: customerEmail,
        name: customerName,
        phone_number: customerPhone,
      },
    });

    if (!result.success) {
      console.error(`[Flutterwave Initialize] Failed: ${result.error}`);
      return NextResponse.json(
        { success: false, error: result.error || "Failed to initialize payment" },
        { status: 500 }
      );
    }

    console.log(`[Flutterwave Initialize] ✅ Payment link created: ${result.data?.link}`);

    return NextResponse.json({
      success: true,
      authorization_url: result.data?.link, // Use same field name as Paystack for compatibility
      link: result.data?.link,
      access_code: txRef, // Use txRef as access_code for compatibility
      reference: txRef,
    });
  } catch (error: any) {
    console.error("[Flutterwave Initialize] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
