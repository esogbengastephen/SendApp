import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserByEmail } from "@/lib/auth";
import { sendInvoiceEmail } from "@/lib/transaction-emails";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, amount, currency, cryptoChainId, cryptoAddress, description, customerName, customerEmail, customerPhone, dueDate, invoiceType, lineItems } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid amount is required" },
        { status: 400 }
      );
    }

    // Validate crypto fields if currency is crypto
    if (currency && currency !== 'NGN') {
      if (!cryptoChainId) {
        return NextResponse.json(
          { success: false, error: "Crypto chain ID is required for crypto invoices" },
          { status: 400 }
        );
      }
    }

    // Get user by email
    const userResult = await getUserByEmail(email);
    if (!userResult.success || !userResult.user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const userId = userResult.user.id;

    // Generate invoice number
    const { data: invoiceNumberData, error: invoiceNumberError } = await supabaseAdmin
      .rpc('generate_invoice_number');

    if (invoiceNumberError) {
      console.error("Error generating invoice number:", invoiceNumberError);
      // Fallback: generate manually
      const year = new Date().getFullYear();
      const timestamp = Date.now();
      const invoiceNumber = `INV-${year}-${timestamp.toString().slice(-5)}`;
      
      // Create invoice
      const { data: invoice, error: createError } = await supabaseAdmin
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          user_id: userId,
          amount: parseFloat(amount),
          currency: currency || 'NGN',
          crypto_chain_id: cryptoChainId || null,
          crypto_address: cryptoAddress || null,
          description: description || null,
          customer_name: customerName || null,
          customer_email: customerEmail || null,
          customer_phone: customerPhone || null,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          status: "pending",
          invoice_type: invoiceType || "personal",
          metadata: lineItems && lineItems.length > 0 ? { lineItems } : null,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating invoice:", createError);
        return NextResponse.json(
          { success: false, error: "Failed to create invoice" },
          { status: 500 }
        );
      }

      // Send invoice email to customer if email is provided
      if (customerEmail && invoice) {
        const invoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invoice/${invoice.invoice_number}`;
        const merchantName = userResult.user.display_name || userResult.user.email || "FlipPay";
        
        // Send email asynchronously (don't wait for it)
        sendInvoiceEmail(
          customerEmail,
          invoice.invoice_number,
          invoiceUrl,
          parseFloat(amount),
          currency || 'NGN',
          merchantName,
          description,
          dueDate,
          cryptoAddress,
          cryptoChainId
        ).catch(err => {
          console.error("[Invoice Email] Failed to send email:", err);
          // Don't fail the invoice creation if email fails
        });
      }

      return NextResponse.json({
        success: true,
        invoice: invoice,
      });
    }

    const invoiceNumber = invoiceNumberData;

    // Create invoice
    const { data: invoice, error: createError } = await supabaseAdmin
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        user_id: userId,
        amount: parseFloat(amount),
        currency: currency || 'NGN',
        crypto_chain_id: cryptoChainId || null,
        crypto_address: cryptoAddress || null,
        description: description || null,
        customer_name: customerName || null,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        status: "pending",
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating invoice:", createError);
      return NextResponse.json(
        { success: false, error: "Failed to create invoice" },
        { status: 500 }
      );
    }

    // Send invoice email to customer if email is provided
    if (customerEmail && invoice) {
      const invoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invoice/${invoice.invoice_number}`;
      const merchantName = userResult.user.display_name || userResult.user.email || "FlipPay";
      
      // Send email asynchronously (don't wait for it)
      sendInvoiceEmail(
        customerEmail,
        invoice.invoice_number,
        invoiceUrl,
        parseFloat(amount),
        currency || 'NGN',
        merchantName,
        description,
        dueDate,
        cryptoAddress,
        cryptoChainId
      ).catch(err => {
        console.error("[Invoice Email] Failed to send email:", err);
        // Don't fail the invoice creation if email fails
      });
    }

    return NextResponse.json({
      success: true,
      invoice: invoice,
    });
  } catch (error: any) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
