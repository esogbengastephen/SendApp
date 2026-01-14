/**
 * Token configurations for all supported chains (Mainnet)
 * Real contract addresses for production use
 */

import { SEND_TOKEN_ADDRESS } from "./constants";

export interface TokenConfig {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  coingeckoId?: string; // For price fetching
  coingeckoContractAddress?: string; // For contract-based price fetching
}

export interface ChainTokens {
  native: TokenConfig;
  tokens: TokenConfig[];
}

/**
 * Supported tokens on each chain (mainnet addresses)
 */
export const CHAIN_TOKENS: Record<string, ChainTokens> = {
  // Base Network
  base: {
    native: {
      address: "native",
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      coingeckoId: "ethereum",
    },
    tokens: [
      {
        address: SEND_TOKEN_ADDRESS,
        name: "Send Token",
        symbol: "SEND",
        decimals: 18,
        coingeckoContractAddress: SEND_TOKEN_ADDRESS.toLowerCase(),
      },
      {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
        name: "USD Coin",
        symbol: "USDC",
        decimals: 6,
        coingeckoId: "usd-coin",
      },
    ],
  },

  // Ethereum Mainnet
  ethereum: {
    native: {
      address: "native",
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      coingeckoId: "ethereum",
    },
    tokens: [
      {
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
        name: "USD Coin",
        symbol: "USDC",
        decimals: 6,
        coingeckoId: "usd-coin",
      },
      {
        address: "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
        name: "Tether",
        symbol: "USDT",
        decimals: 6,
        coingeckoId: "tether",
      },
    ],
  },

  // Polygon Mainnet
  polygon: {
    native: {
      address: "native",
      name: "Polygon",
      symbol: "MATIC",
      decimals: 18,
      coingeckoId: "matic-network",
    },
    tokens: [
      {
        address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // USDC
        name: "USD Coin",
        symbol: "USDC",
        decimals: 6,
        coingeckoId: "usd-coin",
      },
      {
        address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // USDT
        name: "Tether",
        symbol: "USDT",
        decimals: 6,
        coingeckoId: "tether",
      },
    ],
  },

  // Solana Mainnet
  solana: {
    native: {
      address: "native",
      name: "Solana",
      symbol: "SOL",
      decimals: 9,
      coingeckoId: "solana",
    },
    tokens: [
      {
        address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
        name: "USD Coin",
        symbol: "USDC",
        decimals: 6,
        coingeckoId: "usd-coin",
      },
      {
        address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
        name: "Tether",
        symbol: "USDT",
        decimals: 6,
        coingeckoId: "tether",
      },
    ],
  },

  // Bitcoin
  bitcoin: {
    native: {
      address: "native",
      name: "Bitcoin",
      symbol: "BTC",
      decimals: 8,
      coingeckoId: "bitcoin",
    },
    tokens: [], // Bitcoin doesn't support tokens
  },

  // Sui Mainnet
  sui: {
    native: {
      address: "native",
      name: "Sui",
      symbol: "SUI",
      decimals: 9,
      coingeckoId: "sui",
    },
    tokens: [],
  },

  // Monad (when mainnet launches)
  monad: {
    native: {
      address: "native",
      name: "Monad",
      symbol: "MON",
      decimals: 18,
    },
    tokens: [],
  },
};

/**
 * Get all tokens for a chain
 */
export function getChainTokens(chainId: string): ChainTokens | undefined {
  return CHAIN_TOKENS[chainId];
}

/**
 * Get token config by chain and address
 */
export function getTokenConfig(chainId: string, tokenAddress: string): TokenConfig | undefined {
  const chainTokens = CHAIN_TOKENS[chainId];
  if (!chainTokens) return undefined;

  if (tokenAddress === "native") {
    return chainTokens.native;
  }

  return chainTokens.tokens.find((token) => 
    token.address.toLowerCase() === tokenAddress.toLowerCase()
  );
}
