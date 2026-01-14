/**
 * Reloadly Gift Card API Integration
 * Documentation: https://developers.reloadly.com/
 */

const RELOADLY_CLIENT_ID = process.env.RELOADLY_CLIENT_ID;
const RELOADLY_CLIENT_SECRET = process.env.RELOADLY_CLIENT_SECRET;
const RELOADLY_USE_SANDBOX = process.env.RELOADLY_USE_SANDBOX === "true" || 
                              process.env.NODE_ENV === "development";

if (!RELOADLY_CLIENT_ID) {
  console.warn("RELOADLY_CLIENT_ID is not set in environment variables");
}

if (!RELOADLY_CLIENT_SECRET) {
  console.warn("RELOADLY_CLIENT_SECRET is not set in environment variables");
}

// Reloadly API endpoints
const RELOADLY_AUTH_URL = "https://auth.reloadly.com/oauth/token";
const RELOADLY_GIFTCARD_BASE = RELOADLY_USE_SANDBOX
  ? "https://giftcards-sandbox.reloadly.com"
  : "https://giftcards.reloadly.com";

const RELOADLY_AUDIENCE = RELOADLY_USE_SANDBOX
  ? "https://giftcards-sandbox.reloadly.com"
  : "https://giftcards.reloadly.com";

console.log(`[Reloadly] Using ${RELOADLY_USE_SANDBOX ? 'SANDBOX' : 'PRODUCTION'} API: ${RELOADLY_GIFTCARD_BASE}`);

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get OAuth access token from Reloadly
 * Token is cached and reused until expiration
 */
export async function getReloadlyAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  if (!RELOADLY_CLIENT_ID || !RELOADLY_CLIENT_SECRET) {
    throw new Error("Reloadly API credentials not configured");
  }

  try {
    const response = await fetch(RELOADLY_AUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        client_id: RELOADLY_CLIENT_ID,
        client_secret: RELOADLY_CLIENT_SECRET,
        grant_type: "client_credentials",
        audience: RELOADLY_AUDIENCE,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Reloadly] Auth error:", errorText);
      throw new Error(`Failed to authenticate with Reloadly: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // Cache the token (expires_in is in seconds)
    const expiresIn = data.expires_in || 86400; // Default to 24 hours if not provided
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (expiresIn * 1000) - 60000, // Subtract 1 minute for safety
    };

    console.log("[Reloadly] Access token obtained successfully");
    return data.access_token;
  } catch (error: any) {
    console.error("[Reloadly] Error getting access token:", error);
    throw new Error(`Reloadly authentication failed: ${error.message}`);
  }
}

/**
 * Dynamic product mapping - populated from Reloadly API
 * Maps product names/brand names to product IDs
 */
let productMapCache: Record<string, number> = {};
let productMapCacheExpiry: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Build product mapping from Reloadly products
 */
export async function buildProductMap(): Promise<Record<string, number>> {
  // Check cache
  if (Object.keys(productMapCache).length > 0 && Date.now() < productMapCacheExpiry) {
    return productMapCache;
  }

  try {
    const result = await getGiftCardProducts();
    
    if (result.success && result.products) {
      const newMap: Record<string, number> = {};
      
      result.products.forEach((product: any) => {
        const productId = product.productId || product.id;
        const name = product.productName || product.name || product.brand?.brandName;
        const brandName = product.brand?.brandName;
        
        if (productId && name) {
          // Map by product name
          newMap[name] = productId;
          // Also map by brand name if different
          if (brandName && brandName !== name) {
            newMap[brandName] = productId;
          }
        }
      });
      
      productMapCache = newMap;
      productMapCacheExpiry = Date.now() + CACHE_DURATION;
      
      console.log(`[Reloadly] Product map built with ${Object.keys(newMap).length} products`);
      return newMap;
    }
  } catch (error) {
    console.error("[Reloadly] Error building product map:", error);
  }
  
  // Return existing cache or empty map
  return productMapCache;
}

/**
 * Get Reloadly product ID for a gift card network
 * Uses dynamic mapping from Reloadly API
 */
export async function getReloadlyProductId(network: string): Promise<number | null> {
  const productMap = await buildProductMap();
  
  // Try exact match first
  if (productMap[network]) {
    return productMap[network];
  }
  
  // Try case-insensitive match
  const lowerNetwork = network.toLowerCase();
  for (const [key, value] of Object.entries(productMap)) {
    if (key.toLowerCase() === lowerNetwork) {
      return value;
    }
  }
  
  // Try partial match (e.g., "Google Play" matches "Google")
  for (const [key, value] of Object.entries(productMap)) {
    if (key.toLowerCase().includes(lowerNetwork) || lowerNetwork.includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return null;
}

/**
 * Redeem/Validate a gift card code
 * 
 * This function validates and redeems a gift card code that the user already owns.
 * The amount is determined from the gift card code itself, not passed as a parameter.
 * 
 * Note: Reloadly's API primarily focuses on purchasing gift cards.
 * For redeeming user-provided gift card codes, you may need to:
 * 1. Use Reloadly's validation endpoint (if available)
 * 2. Or integrate with a different service that validates gift card codes
 * 3. Or use Reloadly to purchase gift cards and provide codes to users
 * 
 * This implementation attempts to validate/redeem a gift card code.
 * Adjust the endpoint and request structure based on Reloadly's actual API.
 */
export async function redeemGiftCard(
  giftCardCode: string,
  network: string,
  amount?: number // Optional - will be determined from gift card if not provided
): Promise<{
  success: boolean;
  transactionId?: string;
  redeemCode?: string;
  pin?: string;
  amount?: number; // Amount determined from gift card
  message?: string;
  error?: string;
}> {
  try {
    const accessToken = await getReloadlyAccessToken();
    const productId = await getReloadlyProductId(network);

    if (!productId) {
      return {
        success: false,
        error: `Gift card network "${network}" is not supported`,
      };
    }

    // Try Reloadly's validation/redemption endpoint
    // Note: This endpoint structure may need to be adjusted based on Reloadly's actual API
    // Check Reloadly documentation: https://developers.reloadly.com/
    
    // Option 1: If Reloadly has a validation endpoint
    const validateUrl = `${RELOADLY_GIFTCARD_BASE}/validate`; // Adjust endpoint as needed
    
    const response = await fetch(validateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/com.reloadly.giftcards-v1+json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        productId: productId,
        code: giftCardCode,
        // Amount is optional - gift card validation should return the amount
        ...(amount ? { amount: amount } : {}),
      }),
    });

    if (!response.ok) {
      // Try alternative endpoint structure
      const alternativeUrl = `${RELOADLY_GIFTCARD_BASE}/redeem`;
      const altResponse = await fetch(alternativeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/com.reloadly.giftcards-v1+json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          productId: productId,
          code: giftCardCode,
          // Amount is optional - gift card validation should return the amount
          ...(amount ? { amount: amount } : {}),
        }),
      });

      if (!altResponse.ok) {
        let errorData: any;
        try {
          errorData = await altResponse.json();
        } catch {
          const errorText = await altResponse.text();
          errorData = { message: errorText || `HTTP ${altResponse.status}` };
        }
        console.error("[Reloadly] Redemption error:", errorData);
        
        return {
          success: false,
          error: errorData.message || errorData.error || `Redemption failed: ${altResponse.status}`,
        };
      }

      const altData = await altResponse.json();
      return {
        success: true,
        transactionId: altData.transactionId || altData.id || altData.transaction_id,
        redeemCode: altData.redeemCode || altData.code || altData.redeem_code,
        pin: altData.pin || altData.PIN,
        amount: altData.amount || altData.value || altData.faceValue || amount,
        message: altData.message || "Gift card redeemed successfully",
      };
    }

    const data = await response.json();
    
    return {
      success: true,
      transactionId: data.transactionId || data.id || data.transaction_id,
      redeemCode: data.redeemCode || data.code || data.redeem_code,
      pin: data.pin || data.PIN,
      amount: data.amount || data.value || data.faceValue || amount,
      message: data.message || "Gift card redeemed successfully",
    };
  } catch (error: any) {
    console.error("[Reloadly] Error redeeming gift card:", error);
    return {
      success: false,
      error: error.message || "Failed to redeem gift card. Please verify the code and try again.",
    };
  }
}

/**
 * Validate a gift card code format
 * This is a basic validation - actual validation happens via Reloadly API
 */
export function validateGiftCardCode(code: string, network: string): {
  valid: boolean;
  error?: string;
} {
  if (!code || code.trim().length === 0) {
    return { valid: false, error: "Gift card code is required" };
  }

  // Basic length validation (adjust based on actual gift card code formats)
  if (code.length < 10 || code.length > 50) {
    return { valid: false, error: "Invalid gift card code format" };
  }

  // Network-specific validation can be added here
  // For example, Amazon codes are typically alphanumeric, etc.

  return { valid: true };
}

/**
 * Get available gift card products from Reloadly
 * This can be used to populate the network dropdown with actual Reloadly products
 */
export async function getGiftCardProducts(): Promise<{
  success: boolean;
  products?: any[];
  error?: string;
}> {
  try {
    const accessToken = await getReloadlyAccessToken();
    
    const response = await fetch(`${RELOADLY_GIFTCARD_BASE}/products`, {
      method: "GET",
      headers: {
        "Accept": "application/com.reloadly.giftcards-v1+json",
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        const errorText = await response.text();
        errorData = { message: errorText || `HTTP ${response.status}` };
      }
      return {
        success: false,
        error: errorData.message || `Failed to fetch products: ${response.status}`,
      };
    }

    const data = await response.json();
    
    return {
      success: true,
      products: data.content || data.products || data,
    };
  } catch (error: any) {
    console.error("[Reloadly] Error fetching products:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch gift card products",
    };
  }
}

/**
 * Get redeem codes for a purchased gift card transaction
 * This is used after purchasing a gift card to retrieve the actual code
 */
export async function getRedeemCodes(transactionId: string): Promise<{
  success: boolean;
  redeemCode?: string;
  pin?: string;
  error?: string;
}> {
  try {
    const accessToken = await getReloadlyAccessToken();
    
    const response = await fetch(`${RELOADLY_GIFTCARD_BASE}/orders/transactions/${transactionId}/cards`, {
      method: "POST",
      headers: {
        "Accept": "application/com.reloadly.giftcards-v1+json",
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        const errorText = await response.text();
        errorData = { message: errorText || `HTTP ${response.status}` };
      }
      return {
        success: false,
        error: errorData.message || `Failed to get redeem codes: ${response.status}`,
      };
    }

    const data = await response.json();
    
    return {
      success: true,
      redeemCode: data.redeemCode || data.code || data.redeem_code,
      pin: data.pin || data.PIN,
    };
  } catch (error: any) {
    console.error("[Reloadly] Error getting redeem codes:", error);
    return {
      success: false,
      error: error.message || "Failed to get redeem codes",
    };
  }
}
