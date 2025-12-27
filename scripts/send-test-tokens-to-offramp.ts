/**
 * Send test SEND tokens to the new off-ramp wallet
 */

import { createWalletClient, createPublicClient, http, parseUnits, formatUnits } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const SEND_TOKEN_ADDRESS = "0xEab49138BA2Ea6dd776220fE26b7b8E446638956";
const LIQUIDITY_POOL_KEY = process.env.LIQUIDITY_POOL_PRIVATE_KEY!; // Use liquidity pool wallet
const TARGET_WALLET = "0x6905325f09Bd165C6F983519070979b9F4B232ec";
const AMOUNT_TO_SEND = "5"; // 5 SEND tokens

const ERC20_ABI = [
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function sendTestTokens() {
  console.log("🚀 Sending Test SEND Tokens to Off-Ramp Wallet\n");

  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
  });

  const account = privateKeyToAccount(LIQUIDITY_POOL_KEY as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
  });

  console.log("From (Liquidity Pool):", account.address);
  console.log("To (Off-Ramp):", TARGET_WALLET);
  console.log("Amount:", AMOUNT_TO_SEND, "SEND\n");

  // Check balance first
  const balance = await publicClient.readContract({
    address: SEND_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });

  console.log("Liquidity Pool SEND Balance:", formatUnits(balance, 18), "SEND");

  if (balance < parseUnits(AMOUNT_TO_SEND, 18)) {
    console.log("❌ Insufficient SEND balance!");
    return;
  }

  // Send tokens
  console.log("\n📤 Sending tokens...");

  const txHash = await walletClient.writeContract({
    address: SEND_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [TARGET_WALLET as `0x${string}`, parseUnits(AMOUNT_TO_SEND, 18)],
  });

  console.log("Transaction Hash:", txHash);
  console.log("⏳ Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status === "success") {
    console.log("\n✅ Tokens sent successfully!");
    console.log("Block Number:", receipt.blockNumber.toString());
    
    // Check new balance
    const newBalance = await publicClient.readContract({
      address: SEND_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [TARGET_WALLET as `0x${string}`],
    });
    
    console.log(`\n📍 Off-Ramp Wallet (${TARGET_WALLET})`);
    console.log("SEND Balance:", formatUnits(newBalance, 18), "SEND");
    console.log("\n🎯 Next: The system will automatically detect and swap these tokens!");
  } else {
    console.log("\n❌ Transaction failed");
  }
}

sendTestTokens().catch(console.error);

