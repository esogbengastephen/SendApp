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
import { supabase, updateReferralCountOnTransaction } from "@/lib/supabase";
import { nanoid } from "nanoid";
import { sendPaymentVerificationEmail, sendTokenDistributionEmail } from "@/lib/transaction-emails";

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
        
        // Find user by their virtual account number (EMAIL-BASED)
        // Virtual accounts are now stored in users table, but we check both for backward compatibility
        // Priority: users table (email-based) > user_wallets (old wallet-based accounts)
        
        let walletAddress: string | null = null;
        let userId: string | null = null;
        let userEmail: string | null = null;

        // First, check users table (EMAIL-BASED - primary location)
        const { data: user, error: userError } = await supabase
          .from("users")
          .select("*")
          .eq("default_virtual_account_number", accountNumber)
          .single();
        
        if (user) {
          userId = user.id;
          userEmail = user.email;
          console.log(`✅ [Webhook] Found in users table (EMAIL-BASED): ${userEmail}`);
          
          // Check if this user has linked any wallet in user_wallets
          // Use the most recent wallet, or find wallet from pending transaction if available
          const { data: linkedWallets } = await supabase
            .from("user_wallets")
            .select("wallet_address")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit(1);
          
          if (linkedWallets && linkedWallets.length > 0) {
            walletAddress = linkedWallets[0].wallet_address;
            console.log(`✅ [Webhook] Found linked wallet: ${walletAddress}`);
          } else {
            console.error(`❌ [Webhook] User ${userEmail} has no linked wallet yet`);
            return NextResponse.json(
              { success: false, error: "User has no wallet address. Please complete a transaction first." },
              { status: 400 }
            );
          }
        } else {
          // Fallback: Check user_wallets (for backward compatibility with old wallet-based accounts)
          console.log(`🔍 [Webhook] Not in users table, checking user_wallets (backward compatibility)...`);
          
          let { data: userWallet, error: walletError } = await supabase
            .from("user_wallets")
            .select("*, users!inner(*)")
            .eq("virtual_account_number", accountNumber)
            .single();

          if (userWallet) {
            walletAddress = userWallet.wallet_address;
            userId = userWallet.user_id;
            userEmail = userWallet.users.email;
            console.log(`✅ [Webhook] Found in user_wallets (backward compatibility): User ${userEmail}, Wallet ${walletAddress}`);
          } else {
            console.error(`❌ [Webhook] Virtual account ${accountNumber} not found in any table`);
            return NextResponse.json(
              { success: false, error: "Virtual account not found" },
              { status: 404 }
            );
          }
        }

        if (!walletAddress || !userId || !userEmail) {
          console.error(`❌ [Webhook] Missing required data for virtual account ${accountNumber}`);
          return NextResponse.json(
            { success: false, error: "Incomplete user data" },
            { status: 400 }
          );
        }
        
        console.log(`✅ [Webhook] Payment identified: User ${userEmail}, Wallet ${walletAddress}`);
        
        // Get exchange rate
        const exchangeRate = await getExchangeRate();
        const sendAmount = calculateSendAmount(paystackAmount, exchangeRate);
        
        console.log(`💰 [Webhook] Converting ${paystackAmount} NGN → ${sendAmount} SEND (rate: ${exchangeRate})`);
        
        // Try to find existing pending transaction for this user and wallet
        const { data: existingTransactions } = await supabase
          .from("transactions")
          .select("*")
          .eq("user_id", userId)
          .eq("wallet_address", walletAddress.toLowerCase())
          .eq("status", "pending")
          .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Last 10 minutes
          .order("created_at", { ascending: false })
          .limit(1);

        let transactionId: string;

        if (existingTransactions && existingTransactions.length > 0) {
          // Found existing pending transaction - update it
          const existingTx = existingTransactions[0];
          transactionId = existingTx.transaction_id;
          
          console.log(`📝 [Webhook] Found existing pending transaction: ${transactionId}`);
          
          // Update the existing transaction
          await updateTransaction(transactionId, {
            status: "completed",
            paystackReference: reference,
            ngnAmount: paystackAmount,
            sendAmount,
            exchangeRate,
            completedAt: new Date(),
          });
          
          console.log(`✅ [Webhook] Updated existing transaction to completed`);
        } else {
          // No pending transaction found - create new one
          transactionId = nanoid();
          
          console.log(`📝 [Webhook] No pending transaction found, creating new: ${transactionId}`);
          
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

          // Update to completed status immediately
          await updateTransaction(transactionId, {
            status: "completed",
            completedAt: new Date(),
          });
        }

        // Send payment verification email
        try {
          await sendPaymentVerificationEmail(userEmail, paystackAmount, reference);
        } catch (emailError) {
          console.error(`[Webhook] Failed to send payment verification email:`, emailError);
          // Don't fail the transaction if email fails
        }

        // Update referral count if this is user's first completed transaction
        // (Database trigger should handle this, but we call it explicitly as backup)
        try {
          const referralResult = await updateReferralCountOnTransaction(userId);
          if (referralResult.success) {
            console.log(`[Webhook] ✅ Referral count updated for user ${userId}`);
          } else {
            console.error(`[Webhook] ⚠️ Failed to update referral count:`, referralResult.error);
            // Continue anyway - trigger should handle it
          }
        } catch (error) {
          console.error(`[Webhook] ⚠️ Exception updating referral count:`, error);
          // Continue anyway - trigger should handle it
        }
        
        // Distribute tokens immediately
        try {
          const distributionResult = await distributeTokens(
            transactionId,
            walletAddress,
            sendAmount
          );
          
          if (distributionResult.success) {
            console.log(`🎉 [Webhook] Tokens distributed successfully! TX: ${distributionResult.txHash}`);
            
            // Send token distribution email
            try {
              await sendTokenDistributionEmail(
                userEmail,
                paystackAmount,
                sendAmount,
                walletAddress,
                distributionResult.txHash
              );
            } catch (emailError) {
              console.error(`[Webhook] Failed to send token distribution email:`, emailError);
              // Don't fail the transaction if email fails
            }
            
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

      // Get user email for sending notification
      let userEmail: string | null = null;
      if (transaction.userId) {
        const { data: user } = await supabase
          .from("users")
          .select("email")
          .eq("id", transaction.userId)
          .single();
        userEmail = user?.email || null;
      }

      // Send payment verification email
      if (userEmail) {
        try {
          await sendPaymentVerificationEmail(userEmail, paystackAmount, reference);
        } catch (emailError) {
          console.error(`[Webhook] Failed to send payment verification email:`, emailError);
          // Don't fail the transaction if email fails
        }
      }

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
          
          // Send token distribution email
          if (userEmail) {
            try {
              await sendTokenDistributionEmail(
                userEmail,
                paystackAmount,
                finalSendAmount,
                transaction.walletAddress,
                distributionResult.txHash
              );
            } catch (emailError) {
              console.error(`[Webhook] Failed to send token distribution email:`, emailError);
              // Don't fail the transaction if email fails
            }
          }
          
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

