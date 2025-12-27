/**
 * HD Wallet utility for generating unique wallet addresses for off-ramp transactions
 * Uses BIP44 derivation path: m/44'/60'/0'/0/{index}
 * 
 * Each user gets a unique, persistent wallet address derived from a master seed.
 * The same user will always get the same wallet address across all transactions.
 * This allows users to reuse the same wallet address for all their off-ramp transactions.
 */

import { ethers } from "ethers";

const MASTER_MNEMONIC = process.env.OFFRAMP_MASTER_MNEMONIC;
const ADMIN_WALLET = process.env.OFFRAMP_ADMIN_WALLET_ADDRESS;
const RECEIVER_WALLET = process.env.OFFRAMP_RECEIVER_WALLET_ADDRESS; // Where final USDC goes after swap
const MASTER_WALLET_PRIVATE_KEY = process.env.OFFRAMP_MASTER_WALLET_PRIVATE_KEY; // Optional: custom master wallet private key

// DEBUG: Log exactly what we're getting
console.log("[DEBUG] MASTER_MNEMONIC length:", MASTER_MNEMONIC?.length || 0);
console.log("[DEBUG] MASTER_MNEMONIC word count:", MASTER_MNEMONIC?.split(/\s+/).length || 0);
console.log("[DEBUG] MASTER_MNEMONIC first word:", MASTER_MNEMONIC?.split(/\s+/)[0] || "NONE");
console.log("[DEBUG] MASTER_MNEMONIC last word:", MASTER_MNEMONIC?.split(/\s+/).slice(-1)[0] || "NONE");

if (!MASTER_MNEMONIC) {
  console.warn("⚠️ OFFRAMP_MASTER_MNEMONIC environment variable is not set. Off-ramp wallet generation will fail.");
} else {
  // Validate mnemonic on module load
  try {
    const mnemonic = ethers.Mnemonic.fromPhrase(MASTER_MNEMONIC);
    const seed = mnemonic.computeSeed();
    const rootNode = ethers.HDNodeWallet.fromSeed(seed);
    const testWallet = rootNode.derivePath("m/44'/60'/0'/0/0");
    console.log("✅ OFFRAMP_MASTER_MNEMONIC is valid. Master address:", testWallet.address);
  } catch (error) {
    console.error("❌ OFFRAMP_MASTER_MNEMONIC is INVALID:", error instanceof Error ? error.message : "Unknown error");
    console.error("   Please generate a new valid BIP39 mnemonic phrase (12 or 24 words)");
  }
}

if (!ADMIN_WALLET) {
  console.warn("⚠️ OFFRAMP_ADMIN_WALLET_ADDRESS environment variable is not set. Off-ramp payment processing will fail.");
}

if (!RECEIVER_WALLET) {
  console.warn("⚠️ OFFRAMP_RECEIVER_WALLET_ADDRESS environment variable is not set. USDC transfers will fail.");
}

/**
 * Generate a unique wallet address for a user (persistent across transactions)
 * Same user will always get the same wallet address
 * @param userIdentifier - User ID (UUID), email, or guest identifier
 * @returns Wallet address and private key (for monitoring)
 */
export function generateUserOfframpWallet(userIdentifier: string): {
  address: string;
  privateKey: string;
  derivationPath: string;
} {
  if (!MASTER_MNEMONIC) {
    throw new Error("OFFRAMP_MASTER_MNEMONIC environment variable is required");
  }

  try {
    // Use user identifier hash as derivation index
    // This ensures the same user always gets the same wallet address
    const indexHash = ethers.keccak256(ethers.toUtf8Bytes(`user_${userIdentifier.toLowerCase()}`));
    // Convert hash to a number within valid BIP44 range (0 to 2^31 - 1)
    const indexNumber = BigInt(indexHash) % BigInt(2147483647);

    // Derive wallet using BIP44 path: m/44'/60'/0'/0/{index}
    // 44' = BIP44 standard
    // 60' = Ethereum coin type
    // 0' = Account
    // 0 = Change (external addresses)
    // {index} = Address index
    const derivationPath = `m/44'/60'/0'/0/${indexNumber}`;
    
    // Create root HD node from mnemonic seed
    const mnemonic = ethers.Mnemonic.fromPhrase(MASTER_MNEMONIC);
    const seed = mnemonic.computeSeed();
    const rootNode = ethers.HDNodeWallet.fromSeed(seed);
    
    // Derive the specific wallet for this user using the full BIP44 path
    const wallet = rootNode.derivePath(derivationPath);

    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      derivationPath,
    };
  } catch (error) {
    console.error("[OffRamp Wallet] Error generating user wallet:", error);
    throw new Error(`Failed to generate user off-ramp wallet: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Generate a unique wallet address for an off-ramp transaction (DEPRECATED - use generateUserOfframpWallet)
 * @param transactionId - Unique transaction ID (e.g., "offramp_abc123")
 * @returns Wallet address and private key (for monitoring)
 * @deprecated Use generateUserOfframpWallet instead for user-based wallets
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
    const derivationPath = `m/44'/60'/0'/0/${indexNumber}`;
    
    // Create root HD node from mnemonic seed
    const mnemonic = ethers.Mnemonic.fromPhrase(MASTER_MNEMONIC);
    const seed = mnemonic.computeSeed();
    const rootNode = ethers.HDNodeWallet.fromSeed(seed);
    
    // Derive the specific wallet for this transaction using the full BIP44 path
    const wallet = rootNode.derivePath(derivationPath);

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
 * Get receiver wallet address (where final USDC will be sent after swap)
 * This is the wallet that receives USDC from the unique transaction wallet
 */
export function getReceiverWalletAddress(): string {
  if (!RECEIVER_WALLET) {
    throw new Error("OFFRAMP_RECEIVER_WALLET_ADDRESS environment variable is required");
  }
  return RECEIVER_WALLET;
}

/**
 * Get master wallet (used as gas reserve)
 * If OFFRAMP_MASTER_WALLET_PRIVATE_KEY is set, uses that wallet
 * Otherwise, uses the first wallet from mnemonic (m/44'/60'/0'/0/0)
 * This wallet should be funded with ETH to pay for gas fees
 */
export function getMasterWallet(): {
  address: string;
  privateKey: string;
} {
  // If custom master wallet private key is provided, use it
  if (MASTER_WALLET_PRIVATE_KEY) {
    try {
      const wallet = new ethers.Wallet(MASTER_WALLET_PRIVATE_KEY);
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
      };
    } catch (error) {
      console.error("[OffRamp Wallet] Error creating wallet from private key:", error);
      throw new Error(`Failed to create master wallet from private key: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  // Otherwise, use the first wallet from mnemonic
  if (!MASTER_MNEMONIC) {
    throw new Error("OFFRAMP_MASTER_MNEMONIC environment variable is required (or set OFFRAMP_MASTER_WALLET_PRIVATE_KEY)");
  }

  try {
    const mnemonic = ethers.Mnemonic.fromPhrase(MASTER_MNEMONIC);
    const seed = mnemonic.computeSeed();
    const rootNode = ethers.HDNodeWallet.fromSeed(seed);
    // Master wallet is at m/44'/60'/0'/0/0 (first address)
    const masterWallet = rootNode.derivePath("m/44'/60'/0'/0/0");

    return {
      address: masterWallet.address,
      privateKey: masterWallet.privateKey,
    };
  } catch (error) {
    console.error("[OffRamp Wallet] Error getting master wallet:", error);
    throw new Error(`Failed to get master wallet: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
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

