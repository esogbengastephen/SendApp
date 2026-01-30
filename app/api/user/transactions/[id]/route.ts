import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Get detailed transaction information by ID and type
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const transactionId = resolvedParams.id;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const userId = searchParams.get("userId");

    if (!transactionId || !type || !userId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    let transactionDetails: any = null;

    switch (type) {
      case "crypto_purchase": {
        const { data, error } = await supabaseAdmin
          .from("transactions")
          .select("*")
          .eq("id", transactionId)
          .eq("user_id", userId)
          .single();

        if (error || !data) {
          return NextResponse.json(
            { success: false, error: "Transaction not found" },
            { status: 404 }
          );
        }

        const effectiveStatus = (data.status === "pending" && data.tx_hash) ? "completed" : (data.status || "pending");
        transactionDetails = {
          type: "crypto_purchase",
          id: data.id,
          transactionId: data.transaction_id,
          ngnAmount: parseFloat(data.ngn_amount || "0"),
          sendAmount: parseFloat(data.send_amount || "0"),
          walletAddress: data.wallet_address,
          status: effectiveStatus,
          txHash: data.tx_hash,
          paystackReference: data.paystack_reference,
          exchangeRate: data.exchange_rate,
          sendtag: data.sendtag,
          errorMessage: data.error_message,
          createdAt: data.created_at,
          completedAt: data.completed_at,
          initializedAt: data.initialized_at,
          lastCheckedAt: data.last_checked_at,
          verificationAttempts: data.verification_attempts || 0,
        };
        break;
      }

      case "utility": {
        const { data, error } = await supabaseAdmin
          .from("utility_transactions")
          .select("*")
          .eq("id", transactionId)
          .eq("user_id", userId)
          .single();

        if (error || !data) {
          return NextResponse.json(
            { success: false, error: "Transaction not found" },
            { status: 404 }
          );
        }

        const serviceNames: Record<string, string> = {
          airtime: "Airtime",
          data: "Data Bundle",
          tv: "TV Subscription",
          betting: "Betting",
          electricity: "Electricity",
          school: "School e-PIN",
        };

        transactionDetails = {
          type: "utility",
          id: data.id,
          serviceId: data.service_id,
          serviceName: serviceNames[data.service_id] || data.service_id,
          network: data.network,
          phoneNumber: data.phone_number,
          meterNumber: data.phone_number, // For electricity
          amount: parseFloat(data.amount?.toString() || "0"),
          markupAmount: parseFloat(data.markup_amount?.toString() || "0"),
          totalAmount: parseFloat(data.total_amount?.toString() || "0"),
          status: data.status,
          clubkonnectReference: data.clubkonnect_reference,
          clubkonnectResponse: data.clubkonnect_response ? JSON.parse(data.clubkonnect_response) : null,
          errorMessage: data.error_message,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
        break;
      }

      case "invoice_paid":
      case "invoice_created": {
        const { data: userData } = await supabaseAdmin
          .from("users")
          .select("email")
          .eq("id", userId)
          .single();

        const userEmail = userData?.email || "";

        const { data, error } = await supabaseAdmin
          .from("invoices")
          .select("*")
          .eq("id", transactionId)
          .or(`user_id.eq.${userId},customer_email.eq.${userEmail}`)
          .single();

        if (error || !data) {
          return NextResponse.json(
            { success: false, error: "Invoice not found" },
            { status: 404 }
          );
        }

        transactionDetails = {
          type: data.status === "paid" ? "invoice_paid" : "invoice_created",
          id: data.id,
          invoiceNumber: data.invoice_number,
          amount: parseFloat(data.amount?.toString() || "0"),
          currency: data.currency,
          cryptoChainId: data.crypto_chain_id,
          cryptoAddress: data.crypto_address,
          description: data.description,
          customerName: data.customer_name,
          customerEmail: data.customer_email,
          customerPhone: data.customer_phone,
          status: data.status,
          dueDate: data.due_date,
          paidAt: data.paid_at,
          transactionId: data.transaction_id,
          paystackReference: data.paystack_reference,
          metadata: data.metadata,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
        break;
      }

      case "offramp": {
        const { data, error } = await supabaseAdmin
          .from("offramp_transactions")
          .select("*")
          .eq("id", transactionId)
          .eq("user_id", userId)
          .single();

        if (error || !data) {
          return NextResponse.json(
            { success: false, error: "Transaction not found" },
            { status: 404 }
          );
        }

        const effectiveStatus = (data.status === "pending" && data.swap_tx_hash) ? "completed" : (data.status || "pending");
        transactionDetails = {
          type: "offramp",
          id: data.id,
          transactionId: data.transaction_id,
          userAccountNumber: data.user_account_number,
          userAccountName: data.user_account_name,
          userBankCode: data.user_bank_code,
          walletAddress: data.unique_wallet_address,
          tokenAddress: data.token_address,
          tokenSymbol: data.token_symbol,
          tokenAmount: data.token_amount,
          tokenAmountRaw: data.token_amount_raw,
          usdcAmount: data.usdc_amount,
          usdcAmountRaw: data.usdc_amount_raw,
          ngnAmount: parseFloat(data.ngn_amount?.toString() || "0"),
          exchangeRate: data.exchange_rate,
          feeNgn: parseFloat(data.fee_ngn?.toString() || "0"),
          feeInSend: data.fee_in_send,
          status: effectiveStatus,
          swapTxHash: data.swap_tx_hash,
          swapAttempts: data.swap_attempts || 0,
          paystackReference: data.paystack_reference,
          paystackRecipientCode: data.paystack_recipient_code,
          errorMessage: data.error_message,
          refundTxHash: data.refund_tx_hash,
          createdAt: data.created_at,
          tokenReceivedAt: data.token_received_at,
          usdcReceivedAt: data.usdc_received_at,
          completedAt: data.completed_at,
        };
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid transaction type" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      transaction: transactionDetails,
    });
  } catch (error: any) {
    console.error("[Transaction Details API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
