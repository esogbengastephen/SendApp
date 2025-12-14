/**
 * Full wallet check - scan for all tokens and check database
 */

import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL, SEND_TOKEN_ADDRESS } from "../lib/constants";
import { scanWalletForAllTokens } from "../lib/wallet-scanner";

const walletAddress = "0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2";
const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLETS?.split(",")[0] || "";

async function checkWallet() {
  console.log(`\n🔍 Full Wallet Check`);
  console.log(`====================\n`);
  console.log(`Wallet: ${walletAddress}\n`);

  const publicClient = createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
  });

  // 1. Scan for ALL tokens
  console.log(`1️⃣ Scanning wallet for all tokens...\n`);
  try {
    const allTokens = await scanWalletForAllTokens(walletAddress);
    
    if (allTokens.length === 0) {
      console.log(`❌ No tokens found in wallet\n`);
    } else {
      console.log(`✅ Found ${allTokens.length} token(s):\n`);
      allTokens.forEach((token, i) => {
        console.log(`   ${i + 1}. ${token.symbol}: ${token.amount}`);
        console.log(`      Address: ${token.address || "Native ETH"}`);
        console.log(`      Raw: ${token.amountRaw}\n`);
      });
    }

    // 2. Check database for transaction
    if (ADMIN_WALLET) {
      console.log(`2️⃣ Checking database for transaction...\n`);
      try {
        const response = await fetch(`${API_URL}/api/admin/offramp?adminWallet=${ADMIN_WALLET}&status=all`);
        const data = await response.json();
        
        if (data.success && data.transactions) {
          const tx = data.transactions.find(
            (t: any) => t.unique_wallet_address?.toLowerCase() === walletAddress.toLowerCase()
          );
          
          if (tx) {
            console.log(`✅ Found transaction in database:`);
            console.log(`   Transaction ID: ${tx.transaction_id}`);
            console.log(`   Status: ${tx.status}`);
            console.log(`   User: ${tx.user_email}`);
            console.log(`   Account: ${tx.user_account_number}`);
            console.log(`   Token: ${tx.token_symbol || "Not detected"} ${tx.token_amount || ""}\n`);
          } else {
            console.log(`⚠️  No transaction found in database for this wallet\n`);
          }
        }
      } catch (error: any) {
        console.error(`❌ Error checking database: ${error.message}\n`);
      }
    } else {
      console.log(`⚠️  ADMIN_WALLET not set, skipping database check\n`);
    }

    // 3. If SEND tokens found, suggest next steps
    const sendToken = allTokens.find(t => t.symbol === "SEND");
    if (sendToken) {
      console.log(`3️⃣ SEND tokens detected! Next steps:\n`);
      console.log(`   Option 1: Use restart-by-wallet endpoint`);
      console.log(`   Option 2: Use manual-swap endpoint`);
      console.log(`   Option 3: Create transaction via frontend\n`);
    }

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    if (error.stack) {
      console.error(`   ${error.stack}`);
    }
  }
}

checkWallet();

