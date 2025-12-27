/**
 * Off-ramp Settings Management
 * Handles USDC → NGN exchange rate and fee tiers for off-ramp transactions
 * Separate from on-ramp settings (NGN → SEND)
 */

import { supabaseAdmin } from "./supabase";

export interface OfframpSettings {
  exchangeRate: number; // USDC → NGN
  transactionsEnabled: boolean;
  minimumAmount: number; // Minimum NGN amount
  maximumAmount: number; // Maximum NGN amount
  updatedAt: Date;
  updatedBy?: string;
}

export interface OfframpFeeTier {
  id?: string;
  tier_name: string;
  min_amount: number; // NGN
  max_amount: number | null; // NGN, NULL for unlimited
  fee_percentage: number; // e.g., 2.0 for 2%
  updated_at?: string;
  updated_by?: string;
}

// Cache settings for 5 minutes to reduce database calls
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

declare global {
  // eslint-disable-next-line no-var
  var __offrampSettings: OfframpSettings | undefined;
  // eslint-disable-next-line no-var
  var __offrampSettingsCacheTime: number | undefined;
}

/**
 * Load off-ramp settings from Supabase
 */
async function loadOfframpSettings(): Promise<OfframpSettings> {
  try {
    console.log("[Offramp Settings] Loading from Supabase...");
    const { data, error } = await supabaseAdmin
      .from("platform_settings")
      .select("setting_value")
      .eq("setting_key", "offramp_exchange_rate")
      .maybeSingle();

    if (error && error.code === "PGRST116") {
      // No settings found, create default
      console.log("[Offramp Settings] No settings found, creating default...");
      const defaultSettings: OfframpSettings = {
        exchangeRate: 1650.0, // 1 USDC = 1650 NGN
        transactionsEnabled: true,
        minimumAmount: 500, // 500 NGN minimum
        maximumAmount: 5000000, // 5M NGN maximum
        updatedAt: new Date(),
        updatedBy: "system",
      };

      const { error: insertError } = await supabaseAdmin
        .from("platform_settings")
        .upsert(
          {
            setting_key: "offramp_exchange_rate",
            setting_value: {
              exchangeRate: defaultSettings.exchangeRate,
              transactionsEnabled: defaultSettings.transactionsEnabled,
              minimumAmount: defaultSettings.minimumAmount,
              maximumAmount: defaultSettings.maximumAmount,
              updatedAt: defaultSettings.updatedAt.toISOString(),
              updatedBy: defaultSettings.updatedBy,
            },
            updated_by: "system",
          },
          { onConflict: "setting_key" }
        );

      if (insertError) {
        console.error("[Offramp Settings] Error creating default:", insertError);
        return defaultSettings;
      }

      return defaultSettings;
    }

    if (error) {
      console.error("[Offramp Settings] Error loading:", error);
      throw new Error(`Failed to load off-ramp settings: ${error.message}`);
    }

    if (data && data.setting_value) {
      const value = data.setting_value as any;
      const loadedSettings: OfframpSettings = {
        exchangeRate: value.exchangeRate || 1650.0,
        transactionsEnabled: value.transactionsEnabled !== false,
        minimumAmount: value.minimumAmount || 500,
        maximumAmount: value.maximumAmount || 5000000,
        updatedAt: value.updatedAt ? new Date(value.updatedAt) : new Date(),
        updatedBy: value.updatedBy,
      };

      console.log(`[Offramp Settings] Loaded: USDC → NGN = ${loadedSettings.exchangeRate}`);
      return loadedSettings;
    }

    throw new Error("No data returned from Supabase");
  } catch (error: any) {
    console.error("[Offramp Settings] Critical error:", error);
    return {
      exchangeRate: 1650.0,
      transactionsEnabled: true,
      minimumAmount: 500,
      maximumAmount: 5000000,
      updatedAt: new Date(),
    };
  }
}

/**
 * Get off-ramp settings (with caching)
 */
export async function getOfframpSettings(): Promise<OfframpSettings> {
  const now = Date.now();
  const cacheTime = global.__offrampSettingsCacheTime || 0;
  const isCacheValid = global.__offrampSettings && now - cacheTime < CACHE_DURATION;

  if (isCacheValid && global.__offrampSettings) {
    console.log(`[Offramp Settings] Using cached (age: ${Math.round((now - cacheTime) / 1000)}s)`);
    return { ...global.__offrampSettings };
  }

  console.log("[Offramp Settings] Cache expired, loading...");
  const settings = await loadOfframpSettings();
  global.__offrampSettings = settings;
  global.__offrampSettingsCacheTime = now;

  return { ...settings };
}

/**
 * Get off-ramp exchange rate (USDC → NGN)
 */
export async function getOfframpExchangeRate(): Promise<number> {
  const settings = await getOfframpSettings();
  return settings.exchangeRate;
}

/**
 * Update off-ramp settings
 */
export async function updateOfframpSettings(
  updates: Partial<OfframpSettings>,
  updatedBy?: string
): Promise<OfframpSettings> {
  const currentSettings = await getOfframpSettings();

  const newSettings: OfframpSettings = {
    ...currentSettings,
    ...updates,
    updatedAt: new Date(),
    updatedBy,
  };

  // Validate
  if (newSettings.exchangeRate <= 0) {
    throw new Error("Exchange rate must be greater than 0");
  }
  if (newSettings.minimumAmount < 0) {
    throw new Error("Minimum amount cannot be negative");
  }
  if (newSettings.maximumAmount < newSettings.minimumAmount) {
    throw new Error("Maximum amount must be greater than minimum");
  }

  // Save to database
  const { error } = await supabaseAdmin
    .from("platform_settings")
    .upsert(
      {
        setting_key: "offramp_exchange_rate",
        setting_value: {
          exchangeRate: newSettings.exchangeRate,
          transactionsEnabled: newSettings.transactionsEnabled,
          minimumAmount: newSettings.minimumAmount,
          maximumAmount: newSettings.maximumAmount,
          updatedAt: newSettings.updatedAt.toISOString(),
          updatedBy: newSettings.updatedBy,
        },
        updated_by: updatedBy || "system",
      },
      { onConflict: "setting_key" }
    );

  if (error) {
    console.error("[Offramp Settings] Error saving:", error);
    throw error;
  }

  // Update cache
  global.__offrampSettings = newSettings;
  global.__offrampSettingsCacheTime = Date.now();

  console.log(`[Offramp Settings] Updated by ${updatedBy || "system"}`);
  return { ...newSettings };
}

/**
 * Get all off-ramp fee tiers
 */
export async function getOfframpFeeTiers(): Promise<OfframpFeeTier[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("offramp_fee_tiers")
      .select("*")
      .order("min_amount", { ascending: true });

    if (error) {
      console.error("[Offramp Fee Tiers] Error fetching:", error);
      // Return default tiers
      return [
        { tier_name: "tier_1", min_amount: 0, max_amount: 1000, fee_percentage: 2.0 },
        { tier_name: "tier_2", min_amount: 1000, max_amount: 5000, fee_percentage: 1.5 },
        { tier_name: "tier_3", min_amount: 5000, max_amount: 20000, fee_percentage: 1.0 },
        { tier_name: "tier_4", min_amount: 20000, max_amount: null, fee_percentage: 0.5 },
      ];
    }

    return (data || []).map((tier) => ({
      id: tier.id,
      tier_name: tier.tier_name,
      min_amount: parseFloat(tier.min_amount.toString()),
      max_amount: tier.max_amount ? parseFloat(tier.max_amount.toString()) : null,
      fee_percentage: parseFloat(tier.fee_percentage.toString()),
      updated_at: tier.updated_at,
      updated_by: tier.updated_by,
    }));
  } catch (error) {
    console.error("[Offramp Fee Tiers] Exception:", error);
    return [
      { tier_name: "tier_1", min_amount: 0, max_amount: 1000, fee_percentage: 2.0 },
      { tier_name: "tier_2", min_amount: 1000, max_amount: 5000, fee_percentage: 1.5 },
      { tier_name: "tier_3", min_amount: 5000, max_amount: 20000, fee_percentage: 1.0 },
      { tier_name: "tier_4", min_amount: 20000, max_amount: null, fee_percentage: 0.5 },
    ];
  }
}

/**
 * Calculate off-ramp fee based on NGN amount
 */
export async function calculateOfframpFee(ngnAmount: number): Promise<number> {
  const tiers = await getOfframpFeeTiers();

  // Find the appropriate tier
  for (const tier of tiers) {
    if (ngnAmount >= tier.min_amount) {
      if (tier.max_amount === null || ngnAmount <= tier.max_amount) {
        // Calculate percentage-based fee
        return (ngnAmount * tier.fee_percentage) / 100;
      }
    }
  }

  // If no tier matches, use the highest tier
  const highestTier = tiers[tiers.length - 1];
  return highestTier ? (ngnAmount * highestTier.fee_percentage) / 100 : 0;
}

/**
 * Update off-ramp fee tier
 */
export async function updateOfframpFeeTier(
  tier: OfframpFeeTier,
  updatedBy?: string
): Promise<OfframpFeeTier> {
  // Validate
  if (tier.fee_percentage < 0 || tier.fee_percentage > 100) {
    throw new Error("Fee percentage must be between 0 and 100");
  }
  if (tier.min_amount < 0) {
    throw new Error("Minimum amount cannot be negative");
  }
  if (tier.max_amount !== null && tier.max_amount < tier.min_amount) {
    throw new Error("Maximum amount must be greater than minimum");
  }

  const { data, error } = await supabaseAdmin
    .from("offramp_fee_tiers")
    .upsert(
      {
        id: tier.id,
        tier_name: tier.tier_name,
        min_amount: tier.min_amount,
        max_amount: tier.max_amount,
        fee_percentage: tier.fee_percentage,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy || "system",
      },
      { onConflict: "tier_name" }
    )
    .select()
    .single();

  if (error) {
    console.error("[Offramp Fee Tiers] Error updating:", error);
    throw error;
  }

  return {
    id: data.id,
    tier_name: data.tier_name,
    min_amount: parseFloat(data.min_amount.toString()),
    max_amount: data.max_amount ? parseFloat(data.max_amount.toString()) : null,
    fee_percentage: parseFloat(data.fee_percentage.toString()),
    updated_at: data.updated_at,
    updated_by: data.updated_by,
  };
}

/**
 * Delete off-ramp fee tier
 */
export async function deleteOfframpFeeTier(tierId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("offramp_fee_tiers")
    .delete()
    .eq("id", tierId);

  if (error) {
    console.error("[Offramp Fee Tiers] Error deleting:", error);
    throw error;
  }
}
