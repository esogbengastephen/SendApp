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

let settings: PlatformSettings = {
  exchangeRate: defaultRate,
  updatedAt: new Date(),
};

// Log initialization
console.log(`[Settings] Initialized with exchange rate: ${defaultRate}`);

/**
 * Get current platform settings
 */
export function getSettings(): PlatformSettings {
  return { ...settings };
}

/**
 * Get current exchange rate
 */
export function getExchangeRate(): number {
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
  settings = {
    exchangeRate: rate,
    updatedAt: new Date(),
    updatedBy,
  };

  console.log(`[Settings] Exchange rate updated: ${oldRate} -> ${rate} by ${updatedBy || 'system'}`);
  
  return { ...settings };
}

/**
 * Reset to default exchange rate
 */
export function resetExchangeRate(): PlatformSettings {
  const defaultRate = parseFloat(process.env.SEND_NGN_EXCHANGE_RATE || "50");
  return updateExchangeRate(defaultRate);
}

