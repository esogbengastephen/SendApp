import { NextRequest, NextResponse } from "next/server";
import { getSettings, getSettingsNoCache, updateExchangeRate, updateTransactionsEnabled, updateMinimumPurchase, updateMinimumOfframpSEND, updateOnrampEnabled, updateOfframpEnabled, updateProfitMargins, updateProfitMarginsSell, updateSellRates, updateCoingeckoAutoPublish, updateCoingeckoAutoPublishSell } from "@/lib/settings";
import { isAdminWallet } from "@/lib/supabase";

/**
 * GET - Get current platform settings
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Extract wallet address from header (set by client)
    const walletAddress = authHeader.replace("Bearer ", "");
    const isAdmin = await isAdminWallet(walletAddress);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const settings = await getSettingsNoCache();

    return NextResponse.json({
      success: true,
      settings: {
        exchangeRate: settings.exchangeRate,
        transactionsEnabled: settings.transactionsEnabled !== false,
        onrampEnabled: settings.onrampEnabled !== false,
        offrampEnabled: settings.offrampEnabled !== false,
        minimumPurchase: settings.minimumPurchase || 3000,
        minimumOfframpSEND: settings.minimumOfframpSEND ?? 1,
        profitNgnSend: settings.profitNgnSend ?? 0,
        profitNgnUsdc: settings.profitNgnUsdc ?? 0,
        profitNgnUsdt: settings.profitNgnUsdt ?? 0,
        profitNgnSendSell: settings.profitNgnSendSell ?? 0,
        profitNgnUsdcSell: settings.profitNgnUsdcSell ?? 0,
        profitNgnUsdtSell: settings.profitNgnUsdtSell ?? 0,
        sendToNgnSell: settings.sendToNgnSell,
        usdcSellPriceNgn: settings.usdcSellPriceNgn,
        usdtSellPriceNgn: settings.usdtSellPriceNgn,
        coingeckoAutoPublish: settings.coingeckoAutoPublish === true,
        coingeckoAutoPublishSell: settings.coingeckoAutoPublishSell === true,
        updatedAt: settings.updatedAt.toISOString(),
        updatedBy: settings.updatedBy,
      },
    });
  } catch (error: any) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update platform settings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { exchangeRate, transactionsEnabled, onrampEnabled, offrampEnabled, minimumPurchase, minimumOfframpSEND, profitNgnSend, profitNgnUsdc, profitNgnUsdt, profitNgnSendSell, profitNgnUsdcSell, profitNgnUsdtSell, sendToNgnSell, usdcSellPriceNgn, usdtSellPriceNgn, coingeckoAutoPublish, coingeckoAutoPublishSell, walletAddress } = body;

    // Verify admin access
    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: "Wallet address required" },
        { status: 400 }
      );
    }

    const isAdmin = await isAdminWallet(walletAddress);

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    // Update exchange rate if provided
    if (exchangeRate !== undefined) {
      // Validate exchange rate
      if (isNaN(parseFloat(exchangeRate)) || parseFloat(exchangeRate) <= 0) {
        return NextResponse.json(
          { success: false, error: "Invalid exchange rate. Must be a positive number." },
          { status: 400 }
        );
      }

      const rateValue = parseFloat(exchangeRate);
      console.log(`[Admin Settings] Updating exchange rate to: ${rateValue}`);
      
      await updateExchangeRate(
        rateValue,
        walletAddress.toLowerCase()
      );
    }

    // Update transactions enabled status (global – affects all) if provided
    if (transactionsEnabled !== undefined) {
      const enabled = transactionsEnabled === true || transactionsEnabled === "true";
      console.log(`[Admin Settings] Updating transactions (global) enabled to: ${enabled}`);
      
      await updateTransactionsEnabled(
        enabled,
        walletAddress.toLowerCase()
      );
    }

    // Update onramp (buy) enabled if provided
    if (onrampEnabled !== undefined) {
      const enabled = onrampEnabled === true || onrampEnabled === "true";
      console.log(`[Admin Settings] Updating onramp enabled to: ${enabled}`);
      await updateOnrampEnabled(enabled, walletAddress.toLowerCase());
    }

    // Update offramp (sell) enabled if provided
    if (offrampEnabled !== undefined) {
      const enabled = offrampEnabled === true || offrampEnabled === "true";
      console.log(`[Admin Settings] Updating offramp enabled to: ${enabled}`);
      await updateOfframpEnabled(enabled, walletAddress.toLowerCase());
    }

    // Update buy profit margins (NGN) if provided
    if (profitNgnSend !== undefined || profitNgnUsdc !== undefined || profitNgnUsdt !== undefined) {
      const current = await getSettings();
      const send = profitNgnSend !== undefined ? (Number(profitNgnSend) || 0) : (current.profitNgnSend ?? 0);
      const usdc = profitNgnUsdc !== undefined ? (Number(profitNgnUsdc) || 0) : (current.profitNgnUsdc ?? 0);
      const usdt = profitNgnUsdt !== undefined ? (Number(profitNgnUsdt) || 0) : (current.profitNgnUsdt ?? 0);
      await updateProfitMargins(Math.max(0, send), Math.max(0, usdc), Math.max(0, usdt), walletAddress.toLowerCase());
    }

    // Update sell profit margins (NGN) if provided
    if (profitNgnSendSell !== undefined || profitNgnUsdcSell !== undefined || profitNgnUsdtSell !== undefined) {
      const current = await getSettings();
      const send = profitNgnSendSell !== undefined ? (Number(profitNgnSendSell) || 0) : (current.profitNgnSendSell ?? 0);
      const usdc = profitNgnUsdcSell !== undefined ? (Number(profitNgnUsdcSell) || 0) : (current.profitNgnUsdcSell ?? 0);
      const usdt = profitNgnUsdtSell !== undefined ? (Number(profitNgnUsdtSell) || 0) : (current.profitNgnUsdtSell ?? 0);
      await updateProfitMarginsSell(Math.max(0, send), Math.max(0, usdc), Math.max(0, usdt), walletAddress.toLowerCase());
    }

    // Update sell rates (1 SEND = X NGN, etc.) if provided
    if (sendToNgnSell !== undefined || usdcSellPriceNgn !== undefined || usdtSellPriceNgn !== undefined) {
      const sendVal = sendToNgnSell !== undefined ? parseFloat(sendToNgnSell) : undefined;
      const usdcVal = usdcSellPriceNgn !== undefined ? parseFloat(usdcSellPriceNgn) : undefined;
      const usdtVal = usdtSellPriceNgn !== undefined ? parseFloat(usdtSellPriceNgn) : undefined;
      await updateSellRates(
        sendVal != null && !isNaN(sendVal) ? sendVal : undefined,
        usdcVal != null && !isNaN(usdcVal) ? usdcVal : undefined,
        usdtVal != null && !isNaN(usdtVal) ? usdtVal : undefined,
        walletAddress.toLowerCase()
      );
    }

    // Update CoinGecko auto-publish for buy (every 30s) if provided
    if (coingeckoAutoPublish !== undefined) {
      const enabled = coingeckoAutoPublish === true || coingeckoAutoPublish === "true";
      await updateCoingeckoAutoPublish(enabled, walletAddress.toLowerCase());
    }

    // Update CoinGecko auto-publish for sell/offramp (every 30s) if provided
    if (coingeckoAutoPublishSell !== undefined) {
      const enabled = coingeckoAutoPublishSell === true || coingeckoAutoPublishSell === "true";
      await updateCoingeckoAutoPublishSell(enabled, walletAddress.toLowerCase());
    }

    // Update minimum purchase (onramp) if provided
    if (minimumPurchase !== undefined) {
      const minPurchaseValue = parseFloat(minimumPurchase);
      if (isNaN(minPurchaseValue) || minPurchaseValue <= 0) {
        return NextResponse.json(
          { success: false, error: "Invalid minimum purchase. Must be a positive number." },
          { status: 400 }
        );
      }
      console.log(`[Admin Settings] Updating minimum purchase (onramp) to: ${minPurchaseValue}`);
      await updateMinimumPurchase(minPurchaseValue, walletAddress.toLowerCase());
    }

    // Update minimum offramp sell ($SEND) if provided
    if (minimumOfframpSEND !== undefined) {
      const minOfframpValue = parseFloat(minimumOfframpSEND);
      if (isNaN(minOfframpValue) || minOfframpValue <= 0) {
        return NextResponse.json(
          { success: false, error: "Invalid minimum offramp. Must be a positive number." },
          { status: 400 }
        );
      }
      console.log(`[Admin Settings] Updating minimum offramp SEND to: ${minOfframpValue}`);
      await updateMinimumOfframpSEND(minOfframpValue, walletAddress.toLowerCase());
    }

    // Return updated settings
    const updatedSettings = await getSettings();

    return NextResponse.json({
      success: true,
      settings: {
        exchangeRate: updatedSettings.exchangeRate,
        transactionsEnabled: updatedSettings.transactionsEnabled !== false,
        onrampEnabled: updatedSettings.onrampEnabled !== false,
        offrampEnabled: updatedSettings.offrampEnabled !== false,
        minimumPurchase: updatedSettings.minimumPurchase || 3000,
        minimumOfframpSEND: updatedSettings.minimumOfframpSEND ?? 1,
        profitNgnSend: updatedSettings.profitNgnSend ?? 0,
        profitNgnUsdc: updatedSettings.profitNgnUsdc ?? 0,
        profitNgnUsdt: updatedSettings.profitNgnUsdt ?? 0,
        profitNgnSendSell: updatedSettings.profitNgnSendSell ?? 0,
        profitNgnUsdcSell: updatedSettings.profitNgnUsdcSell ?? 0,
        profitNgnUsdtSell: updatedSettings.profitNgnUsdtSell ?? 0,
        sendToNgnSell: updatedSettings.sendToNgnSell,
        usdcSellPriceNgn: updatedSettings.usdcSellPriceNgn,
        usdtSellPriceNgn: updatedSettings.usdtSellPriceNgn,
        coingeckoAutoPublish: updatedSettings.coingeckoAutoPublish === true,
        coingeckoAutoPublishSell: updatedSettings.coingeckoAutoPublishSell === true,
        updatedAt: updatedSettings.updatedAt.toISOString(),
        updatedBy: updatedSettings.updatedBy,
      },
      message: "Settings updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

