/**
 * Dedicated deposit address per off-ramp request (SEND).
 * One EOA per transaction; private key encrypted with server secret for later sweep to pool.
 */

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const SECRET =
  process.env.OFFRAMP_DEPOSIT_ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET || "offramp-deposit-default";

async function getEncryptionKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("offramp-deposit-wallet-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptDepositPrivateKey(privateKey: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(privateKey)
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptDepositPrivateKey(encryptedKey: string): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedKey), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  const key = await getEncryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );
  return new TextDecoder().decode(decrypted);
}

export interface DedicatedDepositWallet {
  address: string;
  privateKey: string;
  privateKeyEncrypted: string;
}

/**
 * Generate a new dedicated deposit address (EOA on Base) for one off-ramp request.
 * Store address and privateKeyEncrypted in offramp_transactions; use private key later to sweep SEND to pool.
 */
export async function generateDedicatedDepositWallet(): Promise<DedicatedDepositWallet> {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const privateKeyEncrypted = await encryptDepositPrivateKey(privateKey);
  return {
    address: account.address,
    privateKey,
    privateKeyEncrypted,
  };
}
