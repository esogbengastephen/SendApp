// Base Network Configuration
export const BASE_CHAIN_ID = 8453;
export const BASE_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org";

// $SEND Token Contract Address
export const SEND_TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_SEND_TOKEN_ADDRESS ||
  "0x3f14920c99beb920afa163031c4e47a3e03b3e4a";

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

