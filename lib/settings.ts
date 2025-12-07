// Persistent storage for platform settings using Supabase
// Settings are saved to Supabase database to persist across server restarts and work in serverless environments

import { supabase } from "./supabase";

interface PlatformSettings {
  exchangeRate: number;
  transactionsEnabled: boolean;
  minimumPurchase: number;
  updatedAt: Date;
  updatedBy?: string;
}

// Initialize with default rate from environment or constant
const defaultRate = parseFloat(process.env.SEND_NGN_EXCHANGE_RATE || "50");

// Use a global object to cache settings in memory (for performance)
declare global {
  // eslint-disable-next-line no-var
  var __sendSettings: PlatformSettings | undefined;
  // eslint-disable-next-line no-var
  var __sendSettingsCacheTime: number | undefined;
}

// Cache settings for 5 minutes to reduce database calls
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Load settings from Supabase, or create default if not found
 * This function ALWAYS tries to load from Supabase first
 */
async function loadSettings(): Promise<PlatformSettings> {
  try {
    console.log("[Settings] Loading settings from Supabase...");
    const { data, error } = await supabase
      .from("platform_settings")
      .select("setting_value")
      .eq("setting_key", "exchange_rate")
      .maybeSingle();

    // PGRST116 is "not found" error - this means the table exists but no row found
    if (error && error.code === "PGRST116") {
      console.log("[Settings] No exchange_rate setting found in database, creating default...");
      // If no settings found, create default in database
      const defaultSettings: PlatformSettings = {
        exchangeRate: defaultRate,
        transactionsEnabled: true, // Default: transactions enabled
        minimumPurchase: 3000, // Default minimum purchase
        updatedAt: new Date(),
        updatedBy: "system",
      };

      // Try to insert default settings (ignore if already exists)
      const { error: insertError } = await supabase
        .from("platform_settings")
        .upsert({
          setting_key: "exchange_rate",
          setting_value: {
            exchangeRate: defaultSettings.exchangeRate,
            transactionsEnabled: defaultSettings.transactionsEnabled,
            minimumPurchase: defaultSettings.minimumPurchase,
            updatedAt: defaultSettings.updatedAt.toISOString(),
            updatedBy: defaultSettings.updatedBy,
          },
          updated_by: "system",
        }, {
          onConflict: "setting_key",
        });

      if (insertError) {
        console.error("[Settings] Error creating default settings:", insertError);
        // Only fall back to default if we can't create it in DB
        return defaultSettings;
      }

      console.log("[Settings] Default settings created in database");
      return defaultSettings;
    }

    // If there's a different error (not "not found"), log it but try to continue
    if (error) {
      console.error("[Settings] Error loading from Supabase:", error);
      // Don't fall back to default - throw error so caller knows something is wrong
      throw new Error(`Failed to load settings from Supabase: ${error.message}`);
    }

    // If we have data, use it - don't fall back to default
    if (data && data.setting_value) {
      const value = data.setting_value as any;
      const loadedSettings: PlatformSettings = {
        exchangeRate: value.exchangeRate,
        transactionsEnabled: value.transactionsEnabled !== undefined ? value.transactionsEnabled : true,
        minimumPurchase: value.minimumPurchase !== undefined ? value.minimumPurchase : 3000,
        updatedAt: value.updatedAt ? new Date(value.updatedAt) : new Date(),
        updatedBy: value.updatedBy,
      };
      
      console.log(`[Settings] Loaded from Supabase: exchange rate = ${loadedSettings.exchangeRate}`);
      return loadedSettings;
    }

    // This shouldn't happen, but if it does, throw an error
    throw new Error("No data returned from Supabase and no error code");
  } catch (error: any) {
    console.error("[Settings] Critical error loading settings:", error);
    // Only use default as absolute last resort if Supabase is completely unavailable
    // But log a warning so we know something is wrong
    console.warn(`[Settings] WARNING: Using fallback default rate (${defaultRate}) because Supabase is unavailable`);
    return {
      exchangeRate: defaultRate,
      transactionsEnabled: true,
      minimumPurchase: 3000,
      updatedAt: new Date(),
    };
  }
}

/**
 * Save settings to Supabase
 */
async function saveSettings(settings: PlatformSettings): Promise<void> {
  try {
    const { error } = await supabase
      .from("platform_settings")
      .upsert({
        setting_key: "exchange_rate",
        setting_value: {
          exchangeRate: settings.exchangeRate,
          transactionsEnabled: settings.transactionsEnabled,
          minimumPurchase: settings.minimumPurchase,
          updatedAt: settings.updatedAt.toISOString(),
          updatedBy: settings.updatedBy,
        },
        updated_by: settings.updatedBy || "system",
      }, {
        onConflict: "setting_key",
      });

    if (error) {
      console.error("[Settings] Error saving to Supabase:", error);
      throw error;
    }

    // Update cache
    global.__sendSettings = settings;
    global.__sendSettingsCacheTime = Date.now();

    console.log(`[Settings] Saved settings to Supabase: exchange rate = ${settings.exchangeRate}`);
  } catch (error) {
    console.error("[Settings] Error saving settings:", error);
    throw error;
  }
}

// DO NOT initialize with default values on module load
// Settings should ALWAYS be loaded from Supabase on first access
// This ensures the persisted rate is used, not the default

// Reference the global settings (will be loaded from Supabase on first call)
let settings: PlatformSettings | null = null;

/**
 * Get current platform settings (with caching)
 * Always loads from Supabase on first call or when cache expires
 */
export async function getSettings(): Promise<PlatformSettings> {
  // Check if cache is still valid
  const now = Date.now();
  const cacheTime = global.__sendSettingsCacheTime || 0;
  const isCacheValid = global.__sendSettings && (now - cacheTime) < CACHE_DURATION;

  if (isCacheValid && global.__sendSettings) {
    console.log(`[Settings] Using cached settings (age: ${Math.round((now - cacheTime) / 1000)}s)`);
    return { ...global.__sendSettings };
  }

  // Load from database (this will always fetch the persisted rate)
  console.log("[Settings] Cache expired or missing, loading from Supabase...");
  const loadedSettings = await loadSettings();
  global.__sendSettings = loadedSettings;
  global.__sendSettingsCacheTime = now;
  settings = loadedSettings;

  return { ...settings };
}

/**
 * Get current platform settings (synchronous version - uses cache)
 * Use this when you need synchronous access and can accept cached data
 * WARNING: This may return undefined if settings haven't been loaded yet
 */
export function getSettingsSync(): PlatformSettings | null {
  if (global.__sendSettings) {
    return { ...global.__sendSettings };
  }
  // Return null if cache not available - caller should use async getSettings() instead
  console.warn("[Settings] getSettingsSync() called but no cached settings available. Use getSettings() instead.");
  return null;
}

/**
 * Get current exchange rate (async - loads from database if cache expired)
 */
export async function getExchangeRate(): Promise<number> {
  const loadedSettings = await getSettings();
  return loadedSettings.exchangeRate;
}

/**
 * Get current exchange rate (synchronous - uses cache)
 * Use this when you need synchronous access and can accept cached data
 * WARNING: This may throw if settings haven't been loaded yet
 */
export function getExchangeRateSync(): number {
  const cachedSettings = getSettingsSync();
  if (!cachedSettings) {
    console.warn("[Settings] getExchangeRateSync() called but no cached settings. Returning default rate.");
    return defaultRate;
  }
  return cachedSettings.exchangeRate;
}

/**
 * Update exchange rate
 */
export async function updateExchangeRate(
  rate: number,
  updatedBy?: string
): Promise<PlatformSettings> {
  if (rate <= 0) {
    throw new Error("Exchange rate must be greater than 0");
  }

  // Load current settings first to get old rate
  const currentSettings = settings || await getSettings();
  const oldRate = currentSettings.exchangeRate;
  
  // Create new settings object (preserve transactionsEnabled and minimumPurchase)
  const newSettings: PlatformSettings = {
    exchangeRate: rate,
    transactionsEnabled: currentSettings.transactionsEnabled !== false,
    minimumPurchase: currentSettings.minimumPurchase || 3000,
    updatedAt: new Date(),
    updatedBy,
  };
  
  // Update both local and global reference
  settings = newSettings;
  global.__sendSettings = newSettings;
  global.__sendSettingsCacheTime = Date.now();
  
  // Save to Supabase for persistence across server restarts
  await saveSettings(newSettings);

  console.log(`[Settings] Exchange rate updated: ${oldRate} -> ${rate} by ${updatedBy || 'system'}`);
  console.log(`[Settings] Settings saved to Supabase`);
  
  return { ...newSettings };
}

/**
 * Reset to default exchange rate
 */
export async function resetExchangeRate(): Promise<PlatformSettings> {
  const defaultRate = parseFloat(process.env.SEND_NGN_EXCHANGE_RATE || "50");
  return await updateExchangeRate(defaultRate);
}

/**
 * Get transactions enabled status
 */
export async function getTransactionsEnabled(): Promise<boolean> {
  const loadedSettings = await getSettings();
  return loadedSettings.transactionsEnabled !== false; // Default to true if not set
}

/**
 * Update transactions enabled status
 */
export async function updateTransactionsEnabled(
  enabled: boolean,
  updatedBy?: string
): Promise<PlatformSettings> {
  const currentSettings = await getSettings();
  
  // Create new settings object (preserve minimumPurchase)
  const newSettings: PlatformSettings = {
    ...currentSettings,
    transactionsEnabled: enabled,
    minimumPurchase: currentSettings.minimumPurchase || 3000,
    updatedAt: new Date(),
    updatedBy,
  };
  
  // Update both local and global reference
  settings = newSettings;
  global.__sendSettings = newSettings;
  global.__sendSettingsCacheTime = Date.now();
  
  // Save to Supabase
  await saveSettings(newSettings);

  console.log(`[Settings] Transactions ${enabled ? 'enabled' : 'disabled'} by ${updatedBy || 'system'}`);
  
  return { ...newSettings };
}

/**
 * Get minimum purchase amount
 */
export async function getMinimumPurchase(): Promise<number> {
  const loadedSettings = await getSettings();
  return loadedSettings.minimumPurchase || 3000;
}

/**
 * Update minimum purchase amount
 */
export async function updateMinimumPurchase(
  amount: number,
  updatedBy?: string
): Promise<PlatformSettings> {
  if (amount <= 0) {
    throw new Error("Minimum purchase amount must be greater than 0");
  }

  const currentSettings = await getSettings();
  
  const newSettings: PlatformSettings = {
    ...currentSettings,
    minimumPurchase: amount,
    updatedAt: new Date(),
    updatedBy,
  };
  
  settings = newSettings;
  global.__sendSettings = newSettings;
  global.__sendSettingsCacheTime = Date.now();
  
  await saveSettings(newSettings);

  console.log(`[Settings] Minimum purchase updated: ${currentSettings.minimumPurchase || 3000} -> ${amount} by ${updatedBy || 'system'}`);
  
  return { ...newSettings };
}
