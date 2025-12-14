import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, formatEther } from "viem";
import { base } from "viem/chains";
import { isAdminWallet } from "@/lib/supabase";
import { generateOfframpWallet, getAdminWalletAddress, getMasterWallet, getReceiverWalletAddress } from "@/lib/offramp-wallet";
import { BASE_RPC_URL } from "@/lib/constants";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Test off-ramp setup and configuration
 * GET /api/admin/offramp/test-setup?adminWallet=0x...
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const adminWallet = searchParams.get("adminWallet");

    // Verify admin access
    if (!adminWallet) {
      return NextResponse.json(
        { success: false, error: "Admin wallet address required" },
        { status: 400 }
      );
    }

    const isAdmin = await isAdminWallet(adminWallet);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const results: any = {
      success: true,
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // 1. Check environment variables
    const envChecks: any = {
      OFFRAMP_MASTER_MNEMONIC: !!process.env.OFFRAMP_MASTER_MNEMONIC,
      OFFRAMP_ADMIN_WALLET_ADDRESS: !!process.env.OFFRAMP_ADMIN_WALLET_ADDRESS,
      OFFRAMP_RECEIVER_WALLET_ADDRESS: !!process.env.OFFRAMP_RECEIVER_WALLET_ADDRESS,
      OFFRAMP_MASTER_WALLET_PRIVATE_KEY: !!process.env.OFFRAMP_MASTER_WALLET_PRIVATE_KEY,
      ZEROX_API_KEY: !!process.env.ZEROX_API_KEY,
      BASE_RPC_URL: !!BASE_RPC_URL,
    };

    results.checks.environment = {
      status: Object.values(envChecks).every(v => v) ? "✅ All set" : "⚠️ Missing variables",
      details: envChecks,
    };

    // 2. Test wallet generation
    try {
      const testTransactionId = "test_" + Date.now();
      const testWallet = generateOfframpWallet(testTransactionId);
      results.checks.walletGeneration = {
        status: "✅ Working",
        testAddress: testWallet.address,
        testTransactionId,
      };
    } catch (error: any) {
      results.checks.walletGeneration = {
        status: "❌ Failed",
        error: error.message,
      };
      results.success = false;
    }

    // 3. Test master wallet
    try {
      const masterWallet = getMasterWallet();
      const publicClient = createPublicClient({
        chain: base,
        transport: http(BASE_RPC_URL),
      });

      const masterBalance = await publicClient.getBalance({
        address: masterWallet.address as `0x${string}`,
      });

      const balanceETH = formatEther(masterBalance);
      const balanceETHNum = parseFloat(balanceETH);
      const balanceUSD = balanceETHNum * 3200; // Approximate ETH price

      results.checks.masterWallet = {
        status: balanceETHNum >= 0.001 ? "✅ Sufficient" : balanceETHNum >= 0.0005 ? "⚠️ Low" : "❌ Insufficient",
        address: masterWallet.address,
        balance: balanceETH,
        balanceUSD: `$${balanceUSD.toFixed(2)}`,
        recommendation: balanceETHNum < 0.001 ? "Fund with at least 0.001 ETH (~$3.20)" : "OK",
      };
    } catch (error: any) {
      results.checks.masterWallet = {
        status: "❌ Failed",
        error: error.message,
      };
      results.success = false;
    }

    // 4. Test admin wallet
    try {
      const adminWalletAddr = getAdminWalletAddress();
      results.checks.adminWallet = {
        status: "✅ Configured",
        address: adminWalletAddr,
      };
    } catch (error: any) {
      results.checks.adminWallet = {
        status: "❌ Failed",
        error: error.message,
      };
      results.success = false;
    }

    // 5. Test receiver wallet
    try {
      const receiverWalletAddr = getReceiverWalletAddress();
      const publicClient = createPublicClient({
        chain: base,
        transport: http(BASE_RPC_URL),
      });

      // Check USDC balance in receiver wallet
      const usdcBalance = await publicClient.readContract({
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`, // USDC on Base
        abi: [
          {
            constant: true,
            inputs: [{ name: "_owner", type: "address" }],
            name: "balanceOf",
            outputs: [{ name: "", type: "uint256" }],
            type: "function",
          },
        ] as const,
        functionName: "balanceOf",
        args: [receiverWalletAddr as `0x${string}`],
      }) as bigint;

      results.checks.receiverWallet = {
        status: "✅ Configured",
        address: receiverWalletAddr,
        currentUSDCBalance: (Number(usdcBalance) / 1e6).toFixed(6),
      };
    } catch (error: any) {
      results.checks.receiverWallet = {
        status: "❌ Failed",
        error: error.message,
      };
      results.success = false;
    }

    // 6. Test database connection
    try {
      const { data, error } = await supabaseAdmin
        .from("offramp_transactions")
        .select("count")
        .limit(1);

      if (error) throw error;

      results.checks.database = {
        status: "✅ Connected",
        message: "Database connection successful",
      };
    } catch (error: any) {
      results.checks.database = {
        status: "❌ Failed",
        error: error.message,
      };
      results.success = false;
    }

    // 7. Test 0x API (basic check)
    try {
      const hasApiKey = !!process.env.ZEROX_API_KEY;
      results.checks.zeroxAPI = {
        status: hasApiKey ? "✅ API Key set" : "⚠️ Missing API Key (optional)",
        hasApiKey,
        note: hasApiKey ? "API key is configured (actual API test requires a swap)" : "Set ZEROX_API_KEY in .env.local (optional, get from https://0x.org/docs/)",
      };
    } catch (error: any) {
      results.checks.zeroxAPI = {
        status: "❌ Failed",
        error: error.message,
      };
      results.success = false;
    }

    // 8. Test RPC connection
    try {
      const publicClient = createPublicClient({
        chain: base,
        transport: http(BASE_RPC_URL),
      });

      const blockNumber = await publicClient.getBlockNumber();
      results.checks.rpcConnection = {
        status: "✅ Connected",
        rpcUrl: BASE_RPC_URL,
        latestBlock: blockNumber.toString(),
      };
    } catch (error: any) {
      results.checks.rpcConnection = {
        status: "❌ Failed",
        error: error.message,
        rpcUrl: BASE_RPC_URL,
      };
      results.success = false;
    }

    // Summary
    const allChecks = Object.values(results.checks);
    const passedChecks = allChecks.filter((c: any) => c.status?.includes("✅")).length;
    const totalChecks = allChecks.length;

    results.summary = {
      totalChecks,
      passedChecks,
      failedChecks: totalChecks - passedChecks,
      ready: results.success && passedChecks === totalChecks,
    };

    return NextResponse.json(results, {
      status: results.success ? 200 : 500,
    });
  } catch (error: any) {
    console.error("[Test Setup] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

