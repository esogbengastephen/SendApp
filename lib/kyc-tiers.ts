/**
 * Flutterwave KYC Tier System
 * 
 * Tier 1: No BVN (Temporary Account)
 * - Daily limit: ₦50,000
 * - Monthly limit: ₦500,000
 * - Single transaction limit: ₦50,000
 * 
 * Tier 2: BVN Verified (Permanent Account)
 * - Daily limit: ₦1,000,000
 * - Monthly limit: ₦10,000,000
 * - Single transaction limit: ₦1,000,000
 * 
 * Tier 3: Enhanced KYC (Permanent Account with Additional Documentation)
 * - Daily limit: ₦10,000,000
 * - Monthly limit: ₦100,000,000
 * - Single transaction limit: ₦10,000,000
 */

export type KYCTier = 1 | 2 | 3;

export interface KYCTierInfo {
  tier: KYCTier;
  name: string;
  description: string;
  dailyLimit: number;
  monthlyLimit: number;
  singleTransactionLimit: number;
  requiresBVN: boolean;
  requiresEnhancedKYC: boolean;
}

export const KYC_TIERS: Record<KYCTier, KYCTierInfo> = {
  1: {
    tier: 1,
    name: "Tier 1 - Basic",
    description: "Temporary account without BVN verification",
    dailyLimit: 50000,
    monthlyLimit: 500000,
    singleTransactionLimit: 50000,
    requiresBVN: false,
    requiresEnhancedKYC: false,
  },
  2: {
    tier: 2,
    name: "Tier 2 - BVN Verified",
    description: "Permanent account with BVN verification",
    dailyLimit: 1000000,
    monthlyLimit: 10000000,
    singleTransactionLimit: 1000000,
    requiresBVN: true,
    requiresEnhancedKYC: false,
  },
  3: {
    tier: 3,
    name: "Tier 3 - Enhanced KYC",
    description: "Permanent account with enhanced KYC verification",
    dailyLimit: 10000000,
    monthlyLimit: 100000000,
    singleTransactionLimit: 10000000,
    requiresBVN: true,
    requiresEnhancedKYC: true,
  },
};

/**
 * Get KYC tier information
 */
export function getKYCTierInfo(tier: KYCTier | null | undefined): KYCTierInfo {
  const tierValue = tier || 1;
  return KYC_TIERS[tierValue as KYCTier] || KYC_TIERS[1];
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}

/**
 * Check if user can perform transaction based on tier limits
 */
export function canPerformTransaction(
  tier: KYCTier | null | undefined,
  amount: number
): { allowed: boolean; reason?: string } {
  const tierInfo = getKYCTierInfo(tier);
  
  if (amount > tierInfo.singleTransactionLimit) {
    return {
      allowed: false,
      reason: `Transaction amount exceeds single transaction limit of ${formatCurrency(tierInfo.singleTransactionLimit)} for ${tierInfo.name}`,
    };
  }
  
  return { allowed: true };
}

/**
 * Get next tier information for upgrade
 */
export function getNextTier(currentTier: KYCTier | null | undefined): KYCTierInfo | null {
  const tier = currentTier || 1;
  
  if (tier === 1) {
    return KYC_TIERS[2];
  } else if (tier === 2) {
    return KYC_TIERS[3];
  }
  
  return null; // Already at highest tier
}

/**
 * Check if user can upgrade to next tier
 */
export function canUpgradeTier(
  currentTier: KYCTier | null | undefined,
  hasBVN: boolean
): { canUpgrade: boolean; nextTier?: KYCTierInfo; reason?: string } {
  const tier = currentTier || 1;
  
  if (tier === 1) {
    if (!hasBVN) {
      return {
        canUpgrade: false,
        reason: "BVN verification required to upgrade to Tier 2",
      };
    }
    return {
      canUpgrade: true,
      nextTier: KYC_TIERS[2],
    };
  } else if (tier === 2) {
    return {
      canUpgrade: true,
      nextTier: KYC_TIERS[3],
      reason: "Submit additional documentation to upgrade to Tier 3",
    };
  }
  
  return {
    canUpgrade: false,
    reason: "Already at highest tier",
  };
}
