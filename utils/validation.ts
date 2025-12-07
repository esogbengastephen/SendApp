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
 * Validates NGN amount (minimum from settings)
 * @param amount - The amount string to validate
 * @param minimum - The minimum purchase amount (defaults to 3000)
 */
export function isValidAmount(amount: string, minimum: number = 3000): boolean {
  const num = parseFloat(amount);
  return !isNaN(num) && num >= minimum;
}

