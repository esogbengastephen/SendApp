// In-memory storage for platform settings
// In production, this should be stored in a database

interface PlatformSettings {
  exchangeRate: number;
  updatedAt: Date;
  updatedBy?: string;
}

let settings: PlatformSettings = {
  exchangeRate: parseFloat(process.env.SEND_NGN_EXCHANGE_RATE || "50"),
  updatedAt: new Date(),
};

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

  settings = {
    exchangeRate: rate,
    updatedAt: new Date(),
    updatedBy,
  };

  return { ...settings };
}

/**
 * Reset to default exchange rate
 */
export function resetExchangeRate(): PlatformSettings {
  const defaultRate = parseFloat(process.env.SEND_NGN_EXCHANGE_RATE || "50");
  return updateExchangeRate(defaultRate);
}

