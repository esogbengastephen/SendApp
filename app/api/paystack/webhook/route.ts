import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import {
  getTransactionByReference,
  updateTransaction,
  isTransactionProcessed,
  calculateSendAmount,
  createTransaction,
} from "@/lib/transactions";
import { distributeTokens } from "@/lib/token-distribution";
import { getExchangeRate } from "@/lib/settings";
import { supabase } from "@/lib/supabase";
import { nanoid } from "nanoid";

export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get("x-paystack-signature");

    if (!signature) {
      return NextResponse.json(
        { success: false, error: "Missing signature" },
        { status: 401 }
      );
    }

    // Verify webhook signature
    const isValid = verifyWebhookSignature(body, signature);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return NextResponse.json(
        { success: false, error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse the webhook payload
    const event = JSON.parse(body);

    // Handle different event types
    if (event.event === "charge.success") {
      const transactionData = event.data;
      const reference = transactionData.reference;
      const paystackAmount = transactionData.amount / 100; // Convert from kobo to NGN
      const channel = transactionData.channel; // "dedicated_nuban" for virtual accounts
      const metadata = transactionData.metadata || {};

      console.log(`📥 [Webhook] Payment received: ${paystackAmount} NGN via ${channel}`);
      console.log(`📥 [Webhook] Reference: ${reference}`);

      // Check if transaction has already been processed
      if (isTransactionProcessed(reference)) {
        console.log(`[Webhook] Transaction ${reference} already processed`);
        return NextResponse.json({ success: true, message: "Already processed" });
      }

      // ============================================
      // VIRTUAL ACCOUNT PAYMENT DETECTION
      // ============================================
      if (channel === "dedicated_nuban") {
        console.log(`🏦 [Webhook] Virtual account payment detected!`);
        
        // Extract virtual account details
        const authorization = transactionData.authorization || {};
        const accountNumber = authorization.receiver_bank_account_number;
        const accountName = authorization.account_name;
        
        console.log(`🏦 [Webhook] Account: ${accountNumber} (${accountName})`);
        
        if (!accountNumber) {
          console.error(`❌ [Webhook] No account number in virtual account payment`);
          return NextResponse.json(
            { success: false, error: "Missing account number" },
            { status: 400 }
          );
        }
        
        // Find user by their virtual account number
        const { data: userWallet, error: walletError } = await supabase
          .from("user_wallets")
          .select("*, users!inner(*)")
          .eq("virtual_account_number", accountNumber)
          .single();
        
        if (walletError || !userWallet) {
          console.error(`❌ [Webhook] Virtual account ${accountNumber} not found in database`);
          console.error(`Error:`, walletError);
          return NextResponse.json(
            { success: false, error: "Virtual account not found" },
            { status: 404 }
          );
        }
        
        const walletAddress = userWallet.wallet_address;
        const userId = userWallet.user_id;
        const userEmail = userWallet.users.email;
        
        console.log(`✅ [Webhook] Payment identified: User ${userEmail}, Wallet ${walletAddress}`);
        
        // Get exchange rate
        const exchangeRate = await getExchangeRate();
        const sendAmount = calculateSendAmount(paystackAmount, exchangeRate);
        
        console.log(`💰 [Webhook] Converting ${paystackAmount} NGN → ${sendAmount} SEND (rate: ${exchangeRate})`);
        
        // Create transaction record
        const transactionId = nanoid();
        await createTransaction({
          transactionId,
          userId,
          walletAddress,
          ngnAmount: paystackAmount,
          sendAmount,
          paystackReference: reference,
          exchangeRate,
          completedAt: new Date(),
        });
        
        // Update to completed status immediately since payment was received
        await updateTransaction(transactionId, {
          status: "completed",
          completedAt: new Date(),
        });
        
        console.log(`📝 [Webhook] Transaction created: ${transactionId}`);
        
        // Distribute tokens immediately
        try {
          const distributionResult = await distributeTokens(
            transactionId,
            walletAddress,
            sendAmount
          );
          
          if (distributionResult.success) {
            console.log(`🎉 [Webhook] Tokens distributed successfully! TX: ${distributionResult.txHash}`);
            return NextResponse.json({
              success: true,
              message: "Virtual account payment processed and tokens distributed",
              txHash: distributionResult.txHash,
              transactionId,
            });
          } else {
            console.error(`❌ [Webhook] Token distribution failed: ${distributionResult.error}`);
            // Update transaction status to show distribution failed
            await updateTransaction(transactionId, {
              status: "failed",
              errorMessage: distributionResult.error,
            });
            return NextResponse.json({
              success: false,
              error: "Token distribution failed",
              details: distributionResult.error,
            });
          }
        } catch (distError: any) {
          console.error(`❌ [Webhook] Token distribution error:`, distError);
          await updateTransaction(transactionId, {
            status: "failed",
            errorMessage: distError.message,
          });
          return NextResponse.json({
            success: false,
            error: "Token distribution error",
            details: distError.message,
          });
        }
      }
      
      // ============================================
      // FALLBACK: Manual payment (old flow)
      // ============================================
      console.log(`🔍 [Webhook] Manual payment - searching for transaction by reference`);

      // Get our transaction record
      let transaction = await getTransactionByReference(reference);
      
      // If not found by reference, try to find by amount + timestamp
      if (!transaction) {
        console.log(`Transaction not found by reference ${reference}, trying to match by amount and timestamp...`);
        // This will be handled in process-payment endpoint
        return NextResponse.json(
          { success: false, error: "Transaction not found. User should claim via payment form." },
          { status: 404 }
        );
      }

      // Verify NGN amount matches
      if (Math.abs(transaction.ngnAmount - paystackAmount) > 0.01) {
        console.error(`Amount mismatch: Transaction has ${transaction.ngnAmount} NGN, Paystack has ${paystackAmount} NGN`);
        return NextResponse.json(
          { success: false, error: "Amount mismatch between transaction and Paystack payment" },
          { status: 400 }
        );
      }

      // Recalculate sendAmount if exchangeRate is stored (in case rate changed)
      let finalSendAmount = transaction.sendAmount;
      if (transaction.exchangeRate) {
        const recalculated = calculateSendAmount(transaction.ngnAmount, transaction.exchangeRate);
        finalSendAmount = recalculated;
        console.log(`Recalculated sendAmount: ${finalSendAmount} SEND (from rate ${transaction.exchangeRate})`);
      }

      // Update transaction with both amounts and status
      await updateTransaction(transaction.transactionId, {
        status: "completed",
        ngnAmount: paystackAmount, // Use Paystack amount as source of truth
        sendAmount: finalSendAmount, // Use recalculated amount
        paystackReference: reference,
        completedAt: new Date(),
      });

      // Distribute tokens to user's wallet
      console.log(`Transaction ${reference} verified. Distributing tokens...`);
      console.log(`Wallet: ${transaction.walletAddress}, Amount: ${finalSendAmount} SEND`);

      try {
        const distributionResult = await distributeTokens(
          transaction.transactionId,
          transaction.walletAddress,
          finalSendAmount
        );

        if (distributionResult.success) {
          console.log(`Tokens distributed successfully. TX Hash: ${distributionResult.txHash}`);
          return NextResponse.json({
            success: true,
            message: "Transaction processed and tokens distributed successfully",
            txHash: distributionResult.txHash,
          });
        } else {
          console.error(`Token distribution failed: ${distributionResult.error}`);
          return NextResponse.json({
            success: true,
            message: "Payment verified but token distribution failed",
            error: distributionResult.error,
          });
        }
      } catch (distError: any) {
        console.error("Error during token distribution:", distError);
        return NextResponse.json({
          success: true,
          message: "Payment verified but token distribution encountered an error",
          error: distError.message,
        });
      }
    }

    // Handle other event types if needed
    if (event.event === "charge.failed") {
      const transactionData = event.data;
      const reference = transactionData.reference;

      const transaction = await getTransactionByReference(reference);
      if (transaction) {
        await updateTransaction(transaction.transactionId, {
          status: "failed",
        });
      }

      return NextResponse.json({
        success: true,
        message: "Transaction marked as failed",
      });
    }

    // Acknowledge other events
    return NextResponse.json({
      success: true,
      message: "Event received",
    });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

