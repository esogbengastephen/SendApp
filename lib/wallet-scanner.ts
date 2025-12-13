/**
 * Wallet Scanner Utility
 * Scans a wallet address for all tokens (ETH and ERC20) on Base network
 */

import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { BASE_RPC_URL } from "./constants";

// ERC20 Token ABI (minimal - just what we need)
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
] as const;

/**
 * Token information found in wallet
 */
export interface TokenInfo {
  address: string | null; // null for native ETH
  symbol: string;
  amount: string; // Human-readable amount
  amountRaw: string; // Raw amount (wei/smallest unit)
  decimals: number;
}

/**
 * Get public client for Base network
 */
function getPublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL, {
      retryCount: 3,
      retryDelay: 1000,
    }),
  });
}

/**
 * Comprehensive list of known ERC20 tokens on Base
 * Includes major tokens that users might send
 */
const KNOWN_BASE_TOKENS = [
  // Major stablecoins
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // DAI
  "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", // USDbC (USD Base Coin)
  
  // Wrapped tokens
  "0x4200000000000000000000000000000000000006", // WETH
  
  // Popular tokens
  "0xEab49138BA2Ea6dd776220fE26b7b8E446638956", // SEND token
  "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", // cbETH
  "0x940181a94A35A4569E4529A3CDfB74e38FD98631", // AERO
  
  // Other common tokens
  "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed", // DEGEN
  "0x532f27101965dd16442E59d40670FaF5eBB142E4", // BRETT
] as const;

/**
 * Scan wallet for all tokens (ETH + ERC20)
 * @param walletAddress - Wallet address to scan
 * @returns Array of all tokens found with balances > 0
 */
export async function scanWalletForAllTokens(
  walletAddress: string
): Promise<TokenInfo[]> {
  const publicClient = getPublicClient();
  const tokens: TokenInfo[] = [];

  // 1. Check native ETH balance
  try {
    const ethBalance = await publicClient.getBalance({
      address: walletAddress as `0x${string}`,
    });

    if (ethBalance > 0n) {
      tokens.push({
        address: null, // Native ETH has no contract address
        symbol: "ETH",
        amount: formatUnits(ethBalance, 18),
        amountRaw: ethBalance.toString(),
        decimals: 18,
      });
    }
  } catch (error) {
    console.error(`[Wallet Scanner] Error checking ETH balance:`, error);
  }

  // 2. Check all known ERC20 tokens
  const tokenChecks = KNOWN_BASE_TOKENS.map(async (tokenAddress) => {
    try {
      const balance = (await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [walletAddress as `0x${string}`],
      })) as bigint;

      if (balance > 0n) {
        // Get token metadata
        const decimals = (await publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "decimals",
        })) as number;

        const symbol = (await publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "symbol",
        })) as string;

        return {
          address: tokenAddress,
          symbol,
          amount: formatUnits(balance, decimals),
          amountRaw: balance.toString(),
          decimals,
        };
      }
      return null;
    } catch (error) {
      // Token might not exist or contract call failed, skip it
      return null;
    }
  });

  // Wait for all token checks to complete
  const results = await Promise.all(tokenChecks);
  
  // Filter out null results and add to tokens array
  for (const result of results) {
    if (result) {
      tokens.push(result);
    }
  }

  // Note: We could enhance this by scanning recent transactions for additional tokens
  // For now, the known token list should cover most use cases
  // If a token is not detected, it can be added to KNOWN_BASE_TOKENS list

  return tokens;
}

/**
 * Check if wallet has sufficient ETH for gas
 * @param walletAddress - Wallet address to check
 * @param minRequired - Minimum ETH required (default: 0.0002 ETH)
 * @returns true if wallet has enough ETH, false otherwise
 */
export async function checkGasBalance(
  walletAddress: string,
  minRequired: bigint = BigInt("200000000000000") // 0.0002 ETH
): Promise<{
  hasEnough: boolean;
  balance: bigint;
  required: bigint;
}> {
  const publicClient = getPublicClient();
  
  const balance = await publicClient.getBalance({
    address: walletAddress as `0x${string}`,
  });

  return {
    hasEnough: balance >= minRequired,
    balance,
    required: minRequired,
  };
}
