import { NextRequest, NextResponse } from "next/server";

/**
 * Webhook Status Check Endpoint
 * Helps diagnose webhook configuration issues
 * Based on Flutterwave documentation: https://developer.flutterwave.com/docs/webhooks
 */
export async function GET(request: NextRequest) {
  try {
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.flippay.app"}/api/flutterwave/webhook`;
    const hasSecretHash = !!process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
    const hasSecretKey = !!process.env.FLUTTERWAVE_SECRET_KEY;
    const isTestMode = process.env.FLUTTERWAVE_USE_TEST_MODE === "true" || 
                       (process.env.FLUTTERWAVE_USE_TEST_MODE === undefined && process.env.NODE_ENV === "development");

    return NextResponse.json({
      success: true,
      webhook: {
        url: webhookUrl,
        endpoint: "/api/flutterwave/webhook",
        status: "active",
        method: "POST",
        events: [
          "charge.completed", // v4 API (primary)
          "charge.success", // v3 API (backward compatibility)
          "charge.failed",
          "virtualaccountpayment",
          "transfer.completed",
          "transfer.failed",
          "refund.completed",
        ],
      },
      configuration: {
        hasWebhookSecretHash: hasSecretHash,
        hasSecretKey: hasSecretKey,
        environment: isTestMode ? "test" : "production",
        apiBase: isTestMode 
          ? "https://developersandbox-api.flutterwave.com/v3"
          : "https://api.flutterwave.com/v3",
      },
      checklist: {
        webhookUrlConfigured: {
          status: "check_flutterwave_dashboard",
          message: "Verify webhook URL is set in Flutterwave Dashboard → Settings → Webhooks",
          expected: webhookUrl,
        },
        eventsSubscribed: {
          status: "check_flutterwave_dashboard",
          message: "Verify ALL events are checked in Flutterwave Dashboard",
          required: [
            "charge.completed",
            "charge.failed",
            "virtualaccountpayment",
            "transfer.completed",
            "transfer.failed",
            "refund.completed",
          ],
        },
        metadataEnabled: {
          status: "check_flutterwave_dashboard",
          message: "⚠️ CRITICAL: Enable 'Add meta to webhook' in Flutterwave Dashboard",
          importance: "high",
          note: "Without this, webhook won't include transaction_id, wallet_address, user_id in payload",
        },
        secretHashSet: {
          status: hasSecretHash ? "ok" : "missing",
          message: hasSecretHash 
            ? "Webhook secret hash is configured"
            : "⚠️ FLUTTERWAVE_WEBHOOK_SECRET_HASH is not set in environment variables",
          action: hasSecretHash 
            ? "Verify it matches Flutterwave Dashboard → Settings → Webhooks"
            : "Add FLUTTERWAVE_WEBHOOK_SECRET_HASH to Vercel environment variables",
        },
        secretKeySet: {
          status: hasSecretKey ? "ok" : "missing",
          message: hasSecretKey 
            ? "Flutterwave secret key is configured"
            : "⚠️ FLUTTERWAVE_SECRET_KEY is not set",
        },
      },
      instructions: {
        step1: {
          title: "Configure Webhook in Flutterwave Dashboard",
          steps: [
            "1. Go to https://dashboard.flutterwave.com",
            "2. Navigate to Settings → Webhooks",
            "3. Add/Edit webhook URL: " + webhookUrl,
            "4. ✅ Check ALL event boxes (charge.completed, charge.failed, virtualaccountpayment, etc.)",
            "5. ⚠️ CRITICAL: Enable 'Add meta to webhook' checkbox",
            "6. Set/Verify Secret Hash matches FLUTTERWAVE_WEBHOOK_SECRET_HASH in Vercel",
            "7. Save webhook",
          ],
        },
        step2: {
          title: "Verify Environment Variables in Vercel",
          steps: [
            "1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables",
            "2. Verify FLUTTERWAVE_WEBHOOK_SECRET_HASH is set",
            "3. Verify FLUTTERWAVE_SECRET_KEY is set",
            "4. Verify NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY is set",
            "5. Redeploy if you just added variables",
          ],
        },
        step3: {
          title: "Test Webhook",
          steps: [
            "1. Make a test payment",
            "2. Check Vercel logs for /api/flutterwave/webhook",
            "3. Look for: 'Event received: charge.completed'",
            "4. Look for: 'Signature verified successfully'",
            "5. Look for: 'On-ramp payment detected'",
          ],
        },
      },
      references: {
        webhookDocs: "https://developer.flutterwave.com/docs/webhooks",
        bestPractices: "https://developer.flutterwave.com/docs/best-practices",
        idempotency: "https://developer.flutterwave.com/docs/idempotency",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
