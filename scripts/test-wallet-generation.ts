/**
 * Test script to verify if a mnemonic generates the correct wallet address
 * Usage: npx tsx scripts/test-wallet-generation.ts
 */

import { ethers } from "ethers";
import { readFileSync } from "fs";
import { join } from "path";

// Load .env.local
const envPath = join(process.cwd(), ".env.local");
let envContent = "";
try {
  envContent = readFileSync(envPath, "utf-8");
  const lines = envContent.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
        process.env[key.trim()] = value;
      }
    }
  }
} catch (error) {
  console.error("Could not read .env.local");
}

const TARGET_WALLET = "0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2";
const TRANSACTION_ID = "offramp_test_ZBAzkllx";
const USER_EMAIL = "test@example.com";
const USER_ACCOUNT_NUMBER = "1234567890";

const MASTER_MNEMONIC = process.env.OFFRAMP_MASTER_MNEMONIC;

function generateWalletFromMnemonic(mnemonic: string, derivationPath: string): {
  address: string;
  privateKey: string;
  derivationPath: string;
} {
  const mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic);
  const seed = mnemonicObj.computeSeed();
  const rootNode = ethers.HDNodeWallet.fromSeed(seed);
  const wallet = rootNode.derivePath(derivationPath);

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    derivationPath,
  };
}

function testOldTransactionBased(mnemonic: string): {
  success: boolean;
  wallet?: { address: string; privateKey: string; derivationPath: string };
  error?: string;
} {
  try {
    const indexHash = ethers.keccak256(ethers.toUtf8Bytes(TRANSACTION_ID));
    const indexNumber = BigInt(indexHash) % BigInt(2147483647);
    const derivationPath = `m/44'/60'/0'/0/${indexNumber}`;

    const wallet = generateWalletFromMnemonic(mnemonic, derivationPath);

    if (wallet.address.toLowerCase() === TARGET_WALLET.toLowerCase()) {
      return { success: true, wallet };
    }
    return { success: false, wallet };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

function testNewUserBased(mnemonic: string, userIdentifier: string): {
  success: boolean;
  wallet?: { address: string; privateKey: string; derivationPath: string };
  error?: string;
} {
  try {
    const indexHash = ethers.keccak256(ethers.toUtf8Bytes(`user_${userIdentifier.toLowerCase()}`));
    const indexNumber = BigInt(indexHash) % BigInt(2147483647);
    const derivationPath = `m/44'/60'/0'/0/${indexNumber}`;

    const wallet = generateWalletFromMnemonic(mnemonic, derivationPath);

    if (wallet.address.toLowerCase() === TARGET_WALLET.toLowerCase()) {
      return { success: true, wallet };
    }
    return { success: false, wallet };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function testWalletGeneration() {
  console.log("🔍 Testing Wallet Generation\n");
  console.log("=" .repeat(70));
  console.log("Target Wallet:", TARGET_WALLET);
  console.log("Transaction ID:", TRANSACTION_ID);
  console.log("User Email:", USER_EMAIL);
  console.log("User Account Number:", USER_ACCOUNT_NUMBER);
  console.log("");

  if (!MASTER_MNEMONIC) {
    console.log("❌ OFFRAMP_MASTER_MNEMONIC is not set in .env.local");
    console.log("");
    console.log("Please set it in .env.local:");
    console.log("OFFRAMP_MASTER_MNEMONIC=your twelve word mnemonic phrase here");
    return;
  }

  // Validate mnemonic format
  try {
    ethers.Mnemonic.fromPhrase(MASTER_MNEMONIC);
    console.log("✅ Mnemonic format is valid");
  } catch (error) {
    console.log("❌ Mnemonic format is INVALID");
    console.log("Error:", error instanceof Error ? error.message : "Unknown error");
    return;
  }

  console.log("");
  console.log("Testing Methods:\n");

  // Test 1: Old transaction-based method
  console.log("1️⃣ Testing OLD Transaction-Based Method");
  console.log("   Using transaction_id:", TRANSACTION_ID);
  try {
    const oldResult = testOldTransactionBased(MASTER_MNEMONIC);
    if (oldResult.success && oldResult.wallet) {
      console.log("   ✅ SUCCESS! Wallet matches!");
      console.log("   Address:", oldResult.wallet.address);
      console.log("   Derivation Path:", oldResult.wallet.derivationPath);
      console.log("   Private Key:", oldResult.wallet.privateKey);
      console.log("");
      console.log("🎉 You can now use this private key to recover your SEND tokens!");
      return;
    } else {
      console.log("   ❌ Wallet does not match");
      if (oldResult.wallet) {
        console.log("   Generated Address:", oldResult.wallet.address);
        console.log("   Derivation Path:", oldResult.wallet.derivationPath);
      } else if (oldResult.error) {
        console.log("   Error:", oldResult.error);
      } else {
        console.log("   Error: Could not generate wallet");
      }
    }
  } catch (error: any) {
    console.log("   ❌ Error:", error.message);
  }

  console.log("");

  // Test 2: New user-based method with email
  console.log("2️⃣ Testing NEW User-Based Method (Email)");
  console.log("   Using user_email:", USER_EMAIL);
  try {
    const emailResult = testNewUserBased(MASTER_MNEMONIC, USER_EMAIL);
    if (emailResult.success && emailResult.wallet) {
      console.log("   ✅ SUCCESS! Wallet matches!");
      console.log("   Address:", emailResult.wallet.address);
      console.log("   Derivation Path:", emailResult.wallet.derivationPath);
      console.log("   Private Key:", emailResult.wallet.privateKey);
      console.log("");
      console.log("🎉 You can now use this private key to recover your SEND tokens!");
      return;
    } else {
      console.log("   ❌ Wallet does not match");
      if (emailResult.wallet) {
        console.log("   Generated Address:", emailResult.wallet.address);
        console.log("   Derivation Path:", emailResult.wallet.derivationPath);
      } else if (emailResult.error) {
        console.log("   Error:", emailResult.error);
      } else {
        console.log("   Error: Could not generate wallet");
      }
    }
  } catch (error: any) {
    console.log("   ❌ Error:", error.message);
  }

  console.log("");

  // Test 3: New user-based method with guest account number
  console.log("3️⃣ Testing NEW User-Based Method (Guest Account)");
  const guestIdentifier = `guest_${USER_ACCOUNT_NUMBER}`;
  console.log("   Using guest identifier:", guestIdentifier);
  try {
    const guestResult = testNewUserBased(MASTER_MNEMONIC, guestIdentifier);
    if (guestResult.success && guestResult.wallet) {
      console.log("   ✅ SUCCESS! Wallet matches!");
      console.log("   Address:", guestResult.wallet.address);
      console.log("   Derivation Path:", guestResult.wallet.derivationPath);
      console.log("   Private Key:", guestResult.wallet.privateKey);
      console.log("");
      console.log("🎉 You can now use this private key to recover your SEND tokens!");
      return;
    } else {
      console.log("   ❌ Wallet does not match");
      if (guestResult.wallet) {
        console.log("   Generated Address:", guestResult.wallet.address);
        console.log("   Derivation Path:", guestResult.wallet.derivationPath);
      } else if (guestResult.error) {
        console.log("   Error:", guestResult.error);
      } else {
        console.log("   Error: Could not generate wallet");
      }
    }
  } catch (error: any) {
    console.log("   ❌ Error:", error.message);
  }

  console.log("");
  console.log("=" .repeat(70));
  console.log("❌ None of the methods generated the target wallet");
  console.log("");
  console.log("This means:");
  console.log("1. The mnemonic in .env.local is NOT the one used to generate this wallet");
  console.log("2. OR the wallet was generated using a different method/identifier");
  console.log("");
  console.log("Next steps:");
  console.log("- Verify you have the correct mnemonic from yesterday");
  console.log("- Or provide the private key for the target wallet directly");
}

testWalletGeneration();

