import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Get all transactions for a user
 * Returns: All transaction types (NGN to crypto, utility purchases, invoices, offramp)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Missing userId parameter" },
        { status: 400 }
      );
    }

    const allTransactions: any[] = [];

    // 1. Get NGN to Crypto transactions
    const { data: cryptoTransactions } = await supabaseAdmin
      .from("transactions")
      .select("id, ngn_amount, send_amount, status, created_at, tx_hash, transaction_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (cryptoTransactions) {
      cryptoTransactions.forEach(tx => {
        // If we have a tx_hash, the tokens were sent — treat as completed even if DB still says pending
        const effectiveStatus = (tx.status === "pending" && tx.tx_hash) ? "completed" : (tx.status || "pending");
        const color = effectiveStatus === "completed" ? "green" : effectiveStatus === "failed" ? "red" : "yellow";
        allTransactions.push({
          id: tx.id,
          type: "naira_to_crypto", // Renamed for clarity
          originalType: "crypto_purchase", // Keep for backward compatibility
          title: "Naira to Crypto",
          description: `Bought ${parseFloat(tx.send_amount || "0").toFixed(2)} SEND`,
          amount: parseFloat(tx.ngn_amount || "0"),
          amountLabel: `₦${parseFloat(tx.ngn_amount || "0").toLocaleString()}`,
          secondaryAmount: parseFloat(tx.send_amount || "0"),
          secondaryAmountLabel: `${parseFloat(tx.send_amount || "0").toFixed(2)} SEND`,
          status: effectiveStatus,
          date: tx.created_at,
          txHash: tx.tx_hash,
          reference: tx.transaction_id,
          icon: "currency_bitcoin",
          color,
        });
      });
    }

    // 2. Get Utility transactions
    const { data: utilityTransactions } = await supabaseAdmin
      .from("utility_transactions")
      .select("id, service_id, network, phone_number, amount, total_amount, status, created_at, clubkonnect_reference")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (utilityTransactions) {
      const serviceNames: Record<string, string> = {
        airtime: "Airtime",
        data: "Data Bundle",
        tv: "TV Subscription",
        betting: "Betting",
        electricity: "Electricity",
        school: "School e-PIN",
      };

      utilityTransactions.forEach(tx => {
        const serviceName = serviceNames[tx.service_id] || tx.service_id;
        allTransactions.push({
          id: tx.id,
          type: "utility",
          title: serviceName,
          description: tx.network ? `${serviceName} - ${tx.network}` : serviceName,
          amount: parseFloat(tx.total_amount?.toString() || "0"),
          amountLabel: `₦${parseFloat(tx.total_amount?.toString() || "0").toLocaleString()}`,
          status: tx.status,
          date: tx.created_at,
          reference: tx.clubkonnect_reference,
          phoneNumber: tx.phone_number,
          icon: tx.service_id === "airtime" ? "phone_android" :
                tx.service_id === "data" ? "data_usage" :
                tx.service_id === "tv" ? "tv" :
                tx.service_id === "betting" ? "sports_esports" :
                tx.service_id === "electricity" ? "bolt" :
                tx.service_id === "school" ? "school" : "receipt",
          color: tx.status === "completed" ? "green" : tx.status === "failed" ? "red" : "yellow",
        });
      });
    }

    // 3. Get Invoice payments
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("id", userId)
      .single();

    const userEmail = userData?.email || "";

    const { data: invoices } = userEmail ? await supabaseAdmin
      .from("invoices")
      .select("id, invoice_number, amount, currency, status, created_at, paid_at, customer_email, user_id")
      .or(`user_id.eq.${userId},customer_email.eq.${userEmail}`)
      .order("created_at", { ascending: false })
      .limit(limit) : { data: null };

    if (invoices) {
      invoices.forEach(inv => {
        allTransactions.push({
          id: inv.id,
          type: "invoice", // Unified type for all invoices
          originalType: inv.status === "paid" ? "invoice_paid" : "invoice_created", // Keep for details API
          title: inv.status === "paid" ? "Invoice Paid" : "Invoice Created",
          description: `Invoice #${inv.invoice_number}`,
          amount: parseFloat(inv.amount?.toString() || "0"),
          amountLabel: `${inv.currency === "NGN" ? "₦" : "$"}${parseFloat(inv.amount?.toString() || "0").toLocaleString()}`,
          status: inv.status,
          date: inv.paid_at || inv.created_at,
          reference: inv.invoice_number,
          icon: "receipt_long",
          color: inv.status === "paid" ? "green" : "blue",
        });
      });
    }

    // 4. Get Offramp transactions (Crypto to Naira)
    const { data: offrampTransactions } = await supabaseAdmin
      .from("offramp_transactions")
      .select("id, transaction_id, token_symbol, token_amount, ngn_amount, status, created_at, swap_tx_hash")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (offrampTransactions) {
      offrampTransactions.forEach(tx => {
        // If we have a swap_tx_hash, the conversion was done — treat as completed even if DB still says pending
        const effectiveStatus = (tx.status === "pending" && tx.swap_tx_hash) ? "completed" : (tx.status || "pending");
        const color = effectiveStatus === "completed" ? "green" : effectiveStatus === "failed" ? "red" : "yellow";
        allTransactions.push({
          id: tx.id,
          type: "crypto_to_naira", // Renamed for clarity
          originalType: "offramp", // Keep for backward compatibility
          title: "Crypto to Naira",
          description: `Converted ${tx.token_amount ?? ""} ${tx.token_symbol ?? ""}`.trim() || "Crypto to Naira",
          amount: parseFloat(tx.ngn_amount?.toString() || "0"),
          amountLabel: `₦${parseFloat(tx.ngn_amount?.toString() || "0").toLocaleString()}`,
          secondaryAmount: parseFloat(tx.token_amount || "0"),
          secondaryAmountLabel: [tx.token_amount, tx.token_symbol].filter(Boolean).join(" ") || "",
          status: effectiveStatus,
          date: tx.created_at,
          txHash: tx.swap_tx_hash,
          reference: tx.transaction_id,
          icon: "currency_exchange",
          color,
        });
      });
    }

    // 5. Get NGN deposit transactions (from Flutterwave webhook)
    // Query transactions that have wallet_address starting with "ngn_account_" or metadata.type = "ngn_deposit"
    const { data: allUserTransactions } = await supabaseAdmin
      .from("transactions")
      .select("id, transaction_id, ngn_amount, status, created_at, completed_at, metadata, paystack_reference, wallet_address")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit * 2); // Get more to filter

    if (allUserTransactions) {
      // Filter for NGN deposits and transfers
      const ngnTransactions = allUserTransactions.filter(tx => {
        const metadata = (tx.metadata as any) || {};
        const isNgnDeposit = metadata.type === "ngn_deposit" || 
                            (tx.wallet_address && typeof tx.wallet_address === "string" && tx.wallet_address.startsWith("ngn_account_"));
        const isNgnTransfer = metadata.type === "ngn_transfer" ||
                             (tx.wallet_address && typeof tx.wallet_address === "string" && tx.wallet_address.startsWith("ngn_transfer_"));
        const isRefund = metadata.type === "refund";
        return isNgnDeposit || isNgnTransfer || isRefund;
      });

      ngnTransactions.forEach(tx => {
        const metadata = (tx.metadata as any) || {};
        const isTransfer = metadata.type === "ngn_transfer";
        const isRefund = metadata.type === "refund";
        
        if (isRefund) {
          // This is a refund
          allTransactions.push({
            id: tx.id,
            type: "refund",
            title: "Refund Received",
            description: "Refund to NGN account",
            amount: parseFloat(tx.ngn_amount?.toString() || "0"),
            amountLabel: `₦${parseFloat(tx.ngn_amount?.toString() || "0").toLocaleString()}`,
            status: tx.status || "completed",
            date: tx.completed_at || tx.created_at,
            reference: tx.paystack_reference || tx.transaction_id,
            icon: "refresh",
            color: "blue",
          });
        } else if (isTransfer) {
          // This is a transfer (send money)
          allTransactions.push({
            id: tx.id,
            type: "ngn_transfer",
            title: "Money Sent",
            description: `Transfer to ${metadata.recipient_phone || "recipient"}`,
            amount: parseFloat(tx.ngn_amount?.toString() || "0"),
            amountLabel: `₦${parseFloat(tx.ngn_amount?.toString() || "0").toLocaleString()}`,
            status: tx.status || "pending",
            date: tx.completed_at || tx.created_at,
            reference: tx.paystack_reference || tx.transaction_id,
            icon: "arrow_upward",
            color: tx.status === "completed" ? "green" : tx.status === "failed" ? "red" : "yellow",
          });
        } else {
          // This is a deposit
          allTransactions.push({
            id: tx.id,
            type: "ngn_deposit",
            title: "NGN Deposit",
            description: "Payment received to NGN account",
            amount: parseFloat(tx.ngn_amount?.toString() || "0"),
            amountLabel: `₦${parseFloat(tx.ngn_amount?.toString() || "0").toLocaleString()}`,
            status: tx.status || "completed",
            date: tx.completed_at || tx.created_at,
            reference: tx.paystack_reference || tx.transaction_id,
            icon: "arrow_downward",
            color: "green",
          });
        }
      });
    }

    // 6. TODO: Get Receive Crypto transactions (when implemented)
    // This will track incoming crypto deposits to wallet addresses

    // Sort all transactions by date: newest first (invalid/missing dates go to the end)
    allTransactions.sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      if (Number.isNaN(timeA)) return 1;
      if (Number.isNaN(timeB)) return -1;
      return timeB - timeA; // descending: newest at top
    });

    return NextResponse.json({
      success: true,
      transactions: allTransactions.slice(0, limit),
      total: allTransactions.length,
    });
  } catch (error: any) {
    console.error("[Transactions API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
