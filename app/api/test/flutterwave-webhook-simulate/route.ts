import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/flutterwave";
import crypto from "crypto";

/**
 * Simulate a Flutterwave webhook call with proper signature
 * This allows testing webhook processing without making a real payment
 * 
 * Usage:
 * POST /api/test/flutterwave-webhook-simulate
 * Body: { txRef: "FLW-xxx", transactionId: "xxx", amount: 1000 }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { txRef, transactionId, amount = 1000, walletAddress } = body;

    if (!txRef && !transactionId) {
      return NextResponse.json(
        { success: false, error: "Either txRef or transactionId is required" },
        { status: 400 }
      );
    }

    const FLUTTERWAVE_WEBHOOK_SECRET_HASH = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
    
    if (!FLUTTERWAVE_WEBHOOK_SECRET_HASH) {
      return NextResponse.json(
        {
          success: false,
          error: "FLUTTERWAVE_WEBHOOK_SECRET_HASH not configured",
          message: "Set FLUTTERWAVE_WEBHOOK_SECRET_HASH in Vercel environment variables",
        },
        { status: 500 }
      );
    }

    // Create a realistic Flutterwave webhook payload
    const webhookPayload = {
      event: "charge.completed",
      data: {
        id: 1234567890,
        tx_ref: txRef || `FLW-TEST-${Date.now()}`,
        flw_ref: `FLW-REF-${Date.now()}`,
        device_fingerprint: "test-fingerprint",
        amount: amount,
        currency: "NGN",
        charged_amount: amount,
        app_fee: 0,
        merchant_fee: 0,
        processor_response: "Successful",
        auth_model: "AUTH",
        card: {
          first_6digits: "123456",
          last_4digits: "7890",
          issuer: "TEST BANK",
          country: "NG",
          type: "VISA",
          token: "test-token",
          expiry: "12/25",
        },
        created_at: new Date().toISOString(),
        status: "successful",
        payment_type: "card",
        customer: {
          id: 12345,
          name: "Test Customer",
          phone_number: "07034494055",
          email: "test@example.com",
          created_at: new Date().toISOString(),
        },
        account_id: 123456,
        meta: {
          transaction_id: transactionId || `test-${Date.now()}`,
          wallet_address: walletAddress || "0x0000000000000000000000000000000000000000",
          user_id: "test-user-id",
        },
      },
    };

    // Convert to JSON string (this is what Flutterwave sends)
    const payloadString = JSON.stringify(webhookPayload);

    // Compute HMAC-SHA256 signature (base64 format - Flutterwave v3/v4 standard)
    const computedSignature = crypto
      .createHmac("sha256", FLUTTERWAVE_WEBHOOK_SECRET_HASH)
      .update(payloadString)
      .digest("base64");

    console.log(`[Webhook Simulate] Generated payload:`, {
      event: webhookPayload.event,
      tx_ref: webhookPayload.data.tx_ref,
      amount: webhookPayload.data.amount,
      hasMetadata: !!webhookPayload.data.meta,
    });
    console.log(`[Webhook Simulate] Computed signature (base64): ${computedSignature.substring(0, 30)}...`);

    // Now simulate calling the actual webhook endpoint
    // We'll make an internal request to the webhook handler
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.flippay.app'}/api/flutterwave/webhook`;
    
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "verif-hash": computedSignature, // Flutterwave v3 uses 'verif-hash' header
          "User-Agent": "Flutterwave-Webhook-Simulator/1.0",
        },
        body: payloadString,
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }

      const result = {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        webhookResponse: responseData,
        testDetails: {
          payload: webhookPayload,
          signatureComputed: computedSignature.substring(0, 30) + "...",
          signatureLength: computedSignature.length,
          secretHashLength: FLUTTERWAVE_WEBHOOK_SECRET_HASH.length,
          webhookUrl,
        },
      };

      if (response.ok) {
        console.log(`[Webhook Simulate] ✅ Webhook processed successfully`);
      } else {
        console.error(`[Webhook Simulate] ❌ Webhook returned error: ${response.status}`);
      }

      return NextResponse.json(result, { status: response.ok ? 200 : response.status });
    } catch (fetchError: any) {
      console.error(`[Webhook Simulate] Error calling webhook:`, fetchError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to call webhook endpoint",
          details: fetchError.message,
          testDetails: {
            payload: webhookPayload,
            signatureComputed: computedSignature.substring(0, 30) + "...",
            webhookUrl,
          },
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[Webhook Simulate] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - Show usage and test signature verification
 */
export async function GET(request: NextRequest) {
  const FLUTTERWAVE_WEBHOOK_SECRET_HASH = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
  
  // Test signature computation
  const testPayload = JSON.stringify({
    event: "charge.completed",
    data: { tx_ref: "test-tx-ref", amount: 1000, status: "successful" },
  });

  let signatureTest = null;
  if (FLUTTERWAVE_WEBHOOK_SECRET_HASH) {
    const computedBase64 = crypto
      .createHmac("sha256", FLUTTERWAVE_WEBHOOK_SECRET_HASH)
      .update(testPayload)
      .digest("base64");
    
    const computedHex = crypto
      .createHmac("sha256", FLUTTERWAVE_WEBHOOK_SECRET_HASH)
      .update(testPayload)
      .digest("hex");
    
    const isValidBase64 = verifyWebhookSignature(testPayload, computedBase64);
    const isValidHex = verifyWebhookSignature(testPayload, computedHex);

    signatureTest = {
      secretHashConfigured: true,
      secretHashLength: FLUTTERWAVE_WEBHOOK_SECRET_HASH.length,
      testPayload,
      computedSignatureBase64: computedBase64,
      computedSignatureHex: computedHex,
      verificationBase64: isValidBase64,
      verificationHex: isValidHex,
      signatureFormat: isValidBase64 ? "base64" : isValidHex ? "hex" : "unknown",
    };
  }

  return NextResponse.json({
    success: true,
    message: "Flutterwave Webhook Simulator",
    usage: {
      method: "POST",
      endpoint: "/api/test/flutterwave-webhook-simulate",
      body: {
        txRef: "FLW-xxx-xxx-xxx (optional, will generate if not provided)",
        transactionId: "xxx (optional, will generate if not provided)",
        amount: 1000,
        walletAddress: "0x... (optional)",
      },
      description: "Simulates a Flutterwave webhook call with proper signature verification. Tests the full webhook processing flow.",
    },
    signatureVerification: signatureTest || {
      secretHashConfigured: false,
      error: "FLUTTERWAVE_WEBHOOK_SECRET_HASH not set",
      recommendation: "Set FLUTTERWAVE_WEBHOOK_SECRET_HASH in Vercel environment variables",
    },
    flutterwaveCompliance: {
      signatureHeader: "verif-hash (v3) or flutterwave-signature (v4)",
      signatureAlgorithm: "HMAC-SHA256",
      signatureFormat: "base64 (v4) or hex (v3)",
      payloadFormat: "JSON string (raw body)",
      verification: "Compute HMAC-SHA256 of raw body using secret hash, compare with header value",
    },
  });
}
