/**
 * Solana Network Off-Ramp Swap Utility
 * Handles swapping tokens to USDC using Jupiter and transferring to admin wallet
 * Sponsors gas fees by funding user wallet with SOL
 */

import {
  Connection,
  Keypair,
  Transaction,
  PublicKey,
  SystemProgram,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// Jupiter API endpoints
const JUPITER_API_BASE = "https://quote-api.jup.ag/v6";
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap";

// USDC mint on Solana
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// Minimum SOL balance for transactions (0.01 SOL)
const MIN_SOL_BALANCE = 0.01 * 1e9; // lamports
const GAS_SPONSOR_AMOUNT = 0.02 * 1e9; // 0.02 SOL for gas

export interface SolanaSwapResult {
  swapTxHash?: string;
  transferTxHash?: string;
  usdcAmount: string;
  success: boolean;
  error?: string;
}

/**
 * Get Jupiter swap quote
 */
async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50 // 0.5% default slippage
) {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: slippageBps.toString(),
    onlyDirectRoutes: "false",
    asLegacyTransaction: "false",
  });

  const response = await fetch(`${JUPITER_API_BASE}/quote?${params}`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jupiter API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Build Jupiter swap transaction
 */
async function buildJupiterSwapTransaction(
  quote: any,
  userPublicKey: PublicKey,
  wrapUnwrapSOL: boolean = true
) {
  const response = await fetch(JUPITER_SWAP_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: userPublicKey.toString(),
      wrapUnwrapSOL,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jupiter swap API error: ${response.status} - ${errorText}`);
  }

  const { swapTransaction } = await response.json();
  return Buffer.from(swapTransaction, "base64");
}

/**
 * Fund user wallet with SOL for gas (sponsor gas fees)
 */
async function fundWalletForGas(
  userWalletAddress: PublicKey,
  adminKeypair: Keypair,
  connection: Connection
): Promise<void> {
  const balance = await connection.getBalance(userWalletAddress);

  if (balance < MIN_SOL_BALANCE) {
    console.log(
      `[Solana Swap] Funding wallet ${userWalletAddress.toString()} with ${GAS_SPONSOR_AMOUNT / 1e9} SOL for gas`
    );

    const transferTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: adminKeypair.publicKey,
        toPubkey: userWalletAddress,
        lamports: GAS_SPONSOR_AMOUNT,
      })
    );

    transferTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transferTx.feePayer = adminKeypair.publicKey;
    transferTx.sign(adminKeypair);

    const signature = await connection.sendRawTransaction(transferTx.serialize());
    await connection.confirmTransaction(signature, "confirmed");

    console.log(`[Solana Swap] Gas funding successful: ${signature}`);
  } else {
    console.log(`[Solana Swap] Wallet has sufficient SOL balance: ${balance / 1e9} SOL`);
  }
}

/**
 * Swap token to USDC and transfer to admin wallet
 * Sponsors gas fees by funding user wallet with SOL
 */
export async function swapAndTransferToAdmin(
  userWalletKeypair: Keypair, // User's Solana wallet
  tokenMint: string, // Token mint address to swap
  tokenAmountRaw: number, // Amount in smallest token unit (lamports for SOL, token decimals for tokens)
  adminWalletAddress: string, // Admin wallet to receive USDC
  adminWalletPrivateKey: string, // Admin wallet private key (hex)
  rpcUrl?: string // Optional custom RPC URL
): Promise<SolanaSwapResult> {
  try {
    const connection = new Connection(
      rpcUrl || process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
      "confirmed"
    );

    // Create admin keypair from private key
    const adminKeypair = Keypair.fromSecretKey(Buffer.from(adminWalletPrivateKey, "hex"));

    // 1. Fund user wallet with SOL for gas (sponsor gas)
    await fundWalletForGas(userWalletKeypair.publicKey, adminKeypair, connection);

    // 2. Get Jupiter swap quote
    console.log(`[Solana Swap] Getting quote for ${tokenAmountRaw} raw units → USDC`);
    const quote = await getJupiterQuote(tokenMint, USDC_MINT.toString(), tokenAmountRaw);

    if (!quote || !quote.outAmount) {
      throw new Error("Invalid quote from Jupiter");
    }

    console.log(`[Solana Swap] Quote received: ${quote.outAmount} USDC (slippage: ${quote.priceImpactPct}%)`);

    // 3. Build swap transaction
    const swapTransactionBuffer = await buildJupiterSwapTransaction(
      quote,
      userWalletKeypair.publicKey
    );

    // 4. Deserialize and sign swap transaction
    const swapTransaction = VersionedTransaction.deserialize(swapTransactionBuffer);
    swapTransaction.sign([userWalletKeypair]);

    // 5. Execute swap
    console.log(`[Solana Swap] Executing swap transaction...`);
    const swapSignature = await connection.sendTransaction(swapTransaction);
    await connection.confirmTransaction(swapSignature, "confirmed");

    console.log(`[Solana Swap] Swap successful: ${swapSignature}`);

    // 6. Get USDC balance after swap
    const userUsdcATA = await getAssociatedTokenAddress(
      USDC_MINT,
      userWalletKeypair.publicKey
    );

    let usdcAccount;
    try {
      usdcAccount = await getAccount(connection, userUsdcATA);
    } catch (error) {
      // Account might not exist if balance is 0
      throw new Error("No USDC received after swap");
    }

    const usdcAmount = Number(usdcAccount.amount) / 1e6; // USDC has 6 decimals

    if (usdcAmount === 0) {
      throw new Error("No USDC received after swap");
    }

    console.log(`[Solana Swap] USDC balance after swap: ${usdcAmount}`);

    // 7. Fund gas again if needed for transfer
    await fundWalletForGas(userWalletKeypair.publicKey, adminKeypair, connection);

    // 8. Transfer USDC to admin wallet
    const adminPublicKey = new PublicKey(adminWalletAddress);
    const adminUsdcATA = await getAssociatedTokenAddress(USDC_MINT, adminPublicKey);

    const transferInstruction = createTransferInstruction(
      userUsdcATA,
      adminUsdcATA,
      userWalletKeypair.publicKey,
      usdcAccount.amount,
      [],
      TOKEN_PROGRAM_ID
    );

    const transferTx = new Transaction().add(transferInstruction);
    transferTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transferTx.feePayer = userWalletKeypair.publicKey;
    transferTx.sign(userWalletKeypair);

    console.log(`[Solana Swap] Transferring ${usdcAmount} USDC to admin wallet...`);
    const transferSignature = await connection.sendTransaction(transferTx as any);
    await connection.confirmTransaction(transferSignature, "confirmed");

    console.log(`[Solana Swap] Transfer successful: ${transferSignature}`);

    return {
      swapTxHash: swapSignature,
      transferTxHash: transferSignature,
      usdcAmount: usdcAmount.toString(),
      success: true,
    };
  } catch (error: any) {
    console.error("[Solana Swap] Error:", error);
    return {
      success: false,
      error: error.message || "Swap failed",
      usdcAmount: "0",
    };
  }
}
