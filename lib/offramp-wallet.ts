/**
 * HD Wallet utility for generating unique wallet addresses for off-ramp transactions
 * Uses BIP44 derivation path: m/44'/60'/0'/0/{index}
 * 
 * Each off-ramp transaction gets a unique wallet address derived from a master seed.
 * This allows us to track which transaction each incoming token belongs to.
 */

import { ethers } from "ethers";

const MASTER_MNEMONIC = process.env.OFFRAMP_MASTER_MNEMONIC;
const ADMIN_WALLET = process.env.OFFRAMP_ADMIN_WALLET_ADDRESS;

if (!MASTER_MNEMONIC) {
  console.warn("⚠️ OFFRAMP_MASTER_MNEMONIC environment variable is not set. Off-ramp wallet generation will fail.");
}

if (!ADMIN_WALLET) {
  console.warn("⚠️ OFFRAMP_ADMIN_WALLET_ADDRESS environment variable is not set. Off-ramp payment processing will fail.");
}

/**
 * Generate a unique wallet address for an off-ramp transaction
 * @param transactionId - Unique transaction ID (e.g., "offramp_abc123")
 * @returns Wallet address and private key (for monitoring)
 */
export function generateOfframpWallet(transactionId: string): {
  address: string;
  privateKey: string;
  derivationPath: string;
} {
  if (!MASTER_MNEMONIC) {
    throw new Error("OFFRAMP_MASTER_MNEMONIC environment variable is required");
  }

  try {
    // Use transaction ID hash as derivation index
    // This ensures deterministic but unique addresses for each transaction
    const indexHash = ethers.keccak256(ethers.toUtf8Bytes(transactionId));
    // Convert hash to a number within valid BIP44 range (0 to 2^31 - 1)
    const indexNumber = BigInt(indexHash) % BigInt(2147483647);

    // Derive wallet using BIP44 path: m/44'/60'/0'/0/{index}
    // 44' = BIP44 standard
    // 60' = Ethereum coin type
    // 0' = Account
    // 0 = Change (external addresses)
    // {index} = Address index
    const derivationPath = `m/44'/60'/0'/0/${indexNumber}`;
    
    // Create HD wallet from mnemonic
    const hdNode = ethers.HDNodeWallet.fromPhrase(MASTER_MNEMONIC);
    
    // Derive the specific wallet for this transaction
    const wallet = hdNode.derivePath(derivationPath);

    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      derivationPath,
    };
  } catch (error) {
    console.error("[OffRamp Wallet] Error generating wallet:", error);
    throw new Error(`Failed to generate off-ramp wallet: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get admin wallet address (where USDC will be received after swap)
 */
export function getAdminWalletAddress(): string {
  if (!ADMIN_WALLET) {
    throw new Error("OFFRAMP_ADMIN_WALLET_ADDRESS environment variable is required");
  }
  return ADMIN_WALLET;
}

/**
 * Verify a wallet address was derived from our master seed
 * (Optional: for validation and security checks)
 * @param address - Wallet address to verify
 * @param transactionId - Transaction ID that should generate this address
 * @returns true if address matches the derivation, false otherwise
 */
export function verifyWalletDerivation(
  address: string,
  transactionId: string
): boolean {
  try {
    const generated = generateOfframpWallet(transactionId);
    return generated.address.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Get wallet from private key (for monitoring transactions)
 * @param privateKey - Private key of the derived wallet
 * @returns Wallet instance
 */
export function getWalletFromPrivateKey(privateKey: string): ethers.Wallet {
  return new ethers.Wallet(privateKey);
}

