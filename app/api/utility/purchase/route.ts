import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserFromStorage } from "@/lib/session";
import { redeemGiftCard, validateGiftCardCode } from "@/lib/reloadly";
import { notifyUtilityPurchase } from "@/lib/notifications";

/**
 * POST - Process utility purchase
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serviceId, phoneNumber, network, packageId, amount, userId } = body;

    // Validate input
    // For gift card redemption, amount is not required upfront (will be determined from gift card)
    if (!serviceId || !phoneNumber || !userId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Amount is required for all services except gift card redemption
    if (serviceId !== "gift-card-redeem" && !amount) {
      return NextResponse.json(
        { success: false, error: "Amount is required" },
        { status: 400 }
      );
    }

    const amountNum = serviceId === "gift-card-redeem" ? 0 : parseFloat(amount);
    if (serviceId !== "gift-card-redeem" && (isNaN(amountNum) || amountNum <= 0)) {
      return NextResponse.json(
        { success: false, error: "Invalid amount" },
        { status: 400 }
      );
    }

    // Fetch service settings
    const { data: service, error: serviceError } = await supabaseAdmin
      .from("utility_settings")
      .select("*")
      .eq("id", serviceId)
      .single();

    // Use default settings if service not found in database
    let serviceSettings = service;
    if (serviceError || !service) {
      const defaultServices: Record<string, any> = {
        airtime: {
          id: "airtime",
          name: "Airtime",
          status: "active",
          markup: 2.5,
          min_amount: 50,
          max_amount: 10000,
        },
        data: {
          id: "data",
          name: "Data Bundle",
          status: "active",
          markup: 3.0,
          min_amount: 100,
          max_amount: 50000,
        },
        tv: {
          id: "tv",
          name: "Cable TV Subscription",
          status: "active",
          markup: 2.0,
          min_amount: 1000,
          max_amount: 50000,
        },
        betting: {
          id: "betting",
          name: "Betting Wallet Funding",
          status: "active",
          markup: 2.5,
          min_amount: 100,
          max_amount: 100000,
        },
        "gift-card-redeem": {
          id: "gift-card-redeem",
          name: "Gift Card Redeem",
          status: "active",
          markup: 5.0,
          min_amount: 500,
          max_amount: 50000,
        },
      };

      serviceSettings = defaultServices[serviceId];
      
      if (!serviceSettings) {
        return NextResponse.json(
          { success: false, error: "Service not found" },
          { status: 404 }
        );
      }
    }

    if (serviceSettings.status !== "active") {
      return NextResponse.json(
        { success: false, error: "Service is currently unavailable" },
        { status: 400 }
      );
    }

    // Validate amount limits
    if (serviceSettings.min_amount && amountNum < parseFloat(serviceSettings.min_amount.toString())) {
      return NextResponse.json(
        { success: false, error: `Minimum amount is ₦${serviceSettings.min_amount}` },
        { status: 400 }
      );
    }

    if (serviceSettings.max_amount && amountNum > parseFloat(serviceSettings.max_amount.toString())) {
      return NextResponse.json(
        { success: false, error: `Maximum amount is ₦${serviceSettings.max_amount}` },
        { status: 400 }
      );
    }

    // For gift card redemption, amount will be determined from the gift card code
    // For other services, calculate markup and total
    const markup = parseFloat(serviceSettings.markup?.toString() || "0");
    const markupAmount = serviceId === "gift-card-redeem" ? 0 : (amountNum * markup) / 100;
    const totalAmount = serviceId === "gift-card-redeem" ? 0 : amountNum + markupAmount;

    // Check network-specific pricing if network is provided
    let finalMarkup = markup;
    if (network && serviceId !== "gift-card-redeem") {
      const { data: networkPrice } = await supabaseAdmin
        .from("utility_network_prices")
        .select("*")
        .eq("service_id", serviceId)
        .eq("network", network)
        .eq("enabled", true)
        .single();

      if (networkPrice) {
        finalMarkup = parseFloat(networkPrice.markup.toString());
      }
    }

    const finalMarkupAmount = serviceId === "gift-card-redeem" ? 0 : (amountNum * finalMarkup) / 100;
    const finalTotal = serviceId === "gift-card-redeem" ? 0 : amountNum + finalMarkupAmount;

    // Create transaction record
    // For gift card redemption, amount will be updated after validation
    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from("utility_transactions")
      .insert({
        user_id: userId,
        service_id: serviceId,
        network: network || null,
        phone_number: phoneNumber,
        amount: amountNum, // Will be updated for gift cards after validation
        markup_amount: finalMarkupAmount, // Will be updated for gift cards after validation
        total_amount: finalTotal, // Will be updated for gift cards after validation
        status: "pending",
        // Store package info in clubkonnect_response for now (can add package_id column later if needed)
        clubkonnect_response: packageId ? JSON.stringify({ packageId }) : null,
      })
      .select()
      .single();

    if (transactionError) {
      console.error("Error creating transaction:", transactionError);
      console.error("Transaction error details:", JSON.stringify(transactionError, null, 2));
      
      // Provide more helpful error messages
      let errorMessage = "Failed to create transaction";
      if (transactionError.code === "23503") {
        errorMessage = "Service not found. Please contact support.";
      } else if (transactionError.message) {
        errorMessage = transactionError.message;
      }
      
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      );
    }

    // Handle gift card redemption with Reloadly
    if (serviceId === "gift-card-redeem") {
      // Validate gift card code format
      const codeValidation = validateGiftCardCode(phoneNumber, network || "");
      if (!codeValidation.valid) {
        await supabaseAdmin
          .from("utility_transactions")
          .update({
            status: "failed",
            error_message: codeValidation.error || "Invalid gift card code",
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction.id);
        
        return NextResponse.json(
          { success: false, error: codeValidation.error || "Invalid gift card code" },
          { status: 400 }
        );
      }

      if (!network) {
        await supabaseAdmin
          .from("utility_transactions")
          .update({
            status: "failed",
            error_message: "Gift card network is required",
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction.id);
        
        return NextResponse.json(
          { success: false, error: "Please select a gift card network" },
          { status: 400 }
        );
      }

      try {
        // Redeem gift card via Reloadly (amount will be determined from gift card)
        const redeemResult = await redeemGiftCard(phoneNumber, network);

        if (!redeemResult.success) {
          await supabaseAdmin
            .from("utility_transactions")
            .update({
              status: "failed",
              error_message: redeemResult.error || "Gift card redemption failed",
              clubkonnect_response: JSON.stringify(redeemResult),
              updated_at: new Date().toISOString(),
            })
            .eq("id", transaction.id);

          return NextResponse.json(
            { success: false, error: redeemResult.error || "Gift card redemption failed" },
            { status: 400 }
          );
        }

        // Get amount from gift card redemption result
        const giftCardAmount = redeemResult.amount || amountNum || 0;
        const giftCardMarkup = (giftCardAmount * finalMarkup) / 100;
        const giftCardTotal = giftCardAmount + giftCardMarkup;

        // Update transaction with actual gift card amount
        await supabaseAdmin
          .from("utility_transactions")
          .update({
            status: "completed",
            amount: giftCardAmount,
            markup_amount: giftCardMarkup,
            total_amount: giftCardTotal,
            clubkonnect_reference: redeemResult.transactionId || `RL${Date.now()}`,
            clubkonnect_response: JSON.stringify({
              redeemCode: redeemResult.redeemCode,
              pin: redeemResult.pin,
              transactionId: redeemResult.transactionId,
              amount: giftCardAmount,
            }),
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction.id);

        return NextResponse.json({
          success: true,
          message: `Gift card redeemed successfully! Value: ₦${giftCardAmount.toLocaleString()}`,
          transaction: {
            id: transaction.id,
            reference: redeemResult.transactionId || `RL${Date.now()}`,
            amount: giftCardAmount,
            total: giftCardTotal,
            redeemCode: redeemResult.redeemCode,
            pin: redeemResult.pin,
          },
        });
      } catch (error: any) {
        console.error("Reloadly gift card redemption error:", error);

        await supabaseAdmin
          .from("utility_transactions")
          .update({
            status: "failed",
            error_message: error.message || "Gift card redemption failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", transaction.id);

        return NextResponse.json(
          { success: false, error: "Gift card redemption failed. Please try again later." },
          { status: 500 }
        );
      }
    }

    // ClubKonnect API Integration (for other services)
    const clubkonnectApiKey = process.env.CLUBKONNECT_API_KEY;
    const clubkonnectApiUsername = process.env.CLUBKONNECT_API_USERNAME;
    const clubkonnectApiPassword = process.env.CLUBKONNECT_API_PASSWORD;
    
    if (!clubkonnectApiKey || !clubkonnectApiUsername || !clubkonnectApiPassword) {
      // Update transaction as failed due to missing credentials
      await supabaseAdmin
        .from("utility_transactions")
        .update({
          status: "failed",
          error_message: "ClubKonnect API credentials not configured",
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.id);
        
      return NextResponse.json(
        { success: false, error: "Service temporarily unavailable. Please contact support." },
        { status: 500 }
      );
    }
    
    // Get API endpoint based on service type
    // ClubKonnect uses nellobytesystems.com domain for API calls
    const apiEndpoints: Record<string, string> = {
      airtime: "https://www.nellobytesystems.com/APIAirtimeV1.asp",
      data: "https://www.nellobytesystems.com/APIDatabundleV1.asp", // Note: lowercase 'b' in bundle
      tv: "https://www.nellobytesystems.com/APICableTVV1.asp",
      betting: "https://www.nellobytesystems.com/APIBettingV1.asp",
    };
    
    // Always use the correct endpoint - ignore api_endpoint from database (it may have wrong URL)
    // The correct endpoints are nellobytesystems.com, not clubkonnect.com
    const clubkonnectApiUrl = apiEndpoints[serviceId] || apiEndpoints.airtime;
    
    console.log("[ClubKonnect] Using API endpoint:", clubkonnectApiUrl);

    // Map network names to ClubKonnect network codes
    const networkCodes: Record<string, string> = {
      "MTN": "01",
      "GLO": "02",
      "9mobile": "03",
      "9Mobile": "03",
      "Airtel": "04",
    };

    // Prepare ClubKonnect API request parameters
    // Based on ClubKonnect API documentation - uses GET with query parameters
    // Note: ClubKonnect is case-sensitive, so use exact parameter names
    const clubkonnectParams: Record<string, string> = {
      UserID: clubkonnectApiUsername.trim(), // Trim whitespace
      APIKey: clubkonnectApiKey.trim(), // Trim whitespace
      Amount: amountNum.toString(),
    };
    
    console.log("[ClubKonnect] API Parameters prepared:", {
      UserID: clubkonnectParams.UserID,
      APIKey: "***" + clubkonnectApiKey.substring(clubkonnectApiKey.length - 4),
      Amount: clubkonnectParams.Amount,
      UserIDLength: clubkonnectParams.UserID.length,
      APIKeyLength: clubkonnectApiKey.length,
    });

    // Add network code - required for airtime, data, and TV
    if (network) {
      const networkCode = networkCodes[network] || network;
      clubkonnectParams.MobileNetwork = networkCode;
    } else if (serviceId === "airtime" || serviceId === "data") {
      // Network is required for airtime and data
      return NextResponse.json(
        { success: false, error: "Network selection is required" },
        { status: 400 }
      );
    }

    // Clean and format phone number for ClubKonnect
    // ClubKonnect expects: 11 digits starting with 0 (e.g., 08123456789)
    let cleanedPhoneNumber = phoneNumber.replace(/\D/g, ""); // Remove all non-digits
    
    // Convert international format to local format
    if (cleanedPhoneNumber.startsWith("234")) {
      // +2348012345678 or 2348012345678 -> 08012345678
      cleanedPhoneNumber = "0" + cleanedPhoneNumber.substring(3);
    } else if (!cleanedPhoneNumber.startsWith("0") && cleanedPhoneNumber.length === 10) {
      // 8012345678 -> 08012345678
      cleanedPhoneNumber = "0" + cleanedPhoneNumber;
    }
    
    // Validate phone number format (must be 11 digits starting with 0)
    if (!/^0[789][01]\d{8}$/.test(cleanedPhoneNumber)) {
      await supabaseAdmin
        .from("utility_transactions")
        .update({
          status: "failed",
          error_message: "Invalid phone number format",
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.id);
      
      return NextResponse.json(
        { success: false, error: "Invalid phone number format. Please use format: 08123456789" },
        { status: 400 }
      );
    }
    
    // Add phone number (parameter name varies by service)
    if (serviceId === "betting") {
      clubkonnectParams.AccountNumber = cleanedPhoneNumber;
    } else {
      clubkonnectParams.MobileNumber = cleanedPhoneNumber;
    }
    
    console.log("[ClubKonnect] Phone number:", {
      original: phoneNumber,
      cleaned: cleanedPhoneNumber,
    });

    // Add package_id for TV and Data subscriptions
    if (packageId && (serviceId === "tv" || serviceId === "data")) {
      clubkonnectParams.PackageID = packageId;
    }

    // Generate unique RequestID for tracking
    const requestId = `REQ${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
    clubkonnectParams.RequestID = requestId;

    // Add CallBackURL for webhook notifications (optional but recommended)
    // ClubKonnect will call this URL when transaction status changes
    // Only add CallBackURL if we have a public URL (not localhost)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    
    // Only add CallBackURL if we have a public URL (ClubKonnect can't reach localhost)
    if (baseUrl && !baseUrl.includes("localhost")) {
      clubkonnectParams.CallBackURL = `${baseUrl}/api/utility/clubkonnect-webhook`;
      console.log("[ClubKonnect] CallBackURL set:", clubkonnectParams.CallBackURL);
    } else {
      console.log("[ClubKonnect] CallBackURL skipped (localhost or no public URL)");
    }

    // Add bonus type for MTN/Glo bonuses (optional)
    // BonusType=01 for MTN Awuf (400% bonus)
    // BonusType=02 for MTN Garabasa (1,000% bonus)
    // For Glo 5X, use specific amounts (handled by amount value)
    if (body.bonusType && serviceId === "airtime") {
      clubkonnectParams.BonusType = body.bonusType; // "01" or "02"
    }

    try {
      // Build query string for GET request (ClubKonnect uses GET with query parameters)
      const queryParams = new URLSearchParams();
      Object.keys(clubkonnectParams).forEach(key => {
        queryParams.append(key, clubkonnectParams[key]);
      });
      
      const apiUrlWithParams = `${clubkonnectApiUrl}?${queryParams.toString()}`;
      
      console.log("[ClubKonnect] Making API call to:", clubkonnectApiUrl);
      console.log("[ClubKonnect] Full URL:", apiUrlWithParams.replace(/APIKey=[^&]+/, "APIKey=***"));
      console.log("[ClubKonnect] Parameters:", { ...clubkonnectParams, APIKey: "***" });
      console.log("[ClubKonnect] Credentials check:", {
        hasUsername: !!clubkonnectApiUsername,
        hasKey: !!clubkonnectApiKey,
        hasPassword: !!clubkonnectApiPassword,
        username: clubkonnectApiUsername,
        keyPrefix: clubkonnectApiKey?.substring(0, 10) + "...",
      });
      
      let clubkonnectResponse;
      let clubkonnectData;
      let responseText = "";
      
      try {
        // ClubKonnect API uses HTTPS GET requests
        clubkonnectResponse = await fetch(apiUrlWithParams, {
          method: "GET",
          headers: {
            "Accept": "application/json, */*",
            "User-Agent": "Mozilla/5.0",
          },
        });

        responseText = await clubkonnectResponse.text();
        console.log("[ClubKonnect] Response status:", clubkonnectResponse.status);
        console.log("[ClubKonnect] Response URL:", clubkonnectResponse.url);
        console.log("[ClubKonnect] Response headers:", Object.fromEntries(clubkonnectResponse.headers.entries()));
        console.log("[ClubKonnect] Raw response (first 1000 chars):", responseText.substring(0, 1000));
        console.log("[ClubKonnect] Response starts with:", responseText.trim().substring(0, 50));
        
        // Check if response is HTML (error page or login redirect)
        const trimmedResponse = responseText.trim();
        const isHTML = trimmedResponse.startsWith("<!DOCTYPE") || 
                      trimmedResponse.startsWith("<html") ||
                      trimmedResponse.startsWith("<?xml") && !trimmedResponse.includes("orderid");
        
        if (isHTML) {
          console.log("[ClubKonnect] Detected HTML response - checking for login page");
          // Check if it's a login page
          const lowerResponse = responseText.toLowerCase();
          if (lowerResponse.includes("login") || 
              lowerResponse.includes("password") ||
              clubkonnectResponse.url.includes("Login.asp")) {
            console.log("[ClubKonnect] Login page detected - authentication failed");
            clubkonnectData = {
              status: "failed",
              message: "API authentication failed. Please verify your API credentials and ensure your server IP is whitelisted in ClubKonnect. Visit https://www.clubkonnect.com/APIParaWhitelistServerIPV1.asp to whitelist your IP.",
              raw: responseText.substring(0, 1000),
            };
          } else {
            // Extract error message from HTML if possible
            const errorMatch = responseText.match(/<title[^>]*>([^<]+)<\/title>/i) || 
                              responseText.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                              responseText.match(/<div[^>]*class[^=]*error[^>]*>([^<]+)/i) ||
                              responseText.match(/error[^>]*>([^<]+)/i);
            
            const errorMessage = errorMatch ? errorMatch[1] : "Invalid response format from ClubKonnect API";
            
            clubkonnectData = {
              status: "failed",
              message: errorMessage,
              raw: responseText.substring(0, 1000),
            };
          }
        } 
        // Try to parse as JSON
        else if (responseText.trim().startsWith("{") || responseText.trim().startsWith("[")) {
          try {
            clubkonnectData = JSON.parse(responseText);
          } catch (parseError) {
            clubkonnectData = {
              status: "failed",
              message: "Invalid JSON response from ClubKonnect",
              raw: responseText.substring(0, 1000),
            };
          }
        }
        // Try to parse as XML
        else if (responseText.trim().startsWith("<?xml") || responseText.trim().startsWith("<")) {
          // Simple XML parsing - extract key values
          const statusMatch = responseText.match(/<status[^>]*>([^<]+)<\/status>/i) ||
                             responseText.match(/<Status[^>]*>([^<]+)<\/Status>/i);
          const messageMatch = responseText.match(/<message[^>]*>([^<]+)<\/message>/i) ||
                              responseText.match(/<Message[^>]*>([^<]+)<\/Message>/i) ||
                              responseText.match(/<error[^>]*>([^<]+)<\/error>/i) ||
                              responseText.match(/<Error[^>]*>([^<]+)<\/Error>/i);
          
          clubkonnectData = {
            status: statusMatch ? statusMatch[1].toLowerCase() : "unknown",
            message: messageMatch ? messageMatch[1] : responseText.substring(0, 200),
            raw: responseText.substring(0, 1000),
          };
        }
        // Plain text response
        else {
          const lowerText = responseText.toLowerCase();
          const trimmedText = responseText.trim();
          
          // Check for specific error patterns
          let detectedStatus = "failed";
          let detectedMessage = trimmedText || "Unknown response";
          
          if (lowerText.includes("success") || lowerText.includes("approved") || lowerText.includes("completed")) {
            detectedStatus = "success";
          } else if (lowerText.includes("authentication failed") || 
                     lowerText.includes("auth failed") || 
                     trimmedText.match(/authentication\s*failed\s*\d*/i) ||
                     trimmedText.toLowerCase().includes("authentication failed 1") ||
                     trimmedText.toLowerCase().includes("authentication failed1")) {
            detectedStatus = "failed";
            detectedMessage = "API authentication failed. Please verify your API credentials and ensure your server IP is whitelisted in ClubKonnect. Visit https://www.clubkonnect.com/APIParaWhitelistServerIPV1.asp to whitelist your IP.";
          } else if (lowerText.includes("invalid credentials") || lowerText.includes("invalid_credentials")) {
            detectedStatus = "failed";
            detectedMessage = "Invalid API credentials. Please check your ClubKonnect API key and username.";
          } else if (lowerText.includes("insufficient") || lowerText.includes("balance")) {
            detectedStatus = "failed";
            detectedMessage = "Insufficient balance in ClubKonnect account.";
          }
          
          clubkonnectData = {
            status: detectedStatus,
            message: detectedMessage,
            raw: responseText.substring(0, 1000),
          };
        }
      } catch (fetchError: any) {
        console.error("[ClubKonnect] Fetch error:", fetchError);
        // Set error response if fetch failed
        clubkonnectData = {
          status: "failed",
          message: fetchError.message || "Failed to connect to ClubKonnect API",
          raw: fetchError.toString(),
        };
      }
      
      // Ensure clubkonnectData is defined
      if (!clubkonnectData) {
        clubkonnectData = {
          status: "failed",
          message: "No response from ClubKonnect API",
          raw: "",
        };
      }
      
      console.log("[ClubKonnect] Parsed response:", clubkonnectData);

      // Check for success based on ClubKonnect API response format
      // statuscode: "200" = ORDER_COMPLETED (success)
      // statuscode: "100" = ORDER_RECEIVED (pending, but order received)
      // status: "ORDER_COMPLETED" = success
      const statusCode = clubkonnectData.statuscode || clubkonnectData.statusCode || clubkonnectData.StatusCode;
      const orderStatus = clubkonnectData.status || clubkonnectData.Status || clubkonnectData.orderstatus || clubkonnectData.OrderStatus;
      
      const isSuccess = statusCode === "200" || 
                       statusCode === 200 ||
                       orderStatus === "ORDER_COMPLETED" ||
                       orderStatus === "order_completed" ||
                       (clubkonnectData.status && clubkonnectData.status === "success") ||
                       (clubkonnectData.Status && clubkonnectData.Status === "success");
      
      // Check for error status codes
      const isError = statusCode === "100" || statusCode === 100 ? false : // ORDER_RECEIVED is not an error
                      orderStatus === "INVALID_CREDENTIALS" ||
                      orderStatus === "MISSING_CREDENTIALS" ||
                      orderStatus === "MISSING_USERID" ||
                      orderStatus === "MISSING_APIKEY" ||
                      orderStatus === "MISSING_MOBILENETWORK" ||
                      orderStatus === "MISSING_AMOUNT" ||
                      orderStatus === "INVALID_AMOUNT" ||
                      orderStatus === "MINIMUM_50" ||
                      orderStatus === "INVALID_RECIPIENT" ||
                      (statusCode && statusCode !== "200" && statusCode !== 200 && statusCode !== "100" && statusCode !== 100);

      // Get reference from orderid field (ClubKonnect uses orderid)
      const reference = clubkonnectData.orderid || 
                       clubkonnectData.orderId || 
                       clubkonnectData.OrderID ||
                       clubkonnectData.OrderId ||
                       requestId ||
                       null;

      // Map ClubKonnect error statuses to user-friendly messages
      const errorMessages: Record<string, string> = {
        "INVALID_CREDENTIALS": "Invalid API credentials. Please check your ClubKonnect API key and username.",
        "MISSING_CREDENTIALS": "API credentials are missing. Please contact support.",
        "MISSING_USERID": "API username is missing.",
        "MISSING_APIKEY": "API key is missing.",
        "MISSING_MOBILENETWORK": "Network selection is required.",
        "MISSING_AMOUNT": "Amount is required.",
        "INVALID_AMOUNT": "Invalid amount entered.",
        "MINIMUM_50": "Minimum amount is ₦50.",
        "INVALID_RECIPIENT": "Invalid phone number. Please check and try again.",
      };

      // Get error message - extract from various possible fields
      let errorMsg = clubkonnectData.remark || 
                    clubkonnectData.Remark ||
                    clubkonnectData.orderremark ||
                    clubkonnectData.OrderRemark ||
                    clubkonnectData.message || 
                    clubkonnectData.Message || 
                    clubkonnectData.error || 
                    clubkonnectData.Error ||
                    clubkonnectData.status || // Check status field
                    clubkonnectData.Status || // Check Status field
                    null;
      
      // Check if the raw response contains "Authentication Failed" pattern (including "Authentication Failed 1")
      if (!errorMsg && clubkonnectData.raw) {
        const authFailedMatch = clubkonnectData.raw.match(/authentication\s*failed\s*\d*/i);
        if (authFailedMatch) {
          errorMsg = "API authentication failed. Please verify your API credentials and ensure your server IP is whitelisted in ClubKonnect. Visit https://www.clubkonnect.com/APIParaWhitelistServerIPV1.asp to whitelist your IP.";
        }
      }
      
      // Also check the parsed data itself for "Authentication Failed" patterns
      if (!errorMsg) {
        const responseString = JSON.stringify(clubkonnectData).toLowerCase();
        if (responseString.includes("authentication failed")) {
          errorMsg = "API authentication failed. Please verify your API credentials and ensure your server IP is whitelisted in ClubKonnect. Visit https://www.clubkonnect.com/APIParaWhitelistServerIPV1.asp to whitelist your IP.";
        }
      }
      
      // Check if statuscode indicates authentication failure
      if (!errorMsg && statusCode && (statusCode === "401" || statusCode === 401 || statusCode === "403" || statusCode === 403)) {
        errorMsg = "API authentication failed. Please verify your API credentials and ensure your server IP is whitelisted in ClubKonnect.";
      }
      
      // If we have an orderStatus error code, use the mapped message
      if (!errorMsg && orderStatus && errorMessages[orderStatus]) {
        errorMsg = errorMessages[orderStatus];
      } else if (!errorMsg && orderStatus) {
        // Use the orderStatus as error message if no other message found
        errorMsg = orderStatus.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase());
      }
      
      // If we have raw HTML/text, try to extract a meaningful message
      if (!errorMsg && clubkonnectData.raw) {
        const rawText = clubkonnectData.raw;
        // Look for common error patterns
        const errorPatterns = [
          /insufficient[^<]*fund/i,
          /invalid[^<]*credentials/i,
          /invalid[^<]*phone/i,
          /network[^<]*error/i,
          /service[^<]*unavailable/i,
          /transaction[^<]*failed/i,
        ];
        
        for (const pattern of errorPatterns) {
          const match = rawText.match(pattern);
          if (match) {
            errorMsg = match[0];
            break;
          }
        }
      }
      
      // Determine transaction status
      // statuscode "200" = ORDER_COMPLETED (success)
      // statuscode "100" = ORDER_RECEIVED (pending, order received but processing)
      // Other statuscodes = error
      let transactionStatus = "failed";
      if (isSuccess) {
        transactionStatus = "completed";
      } else if (statusCode === "100" || statusCode === 100 || orderStatus === "ORDER_RECEIVED") {
        transactionStatus = "pending"; // Order received, but still processing
      }
      
      // Fallback to generic message if no error message found
      if (!errorMsg && transactionStatus === "failed") {
        errorMsg = "Transaction failed. Please check your details and try again.";
      } else if (statusCode === "100" || statusCode === 100) {
        errorMsg = null; // No error for ORDER_RECEIVED
      }

      // Update transaction with ClubKonnect response
      const { error: updateError } = await supabaseAdmin
        .from("utility_transactions")
        .update({
          status: transactionStatus,
          clubkonnect_reference: reference,
          clubkonnect_response: JSON.stringify(clubkonnectData),
          error_message: transactionStatus === "failed" ? errorMsg : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.id);

      if (updateError) {
        console.error("Error updating transaction:", updateError);
      }

      if (isSuccess) {
        // Create notification for successful utility purchase
        try {
          await notifyUtilityPurchase(
            userId,
            serviceSettings.name,
            amountNum,
            "completed",
            reference || `CK${Date.now()}`
          );
        } catch (notifError) {
          console.error("Failed to create utility purchase notification:", notifError);
        }

        return NextResponse.json({
          success: true,
          message: `${serviceSettings.name} purchase successful!`,
          transaction: {
            id: transaction.id,
            reference: reference || `CK${Date.now()}`,
            amount: amountNum,
            total: finalTotal,
          },
        });
      } else if (transactionStatus === "pending") {
        // ORDER_RECEIVED - order is processing
        return NextResponse.json({
          success: true,
          message: `${serviceSettings.name} order received and is being processed.`,
          transaction: {
            id: transaction.id,
            reference: reference || requestId,
            amount: amountNum,
            total: finalTotal,
            status: "pending",
          },
        });
      } else {
        // Create notification for failed utility purchase
        try {
          await notifyUtilityPurchase(
            userId,
            serviceSettings.name,
            amountNum,
            "failed",
            reference || `CK${Date.now()}`
          );
        } catch (notifError) {
          console.error("Failed to create failed purchase notification:", notifError);
        }

        return NextResponse.json(
          { success: false, error: errorMsg || "Transaction failed" },
          { status: 400 }
        );
      }
    } catch (apiError: any) {
      console.error("ClubKonnect API error:", apiError);

      // Update transaction as failed
      await supabaseAdmin
        .from("utility_transactions")
        .update({
          status: "failed",
          error_message: apiError.message || "API call failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.id);

      return NextResponse.json(
        { success: false, error: "Service temporarily unavailable. Please try again later." },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error processing utility purchase:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

