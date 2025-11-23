// Base Network Configuration
export const BASE_CHAIN_ID = 8453;
// Use public RPC endpoints with better rate limits
// Options: Base public RPC, Alchemy, Infura, or QuickNode
export const BASE_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_RPC_URL || 
  "https://base-mainnet.g.alchemy.com/v2/demo" || // Alchemy public endpoint (demo)
  "https://base.llamarpc.com" || // LlamaRPC public endpoint
  "https://mainnet.base.org"; // Fallback to Base public RPC

// $SEND Token Contract Address
export const SEND_TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_SEND_TOKEN_ADDRESS ||
  "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";

// Exchange Rate (default, should be fetched from API)
export const DEFAULT_EXCHANGE_RATE = parseFloat(
  process.env.SEND_NGN_EXCHANGE_RATE || "50"
);

// Deposit Account Information
export const DEPOSIT_ACCOUNT = {
  name: "FlashPhotogra/Badmus O. U",
  accountNumber: "9327908332",
  bank: "Wema",
};

