/**
 * Validates if a string is a valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validates if a string is a valid SendTag (starts with @)
 */
export function isValidSendTag(tag: string): boolean {
  return /^@[a-zA-Z0-9_]+$/.test(tag);
}

/**
 * Validates if input is either a wallet address or SendTag
 */
export function isValidWalletOrTag(input: string): boolean {
  return isValidAddress(input) || isValidSendTag(input);
}

/**
 * Validates NGN amount
 */
export function isValidAmount(amount: string): boolean {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0;
}

