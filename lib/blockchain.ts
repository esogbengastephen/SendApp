import { createWalletClient, createPublicClient, http, formatUnits, parseUnits } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { defineChain } from "viem";
import { BASE_RPC_URL, SEND_TOKEN_ADDRESS } from "./constants";
import { SUPPORTED_CHAINS } from "./chains";

// ERC20 Token ABI (minimal - just what we need for transfers)
const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
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
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
] as const;

/**
 * Get the public client for Base network
 */
export function getPublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL, {
      retryCount: 3,
      retryDelay: 1000,
    }),
  });
}

/**
 * Get the wallet client for token transfers
 */
export function getWalletClient() {
  let privateKey = process.env.LIQUIDITY_POOL_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error("LIQUIDITY_POOL_PRIVATE_KEY is not set in environment variables");
  }

  // Clean up the private key - remove whitespace and newlines
  privateKey = privateKey.trim().replace(/\s/g, '');

  // Ensure it starts with 0x
  if (!privateKey.startsWith("0x")) {
    privateKey = `0x${privateKey}`;
  }

  // Validate format - should be 66 characters (0x + 64 hex chars)
  if (privateKey.length !== 66) {
    throw new Error(
      `Invalid private key format. Expected 66 characters (0x + 64 hex), got ${privateKey.length}. ` +
      `Make sure your private key is a valid 64-character hex string.`
    );
  }

  // Validate it's valid hex
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error(
      "Invalid private key format. Must be a valid 64-character hexadecimal string starting with 0x."
    );
  }

  try {
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    
  return createWalletClient({
    account,
    chain: base,
    transport: http(BASE_RPC_URL, {
      retryCount: 3,
      retryDelay: 1000,
    }),
  });
  } catch (error: any) {
    console.error("Error creating wallet client:", error);
    throw new Error(
      `Failed to create wallet client: ${error.message}. ` +
      `Please check that LIQUIDITY_POOL_PRIVATE_KEY is a valid private key.`
    );
  }
}

/**
 * Get the liquidity pool wallet address
 */
export function getLiquidityPoolAddress(): string {
  const walletClient = getWalletClient();
  return walletClient.account.address;
}

/**
 * Get the next nonce for the liquidity pool address.
 * Call this before each sendTransaction/writeContract when sending multiple txs in sequence
 * so the chain sees the latest nonce (avoids "nonce too low" after a previous tx is mined).
 */
export async function getNextNonce(): Promise<number> {
  const publicClient = getPublicClient();
  const address = getLiquidityPoolAddress();
  return publicClient.getTransactionCount({ address: address as `0x${string}` });
}

/**
 * Get token balance for an address
 */
export async function getTokenBalance(address: string): Promise<string> {
  try {
    const publicClient = getPublicClient();
    
    console.log(`[getTokenBalance] Checking balance for: ${address}`);
    console.log(`[getTokenBalance] Token contract: ${SEND_TOKEN_ADDRESS}`);
    console.log(`[getTokenBalance] RPC URL: ${BASE_RPC_URL}`);
    
    // Get token decimals
    const decimals = (await publicClient.readContract({
      address: SEND_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "decimals",
    })) as number;
    
    console.log(`[getTokenBalance] Token decimals: ${decimals}`);

    // Get balance
    const balance = (await publicClient.readContract({
      address: SEND_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    })) as bigint;

    console.log(`[getTokenBalance] Raw balance (wei): ${balance.toString()}`);
    
    const formattedBalance = formatUnits(balance, decimals);
    console.log(`[getTokenBalance] Formatted balance: ${formattedBalance} SEND`);

    return formattedBalance;
  } catch (error: any) {
    console.error("[getTokenBalance] Error getting token balance:", error);
    console.error("[getTokenBalance] Error details:", {
      message: error.message,
      code: error.code,
      address,
      tokenContract: SEND_TOKEN_ADDRESS,
    });
    throw error;
  }
}

/**
 * Transfer $SEND tokens from liquidity pool to recipient
 */
export async function transferTokens(
  toAddress: string,
  amount: string
): Promise<{ hash: string; success: boolean }> {
  try {
    const walletClient = getWalletClient();
    const publicClient = getPublicClient();

    // Get token decimals
    const decimals = (await publicClient.readContract({
      address: SEND_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "decimals",
    })) as number;

    // Convert amount to wei (token's smallest unit)
    const amountInWei = parseUnits(amount, decimals);

    // Check liquidity pool balance
    const poolAddress = walletClient.account.address;
    const balance = await getTokenBalance(poolAddress);
    const balanceInWei = parseUnits(balance, decimals);

    if (balanceInWei < amountInWei) {
      throw new Error(
        `Insufficient balance in liquidity pool. Available: ${balance} SEND, Required: ${amount} SEND`
      );
    }

    // Transfer tokens (use fresh nonce to avoid "nonce too low" when multiple txs are sent)
    const hash = await walletClient.writeContract({
      address: SEND_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [toAddress as `0x${string}`, amountInWei],
      nonce: await getNextNonce(),
    });

    // Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    return {
      hash: receipt.transactionHash,
      success: receipt.status === "success",
    };
  } catch (error: any) {
    console.error("Error transferring tokens:", error);
    throw error;
  }
}

/**
 * Estimate gas for token transfer
 */
export async function estimateGas(
  toAddress: string,
  amount: string
): Promise<bigint> {
  try {
    const walletClient = getWalletClient();
    const publicClient = getPublicClient();

    // Get token decimals
    const decimals = (await publicClient.readContract({
      address: SEND_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "decimals",
    })) as number;

    // Convert amount to wei
    const amountInWei = parseUnits(amount, decimals);

    // Estimate gas
    const gasEstimate = await publicClient.estimateContractGas({
      address: SEND_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [toAddress as `0x${string}`, amountInWei],
      account: walletClient.account,
    });

    return gasEstimate;
  } catch (error: any) {
    console.error("Error estimating gas:", error);
    throw error;
  }
}

/**
 * Validate Base wallet address format
 */
export function isValidBaseAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Get public client for any EVM chain
 */
export function getPublicClientForChain(chainId: string) {
  const chainConfig = SUPPORTED_CHAINS[chainId];
  if (!chainConfig || chainConfig.type !== "EVM" || !chainConfig.rpcUrl) {
    throw new Error(`Invalid EVM chain: ${chainId}`);
  }

  const customChain = defineChain({
    id: chainConfig.chainId!,
    name: chainConfig.name,
    nativeCurrency: chainConfig.nativeCurrency ? {
      name: chainConfig.nativeCurrency.symbol,
      symbol: chainConfig.nativeCurrency.symbol,
      decimals: chainConfig.nativeCurrency.decimals,
    } : {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [chainConfig.rpcUrl],
      },
    },
  });

  return createPublicClient({
    chain: customChain,
    transport: http(chainConfig.rpcUrl, {
      retryCount: 3,
      retryDelay: 1000,
    }),
  });
}

/**
 * Get ERC20 token balance for any EVM chain
 */
export async function getERC20Balance(
  chainId: string,
  walletAddress: string,
  tokenAddress: string
): Promise<{ balance: string; decimals: number; symbol: string; name: string }> {
  try {
    const publicClient = getPublicClientForChain(chainId);

    // Get token decimals, symbol, name, and balance
    const [decimals, symbol, name, balance] = await Promise.all([
      publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "decimals",
      }) as Promise<number>,
      publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "symbol",
      }) as Promise<string>,
      publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "name",
      }) as Promise<string>,
      publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [walletAddress as `0x${string}`],
      }) as Promise<bigint>,
    ]);

    const formattedBalance = formatUnits(balance, decimals);

    return {
      balance: formattedBalance,
      decimals,
      symbol,
      name,
    };
  } catch (error: any) {
    console.error(`[getERC20Balance] Error for ${chainId}:`, error);
    throw error;
  }
}

/**
 * Get native token balance for any EVM chain
 */
export async function getNativeBalance(
  chainId: string,
  walletAddress: string
): Promise<string> {
  try {
    const publicClient = getPublicClientForChain(chainId);
    const balance = await publicClient.getBalance({
      address: walletAddress as `0x${string}`,
    });
    
    const chainConfig = SUPPORTED_CHAINS[chainId];
    const decimals = chainConfig?.nativeCurrency?.decimals || 18;
    
    return formatUnits(balance, decimals);
  } catch (error: any) {
    console.error(`[getNativeBalance] Error for ${chainId}:`, error);
    throw error;
  }
}

