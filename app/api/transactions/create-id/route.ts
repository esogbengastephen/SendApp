import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createTransaction, getTransaction, updateTransaction } from "@/lib/transactions";
import { createOrUpdateUser } from "@/lib/users";
import { calculateSendAmount } from "@/lib/transactions";

/**
 * Create or update a transaction ID
 * This endpoint stores transaction details when user inputs amount
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, ngnAmount, sendAmount, walletAddress, sendtag, exchangeRate } = body;

    // If transactionId provided, check if it exists
    if (transactionId) {
      const existing = getTransaction(transactionId);
      if (existing) {
        // Update existing transaction if we have new data
        if (ngnAmount && walletAddress) {
          const normalizedWallet = walletAddress.trim().toLowerCase();
          const currentExchangeRate = exchangeRate ? parseFloat(exchangeRate) : existing.exchangeRate || 50;
          const calculatedSendAmount = sendAmount || calculateSendAmount(parseFloat(ngnAmount), currentExchangeRate);
          
          updateTransaction(transactionId, {
            ngnAmount: parseFloat(ngnAmount),
            sendAmount: calculatedSendAmount,
            walletAddress: normalizedWallet,
            sendtag: sendtag || undefined,
            exchangeRate: currentExchangeRate,
          });
          
          // Create or update user for this transaction
          if (ngnAmount && walletAddress) {
            createOrUpdateUser(
              normalizedWallet,
              transactionId,
              parseFloat(ngnAmount),
              calculatedSendAmount,
              sendtag || undefined
            );
          }
        }
      }
    }

    // Generate new transaction ID if not provided
    const newTransactionId = transactionId || nanoid();
    
    // If we have amount and wallet, create full transaction
    // Otherwise, create minimal transaction record (will be updated later)
    if (ngnAmount && walletAddress) {
      const normalizedWallet = walletAddress.trim().toLowerCase();
      let currentExchangeRate = 50; // Default
      if (exchangeRate) {
        const parsed = parseFloat(exchangeRate);
        if (!isNaN(parsed) && parsed > 0) {
          currentExchangeRate = parsed;
        }
      }
      const calculatedSendAmount = sendAmount || calculateSendAmount(parseFloat(ngnAmount), currentExchangeRate);
      
      const transaction = createTransaction({
        transactionId: newTransactionId,
        paystackReference: newTransactionId, // Will be updated when payment is found
        ngnAmount: parseFloat(ngnAmount),
        sendAmount: calculatedSendAmount,
        walletAddress: normalizedWallet,
        sendtag: sendtag || undefined,
        exchangeRate: currentExchangeRate, // Always store exchangeRate
      });
      
      // Create or update user for this transaction
      createOrUpdateUser(
        normalizedWallet,
        newTransactionId,
        parseFloat(ngnAmount),
        calculatedSendAmount,
        sendtag || undefined
      );

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
      // Create minimal transaction record (just ID, will be updated when user submits form)
      const transaction = createTransaction({
        transactionId: newTransactionId,
        paystackReference: newTransactionId,
        ngnAmount: 0,
        sendAmount: "0.00",
        walletAddress: "",
      });

      return NextResponse.json({
        success: true,
        transactionId: transaction.transactionId,
        exists: false,
        transaction: {
          transactionId: transaction.transactionId,
          status: transaction.status,
        },
        alreadyProcessed: false,
      });
    }
  } catch (error: any) {
    console.error("Transaction ID creation error:", error);
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

    const transaction = getTransaction(transactionId);
    
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
    console.error("Transaction ID check error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
