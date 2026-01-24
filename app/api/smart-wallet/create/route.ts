import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getOrCreateSmartWallet, encryptWalletPrivateKey } from "@/lib/coinbase-smart-wallet";
import { generateSolanaWalletForUser, encryptSolanaPrivateKey } from "@/lib/solana-wallet";

export async function POST(request: NextRequest) {
  try {
    const { userId, userEmail, network } = await request.json();

    if (!userId || !userEmail || !network) {
      return NextResponse.json(
        { success: false, error: "Missing userId, userEmail, or network" },
        { status: 400 }
      );
    }

    if (network === "base") {
      // Check if user already has smart wallet
      const { data: userData, error: fetchError } = await supabaseAdmin
        .from("users")
        .select("smart_wallet_address, smart_wallet_owner_encrypted")
        .eq("id", userId)
        .single();

      if (userData?.smart_wallet_address) {
        return NextResponse.json({
          success: true,
          walletAddress: userData.smart_wallet_address,
          message: "Smart wallet already exists",
        });
      }

      // Generate smart wallet
      const walletData = await getOrCreateSmartWallet(
        userId,
        userEmail,
        userData?.smart_wallet_owner_encrypted,
        userData?.smart_wallet_address
      );

      // Encrypt private key before storing
      const encryptedKey = await encryptWalletPrivateKey(
        walletData.ownerPrivateKey,
        userId
      );

      // Store in database
      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          smart_wallet_address: walletData.address,
          smart_wallet_owner_encrypted: encryptedKey,
          smart_wallet_salt: walletData.salt,
          smart_wallet_created_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) {
        console.error("[Smart Wallet] Database error:", updateError);
        return NextResponse.json(
          { success: false, error: "Failed to save smart wallet" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        walletAddress: walletData.address,
      });
    } else if (network === "solana") {
      // Check if user already has Solana wallet
      const { data: userData, error: fetchError } = await supabaseAdmin
        .from("users")
        .select("solana_wallet_address, solana_wallet_private_key_encrypted")
        .eq("id", userId)
        .single();

      if (userData?.solana_wallet_address) {
        return NextResponse.json({
          success: true,
          walletAddress: userData.solana_wallet_address,
          message: "Solana wallet already exists",
        });
      }

      // Generate Solana wallet
      const walletData = generateSolanaWalletForUser(userId);

      // Encrypt private key
      const encryptedKey = await encryptSolanaPrivateKey(
        walletData.privateKey,
        userId
      );

      // Store in database
      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          solana_wallet_address: walletData.address,
          solana_wallet_private_key_encrypted: encryptedKey,
          solana_wallet_created_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) {
        console.error("[Solana Wallet] Database error:", updateError);
        return NextResponse.json(
          { success: false, error: "Failed to save Solana wallet" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        walletAddress: walletData.address,
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Unsupported network. Use 'base' or 'solana'" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("[Smart Wallet] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create wallet" },
      { status: 500 }
    );
  }
}
