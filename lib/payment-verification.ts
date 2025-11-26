import axios from "axios";
import { Transaction, getTransaction, getAllTransactions } from "@/lib/transactions";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_API_BASE = "https://api.paystack.co";

export interface VerificationResult {
  valid: boolean;
  transaction?: Transaction;
  paystackTx?: any;
  errors: string[];
  point1Verified: boolean; // Transaction ID verification
  point2Verified: boolean; // Amount verification
  point3Verified: boolean; // Payment status & uniqueness
}

/**
 * Three-point payment verification system
 * 
 * Point 1: Transaction ID Verification
 *   - Transaction ID exists in database
 *   - Status is "pending" (not already completed)
 *   - Transaction ID matches the payment being verified
 * 
 * Point 2: Amount Verification
 *   - Paystack payment amount matches transaction NGN amount (exact match)
 *   - Amount is in correct format (kobo)
 * 
 * Point 3: Payment Status & Uniqueness Verification
 *   - Paystack payment status is "success"
 *   - Paystack reference hasn't been used by another transaction
 *   - Payment was made after transaction creation
 *   - Payment is recent (within time window)
 */
export async function verifyPaymentForTransaction(
  transactionId: string,
  paystackReference?: string
): Promise<VerificationResult> {
  const errors: string[] = [];
  let point1Verified = false;
  let point2Verified = false;
  let point3Verified = false;
  let transaction: Transaction | undefined;
  let paystackTx: any = null;

  // ============================================
  // POINT 1: Transaction ID Verification
  // ============================================
  transaction = await getTransaction(transactionId);
  
  if (!transaction) {
    errors.push("Point 1 Failed: Transaction ID does not exist in database");
    return {
      valid: false,
      errors,
      point1Verified: false,
      point2Verified: false,
      point3Verified: false,
    };
  }

  if (transaction.status === "completed") {
    errors.push("Point 1 Failed: Transaction ID has already been completed");
    return {
      valid: false,
      transaction,
      errors,
      point1Verified: false,
      point2Verified: false,
      point3Verified: false,
    };
  }

  if (transaction.status !== "pending") {
    errors.push(`Point 1 Failed: Transaction status is "${transaction.status}", expected "pending"`);
    return {
      valid: false,
      transaction,
      errors,
      point1Verified: false,
      point2Verified: false,
      point3Verified: false,
    };
  }

  point1Verified = true;
  console.log(`[Payment Verification] Point 1 ✓: Transaction ID ${transactionId} verified`);

  // ============================================
  // POINT 2 & 3: Fetch Paystack Transaction
  // ============================================
  if (!PAYSTACK_SECRET_KEY) {
    errors.push("Paystack API key not configured");
    return {
      valid: false,
      transaction,
      errors,
      point1Verified: true,
      point2Verified: false,
      point3Verified: false,
    };
  }

  try {
    // If paystackReference provided, verify that specific transaction
    // Otherwise, search for matching payment
    if (paystackReference) {
      const verifyResponse = await axios.get(
        `${PAYSTACK_API_BASE}/transaction/verify/${paystackReference}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
        }
      );
      paystackTx = verifyResponse.data.data;
    } else {
      // Search for matching payment
      const response = await axios.get(
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

      const paystackTransactions = response.data.data || [];
      const amountInKobo = Math.round(transaction.ngnAmount * 100);
      const transactionCreatedAt = transaction.createdAt || transaction.initializedAt || new Date();
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      // Get all used Paystack references
      const allCompletedTransactions = getAllTransactions().filter(
        (t) => t.status === "completed" && t.paystackReference
      );
      const usedPaystackReferences = new Set(
        allCompletedTransactions.map((t) => t.paystackReference)
      );

      // Find matching transaction
      paystackTx = paystackTransactions.find((tx: any) => {
        const txAmount = tx.amount;
        const txTime = new Date(tx.created_at);
        const txReference = tx.reference;

        return (
          txAmount === amountInKobo &&
          tx.status === "success" &&
          txTime > tenMinutesAgo &&
          txTime > transactionCreatedAt &&
          !usedPaystackReferences.has(txReference)
        );
      });

      if (!paystackTx) {
        errors.push("Point 2 & 3 Failed: No matching Paystack payment found");
        return {
          valid: false,
          transaction,
          errors,
          point1Verified: true,
          point2Verified: false,
          point3Verified: false,
        };
      }
    }

    // ============================================
    // POINT 2: Amount Verification
    // ============================================
    const amountInKobo = Math.round(transaction.ngnAmount * 100);
    const paystackAmount = paystackTx.amount;

    if (paystackAmount !== amountInKobo) {
      errors.push(
        `Point 2 Failed: Amount mismatch. Expected ${amountInKobo} kobo (${transaction.ngnAmount} NGN), got ${paystackAmount} kobo`
      );
    } else {
      point2Verified = true;
      console.log(`[Payment Verification] Point 2 ✓: Amount verified (${amountInKobo} kobo)`);
    }

    // ============================================
    // POINT 3: Payment Status & Uniqueness Verification
    // ============================================
    if (paystackTx.status !== "success") {
      errors.push(`Point 3 Failed: Paystack payment status is "${paystackTx.status}", expected "success"`);
    }

    // Check if Paystack reference has been used
    const allCompletedTransactions = getAllTransactions().filter(
      (t) => t.status === "completed" && t.paystackReference
    );
    const usedPaystackReferences = new Set(
      allCompletedTransactions.map((t) => t.paystackReference)
    );

    if (usedPaystackReferences.has(paystackTx.reference)) {
      errors.push(`Point 3 Failed: Paystack reference ${paystackTx.reference} has already been used by another transaction`);
    }

    // Check if payment was made after transaction creation
    const transactionCreatedAt = transaction.createdAt || transaction.initializedAt || new Date();
    const paymentTime = new Date(paystackTx.created_at);
    if (paymentTime <= transactionCreatedAt) {
      errors.push(
        `Point 3 Failed: Payment was made before transaction creation. Payment: ${paymentTime.toISOString()}, Transaction: ${transactionCreatedAt.toISOString()}`
      );
    }

    // Check if payment is recent (within 10 minutes)
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    if (paymentTime <= tenMinutesAgo) {
      errors.push(
        `Point 3 Failed: Payment is too old. Payment time: ${paymentTime.toISOString()}, Current time: ${now.toISOString()}`
      );
    }

    if (paystackTx.status === "success" && 
        !usedPaystackReferences.has(paystackTx.reference) &&
        paymentTime > transactionCreatedAt &&
        paymentTime > tenMinutesAgo) {
      point3Verified = true;
      console.log(`[Payment Verification] Point 3 ✓: Payment status and uniqueness verified`);
    }

  } catch (error: any) {
    console.error("Error verifying Paystack payment:", error);
    errors.push(`Paystack API error: ${error.response?.data?.message || error.message}`);
    return {
      valid: false,
      transaction,
      errors,
      point1Verified: true,
      point2Verified: false,
      point3Verified: false,
    };
  }

  // All three points must pass
  const valid = point1Verified && point2Verified && point3Verified;

  if (valid) {
    console.log(`[Payment Verification] ✓ All three points verified for transaction ${transactionId}`);
  } else {
    console.log(`[Payment Verification] ✗ Verification failed for transaction ${transactionId}. Errors:`, errors);
  }

  return {
    valid,
    transaction,
    paystackTx,
    errors,
    point1Verified,
    point2Verified,
    point3Verified,
  };
}

