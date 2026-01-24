import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createTransaction, getTransaction, updateTransaction, calculateSendAmount } from "@/lib/transactions";
import { createOrUpdateUser } from "@/lib/users";
import { getExchangeRate, getTransactionsEnabled, getMinimumPurchase } from "@/lib/settings";
import {
  linkWalletToUser,
  getSupabaseUserByEmail,
  updateWalletStats,
} from "@/lib/supabase-users";
import { calculateTransactionFee, calculateFinalTokens, calculateFeeInTokens } from "@/lib/fee-calculation";
import { isValidAmount } from "@/utils/validation";

/**
 * Get user from session (localStorage data sent in request body)
 */
function getUserFromSession(body: any): { userId?: string; email?: string } {
  // User info sent from frontend (stored in localStorage)
  return {
    userId: body.userId,
    email: body.userEmail,
  };
}

/**
 * Create or update a transaction ID
 * This endpoint stores transaction details when user inputs amount
 * Now links wallets to email users automatically
 */
export async function POST(request: NextRequest) {
  try {
    // Check if transactions are enabled
    const transactionsEnabled = await getTransactionsEnabled();
    if (!transactionsEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: "Transactions are currently disabled. Please check back later.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { transactionId, ngnAmount, sendAmount, walletAddress, sendtag, exchangeRate, userId, userEmail } = body;

    console.log(`[Create ID] Processing transaction request for wallet: ${walletAddress}, user: ${userEmail || userId || 'guest'}`);

    // Get user from session if logged in
    let currentUser = null;
    if (userEmail) {
      const userResult = await getSupabaseUserByEmail(userEmail);
      if (userResult.success && userResult.user) {
        currentUser = userResult.user;
        console.log(`[Create ID] Found logged-in user: ${currentUser.email}`);
      }
    } else if (userId) {
      // Fallback: try to get user by ID
      const { getSupabaseUserById } = await import("@/lib/supabase-users");
      const userResult = await getSupabaseUserById(userId);
      if (userResult.success && userResult.user) {
        currentUser = userResult.user;
        console.log(`[Create ID] Found user by ID: ${currentUser.email}`);
      }
    }

    // If transactionId provided, check if it exists
    if (transactionId) {
      const existing = await getTransaction(transactionId);
      if (existing) {
        // Update existing transaction if we have new data
        if (ngnAmount && walletAddress) {
          const normalizedWallet = walletAddress.trim().toLowerCase();
          const currentExchangeRate = exchangeRate ? parseFloat(exchangeRate) : existing.exchangeRate || await getExchangeRate();
          
          // Calculate fees upfront
          const feeNGN = await calculateTransactionFee(parseFloat(ngnAmount));
          const feeInSEND = calculateFeeInTokens(feeNGN, currentExchangeRate);
          const finalSendAmount = calculateFinalTokens(
            parseFloat(ngnAmount),
            feeNGN,
            currentExchangeRate
          );
          
          await updateTransaction(transactionId, {
            ngnAmount: parseFloat(ngnAmount),
            sendAmount: finalSendAmount, // Use final amount after fee
            walletAddress: normalizedWallet,
            sendtag: sendtag || undefined,
            exchangeRate: currentExchangeRate,
            userId: currentUser?.id,
            fee_ngn: feeNGN,
            fee_in_send: feeInSEND,
          });
          
          // If user is logged in, link wallet and update stats
          if (currentUser) {
            await linkWalletToUser(currentUser.id, normalizedWallet, sendtag);
            console.log(`[Create ID] ✅ Wallet linked to user ${currentUser.email}`);
          } else {
            // Fallback to in-memory user tracking for non-logged-in users
            createOrUpdateUser(
              normalizedWallet,
              transactionId,
              parseFloat(ngnAmount),
              finalSendAmount, // Use final amount after fee
              sendtag || undefined
            );
          }
        }

        return NextResponse.json({
          success: true,
          transactionId: existing.transactionId,
          exists: true,
          transaction: {
            transactionId: existing.transactionId,
            status: existing.status,
            ngnAmount: existing.ngnAmount,
            sendAmount: existing.sendAmount,
            walletAddress: existing.walletAddress,
            createdAt: existing.createdAt.toISOString(),
            initializedAt: existing.initializedAt?.toISOString(),
          },
          alreadyProcessed: existing.status === "completed",
        });
      }
    }

    // Generate new transaction ID if not provided
    const newTransactionId = transactionId || nanoid();
    
    // If we have amount and wallet, create full transaction
    if (ngnAmount && walletAddress) {
      // Validate minimum purchase
      const minPurchase = await getMinimumPurchase();
      if (!isValidAmount(ngnAmount.toString(), minPurchase)) {
        return NextResponse.json(
          { success: false, error: `Minimum purchase amount is ₦${minPurchase.toLocaleString()}` },
          { status: 400 }
        );
      }
      
      const normalizedWallet = walletAddress.trim().toLowerCase();
      // Use admin-set exchange rate (not from frontend)
      const currentExchangeRate = await getExchangeRate();
      
      // Calculate fees upfront so user sees correct final amount
      const feeNGN = await calculateTransactionFee(parseFloat(ngnAmount));
      const feeInSEND = calculateFeeInTokens(feeNGN, currentExchangeRate);
      const finalSendAmount = calculateFinalTokens(
        parseFloat(ngnAmount),
        feeNGN,
        currentExchangeRate
      );
      
      console.log(`[Create ID] Fee calculation: ${feeNGN} NGN (${feeInSEND} $SEND), Final tokens: ${finalSendAmount} $SEND`);
      
      const transaction = await createTransaction({
        transactionId: newTransactionId,
        paystackReference: newTransactionId, // Will be updated when payment is found
        ngnAmount: parseFloat(ngnAmount),
        sendAmount: finalSendAmount, // Use final amount after fee deduction
        walletAddress: normalizedWallet,
        sendtag: sendtag || undefined,
        exchangeRate: currentExchangeRate,
        userId: currentUser?.id,
        fee_ngn: feeNGN, // Store fee info upfront
        fee_in_send: feeInSEND,
      });
      
      // If user is logged in, link wallet to user
      if (currentUser) {
        await linkWalletToUser(currentUser.id, normalizedWallet, sendtag);
        console.log(`[Create ID] ✅ Wallet ${normalizedWallet} linked to user ${currentUser.email}`);
      } else {
        // Fallback to in-memory user tracking for non-logged-in users
        createOrUpdateUser(
          normalizedWallet,
          newTransactionId,
          parseFloat(ngnAmount),
          finalSendAmount, // Use final amount after fee
          sendtag || undefined
        );
        console.log(`[Create ID] ⚠️ No user logged in, using in-memory tracking for wallet ${normalizedWallet}`);
      }

      return NextResponse.json({
        success: true,
        transactionId: transaction.transactionId,
        exists: false,
        transaction: {
          transactionId: transaction.transactionId,
          status: transaction.status,
          ngnAmount: transaction.ngnAmount,
          sendAmount: transaction.sendAmount,
          walletAddress: transaction.walletAddress,
          createdAt: transaction.createdAt.toISOString(),
          initializedAt: transaction.initializedAt?.toISOString(),
        },
        alreadyProcessed: false,
      });
    } else {
      // Don't create transaction without amount and wallet
      // Transactions should only be created when user clicks "Generate Payment"
      return NextResponse.json({
        success: false,
        error: "Transaction requires both NGN amount and wallet address. Please click 'Generate Payment' after entering your details.",
      }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[Create ID] Transaction ID creation error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check if transaction ID exists
 * Also supports lookup by paymentReference (Flutterwave tx_ref)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get("transactionId");
    const paymentReference = searchParams.get("paymentReference");

    // Support lookup by payment_reference (for Flutterwave tx_ref)
    if (paymentReference) {
      const { supabaseAdmin } = await import("@/lib/supabase");
      const { data: transaction, error } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("payment_reference", paymentReference)
        .maybeSingle();

      if (error) {
        console.error("[Create ID] Error looking up by payment_reference:", error);
        return NextResponse.json(
          { success: false, error: "Database error" },
          { status: 500 }
        );
      }

      if (transaction) {
        return NextResponse.json({
          success: true,
          exists: true,
          status: transaction.status,
          txHash: transaction.tx_hash,
          sendAmount: transaction.send_amount,
          transactionId: transaction.transaction_id,
          error_message: transaction.error_message,
        });
      } else {
        return NextResponse.json({
          success: true,
          exists: false,
          paymentReference,
        });
      }
    }

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: "Transaction ID or paymentReference is required" },
        { status: 400 }
      );
    }

    const transaction = await getTransaction(transactionId);
    
    if (transaction) {
      return NextResponse.json({
        success: true,
        exists: true,
        status: transaction.status,
        txHash: transaction.txHash,
        sendAmount: transaction.sendAmount,
        transactionId: transaction.transactionId,
        error_message: transaction.errorMessage,
        transaction: {
          transactionId: transaction.transactionId,
          status: transaction.status,
          ngnAmount: transaction.ngnAmount,
          sendAmount: transaction.sendAmount,
          walletAddress: transaction.walletAddress,
          createdAt: transaction.createdAt.toISOString(),
        },
        alreadyProcessed: transaction.status === "completed",
      });
    } else {
      return NextResponse.json({
        success: true,
        exists: false,
        transactionId,
      });
    }
  } catch (error: any) {
    console.error("[Create ID] Transaction ID check error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
