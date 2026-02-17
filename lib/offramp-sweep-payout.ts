/**
 * Off-ramp sweep + payout: when SEND is received at a dedicated deposit address
 * (user's Smart Wallet, e.g. 0x97F92d40b1201220E4BECf129c16661e457f6147),
 * sweep it to the pool wallet and pay out NGN via Flutterwave.
 * Uses Coinbase Paymaster to sponsor the sweep (no EOA gas funding).
 */

import { createPublicClient, http, formatUnits, encodeFunctionData } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createBundlerClient, toCoinbaseSmartAccount, waitForUserOperationReceipt } from "viem/account-abstraction";
import { BASE_RPC_URL, SEND_TOKEN_ADDRESS } from "./constants";
import { getPublicClient, getLiquidityPoolAddress, getTokenBalance, normalizeBaseAddress } from "./blockchain";
import { decryptWalletPrivateKey } from "./coinbase-smart-wallet";
import { createTransfer } from "./flutterwave";
import { getSettings, getMinimumPurchase } from "./settings";
import { supabaseAdmin } from "./supabase";

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
] as const;

/** Minimum SEND balance to trigger sweep (avoid dust and fee issues) */
const MIN_SEND_SWEEP = parseFloat(process.env.OFFRAMP_MIN_SEND_SWEEP || "0.01");

/** CDP Paymaster/Bundler RPC URL for Base mainnet (from CDP Portal → Paymaster). Required for sponsored sweep. */
function getBundlerRpcUrl(): string {
  const url = process.env.COINBASE_BUNDLER_RPC_URL?.trim();
  if (!url) {
    throw new Error(
      "Paymaster is required for off-ramp sweep. Set COINBASE_BUNDLER_RPC_URL to your CDP Paymaster endpoint (Base mainnet). Get it from CDP Portal → Paymaster."
    );
  }
  return url;
}

export interface OfframpRow {
  id: string;
  transaction_id: string;
  user_id: string | null;
  deposit_address: string | null;
  deposit_private_key_encrypted: string | null;
  account_number: string | null;
  account_name: string | null;
  bank_code: string | null;
  network: string | null;
  status: string;
}

/**
 * Get the pool/receiver address that receives swept SEND.
 * Priority: OFFRAMP_RECEIVER_WALLET_ADDRESS > OFFRAMP_POOL_PRIVATE_KEY > LIQUIDITY_POOL (same as onramp).
 */
export function getOfframpPoolAddress(): string {
  const receiver = process.env.OFFRAMP_RECEIVER_WALLET_ADDRESS?.trim();
  if (receiver && receiver.length >= 42) {
    return receiver.startsWith("0x") ? receiver : `0x${receiver}`;
  }
  const pk = process.env.OFFRAMP_POOL_PRIVATE_KEY;
  if (pk) {
    const key = pk.trim().replace(/\s/g, "").startsWith("0x") ? pk.trim() : `0x${pk.trim()}`;
    const account = privateKeyToAccount(key as `0x${string}`);
    return account.address;
  }
  return getLiquidityPoolAddress();
}

/**
 * SEND → NGN sell rate (1 SEND = X NGN). Uses sendToNgnSell if set, else buy exchangeRate.
 */
export async function getSendToNgnSellRate(): Promise<number> {
  const settings = await getSettings();
  const rate = settings.sendToNgnSell ?? settings.exchangeRate;
  if (!rate || rate <= 0) {
    throw new Error("Off-ramp sell rate not configured. Set sendToNgnSell or exchangeRate in platform settings.");
  }
  return rate;
}

/**
 * Sweep SEND from user's Smart Wallet (deposit address) to pool via Paymaster-sponsored UserOperation.
 * No EOA gas funding: the sweep is executed by the Smart Wallet as the UserOp sender, with gas paid by CDP Paymaster.
 */
async function sweepSendFromSmartWallet(
  userId: string,
  smartWalletAddress: string,
  poolAddress: string
): Promise<{ success: boolean; txHash?: string; sendAmount?: string; error?: string }> {
  try {
    const bundlerRpcUrl = getBundlerRpcUrl();

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("smart_wallet_owner_encrypted")
      .eq("id", userId)
      .single();

    if (!user?.smart_wallet_owner_encrypted) {
      return { success: false, error: "Smart wallet owner key not found for user" };
    }

    const ownerPrivateKey = await decryptWalletPrivateKey(user.smart_wallet_owner_encrypted, userId);
    const ownerAccount = privateKeyToAccount(ownerPrivateKey as `0x${string}`);

    const publicClient = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL, { retryCount: 3, retryDelay: 1000 }),
    });

    const balanceWei = (await publicClient.readContract({
      address: SEND_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [smartWalletAddress as `0x${string}`],
    })) as bigint;

    if (balanceWei === BigInt(0)) {
      return { success: false, error: "No SEND balance at Smart Wallet" };
    }

    const decimals = (await publicClient.readContract({
      address: SEND_TOKEN_ADDRESS as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "decimals",
    })) as number;
    const sendAmount = formatUnits(balanceWei, decimals);

    const transferCalldata = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [poolAddress as `0x${string}`, balanceWei],
    });

    // Coinbase Smart Account (same address as deposit_address so we sweep from the correct wallet)
    const account = await toCoinbaseSmartAccount({
      client: publicClient,
      owners: [ownerAccount],
      version: "1.1",
      address: smartWalletAddress as `0x${string}`,
    });

    const bundlerClient = createBundlerClient({
      client: publicClient,
      chain: base,
      transport: http(bundlerRpcUrl, { retryCount: 3, retryDelay: 1000 }),
      paymaster: true,
    });

    // Single call: Smart Wallet executes SEND.transfer(pool, amount)
    const calls = [
      {
        to: SEND_TOKEN_ADDRESS as `0x${string}`,
        data: transferCalldata,
        value: BigInt(0),
      },
    ] as const;

    const userOpHash = await bundlerClient.sendUserOperation({
      account,
      calls,
      paymaster: true,
    });

    const receipt = await waitForUserOperationReceipt(bundlerClient, { hash: userOpHash });
    const txHash = receipt.receipt.transactionHash;

    console.log(`[Offramp Sweep] Swept ${sendAmount} SEND from Smart Wallet to pool (paymaster sponsored), tx: ${txHash}`);
    return { success: true, txHash, sendAmount };
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[Offramp Sweep] Smart Wallet sweep failed:", err);
    return { success: false, error: err };
  }
}

/**
 * Process one pending off-ramp: check balance, sweep SEND from Smart Wallet, pay NGN via Flutterwave, update DB.
 * Only Smart Wallet deposits are supported (user_id + deposit_address; no EOA).
 */
export async function processOneOfframpPayout(row: OfframpRow): Promise<{
  success: boolean;
  transactionId?: string;
  sendAmount?: string;
  ngnAmount?: number;
  sweepTxHash?: string;
  error?: string;
}> {
  const { transaction_id, user_id, deposit_address, account_number, account_name, bank_code, network } = row;

  if (network !== "base") {
    return { success: false, error: "Only Base (SEND) off-ramp is supported" };
  }
  if (!deposit_address || !user_id) {
    return { success: false, error: "Missing deposit_address or user_id (Smart Wallet required)" };
  }
  if (!account_number || !bank_code) {
    return { success: false, error: "Missing account_number or bank_code" };
  }

  let depositAddressHex: string;
  try {
    depositAddressHex = normalizeBaseAddress(deposit_address);
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Invalid deposit address: ${err}` };
  }

  let sendBalance: string;
  try {
    sendBalance = await getTokenBalance(depositAddressHex);
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Failed to read balance: ${err}` };
  }

  const sendNum = parseFloat(sendBalance);
  if (isNaN(sendNum) || sendNum < MIN_SEND_SWEEP) {
    return { success: false, error: `Insufficient SEND balance: ${sendBalance} (min ${MIN_SEND_SWEEP})` };
  }

  const poolAddress = getOfframpPoolAddress();
  const sweepResult = await sweepSendFromSmartWallet(user_id, depositAddressHex, poolAddress);

  if (!sweepResult.success || !sweepResult.sendAmount) {
    await supabaseAdmin
      .from("offramp_transactions")
      .update({
        status: "failed",
        error_message: sweepResult.error ?? "Sweep failed",
        updated_at: new Date().toISOString(),
      })
      .eq("transaction_id", transaction_id);
    return { success: false, error: sweepResult.error };
  }

  const sendAmount = sweepResult.sendAmount;
  const rate = await getSendToNgnSellRate();
  const ngnAmount = Math.floor(parseFloat(sendAmount) * rate);
  const minPayoutNgn = await getMinimumPurchase();

  if (ngnAmount < minPayoutNgn) {
    await supabaseAdmin
      .from("offramp_transactions")
      .update({
        status: "failed",
        error_message: `NGN amount too small: ${ngnAmount} (min ${minPayoutNgn}, rate ${rate})`,
        updated_at: new Date().toISOString(),
      })
      .eq("transaction_id", transaction_id);
    return {
      success: false,
      error: `NGN amount too small to pay out. Minimum payout is ₦${minPayoutNgn.toLocaleString()} (you have ~₦${ngnAmount.toLocaleString()}). Send more SEND to meet the minimum.`,
    };
  }

  // 3) Flutterwave transfer
  const reference = `OFFRAMP-${transaction_id}-${Date.now()}`;
  const transferResult = await createTransfer({
    accountBank: bank_code,
    accountNumber: account_number.replace(/\D/g, "").slice(0, 10),
    amount: ngnAmount,
    currency: "NGN",
    narration: `SEND off-ramp payout ${transaction_id}`,
    reference,
  });

  if (!transferResult.success) {
    await supabaseAdmin
      .from("offramp_transactions")
      .update({
        status: "failed",
        error_message: `Flutterwave transfer failed: ${transferResult.error}`,
        swap_tx_hash: sweepResult.txHash,
        token_amount: sendAmount,
        ngn_amount: ngnAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("transaction_id", transaction_id);
    return { success: false, error: transferResult.error };
  }

  // 4) Mark completed
  const { error: updateErr } = await supabaseAdmin
    .from("offramp_transactions")
    .update({
      status: "completed",
      swap_tx_hash: sweepResult.txHash,
      token_amount: sendAmount,
      ngn_amount: ngnAmount,
      payment_reference: reference,
      paid_at: new Date().toISOString(),
      token_received_at: new Date().toISOString(),
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("transaction_id", transaction_id);

  if (updateErr) {
    console.error("[Offramp Payout] DB update error:", updateErr);
    return {
      success: false,
      error: `Payout sent but DB update failed: ${updateErr.message}`,
      transactionId: transaction_id,
      sendAmount,
      ngnAmount,
      sweepTxHash: sweepResult.txHash,
    };
  }

  console.log(`[Offramp Payout] Completed ${transaction_id}: ${sendAmount} SEND → ₦${ngnAmount}`);
  return {
    success: true,
    transactionId: transaction_id,
    sendAmount,
    ngnAmount,
    sweepTxHash: sweepResult.txHash,
  };
}

/**
 * Fetch all pending Base off-ramp transactions (Smart Wallet only) and process each (sweep + payout).
 */
export async function processPendingOfframpPayouts(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  results: Array<{ transactionId: string; success: boolean; error?: string }>;
}> {
  const { data: rows, error } = await supabaseAdmin
    .from("offramp_transactions")
    .select("id, transaction_id, user_id, deposit_address, deposit_private_key_encrypted, account_number, account_name, bank_code, network, status")
    .eq("status", "pending")
    .not("deposit_address", "is", null)
    .not("user_id", "is", null)
    .is("deposit_private_key_encrypted", null)
    .eq("network", "base");

  if (error) {
    console.error("[Offramp Payout] Failed to fetch pending:", error);
    return { processed: 0, succeeded: 0, failed: 0, results: [] };
  }

  const results: Array<{ transactionId: string; success: boolean; error?: string }> = [];
  let succeeded = 0;
  let failed = 0;

  for (const row of rows || []) {
    const r = await processOneOfframpPayout(row as OfframpRow);
    results.push({
      transactionId: row.transaction_id,
      success: r.success,
      error: r.error,
    });
    if (r.success) succeeded++;
    else failed++;
    // Avoid rate limits
    await new Promise((res) => setTimeout(res, 1500));
  }

  return {
    processed: rows?.length ?? 0,
    succeeded,
    failed,
    results,
  };
}
