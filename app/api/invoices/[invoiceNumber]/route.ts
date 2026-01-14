import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserByEmail } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceNumber: string }> | { invoiceNumber: string } }
) {
  try {
    // Handle both sync and async params (Next.js 15+)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { invoiceNumber } = resolvedParams;
    // Decode invoice number in case it's URL encoded
    const decodedInvoiceNumber = decodeURIComponent(invoiceNumber);
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    
    console.log("Fetching invoice with number:", decodedInvoiceNumber);

    // Fetch invoice first
    const { data: invoice, error } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("invoice_number", decodedInvoiceNumber)
      .single();

    if (error) {
      console.error("Error fetching invoice:", error);
      console.error("Invoice number searched:", decodedInvoiceNumber);
      return NextResponse.json(
        { success: false, error: error.message || "Invoice not found" },
        { status: 404 }
      );
    }

    if (!invoice) {
      console.error("Invoice not found for invoice number:", decodedInvoiceNumber);
      return NextResponse.json(
        { success: false, error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Fetch user/merchant information separately
    let merchantInfo = null;
    if (invoice.user_id) {
      const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .select("id, email, display_name, photo_url, invoice_type, business_name, business_logo_url, business_address, business_city, business_state, business_zip, business_phone")
        .eq("id", invoice.user_id)
        .single();

      if (!userError && userData) {
        merchantInfo = {
          name: userData.display_name || userData.email,
          email: userData.email,
          photoUrl: userData.photo_url,
          invoiceType: userData.invoice_type || "personal",
          businessName: userData.business_name,
          businessLogoUrl: userData.business_logo_url,
          businessAddress: userData.business_address,
          businessCity: userData.business_city,
          businessState: userData.business_state,
          businessZip: userData.business_zip,
          businessPhone: userData.business_phone,
        };
      }
    }

    // Clean invoice object
    const cleanInvoice = invoice;

    // If email is provided, verify ownership
    if (email) {
      const userResult = await getUserByEmail(email);
      if (userResult.success && userResult.user && userResult.user.id === cleanInvoice.user_id) {
        return NextResponse.json({
          success: true,
          invoice: cleanInvoice,
          merchant: merchantInfo,
        });
      }
    }

    // Return invoice even without email (for public sharing)
    return NextResponse.json({
      success: true,
      invoice: cleanInvoice,
      merchant: merchantInfo,
    });
  } catch (error: any) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceNumber: string }> | { invoiceNumber: string } }
) {
  try {
    // Handle both sync and async params (Next.js 15+)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { invoiceNumber } = resolvedParams;
    // Decode invoice number in case it's URL encoded and trim whitespace
    const decodedInvoiceNumber = decodeURIComponent(invoiceNumber).trim();
    const body = await request.json();
    const { email, status, amount, currency, cryptoChainId, cryptoAddress, description, customerName, customerEmail, customerPhone, dueDate, invoiceType, lineItems } = body;

    console.log("Updating invoice with number:", decodedInvoiceNumber);
    console.log("Raw invoice number from params:", invoiceNumber);

    // Try multiple search strategies
    let invoice = null;
    let fetchError = null;

    // First try with decoded and trimmed
    let { data, error } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("invoice_number", decodedInvoiceNumber)
      .maybeSingle();

    if (error) {
      console.error("Error with decoded invoice number:", error);
      fetchError = error;
    } else if (data) {
      invoice = data;
    }

    // If not found, try with raw invoice number
    if (!invoice && invoiceNumber !== decodedInvoiceNumber) {
      console.log("Trying with raw invoice number:", invoiceNumber);
      const { data: data2, error: error2 } = await supabaseAdmin
        .from("invoices")
        .select("*")
        .eq("invoice_number", invoiceNumber)
        .maybeSingle();

      if (error2) {
        console.error("Error with raw invoice number:", error2);
        if (!fetchError) fetchError = error2;
      } else if (data2) {
        invoice = data2;
        console.log("Found invoice with raw number");
      }
    }

    if (fetchError && !invoice) {
      console.error("Error fetching invoice:", fetchError);
      console.error("Searched for invoice number:", decodedInvoiceNumber);
      return NextResponse.json(
        { success: false, error: `Database error: ${fetchError.message}` },
        { status: 500 }
      );
    }

    if (!invoice) {
      console.error("Invoice not found for number:", decodedInvoiceNumber);
      // Try to list a few invoices to see the format
      const { data: sampleInvoices } = await supabaseAdmin
        .from("invoices")
        .select("invoice_number")
        .limit(5);
      console.log("Sample invoice numbers in DB:", sampleInvoices);
      return NextResponse.json(
        { success: false, error: `Invoice not found. Searched for: "${decodedInvoiceNumber}"` },
        { status: 404 }
      );
    }

    console.log("Found invoice:", invoice.id, invoice.invoice_number);

    // Verify ownership if email provided
    if (email) {
      const userResult = await getUserByEmail(email);
      if (!userResult.success || !userResult.user || userResult.user.id !== invoice.user_id) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 403 }
        );
      }
    }

    // Only allow updates to pending invoices
    if (invoice.status !== "pending" && status !== invoice.status) {
      return NextResponse.json(
        { success: false, error: "Can only update pending invoices" },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: any = {};
    if (status) updateData.status = status;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (currency !== undefined) updateData.currency = currency;
    if (cryptoChainId !== undefined) updateData.crypto_chain_id = cryptoChainId;
    if (cryptoAddress !== undefined) updateData.crypto_address = cryptoAddress;
    if (description !== undefined) updateData.description = description;
    if (customerName !== undefined) updateData.customer_name = customerName;
    if (customerEmail !== undefined) updateData.customer_email = customerEmail;
    if (customerPhone !== undefined) updateData.customer_phone = customerPhone;
    if (dueDate !== undefined) updateData.due_date = dueDate ? new Date(dueDate).toISOString() : null;
    if (invoiceType !== undefined) updateData.invoice_type = invoiceType;
    
    // Update metadata with line items if provided
    if (lineItems !== undefined) {
      const currentMetadata = invoice.metadata || {};
      updateData.metadata = {
        ...currentMetadata,
        lineItems: lineItems.length > 0 ? lineItems : undefined,
      };
      // Remove lineItems key if empty array
      if (lineItems.length === 0) {
        delete updateData.metadata.lineItems;
      }
    }

    // If status is being set to paid, set paid_at
    if (status === "paid") {
      updateData.paid_at = new Date().toISOString();
    }

    console.log("Update data:", updateData);

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 }
      );
    }

    // Update invoice
    const { data: updatedInvoice, error: updateError } = await supabaseAdmin
      .from("invoices")
      .update(updateData)
      .eq("invoice_number", decodedInvoiceNumber)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating invoice:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update invoice" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
    });
  } catch (error: any) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceNumber: string }> | { invoiceNumber: string } }
) {
  try {
    // Handle both sync and async params (Next.js 15+)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { invoiceNumber } = resolvedParams;
    // Decode invoice number in case it's URL encoded
    const decodedInvoiceNumber = decodeURIComponent(invoiceNumber).trim();
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required for deletion" },
        { status: 400 }
      );
    }

    console.log("Deleting invoice with number:", decodedInvoiceNumber);

    // Fetch invoice first to verify ownership
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

    // Verify ownership
    const userResult = await getUserByEmail(email);
    if (!userResult.success || !userResult.user || userResult.user.id !== invoice.user_id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: You can only delete your own invoices" },
        { status: 403 }
      );
    }

    // Delete the invoice
    const { error: deleteError } = await supabaseAdmin
      .from("invoices")
      .delete()
      .eq("invoice_number", decodedInvoiceNumber);

    if (deleteError) {
      console.error("Error deleting invoice:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to delete invoice" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Invoice deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
