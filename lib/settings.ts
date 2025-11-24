// Persistent storage for platform settings using Supabase
// Settings are saved to Supabase database to persist across server restarts and work in serverless environments

import { supabase } from "./supabase";

interface PlatformSettings {
  exchangeRate: number;
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
 */
async function loadSettings(): Promise<PlatformSettings> {
  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("setting_value")
      .eq("setting_key", "exchange_rate")
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" error, which is fine
      console.error("[Settings] Error loading from Supabase:", error);
      // Fall back to default
      return {
        exchangeRate: defaultRate,
        updatedAt: new Date(),
      };
    }

    if (data && data.setting_value) {
      const value = data.setting_value as any;
      return {
        exchangeRate: value.exchangeRate || defaultRate,
        updatedAt: value.updatedAt ? new Date(value.updatedAt) : new Date(),
        updatedBy: value.updatedBy,
      };
    }

    // If no settings found, create default in database
    const defaultSettings: PlatformSettings = {
      exchangeRate: defaultRate,
      updatedAt: new Date(),
      updatedBy: "system",
    };

    // Try to insert default settings (ignore if already exists)
    await supabase
      .from("platform_settings")
      .upsert({
        setting_key: "exchange_rate",
        setting_value: {
          exchangeRate: defaultSettings.exchangeRate,
          updatedAt: defaultSettings.updatedAt.toISOString(),
          updatedBy: defaultSettings.updatedBy,
        },
        updated_by: "system",
      }, {
        onConflict: "setting_key",
      });

    return defaultSettings;
  } catch (error) {
    console.error("[Settings] Error loading settings:", error);
    // Fall back to default
    return {
      exchangeRate: defaultRate,
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

// Initialize default settings in memory
if (!global.__sendSettings) {
  global.__sendSettings = {
    exchangeRate: defaultRate,
    updatedAt: new Date(),
  };
}

// Reference the global settings
let settings: PlatformSettings = global.__sendSettings!;

/**
 * Get current platform settings (with caching)
 */
export async function getSettings(): Promise<PlatformSettings> {
  // Check if cache is still valid
  const now = Date.now();
  const cacheTime = global.__sendSettingsCacheTime || 0;
  const isCacheValid = global.__sendSettings && (now - cacheTime) < CACHE_DURATION;

  if (isCacheValid && global.__sendSettings) {
    return { ...global.__sendSettings };
  }

  // Load from database
  const loadedSettings = await loadSettings();
  global.__sendSettings = loadedSettings;
  global.__sendSettingsCacheTime = now;
  settings = loadedSettings;

  return { ...settings };
}

/**
 * Get current platform settings (synchronous version - uses cache)
 * Use this when you need synchronous access and can accept cached data
 */
export function getSettingsSync(): PlatformSettings {
  if (global.__sendSettings) {
    return { ...global.__sendSettings };
  }
  // Return default if cache not available
  return {
    exchangeRate: defaultRate,
    updatedAt: new Date(),
  };
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
 */
export function getExchangeRateSync(): number {
  const cachedSettings = getSettingsSync();
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

  const oldRate = settings.exchangeRate;
  
  // Update both local and global reference
  settings = {
    exchangeRate: rate,
    updatedAt: new Date(),
    updatedBy,
  };
  
  // Also update global to ensure persistence
  global.__sendSettings = settings;
  
  // Save to Supabase for persistence across server restarts
  await saveSettings(settings);

  console.log(`[Settings] Exchange rate updated: ${oldRate} -> ${rate} by ${updatedBy || 'system'}`);
  console.log(`[Settings] Settings saved to Supabase`);
  
  return { ...settings };
}

/**
 * Reset to default exchange rate
 */
export async function resetExchangeRate(): Promise<PlatformSettings> {
  const defaultRate = parseFloat(process.env.SEND_NGN_EXCHANGE_RATE || "50");
  return await updateExchangeRate(defaultRate);
}
