import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyWebhookSignature } from "@/lib/flutterwave";
import { 
  notifyPaymentReceived, 
  notifyTransferCompleted, 
  notifyTransferFailed, 
  notifyPaymentFailed,
  notifyRefundReceived 
} from "@/lib/notifications";
import { nanoid } from "nanoid";
import { getTransaction, updateTransaction } from "@/lib/transactions";
import { distributeTokens } from "@/lib/token-distribution";
import { getExchangeRate } from "@/lib/settings";
import { calculateTransactionFee, calculateFinalTokens, calculateFeeInTokens } from "@/lib/fee-calculation";
import { recordRevenue } from "@/lib/revenue";
import { sendPaymentVerificationEmail, sendTokenDistributionEmail } from "@/lib/transaction-emails";
import { updateReferralCountOnTransaction } from "@/lib/supabase";

/**
 * Flutterwave webhook handler
 * Processes incoming payments to virtual accounts
 * Updates user balance and creates transaction records
 */

/**
 * GET handler - For testing/verification that the endpoint exists
 * Returns a simple message indicating this is a webhook endpoint
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      success: true,
      message: "Flutterwave webhook endpoint is active",
      endpoint: "/api/flutterwave/webhook",
      method: "POST",
      note: "This endpoint only accepts POST requests from Flutterwave. Webhooks are sent automatically when payments occur.",
      events: [
        "charge.success",
        "charge.failed",
        "virtualaccountpayment",
        "transfer.completed",
        "transfer.failed",
        "refund.completed",
      ],
    },
    { status: 200 }
  );
}

/**
 * POST handler - Main webhook handler
 * Processes incoming webhook events from Flutterwave
 */
export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const body = await request.text();
    // Flutterwave sends signature in 'verif-hash' header (v3 API) or 'flutterwave-signature' (v4 API)
    const signature = request.headers.get("verif-hash") || request.headers.get("flutterwave-signature");

    if (!signature) {
      console.error("[Flutterwave Webhook] Missing signature header");
      console.error("[Flutterwave Webhook] Available headers:", Object.keys(request.headers));
      return NextResponse.json(
        { success: false, error: "Missing signature" },
        { status: 401 }
      );
    }

    // Verify webhook signature
    const isValid = verifyWebhookSignature(body, signature);
    if (!isValid) {
      console.error("[Flutterwave Webhook] Invalid signature");
      console.error("[Flutterwave Webhook] Received signature:", signature.substring(0, 20) + "...");
      return NextResponse.json(
        { success: false, error: "Invalid signature" },
        { status: 401 }
      );
    }
    
    console.log(`[Flutterwave Webhook] ✅ Signature verified successfully`);

    // Parse the webhook payload
    const event = JSON.parse(body);

    // According to Flutterwave v4 docs, event type is "charge.completed" (not "charge.success")
    // But we support both for backward compatibility
    const eventType = event.event || event.type; // Support both 'event' and 'type' fields
    console.log(`[Flutterwave Webhook] Event received:`, eventType);
    console.log(`[Flutterwave Webhook] Event ID:`, event.id);
    console.log(`[Flutterwave Webhook] Timestamp:`, event.timestamp);
    console.log(`[Flutterwave Webhook] Full event data:`, JSON.stringify(event, null, 2));

    // Handle charge.completed (v4) and charge.success (v3) - payment link/checkout payments (ON-RAMP)
    // According to Flutterwave v4 docs, the event type is "charge.completed"
    if (eventType === "charge.completed" || eventType === "charge.success") {
      const chargeData = event.data;
      const txRef = chargeData.tx_ref || chargeData.reference; // Flutterwave uses 'reference' in some payloads
      const flwRef = chargeData.flw_ref;
      const chargeId = chargeData.id; // Transaction ID from Flutterwave (e.g., chg_Hq4oBRTJ4r)
      const amount = parseFloat(chargeData.amount || "0");
      const status = chargeData.status;
      
      // According to Flutterwave docs, metadata is in data.meta (not data.metadata)
      // But we check multiple locations for backward compatibility
      const metadata = chargeData.meta || chargeData.metadata || chargeData.customer?.meta || {};
      
      console.log(`[Flutterwave Webhook] Charge event: ${event.event}`);
      console.log(`[Flutterwave Webhook] Charge ID: ${chargeId}`);
      console.log(`[Flutterwave Webhook] tx_ref: ${txRef} - ₦${amount}`);
      console.log(`[Flutterwave Webhook] Status: ${status}`);
      console.log(`[Flutterwave Webhook] Metadata received:`, JSON.stringify(metadata, null, 2));
      console.log(`[Flutterwave Webhook] Full chargeData keys:`, Object.keys(chargeData));
      
      // BEST PRACTICE: Verify transaction with Flutterwave API before processing
      // This ensures the webhook data hasn't been tampered with
      if (txRef) {
        try {
          const { verifyPayment } = await import("@/lib/flutterwave");
          console.log(`[Flutterwave Webhook] Verifying transaction with Flutterwave API: ${txRef}`);
          const verificationResult = await verifyPayment(txRef);
          
          if (verificationResult.success && verificationResult.data) {
            const verifiedData = verificationResult.data;
            console.log(`[Flutterwave Webhook] ✅ Verification successful:`, {
              status: verifiedData.status,
              amount: verifiedData.amount,
              currency: verifiedData.currency,
              tx_ref: verifiedData.tx_ref,
            });
            
            // Use verified data for critical fields
            const verifiedStatus = verifiedData.status;
            const verifiedAmount = parseFloat(verifiedData.amount?.toString() || "0");
            
            // Verify amount matches
            if (verifiedAmount !== amount) {
              console.error(`[Flutterwave Webhook] ⚠️ Amount mismatch! Webhook: ₦${amount}, Verified: ₦${verifiedAmount}`);
              return NextResponse.json({
                success: false,
                error: "Amount mismatch between webhook and verified transaction",
              }, { status: 400 });
            }
            
            // Verify status matches
            if (verifiedStatus !== "successful" && verifiedStatus !== "success") {
              console.log(`[Flutterwave Webhook] Verified status is not successful: ${verifiedStatus}`);
              return NextResponse.json({
                success: true,
                message: "Verified transaction status is not successful, skipping processing",
              });
            }
          } else {
            console.error(`[Flutterwave Webhook] ⚠️ Verification failed:`, verificationResult.error);
            // Continue processing but log the warning
          }
        } catch (verifyError: any) {
          console.error(`[Flutterwave Webhook] ⚠️ Error verifying transaction:`, verifyError?.message || verifyError);
          // Continue processing but log the error
        }
      }

      // Only process if status is successful (already verified above, but double-check)
      if (status !== "successful" && status !== "success") {
        console.log(`[Flutterwave Webhook] Payment status is not successful: ${status}`);
        return NextResponse.json({
          success: true,
          message: "Payment not successful, skipping processing",
        });
      }

      // Try to get transaction_id from metadata (primary method)
      let transactionId = metadata.transaction_id || metadata.transactionId;
      let walletAddress = metadata.wallet_address || metadata.walletAddress;
      let userId = metadata.user_id || metadata.userId;

      // FALLBACK: If metadata is missing, try to find transaction by tx_ref
      if (!transactionId && txRef) {
        console.log(`[Flutterwave Webhook] ⚠️ No transaction_id in metadata. Looking up transaction by tx_ref: ${txRef}`);
        
        try {
          // Try to find transaction by payment_reference (which might be the tx_ref)
          const { data: transactionByRef, error: lookupError } = await supabaseAdmin
            .from("transactions")
            .select("transaction_id, wallet_address, user_id, status, ngn_amount, send_amount")
            .eq("payment_reference", txRef)
            .or(`metadata->>flutterwave_tx_ref.eq.${txRef},paystack_reference.eq.${txRef}`)
            .eq("status", "pending")
            .maybeSingle();
          
          if (transactionByRef && !lookupError) {
            console.log(`[Flutterwave Webhook] ✅ Found transaction by tx_ref: ${transactionByRef.transaction_id}`);
            transactionId = transactionByRef.transaction_id;
            walletAddress = transactionByRef.wallet_address || walletAddress;
            userId = transactionByRef.user_id || userId;
          } else {
            console.error(`[Flutterwave Webhook] ❌ Transaction not found by tx_ref: ${txRef}`);
            console.error(`[Flutterwave Webhook] Lookup error:`, lookupError);
          }
        } catch (lookupError: any) {
          console.error(`[Flutterwave Webhook] Error looking up transaction by tx_ref:`, lookupError);
        }
      }

      // Check if this is an on-ramp payment (has transaction_id)
      if (transactionId) {
        console.log(`[Flutterwave Webhook] On-ramp payment detected: transaction ${transactionId}`);
        console.log(`[Flutterwave Webhook] Wallet address: ${walletAddress || "MISSING"}`);
        console.log(`[Flutterwave Webhook] User ID: ${userId || "MISSING"}`);

        // Find existing transaction
        const transaction = await getTransaction(transactionId);

        if (!transaction) {
          console.error(`[Flutterwave Webhook] Transaction not found: ${transactionId}`);
          return NextResponse.json(
            { success: false, error: "Transaction not found" },
            { status: 404 }
          );
        }

        // Check if already processed
        if (transaction.status === "completed" && transaction.txHash) {
          console.log(`[Flutterwave Webhook] Transaction already completed: ${transactionId}`);
          return NextResponse.json({
            success: true,
            message: "Transaction already processed",
          });
        }

        // Get exchange rate and calculate fees
        const exchangeRate = await getExchangeRate();
        const feeNGN = await calculateTransactionFee(amount);
        const feeInSEND = calculateFeeInTokens(feeNGN, exchangeRate);
        const finalSendAmount = calculateFinalTokens(amount, feeNGN, exchangeRate);

        console.log(`[Flutterwave Webhook] Converting ${amount} NGN → ${finalSendAmount} SEND (rate: ${exchangeRate}, fee: ${feeNGN} NGN / ${feeInSEND} $SEND)`);

        // Update transaction status
        // Store Flutterwave reference (txRef/flwRef) in payment_reference
        // The txRef from Flutterwave is unique, but we use transaction_id from metadata to find our transaction
        await updateTransaction(transactionId, {
          status: "completed",
          paymentReference: flwRef || txRef || metadata.flutterwave_tx_ref, // Store Flutterwave reference
          ngnAmount: amount,
          sendAmount: finalSendAmount,
          exchangeRate,
          completedAt: new Date(),
          fee_ngn: feeNGN,
          fee_in_send: feeInSEND,
        });

        // Record revenue
        if (feeNGN > 0) {
          const revenueResult = await recordRevenue(transactionId, feeNGN, feeInSEND);
          if (!revenueResult.success) {
            console.error(`[Flutterwave Webhook] ⚠️ Failed to record revenue: ${revenueResult.error}`);
          }
        }

        // Get user email for notifications
        let userEmail: string | null = null;
        if (userId) {
          const { data: user } = await supabaseAdmin
            .from("users")
            .select("email")
            .eq("id", userId)
            .single();
          userEmail = user?.email || null;
        }

        // Send payment verification email
        if (userEmail) {
          try {
            await sendPaymentVerificationEmail(userEmail, amount, flwRef || txRef);
          } catch (emailError) {
            console.error(`[Flutterwave Webhook] Failed to send payment verification email:`, emailError);
          }
        }

        // Update referral count if this is user's first completed transaction
        if (userId) {
          try {
            const referralResult = await updateReferralCountOnTransaction(userId);
            if (referralResult.success) {
              console.log(`[Flutterwave Webhook] ✅ Referral count updated for user ${userId}`);
            }
          } catch (error) {
            console.error(`[Flutterwave Webhook] ⚠️ Exception updating referral count:`, error);
          }
        }

        // Validate wallet address before distributing tokens
        if (!walletAddress || walletAddress.trim() === "") {
          console.error(`[Flutterwave Webhook] ❌ Wallet address is missing! Cannot distribute tokens.`);
          console.error(`[Flutterwave Webhook] Transaction ID: ${transactionId}`);
          console.error(`[Flutterwave Webhook] Metadata:`, JSON.stringify(metadata, null, 2));
          
          // Try to get wallet address from transaction if missing
          const transaction = await getTransaction(transactionId);
          if (transaction?.walletAddress) {
            walletAddress = transaction.walletAddress;
            console.log(`[Flutterwave Webhook] ✅ Retrieved wallet address from transaction: ${walletAddress}`);
          } else {
            return NextResponse.json(
              { 
                success: false, 
                error: "Wallet address is missing from metadata and transaction. Cannot distribute tokens.",
                transactionId,
                metadata: metadata,
              },
              { status: 400 }
            );
          }
        }

        // Distribute tokens
        try {
          console.log(`[Flutterwave Webhook] Starting token distribution...`);
          console.log(`[Flutterwave Webhook] Transaction ID: ${transactionId}`);
          console.log(`[Flutterwave Webhook] Wallet Address: ${walletAddress}`);
          console.log(`[Flutterwave Webhook] Amount: ${finalSendAmount} SEND`);
          
          const distributionResult = await distributeTokens(
            transactionId,
            walletAddress,
            finalSendAmount
          );

          console.log(`[Flutterwave Webhook] Distribution result:`, JSON.stringify(distributionResult, null, 2));

          if (distributionResult.success) {
            console.log(`[Flutterwave Webhook] 🎉 Tokens distributed successfully! TX: ${distributionResult.txHash}`);

            // Send token distribution email
            if (userEmail) {
              try {
                await sendTokenDistributionEmail(
                  userEmail,
                  amount,
                  finalSendAmount.toString(),
                  walletAddress,
                  distributionResult.txHash || ""
                );
              } catch (emailError) {
                console.error(`[Flutterwave Webhook] Failed to send token distribution email:`, emailError);
              }
            }

            return NextResponse.json({
              success: true,
              message: "On-ramp payment processed and tokens distributed",
              data: {
                transactionId,
                txHash: distributionResult.txHash,
                amount,
                sendAmount: finalSendAmount,
              },
            });
          } else {
            console.error(`[Flutterwave Webhook] ❌ Token distribution failed: ${distributionResult.error}`);
            console.error(`[Flutterwave Webhook] Distribution error details:`, distributionResult);
            return NextResponse.json(
              { 
                success: false, 
                error: `Token distribution failed: ${distributionResult.error}`,
                details: distributionResult,
              },
              { status: 500 }
            );
          }
        } catch (distError: any) {
          console.error(`[Flutterwave Webhook] ❌ Token distribution exception:`, distError);
          console.error(`[Flutterwave Webhook] Exception stack:`, distError.stack);
          return NextResponse.json(
            { 
              success: false, 
              error: `Token distribution error: ${distError.message}`,
              stack: process.env.NODE_ENV === "development" ? distError.stack : undefined,
            },
            { status: 500 }
          );
        }
      } else {
        // Not an on-ramp payment - no transaction_id found
        console.log(`[Flutterwave Webhook] ⚠️ No transaction_id found in metadata or by tx_ref lookup`);
        console.log(`[Flutterwave Webhook] tx_ref: ${txRef}`);
        console.log(`[Flutterwave Webhook] Metadata keys:`, Object.keys(metadata));
        console.log(`[Flutterwave Webhook] Full metadata:`, JSON.stringify(metadata, null, 2));
        console.log(`[Flutterwave Webhook] This might be a regular payment (not on-ramp), skipping token distribution`);
        
        return NextResponse.json({
          success: true,
          message: "Payment received but no transaction_id found. This might not be an on-ramp payment.",
          note: "Enable 'Add meta to webhook' in Flutterwave dashboard to include metadata in webhooks.",
        });
      }
    }

    // Handle virtual account payment
    if (event.event === "virtualaccountpayment") {
      const paymentData = event.data;
      const accountNumber = paymentData.account_number;
      const amount = parseFloat(paymentData.amount);
      const txRef = paymentData.tx_ref;
      const flwRef = paymentData.flw_ref;

      console.log(`[Flutterwave Webhook] Payment received: ₦${amount} to account ${accountNumber}`);

      if (!accountNumber) {
        console.error(`[Flutterwave Webhook] No account number in payment`);
        return NextResponse.json(
          { success: false, error: "Missing account number" },
          { status: 400 }
        );
      }

      // Find user by Flutterwave virtual account number
      const { data: user, error: userError } = await supabaseAdmin
        .from("users")
        .select("id, email, flutterwave_balance, mobile_number")
        .eq("flutterwave_virtual_account_number", accountNumber)
        .maybeSingle();

      if (userError) {
        console.error("[Flutterwave Webhook] Error finding user:", userError);
        return NextResponse.json(
          { success: false, error: "Database error" },
          { status: 500 }
        );
      }

      if (!user) {
        console.error(`[Flutterwave Webhook] User not found for account ${accountNumber}`);
        return NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 }
        );
      }

      // Update user's balance
      const currentBalance = parseFloat(user.flutterwave_balance?.toString() || "0");
      const newBalance = currentBalance + amount;

      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          flutterwave_balance: newBalance,
          flutterwave_balance_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("[Flutterwave Webhook] Error updating balance:", updateError);
        return NextResponse.json(
          { success: false, error: "Failed to update balance" },
          { status: 500 }
        );
      }

      console.log(`[Flutterwave Webhook] ✅ Balance updated for user ${user.id}: ₦${currentBalance} → ₦${newBalance}`);

      // Create transaction record
      const transactionId = `NGN-${Date.now()}-${nanoid(8)}`;
      const { error: txError } = await supabaseAdmin
        .from("transactions")
        .insert({
          transaction_id: transactionId,
          user_id: user.id,
          wallet_address: `ngn_account_${accountNumber}`, // Placeholder for NGN account
          ngn_amount: amount,
          send_amount: "0", // No crypto conversion for NGN deposits
          status: "completed",
          paystack_reference: flwRef || txRef || null,
          exchange_rate: null,
          initialized_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          metadata: {
            type: "ngn_deposit",
            account_number: accountNumber,
            tx_ref: txRef,
            flw_ref: flwRef,
            source: "flutterwave_webhook",
          },
        });

      if (txError) {
        console.error("[Flutterwave Webhook] Error creating transaction record:", txError);
        // Don't fail the webhook if transaction record creation fails
      } else {
        console.log(`[Flutterwave Webhook] ✅ Transaction record created: ${transactionId}`);
      }

      // Send notification to user
      try {
        await notifyPaymentReceived(
          user.id,
          amount,
          txRef || flwRef || transactionId,
          "NGN"
        );
        console.log(`[Flutterwave Webhook] ✅ Notification sent to user ${user.id}`);
      } catch (notifError) {
        console.error("[Flutterwave Webhook] Error sending notification:", notifError);
        // Don't fail the webhook if notification fails
      }

      return NextResponse.json({
        success: true,
        message: "Payment processed successfully",
        data: {
          userId: user.id,
          accountNumber,
          amount,
          newBalance,
        },
      });
    }

    // Handle transfer completed
    if (event.event === "transfer.completed") {
      const transferData = event.data;
      const transferId = transferData.id;
      const reference = transferData.reference;
      const amount = parseFloat(transferData.amount || "0");
      const accountNumber = transferData.account_number;
      const status = transferData.status;

      console.log(`[Flutterwave Webhook] Transfer completed: ${reference} - ₦${amount}`);

      // Find transaction by reference (from send-money)
      const { data: transaction, error: txError } = await supabaseAdmin
        .from("transactions")
        .select("id, transaction_id, user_id, ngn_amount, status, metadata")
        .eq("payment_reference", reference) // Updated to use payment_reference
        .or("metadata->>reference.eq." + reference)
        .maybeSingle();

      if (transaction && transaction.status === "pending") {
        // Update transaction status to completed
        await supabaseAdmin
          .from("transactions")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            metadata: {
              ...(transaction.metadata as any || {}),
              transfer_id: transferId,
              transfer_status: status,
            },
          })
          .eq("id", transaction.id);

        console.log(`[Flutterwave Webhook] ✅ Transfer transaction updated: ${transaction.transaction_id}`);

        // Send notification to sender
        if (transaction.user_id) {
          try {
            const metadata = transaction.metadata as any || {};
            await notifyTransferCompleted(
              transaction.user_id,
              parseFloat(transaction.ngn_amount?.toString() || "0"),
              metadata.recipient_phone || accountNumber || "recipient",
              reference
            );
          } catch (notifError) {
            console.error("[Flutterwave Webhook] Error sending transfer completed notification:", notifError);
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: "Transfer completed processed",
        data: { transferId, reference, amount },
      });
    }

    // Handle transfer failed
    if (event.event === "transfer.failed" || event.event === "transfer.failed") {
      const transferData = event.data;
      const transferId = transferData.id;
      const reference = transferData.reference;
      const amount = parseFloat(transferData.amount || "0");
      const accountNumber = transferData.account_number;
      const errorMessage = transferData.complete_message || transferData.narration || "Transfer failed";

      console.log(`[Flutterwave Webhook] Transfer failed: ${reference} - ₦${amount}`);

      // Find transaction by reference
      const { data: transaction, error: txError } = await supabaseAdmin
        .from("transactions")
        .select("id, transaction_id, user_id, ngn_amount, status, metadata")
        .eq("payment_reference", reference) // Updated to use payment_reference
        .or("metadata->>reference.eq." + reference)
        .maybeSingle();

      if (transaction) {
        // Update transaction status to failed
        await supabaseAdmin
          .from("transactions")
          .update({
            status: "failed",
            error_message: errorMessage,
            metadata: {
              ...(transaction.metadata as any || {}),
              transfer_id: transferId,
              transfer_status: "failed",
              error: errorMessage,
            },
          })
          .eq("id", transaction.id);

        // Revert sender's balance (add back the amount) and recipient's balance (subtract the amount)
        if (transaction.user_id) {
          const { data: sender } = await supabaseAdmin
            .from("users")
            .select("flutterwave_balance")
            .eq("id", transaction.user_id)
            .single();

          if (sender) {
            const currentBalance = parseFloat(sender.flutterwave_balance?.toString() || "0");
            const refundedBalance = currentBalance + parseFloat(transaction.ngn_amount?.toString() || "0");

            await supabaseAdmin
              .from("users")
              .update({
                flutterwave_balance: refundedBalance,
                flutterwave_balance_updated_at: new Date().toISOString(),
              })
              .eq("id", transaction.user_id);

            console.log(`[Flutterwave Webhook] ✅ Balance refunded for sender ${transaction.user_id}: ₦${currentBalance} → ₦${refundedBalance}`);

            // Also revert recipient's balance if we have recipient info
            const metadata = transaction.metadata as any || {};
            if (metadata.recipient_id) {
              const { data: recipient } = await supabaseAdmin
                .from("users")
                .select("flutterwave_balance")
                .eq("id", metadata.recipient_id)
                .single();

              if (recipient) {
                const recipientBalance = parseFloat(recipient.flutterwave_balance?.toString() || "0");
                const revertedRecipientBalance = recipientBalance - parseFloat(transaction.ngn_amount?.toString() || "0");

                await supabaseAdmin
                  .from("users")
                  .update({
                    flutterwave_balance: revertedRecipientBalance,
                    flutterwave_balance_updated_at: new Date().toISOString(),
                  })
                  .eq("id", metadata.recipient_id);

                console.log(`[Flutterwave Webhook] ✅ Balance reverted for recipient ${metadata.recipient_id}: ₦${recipientBalance} → ₦${revertedRecipientBalance}`);
              }
            }

            // Send notification
            try {
              await notifyTransferFailed(
                transaction.user_id,
                parseFloat(transaction.ngn_amount?.toString() || "0"),
                metadata.recipient_phone || accountNumber || "recipient",
                reference,
                errorMessage
              );
            } catch (notifError) {
              console.error("[Flutterwave Webhook] Error sending transfer failed notification:", notifError);
            }
          }
        }

        console.log(`[Flutterwave Webhook] ✅ Transfer failed transaction updated: ${transaction.transaction_id}`);
      }

      return NextResponse.json({
        success: true,
        message: "Transfer failed processed",
        data: { transferId, reference, amount },
      });
    }

    // Handle charge failed (payment/deposit failed)
    if (event.event === "charge.failed") {
      const chargeData = event.data;
      const txRef = chargeData.tx_ref;
      const flwRef = chargeData.flw_ref;
      const amount = parseFloat(chargeData.amount || "0");
      const accountNumber = chargeData.account_number;
      const errorMessage = chargeData.processor_response || chargeData.status || "Payment failed";

      console.log(`[Flutterwave Webhook] Charge failed: ${txRef || flwRef} - ₦${amount}`);

      // Find user by account number if available
      if (accountNumber) {
        const { data: user } = await supabaseAdmin
          .from("users")
          .select("id, flutterwave_balance")
          .eq("flutterwave_virtual_account_number", accountNumber)
          .maybeSingle();

        if (user) {
          // Find and update any pending transaction
          const { data: transaction } = await supabaseAdmin
            .from("transactions")
            .select("id, transaction_id, status")
            .eq("paystack_reference", flwRef || txRef)
            .eq("status", "pending")
            .maybeSingle();

          if (transaction) {
            await supabaseAdmin
              .from("transactions")
              .update({
                status: "failed",
                error_message: errorMessage,
              })
              .eq("id", transaction.id);
          }

          // Send notification
          try {
            await notifyPaymentFailed(
              user.id,
              amount,
              flwRef || txRef || "N/A",
              errorMessage
            );
          } catch (notifError) {
            console.error("[Flutterwave Webhook] Error sending payment failed notification:", notifError);
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: "Charge failed processed",
        data: { txRef, flwRef, amount },
      });
    }

    // Handle refund completed
    if (event.event === "refund.completed" || event.event === "refund") {
      const refundData = event.data;
      const refundId = refundData.id;
      const amount = parseFloat(refundData.amount || "0");
      const txRef = refundData.tx_ref;
      const flwRef = refundData.flw_ref;
      const accountNumber = refundData.account_number;
      const originalTxRef = refundData.original_tx_ref || txRef;

      console.log(`[Flutterwave Webhook] Refund completed: ${refundId} - ₦${amount}`);

      // Find user by account number
      if (accountNumber) {
        const { data: user } = await supabaseAdmin
          .from("users")
          .select("id, flutterwave_balance")
          .eq("flutterwave_virtual_account_number", accountNumber)
          .maybeSingle();

        if (user) {
          // Update user's balance (add refund amount)
          const currentBalance = parseFloat(user.flutterwave_balance?.toString() || "0");
          const newBalance = currentBalance + amount;

          await supabaseAdmin
            .from("users")
            .update({
              flutterwave_balance: newBalance,
              flutterwave_balance_updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);

          console.log(`[Flutterwave Webhook] ✅ Refund processed for user ${user.id}: ₦${currentBalance} → ₦${newBalance}`);

          // Create refund transaction record
          const transactionId = `REFUND-${Date.now()}-${nanoid(8)}`;
          await supabaseAdmin
            .from("transactions")
            .insert({
              transaction_id: transactionId,
              user_id: user.id,
              wallet_address: `ngn_account_${accountNumber}`,
              ngn_amount: amount,
              send_amount: "0",
              status: "completed",
              payment_reference: flwRef || refundId || null, // Updated to use payment_reference
              exchange_rate: null,
              initialized_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              metadata: {
                type: "refund",
                account_number: accountNumber,
                refund_id: refundId,
                original_tx_ref: originalTxRef,
                tx_ref: txRef,
                flw_ref: flwRef,
                source: "flutterwave_webhook",
              },
            });

          // Send notification
          try {
            await notifyRefundReceived(
              user.id,
              amount,
              flwRef || refundId || transactionId,
              originalTxRef
            );
          } catch (notifError) {
            console.error("[Flutterwave Webhook] Error sending refund notification:", notifError);
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: "Refund processed successfully",
        data: { refundId, amount, accountNumber },
      });
    }

    // Handle other events
    console.log(`[Flutterwave Webhook] Unhandled event: ${event.event}`);
    return NextResponse.json({
      success: true,
      message: "Event received but not processed",
      event: event.event,
    });
  } catch (error: any) {
    console.error("[Flutterwave Webhook] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
