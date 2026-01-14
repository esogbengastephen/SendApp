import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { initializeTransaction } from "@/lib/paystack";
import { getUserByEmail } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceNumber: string }> }
) {
  try {
    const { invoiceNumber } = await params;
    const body = await request.json();
    const { email } = body;

    // Fetch invoice
    const { data: invoice, error: fetchError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("invoice_number", invoiceNumber)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json(
        { success: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Check if invoice is already paid
    if (invoice.status === "paid") {
      return NextResponse.json(
        { success: false, error: "Invoice is already paid" },
        { status: 400 }
      );
    }

    // Check if invoice is expired
    if (invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status === "pending") {
      // Auto-expire invoice
      await supabaseAdmin
        .from("invoices")
        .update({ status: "expired" })
        .eq("invoice_number", invoiceNumber);

      return NextResponse.json(
        { success: false, error: "Invoice has expired" },
        { status: 400 }
      );
    }

    // Get user for email
    let payerEmail = email || invoice.customer_email;
    if (!payerEmail) {
      const userResult = await getUserByEmail(email || "");
      if (userResult.success && userResult.user) {
        payerEmail = userResult.user.email;
      } else {
        return NextResponse.json(
          { success: false, error: "Email is required for payment" },
          { status: 400 }
        );
      }
    }

    // Initialize Paystack transaction
    const amountInKobo = Math.round(parseFloat(invoice.amount) * 100); // Convert to kobo
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invoice/${invoiceNumber}?payment=success`;
    const paystackResult = await initializeTransaction({
      email: payerEmail,
      amount: amountInKobo,
      reference: `INV-${invoiceNumber}-${Date.now()}`,
      callback_url: callbackUrl,
      metadata: {
        invoice_number: invoiceNumber,
        invoice_id: invoice.id,
        user_id: invoice.user_id,
      },
    });

    if (!paystackResult.success) {
      return NextResponse.json(
        { success: false, error: paystackResult.error || "Failed to initialize payment" },
        { status: 500 }
      );
    }

    // Update invoice with Paystack reference
    await supabaseAdmin
      .from("invoices")
      .update({ paystack_reference: paystackResult.data.reference })
      .eq("invoice_number", invoiceNumber);

    return NextResponse.json({
      success: true,
      authorization_url: paystackResult.data.authorization_url,
      access_code: paystackResult.data.access_code,
      reference: paystackResult.data.reference,
    });
  } catch (error: any) {
    console.error("Error processing invoice payment:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
