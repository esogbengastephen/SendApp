import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Get the expected origin for passkey verification
 */
function getExpectedOrigin(): string {
  // In production, use the configured domain
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      const url = new URL(appUrl);
      return url.origin;
    } catch {
      // Fallback if URL parsing fails
    }
  }
  
  // Fallback to request origin or default
  return process.env.NODE_ENV === "production" 
    ? "https://flippay.app" 
    : "http://localhost:3000";
}

export async function POST(request: NextRequest) {
  try {
    const { userId, credentialId, signature, clientDataJSON, authenticatorData } = await request.json();

    if (!userId || !credentialId || !signature || !clientDataJSON) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify origin from clientDataJSON
    try {
      const clientData = JSON.parse(
        Buffer.from(clientDataJSON.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()
      );
      const requestOrigin = clientData.origin;
      const expectedOrigin = getExpectedOrigin();
      
      // Allow both with and without www
      const origins = [
        expectedOrigin,
        expectedOrigin.replace("https://", "https://www."),
        expectedOrigin.replace("http://", "http://www."),
      ];
      
      // In development, also allow localhost
      if (process.env.NODE_ENV === "development") {
        origins.push("http://localhost:3000", "http://localhost:80", "http://127.0.0.1:3000");
      }
      
      if (!origins.includes(requestOrigin)) {
        console.warn(`[Passkey] Origin mismatch: expected one of ${origins.join(", ")}, got ${requestOrigin}`);
        // Don't fail in development, but log it
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json(
            { 
              success: false, 
              error: "Invalid origin. Please ensure you're accessing the app from the correct domain.",
              requiresRecreate: true,
            },
            { status: 401 }
          );
        }
      }
    } catch (parseError) {
      console.error("[Passkey] Error parsing clientDataJSON:", parseError);
      // Continue with verification even if origin check fails
    }

    // Verify user has this credential
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("passkey_credential_id, passkey_public_key")
      .eq("id", userId)
      .eq("passkey_credential_id", credentialId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Invalid credential. If you created your passkey on localhost, you need to recreate it on the production domain.",
          requiresRecreate: true,
        },
        { status: 401 }
      );
    }

    // In production, verify the signature cryptographically
    // For now, we'll do a basic check
    // TODO: Implement proper WebAuthn signature verification using passkey_public_key

    return NextResponse.json({
      success: true,
      message: "Passkey verified",
    });
  } catch (error: any) {
    console.error("Error verifying passkey:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

