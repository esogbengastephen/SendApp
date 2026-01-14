import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceNumber: string }> | { invoiceNumber: string } }
) {
  try {
    // Handle both sync and async params (Next.js 15+)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { invoiceNumber } = resolvedParams;
    // Decode invoice number in case it's URL encoded
    const decodedInvoiceNumber = decodeURIComponent(invoiceNumber).trim();
    const body = await request.json();
    const { customerEmail, customerName } = body;

    console.log("Marking invoice as paid by receiver:", decodedInvoiceNumber);

    // Fetch invoice first
    const { data: invoice, error: fetchError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("invoice_number", decodedInvoiceNumber)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching invoice:", fetchError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch invoice" },
        { status: 500 }
      );
    }

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Check if invoice is already paid
    if (invoice.status === "paid") {
      return NextResponse.json(
        { success: false, error: "Invoice is already marked as paid" },
        { status: 400 }
      );
    }

    // Verify customer email matches (optional verification)
    if (customerEmail && invoice.customer_email && invoice.customer_email.toLowerCase() !== customerEmail.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "Email does not match invoice customer email" },
        { status: 403 }
      );
    }

    // Update invoice status to paid
    const { data: updatedInvoice, error: updateError } = await supabaseAdmin
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        metadata: {
          ...(invoice.metadata || {}),
          marked_paid_by: customerEmail || customerName || "receiver",
          marked_paid_at: new Date().toISOString(),
        },
      })
      .eq("invoice_number", decodedInvoiceNumber)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating invoice:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to mark invoice as paid" },
        { status: 500 }
      );
    }

    // Get merchant info to send notification
    let merchantEmail = null;
    if (invoice.user_id) {
      const { data: userData } = await supabaseAdmin
        .from("users")
        .select("email")
        .eq("id", invoice.user_id)
        .single();
      merchantEmail = userData?.email || null;
    }

    return NextResponse.json({
      success: true,
      message: "Invoice marked as paid successfully",
      invoice: updatedInvoice,
      merchantEmail,
    });
  } catch (error: any) {
    console.error("Error marking invoice as paid:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
