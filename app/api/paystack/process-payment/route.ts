import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { createTransaction, getTransaction, updateTransaction, getAllTransactions, findPendingTransactionByWalletAndAmount, findCompletedTransactionByWalletAndAmount, addVerificationAttempt, calculateSendAmount, type Transaction } from "@/lib/transactions";
import { createOrUpdateUser } from "@/lib/users";
import { distributeTokens } from "@/lib/token-distribution";
import { isValidWalletOrTag, isValidAmount } from "@/utils/validation";
import { verifyPaymentForTransaction } from "@/lib/payment-verification";
import { getExchangeRate, getOnrampTransactionsEnabled, getMinimumPurchase } from "@/lib/settings";
import { updateWalletStats } from "@/lib/supabase-users";
import { sendPaymentVerificationEmail, sendTokenDistributionEmail } from "@/lib/transaction-emails";
import { supabase, updateReferralCountOnTransaction } from "@/lib/supabase";
import { calculateTransactionFee, calculateFinalTokens, calculateFeeInTokens } from "@/lib/fee-calculation";
import { recordRevenue } from "@/lib/revenue";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API_BASE = "https://api.paystack.co";

/**
 * Check for pending transactions that can be claimed
 * Matches by: walletAddress + ngnAmount + timestamp
 */
async function findClaimablePendingTransaction(
  walletAddress: string,
  ngnAmount: number,
  transactionId?: string
): Promise<Transaction | null> {
  const allTransactions = getAllTransactions();
  const normalizedWallet = walletAddress.trim().toLowerCase();
  const amountInKobo = Math.round(ngnAmount * 100);
  
  // First, try to find by transactionId if provided
  if (transactionId) {
    const txById = await getTransaction(transactionId);
    if (txById && txById.walletAddress.toLowerCase() === normalizedWallet && 
        Math.abs(txById.ngnAmount - ngnAmount) < 0.01) {
      return txById;
    }
  }
  
  // Find pending transactions matching wallet and amount
  const pendingMatches = allTransactions.filter(tx => 
    tx.status === "pending" &&
    tx.walletAddress.toLowerCase() === normalizedWallet &&
    Math.abs(tx.ngnAmount - ngnAmount) < 0.01
  );
  
  if (pendingMatches.length === 0) {
    return null;
  }
  
  // Check Paystack for matching payment
  if (!PAYSTACK_SECRET_KEY) {
    return null;
  }
  
  try {
    const paystackResponse = await axios.get(
      `${PAYSTACK_API_BASE}/transaction`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
        params: {
          perPage: 100,
        },
      }
    );
    
    const paystackTransactions = paystackResponse.data.data || [];
    const usedReferences = new Set(
      allTransactions
        .filter(t => t.status === "completed" && t.paystackReference)
        .map(t => t.paystackReference)
    );
    
    // Find unused Paystack payment matching amount and timestamp
    for (const pendingTx of pendingMatches) {
      const txTime = new Date(pendingTx.createdAt);
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      
      const matchingPayment = paystackTransactions.find((ptx: any) => {
        const ptxAmount = ptx.amount;
        const ptxTime = new Date(ptx.created_at);
        
        return (
          ptxAmount === amountInKobo &&
          ptx.status === "success" &&
          ptxTime >= txTime &&
          ptxTime > tenMinutesAgo &&
          !usedReferences.has(ptx.reference)
        );
      });
      
      if (matchingPayment) {
        console.log(`Found claimable pending transaction ${pendingTx.transactionId} with matching Paystack payment ${matchingPayment.reference}`);
        return pendingTx;
      }
    }
  } catch (error) {
    console.error("Error checking Paystack for claimable transactions:", error);
  }
  
  return null;
}

/**
 * DEPRECATED: Paystack payment processing endpoint
 * This endpoint is deprecated. Please use Flutterwave checkout for new payments.
 * Kept for backward compatibility with historical Paystack transactions.
 * 
 * New payments should use: /api/flutterwave/initialize-payment
 */
export async function POST(request: NextRequest) {
  // Return deprecation error - Paystack is no longer supported
  return NextResponse.json(
    {
      success: false,
      error: "Paystack payment method is deprecated. Please use Flutterwave checkout instead.",
      deprecated: true,
      message: "This payment method is no longer supported. Please refresh the page and use Flutterwave checkout.",
    },
    { status: 410 } // 410 Gone - indicates the resource is permanently unavailable
  );

  /* COMMENTED OUT - Paystack code kept for reference
  try {
    // Check if transactions are enabled
    const onrampEnabled = await getOnrampTransactionsEnabled();
    if (!onrampEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: "Transactions are currently disabled. Please check back later.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { ngnAmount, sendAmount, walletAddress, transactionId } = body;
    // Note: exchangeRate is no longer accepted from frontend - we use admin-set rate
    
    console.log(`[Process Payment] Received request:`, {
      transactionId,
      ngnAmount,
      walletAddress: walletAddress ? (walletAddress.length > 6 ? `${walletAddress.slice(0, 6)}...` : walletAddress) : 'missing',
    });

    // Validate inputs
    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    // Get minimum purchase from settings
    const minPurchase = await getMinimumPurchase();

    if (!ngnAmount || !isValidAmount(ngnAmount.toString(), minPurchase)) {
      return NextResponse.json(
        { success: false, error: `Minimum purchase amount is ₦${minPurchase.toLocaleString()}` },
        { status: 400 }
      );
    }

    if (!walletAddress || !isValidWalletOrTag(walletAddress.trim())) {
      return NextResponse.json(
        { success: false, error: "Invalid wallet address or SendTag" },
        { status: 400 }
      );
    }

    const normalizedWallet = walletAddress.trim().toLowerCase();
    const parsedAmount = parseFloat(ngnAmount);
    
    // Validate parsed amount against minimum purchase
    if (isNaN(parsedAmount) || parsedAmount < minPurchase) {
      return NextResponse.json(
        { success: false, error: `Minimum purchase amount is ₦${minPurchase.toLocaleString()}` },
        { status: 400 }
      );
    }
    
    const amountInKobo = Math.round(parsedAmount * 100);
    
    // Get exchange rate from admin settings (not from frontend)
    // This ensures all calculations use the admin-set rate
    const adminExchangeRate = await getExchangeRate();
    console.log(`[Process Payment] Using admin-set exchange rate: ${adminExchangeRate}`);
    
    // Use admin-set exchange rate (ignore frontend rate to ensure consistency)
    const parsedExchangeRate = adminExchangeRate;
    
    // First, check if this specific transaction ID is already completed
    let transaction = await getTransaction(transactionId);
    if (transaction && transaction.status === "completed") {
      console.log(`Transaction ${transactionId} already completed, preventing duplicate processing`);
      return NextResponse.json({
        success: false,
        error: "This transaction ID has already been completed. Please refresh the page to start a new transaction.",
        alreadyCompleted: true,
        txHash: transaction.txHash,
        explorerUrl: transaction.txHash ? `https://basescan.org/tx/${transaction.txHash}` : undefined,
      });
    }

    // Validate Paystack key before checking for payments
    if (!PAYSTACK_SECRET_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "Paystack API key not configured. Please set PAYSTACK_SECRET_KEY in environment variables.",
        },
        { status: 500 }
      );
    }

    // Check Paystack FIRST to see if there's an unused payment
    // This allows users to send the same amount twice if there are two actual payments
    let unusedPaymentExists = false;
    try {
      const paystackResponse = await axios.get(
        `${PAYSTACK_API_BASE}/transaction`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
          params: {
            perPage: 100, // Check last 100 transactions
          },
        }
      );

      const paystackTransactions = paystackResponse.data.data || [];
      
      // Get all used Paystack references from our database
      const allCompletedTransactions = getAllTransactions().filter(
        (t) => t.status === "completed" && t.paystackReference
      );
      const usedPaystackReferences = new Set(
        allCompletedTransactions.map((t) => t.paystackReference)
      );
      
      // Check if there's an unused payment matching the amount
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      
      const unusedPayment = paystackTransactions.find((tx: any) => {
        const txAmount = tx.amount;
        const txTime = new Date(tx.created_at);
        const txReference = tx.reference;
        
        return (
          txAmount === amountInKobo &&
          tx.status === "success" &&
          txTime > tenMinutesAgo &&
          !usedPaystackReferences.has(txReference)
        );
      });
      
      unusedPaymentExists = !!unusedPayment;
      
      if (unusedPayment) {
        console.log(`Found unused Paystack payment: ${unusedPayment.reference}, amount: ${unusedPayment.amount}, time: ${unusedPayment.created_at}`);
      } else {
        console.log(`No unused payment found in Paystack for amount ${amountInKobo}`);
      }
    } catch (paystackError: any) {
      console.error("Error checking Paystack for unused payments:", paystackError);
      // Continue with transaction creation - we'll check again later
    }

    // If there's a completed transaction with same wallet + amount, check if there's a new payment
    const existingCompleted = findCompletedTransactionByWalletAndAmount(normalizedWallet, parsedAmount);
    if (existingCompleted && !unusedPaymentExists) {
      console.log(`Found completed transaction ${existingCompleted.transactionId} for wallet ${normalizedWallet}, amount ${parsedAmount} NGN, but no unused payment found`);
      return NextResponse.json({
        success: false,
        error: "A payment with this amount and wallet address has already been processed, and no new payment was found. Please ensure you have sent a new payment to the account.",
        alreadyCompleted: true,
        txHash: existingCompleted.txHash,
        explorerUrl: existingCompleted.txHash ? `https://basescan.org/tx/${existingCompleted.txHash}` : undefined,
      });
    }
    
    // If there's a completed transaction but a new unused payment exists, allow it
    if (existingCompleted && unusedPaymentExists) {
      console.log(`Found completed transaction ${existingCompleted.transactionId}, but unused payment exists - allowing new transaction`);
    }

    // If transaction ID doesn't exist or is pending, check for existing pending transaction
    // with matching wallet address and amount (user might have refreshed page)
    if (!transaction || transaction.status === "pending") {
      // First, try to find a claimable pending transaction
      const claimableTx = await findClaimablePendingTransaction(
        normalizedWallet,
        parsedAmount,
        transactionId
      );
      
      if (claimableTx) {
        console.log(`Found claimable pending transaction ${claimableTx.transactionId}, using it instead of creating new one`);
        transaction = claimableTx;
        
        // Update with latest data and ensure exchangeRate is stored
        const currentExchangeRate = parsedExchangeRate || claimableTx.exchangeRate || 50;
        const recalculatedSendAmount = calculateSendAmount(parsedAmount, currentExchangeRate);
        
        await updateTransaction(claimableTx.transactionId, {
          ngnAmount: parsedAmount,
          sendAmount: recalculatedSendAmount,
          walletAddress: normalizedWallet,
          sendtag: body.sendtag,
          exchangeRate: currentExchangeRate,
        });
        
        // Ensure user exists
        createOrUpdateUser(
          normalizedWallet,
          claimableTx.transactionId,
          parsedAmount,
          recalculatedSendAmount,
          body.sendtag
        );
      } else {
        const existingPending = findPendingTransactionByWalletAndAmount(normalizedWallet, parsedAmount);
        
        if (existingPending) {
          // Use the existing pending transaction instead of creating a new one
          console.log(`Found existing pending transaction ${existingPending.transactionId} for wallet ${normalizedWallet}, amount ${parsedAmount} NGN`);
          console.log(`Using existing transaction instead of new ID ${transactionId}`);
          
          // Recalculate sendAmount with current exchangeRate
          const currentExchangeRate = parsedExchangeRate || existingPending.exchangeRate || 50;
          const recalculatedSendAmount = calculateSendAmount(parsedAmount, currentExchangeRate);
          
          // Update the existing transaction with latest data
          await updateTransaction(existingPending.transactionId, {
            ngnAmount: parsedAmount,
            sendAmount: recalculatedSendAmount,
            walletAddress: normalizedWallet,
            sendtag: body.sendtag,
            exchangeRate: currentExchangeRate,
          });
          
          // Ensure user exists for this transaction
          createOrUpdateUser(
            normalizedWallet,
            existingPending.transactionId,
            parsedAmount,
            recalculatedSendAmount,
            body.sendtag
          );
          
          transaction = await getTransaction(existingPending.transactionId);
        } else if (!transaction) {
          // No existing pending transaction found, create new one
          console.log(`Creating new transaction: ${transactionId} for wallet ${normalizedWallet}, amount ${parsedAmount} NGN`);
          
          // Calculate sendAmount with current exchangeRate
          const currentExchangeRate = parsedExchangeRate || await getExchangeRate();
          
          // Calculate fees upfront
          const feeNGN = await calculateTransactionFee(parsedAmount);
          const feeInSEND = calculateFeeInTokens(feeNGN, currentExchangeRate);
          const finalSendAmount = calculateFinalTokens(parsedAmount, feeNGN, currentExchangeRate);
          
          transaction = await createTransaction({
            transactionId,
            paystackReference: transactionId,
            ngnAmount: parsedAmount,
            sendAmount: finalSendAmount, // Use final amount after fee
            walletAddress: normalizedWallet,
            sendtag: body.sendtag,
            exchangeRate: currentExchangeRate,
            fee_ngn: feeNGN,
            fee_in_send: feeInSEND,
          });
          console.log(`New transaction created: ${transactionId}`);
          
          // Create or update user for this transaction
          createOrUpdateUser(
            normalizedWallet,
            transactionId,
            parsedAmount,
            finalSendAmount, // Use final amount after fee
            body.sendtag
          );
          
          // Verify it was stored
          const verifyStored = await getTransaction(transactionId);
          if (!verifyStored) {
            console.error(`CRITICAL: Transaction ${transactionId} was not stored after creation!`);
          } else {
            console.log(`Verified: Transaction ${transactionId} is stored, status: ${verifyStored.status}`);
          }
        } else {
          // Transaction exists and is pending, just update it
          console.log(`Updating existing pending transaction: ${transactionId}`);
          
          // Recalculate sendAmount with current exchangeRate
          const currentExchangeRate = parsedExchangeRate || transaction.exchangeRate || 50;
          const recalculatedSendAmount = calculateSendAmount(parsedAmount, currentExchangeRate);
          
          await updateTransaction(transactionId, {
            ngnAmount: parsedAmount,
            sendAmount: recalculatedSendAmount,
            walletAddress: normalizedWallet,
            sendtag: body.sendtag,
            exchangeRate: currentExchangeRate,
          });
          
          // Ensure user exists for this transaction
          createOrUpdateUser(
            normalizedWallet,
            transactionId,
            parsedAmount,
            recalculatedSendAmount,
            body.sendtag
          );
          
          console.log(`Transaction updated: ${transactionId}`);
        }
      }
    }

    // Verify transaction exists
    const finalTransactionId = transaction?.transactionId || transactionId;
    transaction = await getTransaction(finalTransactionId);
    if (!transaction) {
      console.error(`Failed to store/retrieve transaction ${finalTransactionId}`);
      
      // Debug: Log all current transactions
      const allTransactions = getAllTransactions();
      console.error(`Current transactions in storage: ${allTransactions.length}`);
      console.error(`Transaction IDs:`, allTransactions.map((t) => t.transactionId));
      
      return NextResponse.json(
        { 
          success: false, 
          error: "Failed to store transaction. Please try again.",
          debug: {
            requestedId: finalTransactionId,
            totalTransactions: allTransactions.length,
            transactionIds: allTransactions.map((t) => t.transactionId),
          }
        },
        { status: 500 }
      );
    }

    console.log(`Transaction ready: ${transaction.transactionId} for wallet ${transaction.walletAddress}, amount: ${transaction.ngnAmount} NGN, status: ${transaction.status}, created at: ${transaction.createdAt ? (transaction.createdAt instanceof Date ? transaction.createdAt.toISOString() : transaction.createdAt) : 'unknown'}`);
    
    // Debug: Log transaction storage state
    const allTransactions = getAllTransactions();
    console.log(`Total transactions in storage: ${allTransactions.length}`);
    console.log(`Pending: ${allTransactions.filter((t) => t.status === "pending").length}, Completed: ${allTransactions.filter((t) => t.status === "completed").length}`);

    // Final check: if transaction is completed, reject (idempotency check)
    if (transaction.status === "completed") {
      console.log(`Transaction ${transaction.transactionId} is already completed (idempotency check)`);
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        message: "Transaction already completed",
        transactionId: transaction.transactionId,
        txHash: transaction.txHash,
        explorerUrl: transaction.txHash ? `https://basescan.org/tx/${transaction.txHash}` : undefined,
      });
    }

    // ============================================
    // THREE-POINT PAYMENT VERIFICATION
    // ============================================
    console.log(`[Payment Processing] Starting three-point verification for transaction ${finalTransactionId}`);
    
    const verificationResult = await verifyPaymentForTransaction(finalTransactionId);
    
    // Log verification attempt
    addVerificationAttempt(finalTransactionId, {
      point1Verified: verificationResult.point1Verified,
      point2Verified: verificationResult.point2Verified,
      point3Verified: verificationResult.point3Verified,
      allPointsVerified: verificationResult.valid,
      paystackReference: verificationResult.paystackTx?.reference,
      errorMessage: verificationResult.errors.length > 0 ? verificationResult.errors.join("; ") : undefined,
    });

    if (!verificationResult.valid) {
      console.error(`[Payment Processing] Verification failed for transaction ${finalTransactionId}:`, verificationResult.errors);
      return NextResponse.json({
        success: false,
        error: "Payment verification failed. Please ensure you have sent the exact amount and try again.",
        verificationDetails: {
          point1Verified: verificationResult.point1Verified,
          point2Verified: verificationResult.point2Verified,
          point3Verified: verificationResult.point3Verified,
          errors: verificationResult.errors,
        },
      });
    }

    // All three points verified - proceed with token distribution
    const verifiedTx = verificationResult.paystackTx!;
    console.log(`[Payment Processing] ✓ All three points verified for transaction ${finalTransactionId}`);
    console.log(`[Payment Processing] Paystack reference: ${verifiedTx.reference}, amount: ${verifiedTx.amount}`);

    // Final idempotency check: ensure Paystack reference hasn't been used
    const checkForDuplicate = getAllTransactions().find(
      (t) => t.paystackReference === verifiedTx.reference && t.transactionId !== transaction.transactionId && t.status === "completed"
    );
    
    if (checkForDuplicate) {
      console.error(`[Payment Processing] Paystack reference ${verifiedTx.reference} already used by transaction ${checkForDuplicate.transactionId}`);
      return NextResponse.json({
        success: false,
        error: "This payment has already been processed for another transaction. Please contact support if you believe this is an error.",
      });
    }

    // Update transaction status with Paystack reference
    // Recalculate sendAmount if exchangeRate changed
    let finalSendAmount = transaction.sendAmount || "0.00";
    
    // Validate transaction has required fields
    if (!transaction.ngnAmount || isNaN(transaction.ngnAmount) || transaction.ngnAmount <= 0) {
      console.error(`[Payment Processing] Invalid ngnAmount for transaction ${transaction.transactionId}: ${transaction.ngnAmount}`);
      return NextResponse.json(
        { success: false, error: "Transaction has invalid amount. Please contact support." },
        { status: 500 }
      );
    }
    
    // Recalculate sendAmount if exchangeRate is available
    if (transaction.exchangeRate && !isNaN(transaction.exchangeRate) && transaction.exchangeRate > 0) {
      try {
        finalSendAmount = calculateSendAmount(transaction.ngnAmount, transaction.exchangeRate);
        console.log(`[Payment Processing] Recalculated sendAmount: ${finalSendAmount} SEND (rate: ${transaction.exchangeRate})`);
      } catch (error: any) {
        console.error(`[Payment Processing] Error calculating sendAmount:`, error);
        // If calculation fails and we don't have a valid sendAmount, use default rate
        if (!finalSendAmount || parseFloat(finalSendAmount) === 0) {
          finalSendAmount = calculateSendAmount(transaction.ngnAmount, 50);
          console.log(`[Payment Processing] Using default rate, calculated: ${finalSendAmount} SEND`);
        }
      }
    } else if (!finalSendAmount || parseFloat(finalSendAmount) === 0) {
      // If no sendAmount and no exchangeRate, use default rate
      finalSendAmount = calculateSendAmount(transaction.ngnAmount, 50);
      console.log(`[Payment Processing] No exchangeRate found, using default rate: ${finalSendAmount} SEND`);
    }
    
    // Final validation of sendAmount
    if (!finalSendAmount || parseFloat(finalSendAmount) <= 0) {
      console.error(`[Payment Processing] Invalid finalSendAmount: ${finalSendAmount}`);
      return NextResponse.json(
        { success: false, error: "Failed to calculate token amount. Please contact support." },
        { status: 500 }
      );
    }
    
    // Calculate transaction fee (only if not already calculated)
    let feeNGN = transaction.fee_ngn;
    let feeInSEND = transaction.fee_in_send;
    const currentExchangeRate = transaction.exchangeRate || await getExchangeRate();
    
    // If fees not already calculated (for backward compatibility with old transactions)
    if (!feeNGN || !feeInSEND) {
      feeNGN = await calculateTransactionFee(transaction.ngnAmount);
      feeInSEND = calculateFeeInTokens(feeNGN, currentExchangeRate);
      // Recalculate final amount if fees weren't applied upfront
      finalSendAmount = calculateFinalTokens(transaction.ngnAmount, feeNGN, currentExchangeRate);
      console.log(`[Payment Processing] Fee calculated: ${feeNGN} NGN (${feeInSEND} $SEND), Final tokens: ${finalSendAmount} $SEND`);
    } else {
      // Fees already calculated upfront - use existing sendAmount (already has fees deducted)
      console.log(`[Payment Processing] Using existing fee: ${feeNGN} NGN (${feeInSEND} $SEND), Final tokens: ${finalSendAmount} $SEND`);
    }
    
    await updateTransaction(transaction.transactionId, {
      status: "completed",
      paystackReference: verifiedTx.reference,
      sendAmount: finalSendAmount, // Final amount after fee deduction
      walletAddress: transaction.walletAddress, // Ensure wallet address is preserved
      completedAt: new Date(),
      fee_ngn: feeNGN,
      fee_in_send: feeInSEND,
    });
    
    // Record revenue
    if (feeNGN > 0) {
      const revenueResult = await recordRevenue(transaction.transactionId, feeNGN, feeInSEND);
      if (!revenueResult.success) {
        console.error(`[Payment Processing] ⚠️ Failed to record revenue: ${revenueResult.error}`);
      }
    }

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
        await sendPaymentVerificationEmail(userEmail, transaction.ngnAmount, verifiedTx.reference);
      } catch (emailError) {
        console.error(`[Payment Processing] Failed to send payment verification email:`, emailError);
        // Don't fail the transaction if email fails
      }
    }
    
    // Update user record when transaction is completed
    if (transaction.userId) {
      // User is logged in - update wallet stats in Supabase
      try {
        const statsResult = await updateWalletStats(
          transaction.userId,
          transaction.walletAddress,
          transaction.ngnAmount,
          finalSendAmount,
          transaction.sendtag
        );
        
        if (statsResult.success) {
          console.log(`[Payment Processing] ✅ Updated Supabase wallet stats for user ${transaction.userId}`);
        } else {
          console.error(`[Payment Processing] ⚠️ Failed to update Supabase wallet stats:`, statsResult.error);
          // Continue anyway - stats can be synced later
        }
      } catch (error) {
        console.error(`[Payment Processing] ⚠️ Exception updating Supabase wallet stats:`, error);
        // Continue anyway
      }

      // Update referral count if this is user's first completed transaction
      // (Database trigger should handle this, but we call it explicitly as backup)
      try {
        const referralResult = await updateReferralCountOnTransaction(transaction.userId);
        if (referralResult.success) {
          console.log(`[Payment Processing] ✅ Referral count updated for user ${transaction.userId}`);
        } else {
          console.error(`[Payment Processing] ⚠️ Failed to update referral count:`, referralResult.error);
          // Continue anyway - trigger should handle it
        }
      } catch (error) {
        console.error(`[Payment Processing] ⚠️ Exception updating referral count:`, error);
        // Continue anyway - trigger should handle it
      }
    } else {
      // No userId - fall back to in-memory user tracking
      createOrUpdateUser(
        transaction.walletAddress,
        transaction.transactionId,
        transaction.ngnAmount,
        finalSendAmount,
        transaction.sendtag
      );
      console.log(`[Payment Processing] Updated in-memory user stats for wallet ${transaction.walletAddress}`);
    }
    
    console.log(`[Payment Processing] Transaction ${finalTransactionId} marked as completed with Paystack reference ${verifiedTx.reference}`);

      // Check if tokens were already distributed (prevent duplicate distribution)
      if (transaction.txHash) {
        console.log(`Tokens already distributed for transaction ${transaction.transactionId}, txHash: ${transaction.txHash}`);
        return NextResponse.json({
          success: true,
          message: `Payment verified. Tokens were already distributed. Transaction: ${transaction.txHash.slice(0, 10)}...`,
          txHash: transaction.txHash,
          explorerUrl: `https://basescan.org/tx/${transaction.txHash}`,
          amount: finalSendAmount,
          walletAddress: transaction.walletAddress,
          alreadyDistributed: true,
        });
      }

      // Distribute tokens
      console.log(`[Payment Processing] Distributing tokens...`);
      console.log(`[Payment Processing] Wallet: ${transaction.walletAddress}, Amount: ${finalSendAmount} SEND`);

      const distributionResult = await distributeTokens(
        transaction.transactionId,
        transaction.walletAddress,
        finalSendAmount
      );

      if (distributionResult.success) {
        // Send token distribution email
        if (userEmail) {
          try {
            await sendTokenDistributionEmail(
              userEmail,
              transaction.ngnAmount,
              finalSendAmount,
              transaction.walletAddress,
              distributionResult.txHash
            );
          } catch (emailError) {
            console.error(`[Payment Processing] Failed to send token distribution email:`, emailError);
            // Don't fail the transaction if email fails
          }
        }

        return NextResponse.json({
          success: true,
          message: `Payment verified and ${finalSendAmount} SEND tokens distributed successfully to ${transaction.walletAddress && transaction.walletAddress.length > 10 ? `${transaction.walletAddress.slice(0, 6)}...${transaction.walletAddress.slice(-4)}` : transaction.walletAddress}`,
          txHash: distributionResult.txHash,
          explorerUrl: `https://basescan.org/tx/${distributionResult.txHash}`,
          amount: finalSendAmount,
          walletAddress: transaction.walletAddress,
          verificationDetails: {
            point1Verified: verificationResult.point1Verified,
            point2Verified: verificationResult.point2Verified,
            point3Verified: verificationResult.point3Verified,
          },
        });
      } else {
        return NextResponse.json({
          success: false,
          error: `Payment verified but token distribution failed: ${distributionResult.error}`,
        });
      }
  } catch (error: any) {
    console.error("Payment processing error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
  */ // End of commented Paystack code
}
