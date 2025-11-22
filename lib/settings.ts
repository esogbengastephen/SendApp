// In-memory storage for platform settings
// In production, this should be stored in a database
// Note: In Next.js, this module is shared across all requests in the same process

interface PlatformSettings {
  exchangeRate: number;
  updatedAt: Date;
  updatedBy?: string;
}

// Initialize with default rate from environment or constant
const defaultRate = parseFloat(process.env.SEND_NGN_EXCHANGE_RATE || "50");

// Use a global object to ensure it's shared across all module instances
declare global {
  // eslint-disable-next-line no-var
  var __sendSettings: PlatformSettings | undefined;
}

// Initialize settings - use global to persist across hot reloads in development
if (!global.__sendSettings) {
  global.__sendSettings = {
    exchangeRate: defaultRate,
    updatedAt: new Date(),
  };
  console.log(`[Settings] Initialized with exchange rate: ${defaultRate}`);
}

// Reference the global settings
let settings: PlatformSettings = global.__sendSettings;

/**
 * Get current platform settings
 */
export function getSettings(): PlatformSettings {
  // Always read from global to ensure we get the latest value
  if (global.__sendSettings) {
    settings = global.__sendSettings;
  }
  return { ...settings };
}

/**
 * Get current exchange rate
 */
export function getExchangeRate(): number {
  // Always read from global to ensure we get the latest value
  if (global.__sendSettings) {
    settings = global.__sendSettings;
  }
  return settings.exchangeRate;
}

/**
 * Update exchange rate
 */
export function updateExchangeRate(
  rate: number,
  updatedBy?: string
): PlatformSettings {
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

  console.log(`[Settings] Exchange rate updated: ${oldRate} -> ${rate} by ${updatedBy || 'system'}`);
  console.log(`[Settings] Current settings object:`, settings);
  
  return { ...settings };
}

/**
 * Reset to default exchange rate
 */
export function resetExchangeRate(): PlatformSettings {
  const defaultRate = parseFloat(process.env.SEND_NGN_EXCHANGE_RATE || "50");
  return updateExchangeRate(defaultRate);
}

