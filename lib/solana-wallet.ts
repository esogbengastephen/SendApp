/**
 * Solana Wallet Generation and Management
 * Handles Solana wallet creation for off-ramp transactions
 */

import { Keypair } from "@solana/web3.js";

export interface SolanaWalletData {
  address: string;
  privateKey: string;
}

/**
 * Simple encryption helper for Solana private keys
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
      salt: encoder.encode("solana-wallet-encryption-salt"),
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
 * Simple decryption helper for Solana private keys
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
      salt: encoder.encode("solana-wallet-encryption-salt"),
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
 * Generate a unique Solana wallet for a user
 */
export function generateSolanaWalletForUser(
  userId: string
): SolanaWalletData {
  // Generate new keypair
  const keypair = Keypair.generate();
  
  return {
    address: keypair.publicKey.toBase58(),
    privateKey: Buffer.from(keypair.secretKey).toString('hex'),
  };
}

/**
 * Get Solana wallet from encrypted private key
 */
export async function getSolanaWalletFromEncrypted(
  encryptedKey: string,
  userId: string
): Promise<SolanaWalletData> {
  // Decrypt the private key
  const decryptedKey = await decryptPrivateKey(encryptedKey, userId);
  
  // Convert hex string back to Uint8Array
  const privateKeyBytes = Buffer.from(decryptedKey, 'hex');
  const keypair = Keypair.fromSecretKey(privateKeyBytes);
  
  return {
    address: keypair.publicKey.toBase58(),
    privateKey: decryptedKey,
  };
}

/**
 * Encrypt Solana private key for storage
 */
export async function encryptSolanaPrivateKey(
  privateKey: string,
  userId: string
): Promise<string> {
  return await encryptPrivateKey(privateKey, userId);
}

/**
 * Decrypt Solana private key from storage
 */
export async function decryptSolanaPrivateKey(
  encryptedKey: string,
  userId: string
): Promise<string> {
  return await decryptPrivateKey(encryptedKey, userId);
}
