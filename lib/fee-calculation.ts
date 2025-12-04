/**
 * Transaction fee calculation utilities
 */

import { supabase } from "./supabase";

export interface FeeTier {
  tier_name: string;
  min_amount: number;
  max_amount: number | null;
  fee_ngn: number;
}

/**
 * Get all fee tiers from database
 */
export async function getFeeTiers(): Promise<FeeTier[]> {
  try {
    const { data, error } = await supabase
      .from("transaction_fee_tiers")
      .select("*")
      .order("min_amount", { ascending: true });

    if (error) {
      console.error("[Fee Calculation] Error fetching fee tiers:", error);
      // Return default tiers as fallback
      return [
        { tier_name: "tier_1", min_amount: 3000, max_amount: 10000, fee_ngn: 250 },
        { tier_name: "tier_2", min_amount: 10001, max_amount: 50000, fee_ngn: 500 },
        { tier_name: "tier_3", min_amount: 50001, max_amount: null, fee_ngn: 1000 },
      ];
    }

    return (data || []).map((tier) => ({
      tier_name: tier.tier_name,
      min_amount: parseFloat(tier.min_amount.toString()),
      max_amount: tier.max_amount ? parseFloat(tier.max_amount.toString()) : null,
      fee_ngn: parseFloat(tier.fee_ngn.toString()),
    }));
  } catch (error) {
    console.error("[Fee Calculation] Exception fetching fee tiers:", error);
    // Return default tiers as fallback
    return [
      { tier_name: "tier_1", min_amount: 3000, max_amount: 10000, fee_ngn: 250 },
      { tier_name: "tier_2", min_amount: 10001, max_amount: 50000, fee_ngn: 500 },
      { tier_name: "tier_3", min_amount: 50001, max_amount: null, fee_ngn: 1000 },
    ];
  }
}

/**
 * Calculate transaction fee based on amount and tier structure
 */
export async function calculateTransactionFee(ngnAmount: number): Promise<number> {
  if (ngnAmount < 3000) {
    return 0; // No fee for amounts below minimum
  }

  const tiers = await getFeeTiers();

  // Find the appropriate tier
  for (const tier of tiers) {
    if (ngnAmount >= tier.min_amount) {
      if (tier.max_amount === null || ngnAmount <= tier.max_amount) {
        return tier.fee_ngn;
      }
    }
  }

  // If no tier matches, return the highest tier fee (shouldn't happen)
  const highestTier = tiers[tiers.length - 1];
  return highestTier ? highestTier.fee_ngn : 0;
}

/**
 * Calculate final tokens after fee deduction
 */
export function calculateFinalTokens(
  ngnAmount: number,
  feeNGN: number,
  exchangeRate: number
): string {
  // Calculate tokens without fee
  const tokensToSend = ngnAmount * exchangeRate;
  
  // Calculate fee in tokens
  const feeInTokens = feeNGN * exchangeRate;
  
  // Calculate final tokens (after fee deduction)
  const finalTokens = tokensToSend - feeInTokens;
  
  // Ensure non-negative
  const result = Math.max(0, finalTokens);
  
  return result.toFixed(2);
}

/**
 * Calculate fee in tokens
 */
export function calculateFeeInTokens(feeNGN: number, exchangeRate: number): string {
  const feeInTokens = feeNGN * exchangeRate;
  return feeInTokens.toFixed(2);
}

