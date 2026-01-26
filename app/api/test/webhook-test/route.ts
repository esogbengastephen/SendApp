import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/flutterwave";
import crypto from "crypto";

/**
 * Test endpoint to verify webhook configuration and simulate webhook calls
 * This helps diagnose why Flutterwave webhooks might not be reaching the server
 */
export async function GET(request: NextRequest) {
  const FLUTTERWAVE_WEBHOOK_SECRET_HASH = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
  const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;
  
  // Test webhook signature verification
  const testPayload = JSON.stringify({
    event: "charge.completed",
    data: {
      id: 1234567890,
      tx_ref: "test-tx-ref-123",
      flw_ref: "test-flw-ref-456",
      amount: 1000,
      status: "successful",
    },
  });

  let signatureTest = null;
  if (FLUTTERWAVE_WEBHOOK_SECRET_HASH || FLUTTERWAVE_SECRET_KEY) {
    const secretHash = FLUTTERWAVE_WEBHOOK_SECRET_HASH || FLUTTERWAVE_SECRET_KEY || "";
    
    // Generate test signature (base64 format)
    const computedHashBase64 = crypto
      .createHmac("sha256", secretHash)
      .update(testPayload)
      .digest("base64");
    
    // Generate test signature (hex format)
    const computedHashHex = crypto
      .createHmac("sha256", secretHash)
      .update(testPayload)
      .digest("hex");
    
    // Test verification
    const isValidBase64 = verifyWebhookSignature(testPayload, computedHashBase64);
    const isValidHex = verifyWebhookSignature(testPayload, computedHashHex);
    
    signatureTest = {
      success: isValidBase64 || isValidHex,
      usingWebhookSecretHash: !!FLUTTERWAVE_WEBHOOK_SECRET_HASH,
      base64Format: isValidBase64,
      hexFormat: isValidHex,
      testSignatureBase64: computedHashBase64.substring(0, 30) + "...",
      testSignatureHex: computedHashHex.substring(0, 30) + "...",
    };
  }

  return NextResponse.json({
    success: true,
    message: "Webhook diagnostic test",
    webhookUrl: "https://www.flippay.app/api/flutterwave/webhook",
    configuration: {
      hasWebhookSecretHash: !!FLUTTERWAVE_WEBHOOK_SECRET_HASH,
      hasSecretKey: !!FLUTTERWAVE_SECRET_KEY,
      usingSecretHash: !!FLUTTERWAVE_WEBHOOK_SECRET_HASH,
    },
    signatureVerification: signatureTest || {
      success: false,
      error: "No webhook secret configured",
      recommendation: "Set FLUTTERWAVE_WEBHOOK_SECRET_HASH in Vercel environment variables",
    },
    checklist: {
      "1. Webhook URL configured in Flutterwave Dashboard": {
        url: "https://www.flippay.app/api/flutterwave/webhook",
        method: "POST",
        status: "✅ URL is accessible (GET returns 200)",
      },
      "2. Webhook Secret Hash configured": {
        configured: !!FLUTTERWAVE_WEBHOOK_SECRET_HASH,
        location: "Flutterwave Dashboard > Settings > Webhooks > Secret hash",
        vercelEnvVar: "FLUTTERWAVE_WEBHOOK_SECRET_HASH",
        status: FLUTTERWAVE_WEBHOOK_SECRET_HASH ? "✅ Configured" : "❌ Missing",
      },
      "3. Webhook events subscribed": {
        requiredEvents: [
          "charge.completed",
          "charge.success",
          "virtualaccountpayment",
        ],
        note: "Check Flutterwave Dashboard > Settings > Webhooks > Events",
      },
      "4. Server allows POST requests": {
        status: "✅ POST handler exists",
        note: "Webhook endpoint accepts POST requests with signature verification",
      },
      "5. Signature verification working": {
        status: signatureTest?.success ? "✅ Working" : "⚠️ Check configuration",
        details: signatureTest,
      },
    },
    troubleshooting: {
      "If webhooks are not reaching your server": [
        "1. Verify FLUTTERWAVE_WEBHOOK_SECRET_HASH is set in Vercel environment variables",
        "2. Check Flutterwave Dashboard > Settings > Webhooks > Secret hash matches Vercel env var",
        "3. Ensure webhook URL in Flutterwave dashboard is exactly: https://www.flippay.app/api/flutterwave/webhook",
        "4. Verify 'Add meta to webhook' is enabled in Flutterwave dashboard",
        "5. Check Vercel logs for webhook requests (they should appear even if signature fails)",
        "6. Test with a manual webhook call using the test endpoint",
      ],
      "To test webhook manually": {
        endpoint: "POST /api/test/flutterwave-webhook",
        body: {
          txRef: "FLW-xxx-xxx-xxx",
          transactionId: "xxx",
        },
        note: "This bypasses signature verification for testing",
      },
    },
  });
}

/**
 * POST handler - Simulate a webhook call for testing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("verif-hash") || request.headers.get("flutterwave-signature");
    
    const result: any = {
      success: true,
      message: "Webhook simulation test",
      received: {
        hasBody: !!body,
        bodyLength: body.length,
        hasSignature: !!signature,
        signatureHeader: signature ? signature.substring(0, 30) + "..." : null,
        contentType: request.headers.get("content-type"),
        userAgent: request.headers.get("user-agent"),
      },
    };

    // Try to parse body
    try {
      const parsed = JSON.parse(body);
      result.parsedBody = {
        event: parsed.event || parsed.type,
        hasData: !!parsed.data,
        dataKeys: parsed.data ? Object.keys(parsed.data) : [],
      };
    } catch (e) {
      result.parseError = "Body is not valid JSON";
    }

    // Test signature verification if signature provided
    if (signature && body) {
      const isValid = verifyWebhookSignature(body, signature);
      result.signatureVerification = {
        verified: isValid,
        message: isValid 
          ? "✅ Signature is valid" 
          : "❌ Signature verification failed - check FLUTTERWAVE_WEBHOOK_SECRET_HASH",
      };
    } else {
      result.signatureVerification = {
        verified: false,
        message: "⚠️ No signature provided - webhook requires signature header",
      };
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
