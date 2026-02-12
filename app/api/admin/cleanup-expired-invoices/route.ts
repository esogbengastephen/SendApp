import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/admin/cleanup-expired-invoices
 *
 * Marks invoices as expired when due_date has passed.
 * Only updates rows with status = 'pending' and due_date < now().
 *
 * Call by: Vercel Cron, cron-job.org, or manual admin.
 * Optional auth: set CRON_SECRET and send Authorization: Bearer <secret>
 */
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = request.headers.get("Authorization");
      const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
      if (token !== secret) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const now = new Date().toISOString();

    const { data: expired, error: fetchError } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_number, due_date")
      .eq("status", "pending")
      .lt("due_date", now);

    if (fetchError) {
      console.error("[Cleanup Expired Invoices] Error fetching:", fetchError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch invoices" },
        { status: 500 }
      );
    }

    if (!expired?.length) {
      return NextResponse.json({
        success: true,
        message: "No overdue pending invoices found",
        updated: 0,
        invoice_numbers: [],
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from("invoices")
      .update({ status: "expired", updated_at: now })
      .in("id", expired.map((i) => i.id));

    if (updateError) {
      console.error("[Cleanup Expired Invoices] Error updating:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update invoices" },
        { status: 500 }
      );
    }

    const invoiceNumbers = expired.map((i) => i.invoice_number);
    console.log(`[Cleanup Expired Invoices] Marked ${expired.length} as expired:`, invoiceNumbers);

    return NextResponse.json({
      success: true,
      message: `Marked ${expired.length} overdue invoice(s) as expired`,
      updated: expired.length,
      invoice_numbers: invoiceNumbers,
    });
  } catch (err: unknown) {
    console.error("[Cleanup Expired Invoices] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
