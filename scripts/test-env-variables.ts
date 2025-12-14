/**
 * Test all required environment variables for off-ramp system
 * This script checks if all necessary .env.local variables are set
 */

import { readFileSync } from "fs";
import { join } from "path";

// Load .env.local file manually
const envPath = join(process.cwd(), ".env.local");
let envContent = "";

try {
  envContent = readFileSync(envPath, "utf-8");
  // Parse .env.local manually
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
  console.error("❌ Could not read .env.local file");
  console.error("   Make sure .env.local exists in the project root\n");
  process.exit(1);
}

console.log("\n🔍 Testing Off-Ramp Environment Variables");
console.log("========================================\n");

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
  value?: string;
  status: "✅ Set" | "⚠️ Missing" | "❌ Invalid";
  note?: string;
}

const requiredVars: EnvVar[] = [
  // Off-Ramp Core
  {
    name: "OFFRAMP_MASTER_MNEMONIC",
    required: true,
    description: "Master mnemonic for HD wallet generation (12 or 24 words)",
    value: process.env.OFFRAMP_MASTER_MNEMONIC,
  },
  {
    name: "OFFRAMP_MASTER_WALLET_PRIVATE_KEY",
    required: true,
    description: "Private key of master wallet (for gas funding)",
    value: process.env.OFFRAMP_MASTER_WALLET_PRIVATE_KEY,
  },
  {
    name: "OFFRAMP_ADMIN_WALLET_ADDRESS",
    required: true,
    description: "Admin wallet address (for access control)",
    value: process.env.OFFRAMP_ADMIN_WALLET_ADDRESS,
  },
  {
    name: "OFFRAMP_RECEIVER_WALLET_ADDRESS",
    required: true,
    description: "Receiver wallet address (where USDC goes after swap)",
    value: process.env.OFFRAMP_RECEIVER_WALLET_ADDRESS,
  },
  
  // Base Network
  {
    name: "NEXT_PUBLIC_BASE_RPC_URL",
    required: false,
    description: "Base network RPC endpoint (optional, defaults to LlamaRPC)",
    value: process.env.NEXT_PUBLIC_BASE_RPC_URL,
    note: "Optional - defaults to https://base.llamarpc.com",
  },
  {
    name: "NEXT_PUBLIC_SEND_TOKEN_ADDRESS",
    required: false,
    description: "SEND token contract address (optional, has default)",
    value: process.env.NEXT_PUBLIC_SEND_TOKEN_ADDRESS,
    note: "Optional - has default value",
  },
  
  // 0x Protocol
  {
    name: "ZEROX_API_KEY",
    required: false,
    description: "0x Protocol API key (optional but recommended)",
    value: process.env.ZEROX_API_KEY,
    note: "Optional - get from https://0x.org/docs/",
  },
  
  // Paystack
  {
    name: "PAYSTACK_SECRET_KEY",
    required: true,
    description: "Paystack secret key for NGN transfers",
    value: process.env.PAYSTACK_SECRET_KEY,
  },
  
  // Supabase
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    description: "Supabase project URL",
    value: process.env.NEXT_PUBLIC_SUPABASE_URL,
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    description: "Supabase anonymous key",
    value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    description: "Supabase service role key (for admin operations)",
    value: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  
  // Admin
  {
    name: "NEXT_PUBLIC_ADMIN_WALLETS",
    required: true,
    description: "Comma-separated list of admin wallet addresses",
    value: process.env.NEXT_PUBLIC_ADMIN_WALLETS,
  },
];

// Validate each variable
let allValid = true;
const results: EnvVar[] = [];

for (const envVar of requiredVars) {
  const varResult: EnvVar = { ...envVar };
  
  if (!envVar.value) {
    if (envVar.required) {
      varResult.status = "❌ Invalid";
      allValid = false;
    } else {
      varResult.status = "⚠️ Missing";
    }
  } else {
    varResult.status = "✅ Set";
    
    // Additional validation for specific variables
    if (envVar.name === "OFFRAMP_MASTER_MNEMONIC") {
      const words = envVar.value.trim().split(/\s+/);
      if (words.length !== 12 && words.length !== 24) {
        varResult.status = "❌ Invalid";
        varResult.note = `Mnemonic must be 12 or 24 words (found ${words.length})`;
        allValid = false;
      } else {
        varResult.note = `Valid ${words.length}-word mnemonic`;
      }
    }
    
    if (envVar.name === "OFFRAMP_MASTER_WALLET_PRIVATE_KEY") {
      // Private key is 66 characters (0x + 64 hex characters)
      if (!envVar.value.startsWith("0x") || envVar.value.length !== 66) {
        varResult.status = "❌ Invalid";
        varResult.note = "Must be a valid private key (0x followed by 64 hex characters)";
        allValid = false;
      } else {
        varResult.note = "Valid private key";
      }
    }
    
    if (envVar.name === "OFFRAMP_ADMIN_WALLET_ADDRESS" || 
        envVar.name === "OFFRAMP_RECEIVER_WALLET_ADDRESS") {
      // Address is 42 characters (0x + 40 hex characters)
      if (!envVar.value.startsWith("0x") || envVar.value.length !== 42) {
        varResult.status = "❌ Invalid";
        varResult.note = "Must be a valid Ethereum address (0x followed by 40 hex characters)";
        allValid = false;
      } else {
        varResult.note = "Valid Ethereum address";
      }
    }
    
    if (envVar.name === "NEXT_PUBLIC_ADMIN_WALLETS") {
      const wallets = envVar.value.split(",").map(w => w.trim());
      const invalidWallets = wallets.filter(w => !w.startsWith("0x") || w.length !== 42);
      if (invalidWallets.length > 0) {
        varResult.status = "❌ Invalid";
        varResult.note = `Invalid wallet addresses: ${invalidWallets.join(", ")}`;
        allValid = false;
      } else {
        varResult.note = `Valid (${wallets.length} wallet${wallets.length > 1 ? "s" : ""})`;
      }
    }
  }
  
  results.push(varResult);
}

// Display results
console.log("Environment Variables Status:\n");

results.forEach((envVar) => {
  const icon = envVar.status === "✅ Set" ? "✅" : envVar.status === "⚠️ Missing" ? "⚠️" : "❌";
  const required = envVar.required ? "[REQUIRED]" : "[OPTIONAL]";
  
  console.log(`${icon} ${envVar.name} ${required}`);
  console.log(`   ${envVar.description}`);
  
  if (envVar.value) {
    // Mask sensitive values
    let displayValue = envVar.value;
    if (envVar.name.includes("KEY") || envVar.name.includes("MNEMONIC") || envVar.name.includes("PRIVATE")) {
      if (envVar.name === "OFFRAMP_MASTER_MNEMONIC") {
        const words = displayValue.split(/\s+/);
        displayValue = `${words[0]} ${words[1]} ... ${words[words.length - 1]} (${words.length} words)`;
      } else {
        displayValue = `${displayValue.substring(0, 10)}...${displayValue.substring(displayValue.length - 4)}`;
      }
    }
    console.log(`   Value: ${displayValue}`);
  }
  
  if (envVar.note) {
    console.log(`   Note: ${envVar.note}`);
  }
  
  if (envVar.status === "❌ Invalid") {
    console.log(`   ⚠️  This variable is invalid or missing!`);
  }
  
  console.log("");
});

// Summary
const requiredCount = results.filter(r => r.required).length;
const requiredSet = results.filter(r => r.required && r.status === "✅ Set").length;
const optionalCount = results.filter(r => !r.required).length;
const optionalSet = results.filter(r => !r.required && r.status === "✅ Set").length;

console.log("Summary:");
console.log("========");
console.log(`Required Variables: ${requiredSet}/${requiredCount} set`);
console.log(`Optional Variables: ${optionalSet}/${optionalCount} set`);
console.log(`\nOverall Status: ${allValid ? "✅ All required variables are set!" : "❌ Some required variables are missing or invalid"}\n`);

if (!allValid) {
  console.log("Missing or Invalid Variables:");
  results
    .filter(r => r.status === "❌ Invalid" || (r.required && r.status === "⚠️ Missing"))
    .forEach(r => {
      console.log(`  - ${r.name}: ${r.description}`);
    });
  console.log("");
  process.exit(1);
} else {
  console.log("✅ All required environment variables are properly configured!\n");
  process.exit(0);
}

