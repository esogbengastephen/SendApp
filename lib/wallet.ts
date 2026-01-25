/**
 * Multi-chain wallet generation and management library
 * Handles BIP-39 seed generation, encryption, and multi-chain wallet derivation
 * 
 * SECURITY NOTES:
 * - Seed phrases are NEVER stored in plaintext
 * - Only encrypted seed phrases are sent to backend
 * - All encryption/decryption happens client-side
 * - Backend never sees plaintext seed phrases
 */

import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { Keypair } from "@solana/web3.js";
import { ethers } from "ethers";
import { mnemonicToSeedSync } from "bip39";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import * as bitcoin from "bitcoinjs-lib";
import { BIP32Factory } from "bip32";
import * as ecc from "tiny-secp256k1";
import { SUPPORTED_CHAINS, ChainType } from "./chains";

export interface WalletData {
  seedPhrase: string; // 12-word mnemonic (NEVER send to backend in plaintext!)
  addresses: Record<string, string>; // Chain ID -> Address mapping
  privateKeys: Record<string, string>; // Chain ID -> Private key mapping
}

/**
 * Generate a new BIP-39 seed phrase (12 words)
 * WARNING: This is generated client-side and should NEVER be sent to backend in plaintext
 */
export function generateSeedPhrase(): string {
  return bip39.generateMnemonic(128); // 12 words
}

/**
 * Validate a seed phrase
 */
export function validateSeedPhrase(seedPhrase: string): boolean {
  return bip39.validateMnemonic(seedPhrase);
}

/**
 * Derive Bitcoin wallet address from seed phrase (Native SegWit - Bech32)
 */
function deriveBitcoinAddress(seed: Buffer): { address: string; privateKey: string } {
  // Derive using BIP-84 (Native SegWit) path: m/84'/0'/0'/0/0
  const bip32 = BIP32Factory(ecc);
  const root = bip32.fromSeed(seed);
  const path = "m/84'/0'/0'/0/0";
  const child = root.derivePath(path);

  // Get public key and create native segwit address
  const { address } = bitcoin.payments.p2wpkh({
    pubkey: child.publicKey,
    network: bitcoin.networks.bitcoin,
  });

  if (!address) {
    throw new Error("Failed to generate Bitcoin address");
  }

  // Export private key in WIF format
  const privateKey = child.toWIF();

  return {
    address,
    privateKey,
  };
}

/**
 * Derive EVM wallet address from seed phrase
 * All EVM chains (Ethereum, Base, Polygon, Monad) use the same derivation path
 */
function deriveEVMAddress(seedPhrase: string): { address: string; privateKey: string } {
  try {
    console.log("[Wallet] Creating EVM wallet from seed phrase...");
    
    // In ethers v6, use fromPhrase() with the derivation path directly
    // This creates the wallet at the specified path in one step
    // The standard Ethereum path is: m/44'/60'/0'/0/0
    const derivationPath = "m/44'/60'/0'/0/0";
    console.log("[Wallet] Using derivation path:", derivationPath);
    
    // Use fromPhrase() with path - this is the correct ethers v6 API
    // It creates the wallet at the specified path directly
    const evmWallet = ethers.HDNodeWallet.fromPhrase(seedPhrase, derivationPath);
    console.log("[Wallet] ✅ EVM wallet created successfully");
    console.log("[Wallet] Wallet address:", evmWallet.address);
    console.log("[Wallet] Wallet path:", evmWallet.path);
    console.log("[Wallet] Wallet depth:", evmWallet.depth);
    
    if (!evmWallet || !evmWallet.address) {
      throw new Error("Failed to generate EVM wallet address");
    }
    
    return {
      address: evmWallet.address,
      privateKey: evmWallet.privateKey,
    };
  } catch (error: any) {
    console.error("[Wallet] ❌ Error in deriveEVMAddress:", error);
    console.error("[Wallet] Error name:", error?.name);
    console.error("[Wallet] Error message:", error?.message);
    console.error("[Wallet] Error code:", error?.code);
    console.error("[Wallet] Error stack:", error?.stack);
    throw error;
  }
}

/**
 * Derive Solana wallet address from seed phrase
 */
function deriveSolanaAddress(seed: Buffer): { address: string; privateKey: string } {
  const solanaSeed = derivePath("m/44'/501'/0'/0'", seed.toString("hex")).key;
  const solanaKeypair = Keypair.fromSeed(solanaSeed);
  return {
    address: solanaKeypair.publicKey.toBase58(),
    privateKey: Buffer.from(solanaKeypair.secretKey).toString("hex"),
  };
}

/**
 * Derive Sui wallet address from seed phrase
 */
function deriveSuiAddress(seed: Buffer): { address: string; privateKey: string } {
  try {
    console.log("[Wallet] Deriving Sui address...");
    // Sui uses Ed25519 with derivation path m/44'/784'/0'/0'/0'
    const derived = derivePath("m/44'/784'/0'/0'/0'", seed.toString("hex"));
    const suiSeed = derived.key;
    console.log("[Wallet] Sui seed derived, type:", typeof suiSeed, Array.isArray(suiSeed) ? "array" : "not array", "length:", suiSeed?.length);
    
    // Create Ed25519 keypair from seed
    // Convert seed to Uint8Array
    let seedBytes: Uint8Array;
    if (Buffer.isBuffer(suiSeed)) {
      seedBytes = new Uint8Array(suiSeed);
    } else if (Array.isArray(suiSeed)) {
      seedBytes = new Uint8Array(suiSeed);
    } else if (typeof suiSeed === "string") {
      // If it's a hex string, convert it
      seedBytes = new Uint8Array(Buffer.from(suiSeed, "hex"));
    } else {
      // Try to convert to buffer
      seedBytes = new Uint8Array(Buffer.from(suiSeed as any));
    }
    
    // Ensure we have at least 32 bytes
    if (seedBytes.length < 32) {
      throw new Error(`Sui seed is too short: ${seedBytes.length} bytes, need 32`);
    }
    
    // Use the first 32 bytes as the private key
    const privateKeyBytes = seedBytes.slice(0, 32);
    console.log("[Wallet] Creating Sui keypair from private key bytes, length:", privateKeyBytes.length);
    
    // Sui SDK: Ed25519Keypair.fromSecretKey expects a 64-byte key (32-byte private + 32-byte public)
    // We need to generate the public key from the private key first
    // For Ed25519, we can use the private key to derive the public key
    // But Sui SDK might handle 32-byte keys, let's try both
    
    let suiKeypair: any;
    try {
      // Try with 32-byte private key first
      suiKeypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      console.log("[Wallet] Sui keypair created with 32-byte key");
    } catch (error32: any) {
      console.log("[Wallet] 32-byte key failed, trying to create full 64-byte key...");
      // If that fails, we need to create a 64-byte key
      // For Ed25519, the public key is derived from the private key
      // We'll need to use a library to derive it, or create the keypair differently
      // For now, let's try using the seed directly with a different method
      throw new Error(`Failed to create Sui keypair: ${error32.message}`);
    }
    console.log("[Wallet] Sui keypair created");
    
    const address = suiKeypair.toSuiAddress();
    const privateKey = Buffer.from(suiKeypair.getSecretKey()).toString("hex");
    
    if (!address) {
      throw new Error("Sui address is undefined");
    }
    
    console.log("[Wallet] ✅ Sui address derived successfully:", address);
    return {
      address,
      privateKey,
    };
  } catch (error: any) {
    console.error("[Wallet] ❌ Error deriving Sui address:", error);
    console.error("[Wallet] Error name:", error?.name);
    console.error("[Wallet] Error message:", error?.message);
    console.error("[Wallet] Error stack:", error?.stack);
    throw error;
  }
}

/**
 * Generate wallet from seed phrase for all supported chains
 * Derives addresses for Bitcoin, Ethereum, Base, Polygon, Monad, Solana, and Sui
 * 
 * SECURITY: This function runs client-side only. The seed phrase is NEVER sent to backend.
 */
export function generateWalletFromSeed(seedPhrase: string): WalletData {
  // Validate seed phrase
  if (!validateSeedPhrase(seedPhrase)) {
    throw new Error("Invalid seed phrase");
  }

  // Generate seed from mnemonic
  const seed = mnemonicToSeedSync(seedPhrase);
  const addresses: Record<string, string> = {};
  const privateKeys: Record<string, string> = {};

  // Derive Bitcoin wallet
  try {
    const bitcoinWallet = deriveBitcoinAddress(seed);
    addresses.bitcoin = bitcoinWallet.address;
    privateKeys.bitcoin = bitcoinWallet.privateKey;
  } catch (error) {
    console.error("Error deriving Bitcoin address:", error);
  }

  // Derive EVM wallet (same address for all EVM chains)
  let evmAddress: string | undefined;
  let evmPrivateKey: string | undefined;
  try {
    console.log("[Wallet] Attempting to derive EVM address from seed phrase...");
    console.log("[Wallet] Seed phrase length:", seedPhrase.split(" ").length, "words");
    console.log("[Wallet] Ethers available:", typeof ethers !== "undefined");
    console.log("[Wallet] Ethers version:", ethers?.version || "unknown");
    
    if (typeof ethers === "undefined") {
      throw new Error("ethers library is not available");
    }
    
    const evmWallet = deriveEVMAddress(seedPhrase);
    evmAddress = evmWallet.address;
    evmPrivateKey = evmWallet.privateKey;
    
    if (!evmAddress || !evmPrivateKey) {
      throw new Error("EVM wallet derivation returned undefined address or private key");
    }
    
    // All EVM chains share the same address
    const evmChains = ["ethereum", "base", "polygon", "monad"];
    for (const chainId of evmChains) {
      addresses[chainId] = evmAddress;
      privateKeys[chainId] = evmPrivateKey;
    }
    console.log("[Wallet] ✅ EVM address generated successfully:", evmAddress);
    console.log("[Wallet] ✅ EVM chains added:", evmChains);
  } catch (error: any) {
    console.error("[Wallet] ❌ CRITICAL: Error deriving EVM address:", error);
    console.error("[Wallet] Error name:", error?.name);
    console.error("[Wallet] Error message:", error?.message);
    console.error("[Wallet] Error stack:", error?.stack);
    // Re-throw so caller knows it failed
    throw new Error(`Failed to generate EVM addresses: ${error?.message || "Unknown error"}`);
  }

  // Derive Solana wallet
  try {
    const solanaWallet = deriveSolanaAddress(seed);
    addresses.solana = solanaWallet.address;
    privateKeys.solana = solanaWallet.privateKey;
  } catch (error) {
    console.error("Error deriving Solana address:", error);
  }

  // Derive Sui wallet
  try {
    console.log("[Wallet] Attempting to derive Sui address...");
    const suiWallet = deriveSuiAddress(seed);
    addresses.sui = suiWallet.address;
    privateKeys.sui = suiWallet.privateKey;
    console.log("[Wallet] ✅ Sui address added to wallet");
  } catch (error: any) {
    console.error("[Wallet] ❌ CRITICAL: Error deriving Sui address:", error);
    console.error("[Wallet] Error name:", error?.name);
    console.error("[Wallet] Error message:", error?.message);
    console.error("[Wallet] Error stack:", error?.stack);
    // Don't throw - allow other chains to be generated, but log the error
    console.error("[Wallet] WARNING: Sui address will not be generated due to error above");
  }

  // Log what was generated
  console.log("[Wallet] Generated addresses for chains:", Object.keys(addresses));
  console.log("[Wallet] Total addresses:", Object.keys(addresses).length);

  // Validate we have at least some addresses
  if (Object.keys(addresses).length === 0) {
    throw new Error("Failed to generate any wallet addresses. Please check your seed phrase.");
  }

  return {
    seedPhrase, // WARNING: Never send this to backend in plaintext!
    addresses,
    privateKeys,
  };
}

/**
 * Get wallet address for a specific chain
 */
export function getAddressForChain(
  walletData: WalletData,
  chainId: string
): string | undefined {
  return walletData.addresses[chainId];
}

/**
 * Get private key for a specific chain
 * WARNING: Private keys should NEVER be sent to backend
 */
export function getPrivateKeyForChain(
  walletData: WalletData,
  chainId: string
): string | undefined {
  return walletData.privateKeys[chainId];
}

/**
 * Encrypt seed phrase using a key derived from passkey
 * Uses Web Crypto API for encryption
 * 
 * SECURITY: This happens client-side. Only encrypted result is sent to backend.
 */
export async function encryptSeedPhrase(
  seedPhrase: string,
  passkeyPublicKey: string
): Promise<string> {
  // Import passkey public key as encryption key
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passkeyPublicKey),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  // Derive encryption key
  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("sendapp-wallet-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  // Encrypt seed phrase
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    encryptionKey,
    new TextEncoder().encode(seedPhrase)
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt seed phrase using passkey
 * 
 * SECURITY: This happens client-side only. Backend never sees plaintext seed.
 */
export async function decryptSeedPhrase(
  encryptedSeed: string,
  passkeyPublicKey: string
): Promise<string> {
  // Decode base64
  const combined = Uint8Array.from(atob(encryptedSeed), (c) => c.charCodeAt(0));

  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  // Import key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passkeyPublicKey),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  // Derive decryption key
  const decryptionKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode("sendapp-wallet-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    decryptionKey,
    encrypted
  );

  return new TextDecoder().decode(decrypted);
}

