import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createTransaction, getTransaction, updateTransaction, calculateSendAmount } from "@/lib/transactions";
import { createOrUpdateUser } from "@/lib/users";
import { getExchangeRate } from "@/lib/settings";
import {
  linkWalletToUser,
  getSupabaseUserByEmail,
  updateWalletStats,
} from "@/lib/supabase-users";
import { calculateTransactionFee, calculateFinalTokens, calculateFeeInTokens } from "@/lib/fee-calculation";

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
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get("transactionId");

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    const transaction = await getTransaction(transactionId);
    
    if (transaction) {
      return NextResponse.json({
        success: true,
        exists: true,
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
