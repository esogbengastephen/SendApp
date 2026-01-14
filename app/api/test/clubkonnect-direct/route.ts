import { NextRequest, NextResponse } from "next/server";

/**
 * GET - Direct test of ClubKonnect API
 * This helps debug what ClubKonnect is actually returning
 */
export async function GET(request: NextRequest) {
  const clubkonnectApiKey = process.env.CLUBKONNECT_API_KEY;
  const clubkonnectApiUsername = process.env.CLUBKONNECT_API_USERNAME;
  
  if (!clubkonnectApiKey || !clubkonnectApiUsername) {
    return NextResponse.json({ error: "Credentials not set" }, { status: 500 });
  }
  
  // Test the exact same API call the purchase route would make
  const testUrl = `https://www.nellobytesystems.com/APIAirtimeV1.asp?UserID=${encodeURIComponent(clubkonnectApiUsername)}&APIKey=${encodeURIComponent(clubkonnectApiKey)}&MobileNetwork=01&Amount=50&MobileNumber=08123456789&RequestID=TEST${Date.now()}`;
  
  try {
    const response = await fetch(testUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json, */*",
        "User-Agent": "Mozilla/5.0",
      },
    });
    
    const responseText = await response.text();
    const isHTML = responseText.trim().startsWith("<!DOCTYPE") || responseText.trim().startsWith("<html");
    
    return NextResponse.json({
      url: testUrl.replace(/APIKey=[^&]+/, "APIKey=***"),
      status: response.status,
      contentType: response.headers.get("content-type"),
      isHTML,
      responsePreview: responseText.substring(0, 500),
      fullResponse: responseText,
      success: !isHTML && responseText.includes("orderid"),
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      url: testUrl.replace(/APIKey=[^&]+/, "APIKey=***"),
    }, { status: 500 });
  }
}

