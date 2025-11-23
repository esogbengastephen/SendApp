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
  const privateKey = process.env.LIQUIDITY_POOL_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error("LIQUIDITY_POOL_PRIVATE_KEY is not set in environment variables");
  }

  if (!privateKey.startsWith("0x")) {
    throw new Error("Private key must start with 0x");
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  
  return createWalletClient({
    account,
    chain: base,
    transport: http(BASE_RPC_URL),
  });
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
    const decimals = (await publicClient.readContract({
      address: SEND_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "decimals",
    })) as number;

    const balance = (await publicClient.readContract({
      address: SEND_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    })) as bigint;

    return formatUnits(balance, decimals);
  } catch (error) {
    console.error("Error getting token balance:", error);
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

