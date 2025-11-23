// Base Network Configuration
export const BASE_CHAIN_ID = 8453;
// Use public RPC endpoints with better rate limits
// Priority: Custom RPC > LlamaRPC (better rate limits than Base public RPC)
export const BASE_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_RPC_URL || 
  "https://base.llamarpc.com"; // LlamaRPC public endpoint (better rate limits)

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

