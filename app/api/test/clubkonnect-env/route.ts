import { NextRequest, NextResponse } from "next/server";

/**
 * GET - Test endpoint to verify ClubKonnect environment variables are loaded
 * This helps debug if env vars are being read correctly
 */
export async function GET(request: NextRequest) {
  const clubkonnectApiKey = process.env.CLUBKONNECT_API_KEY;
  const clubkonnectApiUsername = process.env.CLUBKONNECT_API_USERNAME;
  const clubkonnectApiPassword = process.env.CLUBKONNECT_API_PASSWORD;
  
  return NextResponse.json({
    credentials: {
      hasUsername: !!clubkonnectApiUsername,
      hasKey: !!clubkonnectApiKey,
      hasPassword: !!clubkonnectApiPassword,
      username: clubkonnectApiUsername || "NOT SET",
      keyPrefix: clubkonnectApiKey ? `${clubkonnectApiKey.substring(0, 10)}...` : "NOT SET",
      passwordPrefix: clubkonnectApiPassword ? `${clubkonnectApiPassword.substring(0, 3)}***` : "NOT SET",
    },
    allSet: !!(clubkonnectApiKey && clubkonnectApiUsername && clubkonnectApiPassword),
  });
}

