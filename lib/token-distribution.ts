import { transferTokens, estimateGas, isValidBaseAddress } from "./blockchain";
import { updateTransaction, getTransaction } from "./transactions";
import { isValidAddress } from "../utils/validation";

/**
 * Distribute $SEND tokens to a recipient after successful payment
 */
export async function distributeTokens(
  transactionId: string,
  walletAddress: string,
  sendAmount: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // Check if tokens have already been distributed for this transaction
    const transaction = getTransaction(transactionId);
    if (transaction?.txHash) {
      console.log(`Tokens already distributed for transaction ${transactionId}, txHash: ${transaction.txHash}`);
      return {
        success: true,
        txHash: transaction.txHash,
      };
    }
    
    // Check if transaction is already completed (prevents duplicate distribution)
    if (transaction?.status === "completed" && transaction.txHash) {
      console.log(`Transaction ${transactionId} already completed with txHash: ${transaction.txHash}`);
      return {
        success: true,
        txHash: transaction.txHash,
      };
    }
    // Validate wallet address
    if (!isValidAddress(walletAddress) && !isValidBaseAddress(walletAddress)) {
      return {
        success: false,
        error: "Invalid wallet address format",
      };
    }

    // Estimate gas before transfer
    try {
      const gasEstimate = await estimateGas(walletAddress, sendAmount);
      console.log(`Gas estimate: ${gasEstimate.toString()}`);
    } catch (gasError) {
      console.error("Gas estimation failed:", gasError);
      // Continue anyway - the transfer will fail if there's an issue
    }

    // Transfer tokens
    const result = await transferTokens(walletAddress, sendAmount);

    if (result.success) {
      // Update transaction with blockchain tx hash
      updateTransaction(transactionId, {
        txHash: result.hash,
        status: "completed",
      });

      return {
        success: true,
        txHash: result.hash,
      };
    } else {
      return {
        success: false,
        error: "Token transfer failed",
      };
    }
  } catch (error: any) {
    console.error("Token distribution error:", error);
    
    // Update transaction status to failed
    updateTransaction(transactionId, {
      status: "failed",
    });

    return {
      success: false,
      error: error.message || "Failed to distribute tokens",
    };
  }
}

/**
 * Check if token distribution is ready (payment verified, not already distributed)
 */
export function isDistributionReady(transactionId: string): boolean {
  // This would check transaction status in a real implementation
  // For now, we'll rely on the webhook handler to call this at the right time
  return true;
}

