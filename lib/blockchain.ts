import { createWalletClient, createPublicClient, http, formatUnits, parseUnits } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { BASE_RPC_URL, SEND_TOKEN_ADDRESS } from "./constants";

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
] as const;

/**
 * Get the public client for Base network
 */
export function getPublicClient() {
  return createPublicClient({
    chain: base,
    transport: http(BASE_RPC_URL),
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
      transport: http(BASE_RPC_URL),
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

    // Transfer tokens
    const hash = await walletClient.writeContract({
      address: SEND_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [toAddress as `0x${string}`, amountInWei],
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

