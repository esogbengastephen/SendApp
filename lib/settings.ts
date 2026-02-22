// Persistent storage for platform settings using Supabase
// Settings are saved to Supabase database to persist across server restarts and work in serverless environments

import { supabase } from "./supabase";

interface PlatformSettings {
  exchangeRate: number;
  transactionsEnabled: boolean;
  onrampEnabled: boolean;
  offrampEnabled: boolean;
  minimumPurchase: number;
  /** Minimum $SEND to sell for offramp (crypto → NGN). Default 1. */
  minimumOfframpSEND?: number;
  /** Buy profit margins in NGN (onramp: NGN → crypto) */
  profitNgnSend?: number;
  profitNgnUsdc?: number;
  profitNgnUsdt?: number;
  /** Sell profit margins in NGN (offramp: crypto → NGN) */
  profitNgnSendSell?: number;
  profitNgnUsdcSell?: number;
  profitNgnUsdtSell?: number;
  /** Sell rates: 1 SEND = sendToNgnSell NGN; 1 USDC = usdcSellPriceNgn NGN; 1 USDT = usdtSellPriceNgn NGN */
  sendToNgnSell?: number;
  usdcSellPriceNgn?: number;
  usdtSellPriceNgn?: number;
  /** When true, CoinGecko + buy profit is auto-published every 30s (onramp) */
  coingeckoAutoPublish?: boolean;
  /** When true, CoinGecko + sell profit is auto-published every 30s (offramp) */
  coingeckoAutoPublishSell?: boolean;
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
        transactionsEnabled: true,
        onrampEnabled: true,
        offrampEnabled: true,
        minimumPurchase: 3000,
        minimumOfframpSEND: 1,
        profitNgnSend: 0,
        profitNgnUsdc: 0,
        profitNgnUsdt: 0,
        profitNgnSendSell: 0,
        profitNgnUsdcSell: 0,
        profitNgnUsdtSell: 0,
        coingeckoAutoPublish: false,
        coingeckoAutoPublishSell: false,
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
            onrampEnabled: defaultSettings.onrampEnabled,
            offrampEnabled: defaultSettings.offrampEnabled,
            minimumPurchase: defaultSettings.minimumPurchase,
            minimumOfframpSEND: defaultSettings.minimumOfframpSEND ?? 1,
            profitNgnSend: defaultSettings.profitNgnSend ?? 0,
            profitNgnUsdc: defaultSettings.profitNgnUsdc ?? 0,
            profitNgnUsdt: defaultSettings.profitNgnUsdt ?? 0,
            profitNgnSendSell: defaultSettings.profitNgnSendSell ?? 0,
            profitNgnUsdcSell: defaultSettings.profitNgnUsdcSell ?? 0,
            profitNgnUsdtSell: defaultSettings.profitNgnUsdtSell ?? 0,
        coingeckoAutoPublish: defaultSettings.coingeckoAutoPublish ?? false,
        coingeckoAutoPublishSell: defaultSettings.coingeckoAutoPublishSell ?? false,
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
        onrampEnabled: value.onrampEnabled !== undefined ? value.onrampEnabled : true,
        offrampEnabled: value.offrampEnabled !== undefined ? value.offrampEnabled : true,
        minimumPurchase: value.minimumPurchase !== undefined ? value.minimumPurchase : 3000,
        minimumOfframpSEND: value.minimumOfframpSEND !== undefined ? Number(value.minimumOfframpSEND) : 1,
        profitNgnSend: value.profitNgnSend !== undefined ? Number(value.profitNgnSend) : 0,
        profitNgnUsdc: value.profitNgnUsdc !== undefined ? Number(value.profitNgnUsdc) : 0,
        profitNgnUsdt: value.profitNgnUsdt !== undefined ? Number(value.profitNgnUsdt) : 0,
        profitNgnSendSell: value.profitNgnSendSell !== undefined ? Number(value.profitNgnSendSell) : 0,
        profitNgnUsdcSell: value.profitNgnUsdcSell !== undefined ? Number(value.profitNgnUsdcSell) : 0,
        profitNgnUsdtSell: value.profitNgnUsdtSell !== undefined ? Number(value.profitNgnUsdtSell) : 0,
        sendToNgnSell: value.sendToNgnSell !== undefined ? Number(value.sendToNgnSell) : undefined,
        usdcSellPriceNgn: value.usdcSellPriceNgn !== undefined ? Number(value.usdcSellPriceNgn) : undefined,
        usdtSellPriceNgn: value.usdtSellPriceNgn !== undefined ? Number(value.usdtSellPriceNgn) : undefined,
        coingeckoAutoPublish: value.coingeckoAutoPublish === true,
        coingeckoAutoPublishSell: value.coingeckoAutoPublishSell === true,
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
      onrampEnabled: true,
      offrampEnabled: true,
      minimumPurchase: 3000,
      minimumOfframpSEND: 1,
      profitNgnSend: 0,
      profitNgnUsdc: 0,
      profitNgnUsdt: 0,
      profitNgnSendSell: 0,
      profitNgnUsdcSell: 0,
      profitNgnUsdtSell: 0,
      coingeckoAutoPublish: false,
      coingeckoAutoPublishSell: false,
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
          onrampEnabled: settings.onrampEnabled,
          offrampEnabled: settings.offrampEnabled,
          minimumPurchase: settings.minimumPurchase,
          minimumOfframpSEND: settings.minimumOfframpSEND ?? 1,
          profitNgnSend: settings.profitNgnSend ?? 0,
          profitNgnUsdc: settings.profitNgnUsdc ?? 0,
          profitNgnUsdt: settings.profitNgnUsdt ?? 0,
          profitNgnSendSell: settings.profitNgnSendSell ?? 0,
          profitNgnUsdcSell: settings.profitNgnUsdcSell ?? 0,
          profitNgnUsdtSell: settings.profitNgnUsdtSell ?? 0,
          sendToNgnSell: settings.sendToNgnSell,
          usdcSellPriceNgn: settings.usdcSellPriceNgn,
          usdtSellPriceNgn: settings.usdtSellPriceNgn,
          coingeckoAutoPublish: settings.coingeckoAutoPublish ?? false,
          coingeckoAutoPublishSell: settings.coingeckoAutoPublishSell ?? false,
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
 * Get platform settings without using cache (always loads from DB).
 * Use when fresh data is critical (e.g. token-prices after admin saves sell rates).
 */
export async function getSettingsNoCache(): Promise<PlatformSettings> {
  const loadedSettings = await loadSettings();
  global.__sendSettings = loadedSettings;
  global.__sendSettingsCacheTime = Date.now();
  return { ...loadedSettings };
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
  
  // Create new settings object (preserve transactionsEnabled, onramp/offramp, minimumPurchase, profit, autoPublish)
  const newSettings: PlatformSettings = {
    ...currentSettings,
    exchangeRate: rate,
    transactionsEnabled: currentSettings.transactionsEnabled !== false,
    onrampEnabled: currentSettings.onrampEnabled !== false,
    offrampEnabled: currentSettings.offrampEnabled !== false,
    minimumPurchase: currentSettings.minimumPurchase || 3000,
    minimumOfframpSEND: currentSettings.minimumOfframpSEND ?? 1,
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
  
  // Create new settings object (preserve minimumPurchase, onramp/offramp)
  const newSettings: PlatformSettings = {
    ...currentSettings,
    transactionsEnabled: enabled,
    minimumPurchase: currentSettings.minimumPurchase || 3000,
    minimumOfframpSEND: currentSettings.minimumOfframpSEND ?? 1,
    updatedAt: new Date(),
    updatedBy,
  };
  
  // Update both local and global reference
  settings = newSettings;
  global.__sendSettings = newSettings;
  global.__sendSettingsCacheTime = Date.now();
  
  // Save to Supabase
  await saveSettings(newSettings);

  console.log(`[Settings] Transactions (global) ${enabled ? 'enabled' : 'disabled'} by ${updatedBy || 'system'}`);
  
  return { ...newSettings };
}

/**
 * Get onramp (buy) enabled status. Effective onramp = global AND onrampEnabled.
 */
export async function getOnrampEnabled(): Promise<boolean> {
  const loadedSettings = await getSettings();
  return loadedSettings.onrampEnabled !== false;
}

/**
 * Get offramp (sell) enabled status. Effective offramp = global AND offrampEnabled.
 */
export async function getOfframpEnabled(): Promise<boolean> {
  const loadedSettings = await getSettings();
  return loadedSettings.offrampEnabled !== false;
}

/**
 * Effective onramp: user can buy (onramp) only when global AND onramp are enabled.
 */
export async function getOnrampTransactionsEnabled(): Promise<boolean> {
  const [global, onramp] = await Promise.all([getTransactionsEnabled(), getOnrampEnabled()]);
  return global && onramp;
}

/**
 * Effective offramp: user can sell (offramp) only when global AND offramp are enabled.
 */
export async function getOfframpTransactionsEnabled(): Promise<boolean> {
  const [global, offramp] = await Promise.all([getTransactionsEnabled(), getOfframpEnabled()]);
  return global && offramp;
}

/**
 * Update onramp (buy) enabled status.
 */
export async function updateOnrampEnabled(
  enabled: boolean,
  updatedBy?: string
): Promise<PlatformSettings> {
  const currentSettings = await getSettings();
  const newSettings: PlatformSettings = {
    ...currentSettings,
    onrampEnabled: enabled,
    updatedAt: new Date(),
    updatedBy,
  };
  settings = newSettings;
  global.__sendSettings = newSettings;
  global.__sendSettingsCacheTime = Date.now();
  await saveSettings(newSettings);
  console.log(`[Settings] Onramp (buy) ${enabled ? 'enabled' : 'disabled'} by ${updatedBy || 'system'}`);
  return { ...newSettings };
}

/**
 * Update offramp (sell) enabled status.
 */
export async function updateOfframpEnabled(
  enabled: boolean,
  updatedBy?: string
): Promise<PlatformSettings> {
  const currentSettings = await getSettings();
  const newSettings: PlatformSettings = {
    ...currentSettings,
    offrampEnabled: enabled,
    updatedAt: new Date(),
    updatedBy,
  };
  settings = newSettings;
  global.__sendSettings = newSettings;
  global.__sendSettingsCacheTime = Date.now();
  await saveSettings(newSettings);
  console.log(`[Settings] Offramp (sell) ${enabled ? 'enabled' : 'disabled'} by ${updatedBy || 'system'}`);
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
    minimumOfframpSEND: currentSettings.minimumOfframpSEND ?? 1,
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

/**
 * Get minimum offramp sell amount ($SEND).
 */
export async function getMinimumOfframpSEND(): Promise<number> {
  const loadedSettings = await getSettings();
  return loadedSettings.minimumOfframpSEND ?? 1;
}

/**
 * Update minimum offramp sell amount ($SEND).
 */
export async function updateMinimumOfframpSEND(
  amount: number,
  updatedBy?: string
): Promise<PlatformSettings> {
  if (amount <= 0) {
    throw new Error("Minimum offramp amount must be greater than 0");
  }

  const currentSettings = await getSettings();

  const newSettings: PlatformSettings = {
    ...currentSettings,
    minimumOfframpSEND: amount,
    updatedAt: new Date(),
    updatedBy,
  };

  settings = newSettings;
  global.__sendSettings = newSettings;
  global.__sendSettingsCacheTime = Date.now();

  await saveSettings(newSettings);

  console.log(`[Settings] Minimum offramp SEND updated: ${currentSettings.minimumOfframpSEND ?? 1} -> ${amount} by ${updatedBy || "system"}`);

  return { ...newSettings };
}

/**
 * Get buy profit margins (NGN) – used when publishing CoinGecko for buy (onramp).
 */
export async function getProfitMargins(): Promise<{ profitNgnSend: number; profitNgnUsdc: number; profitNgnUsdt: number }> {
  const s = await getSettings();
  return {
    profitNgnSend: s.profitNgnSend ?? 0,
    profitNgnUsdc: s.profitNgnUsdc ?? 0,
    profitNgnUsdt: s.profitNgnUsdt ?? 0,
  };
}

/**
 * Get sell profit margins (NGN) – used when publishing CoinGecko for sell (offramp).
 */
export async function getProfitMarginsSell(): Promise<{ profitNgnSendSell: number; profitNgnUsdcSell: number; profitNgnUsdtSell: number }> {
  const s = await getSettings();
  return {
    profitNgnSendSell: s.profitNgnSendSell ?? 0,
    profitNgnUsdcSell: s.profitNgnUsdcSell ?? 0,
    profitNgnUsdtSell: s.profitNgnUsdtSell ?? 0,
  };
}

/**
 * Update buy profit margins (NGN). Applied when publishing CoinGecko for buy.
 */
export async function updateProfitMargins(
  profitNgnSend: number,
  profitNgnUsdc: number,
  profitNgnUsdt: number,
  updatedBy?: string
): Promise<PlatformSettings> {
  const currentSettings = await getSettings();
  const newSettings: PlatformSettings = {
    ...currentSettings,
    profitNgnSend: Math.max(0, Number(profitNgnSend) || 0),
    profitNgnUsdc: Math.max(0, Number(profitNgnUsdc) || 0),
    profitNgnUsdt: Math.max(0, Number(profitNgnUsdt) || 0),
    updatedAt: new Date(),
    updatedBy,
  };
  settings = newSettings;
  global.__sendSettings = newSettings;
  global.__sendSettingsCacheTime = Date.now();
  await saveSettings(newSettings);
  console.log(`[Settings] Buy profit margins updated by ${updatedBy || 'system'}`);
  return { ...newSettings };
}

/**
 * Update sell profit margins (NGN). Applied when publishing CoinGecko for sell.
 */
export async function updateProfitMarginsSell(
  profitNgnSendSell: number,
  profitNgnUsdcSell: number,
  profitNgnUsdtSell: number,
  updatedBy?: string
): Promise<PlatformSettings> {
  const currentSettings = await getSettings();
  const newSettings: PlatformSettings = {
    ...currentSettings,
    profitNgnSendSell: Math.max(0, Number(profitNgnSendSell) || 0),
    profitNgnUsdcSell: Math.max(0, Number(profitNgnUsdcSell) || 0),
    profitNgnUsdtSell: Math.max(0, Number(profitNgnUsdtSell) || 0),
    updatedAt: new Date(),
    updatedBy,
  };
  settings = newSettings;
  global.__sendSettings = newSettings;
  global.__sendSettingsCacheTime = Date.now();
  await saveSettings(newSettings);
  console.log(`[Settings] Sell profit margins updated by ${updatedBy || 'system'}`);
  return { ...newSettings };
}

/**
 * Update sell rates (1 SEND = sendToNgnSell NGN; 1 USDC = usdcSellPriceNgn NGN; 1 USDT = usdtSellPriceNgn NGN).
 */
export async function updateSellRates(
  sendToNgnSell?: number,
  usdcSellPriceNgn?: number,
  usdtSellPriceNgn?: number,
  updatedBy?: string
): Promise<PlatformSettings> {
  const currentSettings = await getSettings();
  const newSettings: PlatformSettings = {
    ...currentSettings,
    ...(sendToNgnSell !== undefined && sendToNgnSell > 0 && { sendToNgnSell }),
    ...(usdcSellPriceNgn !== undefined && usdcSellPriceNgn > 0 && { usdcSellPriceNgn }),
    ...(usdtSellPriceNgn !== undefined && usdtSellPriceNgn > 0 && { usdtSellPriceNgn }),
    updatedAt: new Date(),
    updatedBy,
  };
  settings = newSettings;
  global.__sendSettings = newSettings;
  global.__sendSettingsCacheTime = Date.now();
  await saveSettings(newSettings);
  console.log(`[Settings] Sell rates updated by ${updatedBy || 'system'}`);
  return { ...newSettings };
}

/**
 * Get CoinGecko auto-publish setting for buy (onramp).
 */
export async function getCoingeckoAutoPublish(): Promise<boolean> {
  const s = await getSettings();
  return s.coingeckoAutoPublish === true;
}

/**
 * Update CoinGecko auto-publish for buy (when true, publish buy rates every 30s).
 */
export async function updateCoingeckoAutoPublish(
  enabled: boolean,
  updatedBy?: string
): Promise<PlatformSettings> {
  const currentSettings = await getSettings();
  const newSettings: PlatformSettings = {
    ...currentSettings,
    coingeckoAutoPublish: enabled,
    updatedAt: new Date(),
    updatedBy,
  };
  settings = newSettings;
  global.__sendSettings = newSettings;
  global.__sendSettingsCacheTime = Date.now();
  await saveSettings(newSettings);
  console.log(`[Settings] CoinGecko auto-publish (buy) ${enabled ? 'enabled' : 'disabled'} by ${updatedBy || 'system'}`);
  return { ...newSettings };
}

/**
 * Get CoinGecko auto-publish setting for sell (offramp).
 */
export async function getCoingeckoAutoPublishSell(): Promise<boolean> {
  const s = await getSettings();
  return s.coingeckoAutoPublishSell === true;
}

/**
 * Update CoinGecko auto-publish for sell (when true, publish sell/offramp rates every 30s).
 */
export async function updateCoingeckoAutoPublishSell(
  enabled: boolean,
  updatedBy?: string
): Promise<PlatformSettings> {
  const currentSettings = await getSettings();
  const newSettings: PlatformSettings = {
    ...currentSettings,
    coingeckoAutoPublishSell: enabled,
    updatedAt: new Date(),
    updatedBy,
  };
  settings = newSettings;
  global.__sendSettings = newSettings;
  global.__sendSettingsCacheTime = Date.now();
  await saveSettings(newSettings);
  console.log(`[Settings] CoinGecko auto-publish (sell/offramp) ${enabled ? 'enabled' : 'disabled'} by ${updatedBy || 'system'}`);
  return { ...newSettings };
}
