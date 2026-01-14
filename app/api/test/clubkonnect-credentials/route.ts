import { NextRequest, NextResponse } from "next/server";

/**
 * GET - Test ClubKonnect API credentials configuration
 * This endpoint checks if credentials are properly loaded and formatted
 * WITHOUT exposing the actual credentials
 */
export async function GET(request: NextRequest) {
  const clubkonnectApiKey = process.env.CLUBKONNECT_API_KEY;
  const clubkonnectApiUsername = process.env.CLUBKONNECT_API_USERNAME;
  const clubkonnectApiPassword = process.env.CLUBKONNECT_API_PASSWORD;
  
  // Check if credentials exist
  const hasKey = !!clubkonnectApiKey;
  const hasUsername = !!clubkonnectApiUsername;
  const hasPassword = !!clubkonnectApiPassword;
  
  // Check for common issues
  const issues: string[] = [];
  
  if (!hasKey) {
    issues.push("CLUBKONNECT_API_KEY is missing");
  } else {
    // Check for whitespace issues
    if (clubkonnectApiKey !== clubkonnectApiKey.trim()) {
      issues.push("CLUBKONNECT_API_KEY has leading/trailing whitespace");
    }
    if (clubkonnectApiKey.includes(" ")) {
      issues.push("CLUBKONNECT_API_KEY contains spaces (should be trimmed)");
    }
    if (clubkonnectApiKey.length < 10) {
      issues.push("CLUBKONNECT_API_KEY seems too short (expected ~40+ characters)");
    }
  }
  
  if (!hasUsername) {
    issues.push("CLUBKONNECT_API_USERNAME is missing");
  } else {
    // Check username format (usually starts with CK)
    if (clubkonnectApiUsername !== clubkonnectApiUsername.trim()) {
      issues.push("CLUBKONNECT_API_USERNAME has leading/trailing whitespace");
    }
    if (!clubkonnectApiUsername.startsWith("CK")) {
      issues.push("CLUBKONNECT_API_USERNAME should start with 'CK' (e.g., CK101264658)");
    }
    if (clubkonnectApiUsername.length < 8) {
      issues.push("CLUBKONNECT_API_USERNAME seems too short");
    }
  }
  
  if (!hasPassword) {
    issues.push("CLUBKONNECT_API_PASSWORD is missing");
  } else {
    if (clubkonnectApiPassword !== clubkonnectApiPassword.trim()) {
      issues.push("CLUBKONNECT_API_PASSWORD has leading/trailing whitespace");
    }
  }
  
  // Return safe information (no actual credentials)
  return NextResponse.json({
    configured: hasKey && hasUsername && hasPassword,
    checks: {
      hasKey,
      hasUsername,
      hasPassword,
    },
    format: {
      usernameFormat: hasUsername ? (clubkonnectApiUsername.startsWith("CK") ? "✅ Correct format" : "❌ Should start with 'CK'") : "N/A",
      usernameLength: hasUsername ? clubkonnectApiUsername.length : 0,
      keyLength: hasKey ? clubkonnectApiKey.length : 0,
      passwordLength: hasPassword ? clubkonnectApiPassword.length : 0,
      usernamePrefix: hasUsername ? clubkonnectApiUsername.substring(0, 2) : "N/A",
      keyPrefix: hasKey ? clubkonnectApiKey.substring(0, 10) + "..." : "N/A",
    },
    issues: issues.length > 0 ? issues : ["✅ All credentials are configured"],
    recommendations: [
      "Ensure all three variables are set: CLUBKONNECT_API_USERNAME, CLUBKONNECT_API_KEY, CLUBKONNECT_API_PASSWORD",
      "Remove any quotes around values in .env.local (e.g., use: CLUBKONNECT_API_USERNAME=CK101264658 not CLUBKONNECT_API_USERNAME='CK101264658')",
      "Remove any leading/trailing spaces",
      "Restart your dev server after making changes to .env.local",
      "Verify your IP is whitelisted at: https://www.clubkonnect.com/APIParaWhitelistServerIPV1.asp",
    ],
  });
}
