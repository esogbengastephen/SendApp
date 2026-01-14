import { NextRequest, NextResponse } from "next/server";

/**
 * GET - Fetch betting wallet funding packages for a specific betting platform
 * This endpoint will call ClubKonnect API to get available betting packages
 * Documentation: https://www.clubkonnect.com/APIParaGetBettingV1.asp
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const network = searchParams.get("network");

    if (!network) {
      return NextResponse.json(
        { success: false, error: "Network parameter is required" },
        { status: 400 }
      );
    }

    // ClubKonnect API credentials
    const apiKey = process.env.CLUBKONNECT_API_KEY;
    const apiUsername = process.env.CLUBKONNECT_API_USERNAME;
    const apiPassword = process.env.CLUBKONNECT_API_PASSWORD;
    const apiUrl = process.env.CLUBKONNECT_API_URL || "https://www.clubkonnect.com";

    if (!apiKey || !apiUsername || !apiPassword) {
      // Return mock packages for development/testing
      // Note: Betting platforms typically don't have fixed packages, but we can provide common funding amounts
      const mockPackages: Record<string, any[]> = {
        Bet9ja: [
          { id: "bet9ja-500", name: "₦500", amount: 500 },
          { id: "bet9ja-1000", name: "₦1,000", amount: 1000 },
          { id: "bet9ja-2000", name: "₦2,000", amount: 2000 },
          { id: "bet9ja-5000", name: "₦5,000", amount: 5000 },
          { id: "bet9ja-10000", name: "₦10,000", amount: 10000 },
          { id: "bet9ja-20000", name: "₦20,000", amount: 20000 },
          { id: "bet9ja-50000", name: "₦50,000", amount: 50000 },
        ],
        SportyBet: [
          { id: "sportybet-500", name: "₦500", amount: 500 },
          { id: "sportybet-1000", name: "₦1,000", amount: 1000 },
          { id: "sportybet-2000", name: "₦2,000", amount: 2000 },
          { id: "sportybet-5000", name: "₦5,000", amount: 5000 },
          { id: "sportybet-10000", name: "₦10,000", amount: 10000 },
          { id: "sportybet-20000", name: "₦20,000", amount: 20000 },
          { id: "sportybet-50000", name: "₦50,000", amount: 50000 },
        ],
        "1xBet": [
          { id: "1xbet-500", name: "₦500", amount: 500 },
          { id: "1xbet-1000", name: "₦1,000", amount: 1000 },
          { id: "1xbet-2000", name: "₦2,000", amount: 2000 },
          { id: "1xbet-5000", name: "₦5,000", amount: 5000 },
          { id: "1xbet-10000", name: "₦10,000", amount: 10000 },
          { id: "1xbet-20000", name: "₦20,000", amount: 20000 },
          { id: "1xbet-50000", name: "₦50,000", amount: 50000 },
        ],
        NairaBet: [
          { id: "nairabet-500", name: "₦500", amount: 500 },
          { id: "nairabet-1000", name: "₦1,000", amount: 1000 },
          { id: "nairabet-2000", name: "₦2,000", amount: 2000 },
          { id: "nairabet-5000", name: "₦5,000", amount: 5000 },
          { id: "nairabet-10000", name: "₦10,000", amount: 10000 },
          { id: "nairabet-20000", name: "₦20,000", amount: 20000 },
        ],
        MerryBet: [
          { id: "merrybet-500", name: "₦500", amount: 500 },
          { id: "merrybet-1000", name: "₦1,000", amount: 1000 },
          { id: "merrybet-2000", name: "₦2,000", amount: 2000 },
          { id: "merrybet-5000", name: "₦5,000", amount: 5000 },
          { id: "merrybet-10000", name: "₦10,000", amount: 10000 },
          { id: "merrybet-20000", name: "₦20,000", amount: 20000 },
        ],
      };

      const packages = mockPackages[network] || [];
      
      return NextResponse.json({
        success: true,
        packages,
        message: "Using mock data. Configure ClubKonnect API credentials for live data.",
      });
    }

    // TODO: Integrate with actual ClubKonnect API
    // Based on ClubKonnect API documentation: https://www.clubkonnect.com/APIParaGetBettingV1.asp
    // You'll need to:
    // 1. Make a request to their API endpoint for betting packages
    // 2. Parse the response to extract package information
    // 3. Return the packages in a standardized format
    
    // Example API call structure (adjust based on actual ClubKonnect API):
    /*
    const response = await fetch(`${apiUrl}/APIParaGetBettingV1.asp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Add authentication headers as required by ClubKonnect
      },
      body: JSON.stringify({
        api_key: apiKey,
        username: apiUsername,
        password: apiPassword,
        network: network,
        action: "get_packages", // Adjust based on actual API
      }),
    });

    const data = await response.json();
    
    // Parse and format the response
    const packages = data.packages || [];
    */

    // For now, return mock packages
    const mockPackages: Record<string, any[]> = {
      Bet9ja: [
        { id: "bet9ja-500", name: "₦500", amount: 500 },
        { id: "bet9ja-1000", name: "₦1,000", amount: 1000 },
        { id: "bet9ja-2000", name: "₦2,000", amount: 2000 },
        { id: "bet9ja-5000", name: "₦5,000", amount: 5000 },
        { id: "bet9ja-10000", name: "₦10,000", amount: 10000 },
        { id: "bet9ja-20000", name: "₦20,000", amount: 20000 },
        { id: "bet9ja-50000", name: "₦50,000", amount: 50000 },
      ],
      SportyBet: [
        { id: "sportybet-500", name: "₦500", amount: 500 },
        { id: "sportybet-1000", name: "₦1,000", amount: 1000 },
        { id: "sportybet-2000", name: "₦2,000", amount: 2000 },
        { id: "sportybet-5000", name: "₦5,000", amount: 5000 },
        { id: "sportybet-10000", name: "₦10,000", amount: 10000 },
        { id: "sportybet-20000", name: "₦20,000", amount: 20000 },
        { id: "sportybet-50000", name: "₦50,000", amount: 50000 },
      ],
      "1xBet": [
        { id: "1xbet-500", name: "₦500", amount: 500 },
        { id: "1xbet-1000", name: "₦1,000", amount: 1000 },
        { id: "1xbet-2000", name: "₦2,000", amount: 2000 },
        { id: "1xbet-5000", name: "₦5,000", amount: 5000 },
        { id: "1xbet-10000", name: "₦10,000", amount: 10000 },
        { id: "1xbet-20000", name: "₦20,000", amount: 20000 },
        { id: "1xbet-50000", name: "₦50,000", amount: 50000 },
      ],
      NairaBet: [
        { id: "nairabet-500", name: "₦500", amount: 500 },
        { id: "nairabet-1000", name: "₦1,000", amount: 1000 },
        { id: "nairabet-2000", name: "₦2,000", amount: 2000 },
        { id: "nairabet-5000", name: "₦5,000", amount: 5000 },
        { id: "nairabet-10000", name: "₦10,000", amount: 10000 },
        { id: "nairabet-20000", name: "₦20,000", amount: 20000 },
      ],
      MerryBet: [
        { id: "merrybet-500", name: "₦500", amount: 500 },
        { id: "merrybet-1000", name: "₦1,000", amount: 1000 },
        { id: "merrybet-2000", name: "₦2,000", amount: 2000 },
        { id: "merrybet-5000", name: "₦5,000", amount: 5000 },
        { id: "merrybet-10000", name: "₦10,000", amount: 10000 },
        { id: "merrybet-20000", name: "₦20,000", amount: 20000 },
      ],
    };

    const packages = mockPackages[network] || [];

    return NextResponse.json({
      success: true,
      packages,
      network,
    });
  } catch (error: any) {
    console.error("Error fetching betting packages:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

