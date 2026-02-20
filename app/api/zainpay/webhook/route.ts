import { NextRequest, NextResponse } from "next/server";

/**
 * Zainpay transfer callback webhook.
 * Called by Zainpay when a funds transfer status is updated (e.g. success/failed).
 * Configure ZAINPAY_CALLBACK_URL in env to this endpoint (e.g. https://your-domain.com/api/zainpay/webhook).
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Zainpay webhook endpoint is active",
    endpoint: "/api/zainpay/webhook",
    method: "POST",
    note: "Zainpay sends transfer status updates to this URL when callbackUrl is set on the transfer request.",
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    console.log("[Zainpay Webhook] Transfer callback:", JSON.stringify(body, null, 2));
    const status = body?.data?.status ?? body?.status;
    const txnRef = body?.data?.txnRef ?? body?.txnRef;
    if (txnRef) {
      console.log("[Zainpay Webhook] txnRef:", txnRef, "status:", status);
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[Zainpay Webhook] Error:", e);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
