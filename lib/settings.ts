// Persistent storage for platform settings using file system
// Settings are saved to a JSON file to persist across server restarts

import fs from "fs";
import path from "path";

interface PlatformSettings {
  exchangeRate: number;
  updatedAt: Date;
  updatedBy?: string;
}

// Path to settings file
const SETTINGS_FILE_PATH = path.join(process.cwd(), ".settings.json");

// Initialize with default rate from environment or constant
const defaultRate = parseFloat(process.env.SEND_NGN_EXCHANGE_RATE || "50");

// Use a global object to ensure it's shared across all module instances
declare global {
  // eslint-disable-next-line no-var
  var __sendSettings: PlatformSettings | undefined;
  // eslint-disable-next-line no-var
  var __sendSettingsLoaded: boolean | undefined;
}

/**
 * Load settings from file, or create default if file doesn't exist
 */
function loadSettings(): PlatformSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      const fileContent = fs.readFileSync(SETTINGS_FILE_PATH, "utf-8");
      const parsed = JSON.parse(fileContent);
      return {
        exchangeRate: parsed.exchangeRate || defaultRate,
        updatedAt: parsed.updatedAt ? new Date(parsed.updatedAt) : new Date(),
        updatedBy: parsed.updatedBy,
      };
    }
  } catch (error) {
    console.error("[Settings] Error loading settings file:", error);
  }
  
  // Return default settings if file doesn't exist or error occurred
  return {
    exchangeRate: defaultRate,
    updatedAt: new Date(),
  };
}

/**
 * Save settings to file
 */
function saveSettings(settings: PlatformSettings): void {
  try {
    const dataToSave = {
      exchangeRate: settings.exchangeRate,
      updatedAt: settings.updatedAt.toISOString(),
      updatedBy: settings.updatedBy,
    };
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(dataToSave, null, 2), "utf-8");
    console.log(`[Settings] Saved settings to file: ${SETTINGS_FILE_PATH}`);
  } catch (error) {
    console.error("[Settings] Error saving settings file:", error);
  }
}

// Initialize settings - load from file or use default
if (!global.__sendSettingsLoaded) {
  const loadedSettings = loadSettings();
  global.__sendSettings = loadedSettings;
  global.__sendSettingsLoaded = true;
  console.log(`[Settings] Initialized with exchange rate: ${loadedSettings.exchangeRate} (from ${fs.existsSync(SETTINGS_FILE_PATH) ? 'file' : 'default'})`);
}

// Reference the global settings
let settings: PlatformSettings = global.__sendSettings!;

/**
 * Get current platform settings
 */
export function getSettings(): PlatformSettings {
  // Always read from global to ensure we get the latest value
  if (global.__sendSettings) {
    settings = global.__sendSettings;
  } else {
    // Reload from file if global is not set
    settings = loadSettings();
    global.__sendSettings = settings;
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
  } else {
    // Reload from file if global is not set
    settings = loadSettings();
    global.__sendSettings = settings;
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
  
  // Save to file for persistence across server restarts
  saveSettings(settings);

  console.log(`[Settings] Exchange rate updated: ${oldRate} -> ${rate} by ${updatedBy || 'system'}`);
  console.log(`[Settings] Settings saved to file`);
  
  return { ...settings };
}

/**
 * Reset to default exchange rate
 */
export function resetExchangeRate(): PlatformSettings {
  const defaultRate = parseFloat(process.env.SEND_NGN_EXCHANGE_RATE || "50");
  return updateExchangeRate(defaultRate);
}
