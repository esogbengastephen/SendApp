/**
 * Coinbase Smart Wallet Integration
 * Handles smart wallet creation and management for Base network
 */

import { base } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export interface SmartWalletData {
  address: string;
  ownerPrivateKey: string;
  salt?: string;
}

/**
 * Simple encryption helper for private keys
 * Uses userId as encryption key
 */
async function encryptPrivateKey(
  privateKey: string,
  userId: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(userId),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("smart-wallet-encryption-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    encryptionKey,
    encoder.encode(privateKey)
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Simple decryption helper for private keys
 */
async function decryptPrivateKey(
  encryptedKey: string,
  userId: string
): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedKey), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(userId),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const decryptionKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("smart-wallet-encryption-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    decryptionKey,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Generate a unique smart wallet for a user on Base network
 * Note: This requires @coinbase/coinbase-sdk to be installed
 */
export async function generateSmartWalletForUser(
  userId: string,
  userEmail: string
): Promise<SmartWalletData> {
  if (!process.env.COINBASE_API_KEY_NAME || !process.env.COINBASE_API_KEY_PRIVATE_KEY || !process.env.COINBASE_APP_ID) {
    throw new Error("Coinbase Developer Platform credentials not configured. Please set COINBASE_API_KEY_NAME, COINBASE_API_KEY_PRIVATE_KEY, and COINBASE_APP_ID in environment variables.");
  }

  try {
    // Dynamic import to handle case where package isn't installed yet
    const { Coinbase, Wallet } = await import("@coinbase/coinbase-sdk");

    // Clean private key (remove quotes if present)
    const cleanPrivateKey = process.env.COINBASE_API_KEY_PRIVATE_KEY.replace(/^"|"$/g, "");

    // Configure Coinbase SDK
    Coinbase.configure({
      apiKeyName: process.env.COINBASE_API_KEY_NAME,
      privateKey: cleanPrivateKey,
    });

    // Generate deterministic salt from user ID
    const salt = `smart_wallet_${userId}`;
    
    // Generate owner private key for signing (we'll use this for wallet operations)
    // Note: In production, consider using HD wallet derivation for better security
    const ownerPrivateKey = generatePrivateKey();
    
    // Create smart wallet using Coinbase SDK
    // Note: The Wallet.create() creates a server-managed wallet
    // For smart wallets with account abstraction, we might need a different approach
    const wallet = await Wallet.create({
      networkId: "base-mainnet", // Use Base network
    });

    // Get the default address from the wallet
    const defaultAddress = await wallet.getDefaultAddress();
    
    // Extract the actual address string
    // The WalletAddress object has an addressId property that contains the 0x address
    let address: string;
    
    try {
      if (typeof defaultAddress === "string") {
        address = defaultAddress;
      } else if (defaultAddress && typeof defaultAddress === "object") {
        // WalletAddress object has addressId property
        const addressObj = defaultAddress as any;
        
        // Try different possible property names
        address = addressObj.addressId || 
                   addressObj.address || 
                   addressObj.toString?.() || 
                   String(defaultAddress);
        
        // If it's still an object string representation, extract the addressId
        if (typeof address === "string" && address.includes("addressId:")) {
          const match = address.match(/addressId:\s*['"](0x[a-fA-F0-9]{40})['"]/);
          if (match) {
            address = match[1];
          }
        }
      } else {
        address = String(defaultAddress);
      }
      
      // Extract clean 0x address if it's in a formatted string
      const addressMatch = address.match(/(0x[a-fA-F0-9]{40})/);
      if (addressMatch) {
        address = addressMatch[1];
      }
      
      // Validate address format
      if (!address || !address.startsWith("0x") || address.length !== 42) {
        throw new Error(`Invalid address format: ${address}`);
      }
    } catch (extractError: any) {
      console.error("[Smart Wallet] Address extraction error:", extractError);
      throw new Error(`Failed to extract wallet address: ${extractError.message}`);
    }

    return {
      address,
      ownerPrivateKey,
      salt,
    };
  } catch (error: any) {
    if (error.message?.includes("Cannot find module") || error.code === "MODULE_NOT_FOUND") {
      throw new Error("@coinbase/coinbase-sdk is not installed. Please run: npm install @coinbase/coinbase-sdk @coinbase/onchainkit");
    }
    throw error;
  }
}

/**
 * Get or create smart wallet for user
 */
export async function getOrCreateSmartWallet(
  userId: string,
  userEmail: string,
  existingEncryptedKey?: string,
  existingAddress?: string
): Promise<SmartWalletData> {
  // If wallet exists, decrypt and return it
  if (existingAddress && existingEncryptedKey) {
    try {
      const decryptedKey = await decryptPrivateKey(existingEncryptedKey, userId);
      
      return {
        address: existingAddress,
        ownerPrivateKey: decryptedKey,
        salt: `smart_wallet_${userId}`,
      };
    } catch (error) {
      console.error("[Smart Wallet] Error decrypting existing key:", error);
      // If decryption fails, create new wallet
    }
  }

  // Create new smart wallet
  return await generateSmartWalletForUser(userId, userEmail);
}

/**
 * Encrypt private key for storage
 */
export async function encryptWalletPrivateKey(
  privateKey: string,
  userId: string
): Promise<string> {
  return await encryptPrivateKey(privateKey, userId);
}

/**
 * Decrypt private key from storage
 */
export async function decryptWalletPrivateKey(
  encryptedKey: string,
  userId: string
): Promise<string> {
  return await decryptPrivateKey(encryptedKey, userId);
}

/**
 * Send user operation with paymaster sponsorship
 * Note: This requires @coinbase/coinbase-sdk to be installed
 */
export async function sendUserOperationWithPaymaster(
  smartWalletAddress: string,
  ownerPrivateKey: string,
  target: string,
  data: `0x${string}`,
  value?: bigint
) {
  if (!process.env.COINBASE_API_KEY_NAME || !process.env.COINBASE_API_KEY_PRIVATE_KEY) {
    throw new Error("Coinbase Developer Platform credentials not configured");
  }

  try {
    const { Coinbase, Wallet } = await import("@coinbase/coinbase-sdk");

    // Clean private key (remove quotes if present)
    const cleanPrivateKey = process.env.COINBASE_API_KEY_PRIVATE_KEY.replace(/^"|"$/g, "");

    // Configure Coinbase SDK
    Coinbase.configure({
      apiKeyName: process.env.COINBASE_API_KEY_NAME,
      privateKey: cleanPrivateKey,
    });

    // Note: For sending transactions, you would need to fetch the wallet by ID
    // or use the wallet address to find the wallet
    // This is a placeholder - actual implementation depends on your wallet management
    throw new Error("sendUserOperationWithPaymaster needs wallet ID to fetch wallet. Use Wallet.fetch(walletId) first.");

    // Example of how to send a transaction (once you have the wallet):
    // const wallet = await Wallet.fetch(walletId);
    // const transfer = await wallet.createTransfer({
    //   to: target,
    //   amount: value?.toString() || "0",
    //   assetId: "base-mainnet:0x0000000000000000000000000000000000000000", // ETH
    // });
    // const result = await transfer.execute();
    // return result;
  } catch (error: any) {
    if (error.message?.includes("Cannot find module") || error.code === "MODULE_NOT_FOUND") {
      throw new Error("@coinbase/coinbase-sdk is not installed. Please run: npm install @coinbase/coinbase-sdk @coinbase/onchainkit");
    }
    throw error;
  }
}
