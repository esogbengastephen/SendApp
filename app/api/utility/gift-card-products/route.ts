import { NextRequest, NextResponse } from "next/server";
import { getGiftCardProducts } from "@/lib/reloadly";

/**
 * GET - Fetch available gift card products from Reloadly
 * Returns a list of gift card products that can be used for redemption
 */
export async function GET(request: NextRequest) {
  try {
    const result = await getGiftCardProducts();

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || "Failed to fetch gift card products",
          // Return fallback products if API fails
          products: getFallbackProducts()
        },
        { status: 500 }
      );
    }

    // Transform Reloadly products to our format
    const products = (result.products || []).map((product: any) => ({
      id: product.productId || product.id,
      name: product.productName || product.name || product.brand?.brandName,
      brandName: product.brand?.brandName || product.productName || product.name,
      logoUrl: product.logoUrls?.[0] || product.logo || product.brand?.logoUrls?.[0],
      category: product.category?.name || product.category,
      country: product.country?.isoName || product.country,
      // Store the full product data for reference
      productData: product,
    }));

    // Sort by name for better UX
    products.sort((a: any, b: any) => {
      const nameA = (a.name || a.brandName || "").toLowerCase();
      const nameB = (b.name || b.brandName || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return NextResponse.json({
      success: true,
      products: products,
      count: products.length,
    });
  } catch (error: any) {
    console.error("Error fetching gift card products:", error);
    
    // Return fallback products on error
    return NextResponse.json({
      success: true, // Still return success with fallback
      products: getFallbackProducts(),
      error: "Using fallback products. Reloadly API unavailable.",
    });
  }
}

/**
 * Fallback products if Reloadly API is unavailable
 * These are common gift card brands
 */
function getFallbackProducts() {
  return [
    { id: 1, name: "Amazon", brandName: "Amazon", logoUrl: null },
    { id: 2, name: "iTunes", brandName: "iTunes", logoUrl: null },
    { id: 3, name: "Google Play", brandName: "Google Play", logoUrl: null },
    { id: 4, name: "Steam", brandName: "Steam", logoUrl: null },
    { id: 5, name: "Xbox", brandName: "Xbox", logoUrl: null },
    { id: 6, name: "PlayStation", brandName: "PlayStation", logoUrl: null },
    { id: 7, name: "Netflix", brandName: "Netflix", logoUrl: null },
    { id: 8, name: "Spotify", brandName: "Spotify", logoUrl: null },
  ];
}
