/**
 * CDP (Coinbase Developer Platform) webhook for instant off-ramp deposit detection.
 *
 * When a user sends SEND to their Smart Wallet, CDP can send a webhook here.
 * We verify the signature, find the pending off-ramp row by deposit address,
 * and trigger sweep + Flutterwave payout (same logic as process-payouts cron).
 *
 * Setup:
 * - CDP Portal → Webhooks → create subscription for onchain activity (Base).
 * - Set URL to: https://your-domain.com/api/offramp/webhook
 * - Copy the signing secret → set CDP_WEBHOOK_SECRET in env.
 *
 * Signature: X-Hook0-Signature (t=timestamp,h=headerNames,v1=hmacHex).
 * See: https://docs.cdp.coinbase.com/data/webhooks/verify-signatures
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { processOneOfframpPayout, type OfframpRow } from "@/lib/offramp-sweep-payout";
import { normalizeSmartWalletAddress } from "@/lib/coinbase-smart-wallet";
import { supabaseAdmin } from "@/lib/supabase";

const MAX_AGE_MINUTES = 5;

/**
 * Verify CDP webhook signature (X-Hook0-Signature).
 * Signed payload: timestamp.headerNames.headerValues.rawBody
 */
function verifyWebhookSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
  headers: Headers,
  maxAgeMinutes: number = MAX_AGE_MINUTES
): boolean {
  if (!signatureHeader || !secret) return false;
  try {
    const elements = signatureHeader.split(",");
    const tPart = elements.find((e) => e.startsWith("t="));
    const hPart = elements.find((e) => e.startsWith("h="));
    const v1Part = elements.find((e) => e.startsWith("v1="));
    if (!tPart || !hPart || !v1Part) return false;

    const timestamp = tPart.split("=")[1];
    const headerNames = hPart.split("=")[1];
    const providedSignature = v1Part.split("=")[1];

    const headerNameList = headerNames.split(" ").filter(Boolean);
    const headerValues = headerNameList
      .map((name) => headers.get(name) ?? headers.get(name.toLowerCase()) ?? "")
      .join(".");
    const signedPayload = `${timestamp}.${headerNames}.${headerValues}.${payload}`;

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(signedPayload, "utf8")
      .digest("hex");

    let expectedBuf: Buffer;
    let providedBuf: Buffer;
    try {
      expectedBuf = Buffer.from(expectedSignature, "hex");
      providedBuf = Buffer.from(providedSignature, "hex");
    } catch {
      return false;
    }
    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }
    const signaturesMatch = crypto.timingSafeEqual(expectedBuf, providedBuf);
    if (!signaturesMatch) return false;

    const webhookTime = parseInt(timestamp, 10) * 1000;
    const ageMinutes = (Date.now() - webhookTime) / (1000 * 60);
    if (ageMinutes > maxAgeMinutes || ageMinutes < 0) {
      console.warn(`[Offramp Webhook] Timestamp out of window: ${ageMinutes.toFixed(1)} min`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[Offramp Webhook] Verification error:", e);
    return false;
  }
}

/** Extract recipient (to) address from CDP webhook payload. */
function getToAddressFromEvent(event: Record<string, unknown>): string | null {
  const data = event.data as Record<string, unknown> | undefined;
  if (!data) return null;
  const to = data.to ?? data.destination;
  if (typeof to === "string" && to.startsWith("0x")) return to;
  return null;
}

export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (e) {
    console.error("[Offramp Webhook] Failed to read body:", e);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const secret =
    process.env.CDP_WEBHOOK_SECRET ?? process.env.OFFRAMP_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Offramp Webhook] CDP_WEBHOOK_SECRET (or OFFRAMP_WEBHOOK_SECRET) not set");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  const signatureHeader =
    request.headers.get("x-hook0-signature") ??
    request.headers.get("X-Hook0-Signature");

  if (!verifyWebhookSignature(rawBody, signatureHeader, secret, request.headers)) {
    console.warn("[Offramp Webhook] Invalid signature — rejecting");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch (e) {
    console.warn("[Offramp Webhook] Invalid JSON body:", e);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  try {
    const eventType = (event.type as string) ?? "";

    // CDP sends e.g. "onchain.activity.detected" for transfer events
    const isRelevant =
      eventType === "onchain.activity.detected" ||
      eventType === "evm_transactions" ||
      eventType.includes("transaction") ||
      eventType.includes("transfer");
    if (!isRelevant) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const toAddress = getToAddressFromEvent(event);
    if (!toAddress) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const normalizedTo = normalizeSmartWalletAddress(toAddress) ?? toAddress.toLowerCase().trim();
    const hexTo = normalizedTo.startsWith("0x") ? normalizedTo : `0x${normalizedTo}`;

    const { data: rows, error } = await supabaseAdmin
      .from("offramp_transactions")
      .select(
        "id, transaction_id, user_id, deposit_address, wallet_address, deposit_private_key_encrypted, account_number, account_name, bank_code, network, status"
      )
      .eq("status", "pending")
      .eq("network", "base")
      .is("deposit_private_key_encrypted", null)
      .not("deposit_address", "is", null)
      .not("user_id", "is", null)
      .or(`deposit_address.eq.${hexTo},deposit_address.eq.${hexTo.toLowerCase()},wallet_address.eq.${hexTo},wallet_address.eq.${hexTo.toLowerCase()}`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[Offramp Webhook] DB error:", error);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const row = rows;

    if (!row) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    console.log(
      `[Offramp Webhook] Deposit detected for tx ${row.transaction_id} at ${hexTo}; triggering payout.`
    );

    // Optional short delay so chain has balance (can remove if CDP fires after confirmations)
    await new Promise((r) => setTimeout(r, 3000));

    try {
      const result = await processOneOfframpPayout(row as OfframpRow);
      if (result.success) {
        console.log(
          `[Offramp Webhook] Payout done: ${result.sendAmount} SEND → ₦${result.ngnAmount}`
        );
      } else {
        console.warn("[Offramp Webhook] Payout failed:", result.error);
      }
    } catch (payoutErr) {
      console.error("[Offramp Webhook] Payout threw:", payoutErr);
      // Still return 200 so CDP doesn't retry; cron can pick up later
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("[Offramp Webhook] Error:", err);
    // Return 200 so CDP stops retrying; log for debugging
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
