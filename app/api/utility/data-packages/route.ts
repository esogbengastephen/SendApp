import { NextRequest, NextResponse } from "next/server";

/**
 * GET - Fetch data bundle packages for a specific network
 * This endpoint will call ClubKonnect API to get available data packages
 * Documentation: https://www.clubkonnect.com/APIParaGetDataBundleV1.asp
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
      const mockPackages: Record<string, any[]> = {
        MTN: [
          { id: "mtn-500mb", name: "500MB - 30 Days", amount: 200, data: "500MB", validity: "30 days" },
          { id: "mtn-1gb", name: "1GB - 30 Days", amount: 300, data: "1GB", validity: "30 days" },
          { id: "mtn-2gb", name: "2GB - 30 Days", amount: 500, data: "2GB", validity: "30 days" },
          { id: "mtn-3gb", name: "3GB - 30 Days", amount: 1000, data: "3GB", validity: "30 days" },
          { id: "mtn-5gb", name: "5GB - 30 Days", amount: 1500, data: "5GB", validity: "30 days" },
          { id: "mtn-10gb", name: "10GB - 30 Days", amount: 3000, data: "10GB", validity: "30 days" },
          { id: "mtn-20gb", name: "20GB - 30 Days", amount: 5000, data: "20GB", validity: "30 days" },
        ],
        Airtel: [
          { id: "airtel-500mb", name: "500MB - 30 Days", amount: 200, data: "500MB", validity: "30 days" },
          { id: "airtel-1gb", name: "1GB - 30 Days", amount: 300, data: "1GB", validity: "30 days" },
          { id: "airtel-2gb", name: "2GB - 30 Days", amount: 500, data: "2GB", validity: "30 days" },
          { id: "airtel-5gb", name: "5GB - 30 Days", amount: 1500, data: "5GB", validity: "30 days" },
          { id: "airtel-10gb", name: "10GB - 30 Days", amount: 3000, data: "10GB", validity: "30 days" },
          { id: "airtel-20gb", name: "20GB - 30 Days", amount: 5000, data: "20GB", validity: "30 days" },
        ],
        Glo: [
          { id: "glo-500mb", name: "500MB - 30 Days", amount: 200, data: "500MB", validity: "30 days" },
          { id: "glo-1gb", name: "1GB - 30 Days", amount: 300, data: "1GB", validity: "30 days" },
          { id: "glo-2gb", name: "2GB - 30 Days", amount: 500, data: "2GB", validity: "30 days" },
          { id: "glo-5gb", name: "5GB - 30 Days", amount: 1500, data: "5GB", validity: "30 days" },
          { id: "glo-10gb", name: "10GB - 30 Days", amount: 3000, data: "10GB", validity: "30 days" },
        ],
        "9mobile": [
          { id: "9mobile-500mb", name: "500MB - 30 Days", amount: 200, data: "500MB", validity: "30 days" },
          { id: "9mobile-1gb", name: "1GB - 30 Days", amount: 300, data: "1GB", validity: "30 days" },
          { id: "9mobile-2gb", name: "2GB - 30 Days", amount: 500, data: "2GB", validity: "30 days" },
          { id: "9mobile-5gb", name: "5GB - 30 Days", amount: 1500, data: "5GB", validity: "30 days" },
          { id: "9mobile-10gb", name: "10GB - 30 Days", amount: 3000, data: "10GB", validity: "30 days" },
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
    // Based on ClubKonnect API documentation: https://www.clubkonnect.com/APIParaGetDataBundleV1.asp
    // You'll need to:
    // 1. Make a request to their API endpoint for data packages
    // 2. Parse the response to extract package information
    // 3. Return the packages in a standardized format
    
    // Example API call structure (adjust based on actual ClubKonnect API):
    /*
    const response = await fetch(`${apiUrl}/APIParaGetDataBundleV1.asp`, {
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
      MTN: [
        { id: "mtn-500mb", name: "500MB - 30 Days", amount: 200, data: "500MB", validity: "30 days" },
        { id: "mtn-1gb", name: "1GB - 30 Days", amount: 300, data: "1GB", validity: "30 days" },
        { id: "mtn-2gb", name: "2GB - 30 Days", amount: 500, data: "2GB", validity: "30 days" },
        { id: "mtn-3gb", name: "3GB - 30 Days", amount: 1000, data: "3GB", validity: "30 days" },
        { id: "mtn-5gb", name: "5GB - 30 Days", amount: 1500, data: "5GB", validity: "30 days" },
        { id: "mtn-10gb", name: "10GB - 30 Days", amount: 3000, data: "10GB", validity: "30 days" },
        { id: "mtn-20gb", name: "20GB - 30 Days", amount: 5000, data: "20GB", validity: "30 days" },
      ],
      Airtel: [
        { id: "airtel-500mb", name: "500MB - 30 Days", amount: 200, data: "500MB", validity: "30 days" },
        { id: "airtel-1gb", name: "1GB - 30 Days", amount: 300, data: "1GB", validity: "30 days" },
        { id: "airtel-2gb", name: "2GB - 30 Days", amount: 500, data: "2GB", validity: "30 days" },
        { id: "airtel-5gb", name: "5GB - 30 Days", amount: 1500, data: "5GB", validity: "30 days" },
        { id: "airtel-10gb", name: "10GB - 30 Days", amount: 3000, data: "10GB", validity: "30 days" },
        { id: "airtel-20gb", name: "20GB - 30 Days", amount: 5000, data: "20GB", validity: "30 days" },
      ],
      Glo: [
        { id: "glo-500mb", name: "500MB - 30 Days", amount: 200, data: "500MB", validity: "30 days" },
        { id: "glo-1gb", name: "1GB - 30 Days", amount: 300, data: "1GB", validity: "30 days" },
        { id: "glo-2gb", name: "2GB - 30 Days", amount: 500, data: "2GB", validity: "30 days" },
        { id: "glo-5gb", name: "5GB - 30 Days", amount: 1500, data: "5GB", validity: "30 days" },
        { id: "glo-10gb", name: "10GB - 30 Days", amount: 3000, data: "10GB", validity: "30 days" },
      ],
      "9mobile": [
        { id: "9mobile-500mb", name: "500MB - 30 Days", amount: 200, data: "500MB", validity: "30 days" },
        { id: "9mobile-1gb", name: "1GB - 30 Days", amount: 300, data: "1GB", validity: "30 days" },
        { id: "9mobile-2gb", name: "2GB - 30 Days", amount: 500, data: "2GB", validity: "30 days" },
        { id: "9mobile-5gb", name: "5GB - 30 Days", amount: 1500, data: "5GB", validity: "30 days" },
        { id: "9mobile-10gb", name: "10GB - 30 Days", amount: 3000, data: "10GB", validity: "30 days" },
      ],
    };

    const packages = mockPackages[network] || [];

    return NextResponse.json({
      success: true,
      packages,
      network,
    });
  } catch (error: any) {
    console.error("Error fetching data packages:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

