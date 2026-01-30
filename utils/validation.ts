/**
 * Validates if a string is a valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validates if a string is a valid SendTag (starts with /)
 * Format: /username (e.g., /lightblock)
 */
export function isValidSendTag(tag: string): boolean {
  return /^\/[a-zA-Z0-9_]+$/.test(tag);
}

/**
 * Validates if input is either a wallet address or SendTag
 */
export function isValidWalletOrTag(input: string): boolean {
  return isValidAddress(input) || isValidSendTag(input);
}

/**
 * Validates if a string is a valid Solana address (base58, 32–44 chars)
 */
export function isValidSolanaAddress(address: string): boolean {
  const trimmed = address.trim();
  if (trimmed.length < 32 || trimmed.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(trimmed);
}

/**
 * Validates NGN amount (minimum from settings)
 * @param amount - The amount string to validate
 * @param minimum - The minimum purchase amount (defaults to 3000)
 */
export function isValidAmount(amount: string, minimum: number = 3000): boolean {
  const num = parseFloat(amount);
  return !isNaN(num) && num >= minimum;
}

