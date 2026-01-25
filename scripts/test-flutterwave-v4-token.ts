/**
 * Test script to debug Flutterwave v4 OAuth2 token request
 * Run with: npx tsx scripts/test-flutterwave-v4-token.ts
 */

import axios from "axios";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load environment variables
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const FLW_CLIENT_ID = process.env.FLW_CLIENT_ID || process.env.FLUTTERWAVE_CLIENT_ID;
const FLW_CLIENT_SECRET = process.env.FLW_CLIENT_SECRET || process.env.FLUTTERWAVE_CLIENT_SECRET;

console.log("=".repeat(60));
console.log("Flutterwave v4 OAuth2 Token Test");
console.log("=".repeat(60));
console.log();

// Check credentials
console.log("📋 Credentials Check:");
console.log(`  FLW_CLIENT_ID: ${FLW_CLIENT_ID ? `${FLW_CLIENT_ID.substring(0, 20)}... (length: ${FLW_CLIENT_ID.length})` : "❌ NOT SET"}`);
console.log(`  FLW_CLIENT_SECRET: ${FLW_CLIENT_SECRET ? `${FLW_CLIENT_SECRET.substring(0, 10)}... (length: ${FLW_CLIENT_SECRET.length})` : "❌ NOT SET"}`);
console.log();

if (!FLW_CLIENT_ID || !FLW_CLIENT_SECRET) {
  console.error("❌ Error: FLW_CLIENT_ID and FLW_CLIENT_SECRET must be set in .env.local");
  process.exit(1);
}

// Test OAuth2 token request
console.log("🔐 Testing OAuth2 Token Request...");
console.log(`  Endpoint: https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token`);
console.log();

try {
  const requestBody = new URLSearchParams({
    client_id: FLW_CLIENT_ID,
    client_secret: FLW_CLIENT_SECRET,
    grant_type: "client_credentials",
  });

  console.log("📤 Request Details:");
  console.log(`  Method: POST`);
  console.log(`  Content-Type: application/x-www-form-urlencoded`);
  console.log(`  Body: client_id=${FLW_CLIENT_ID.substring(0, 20)}...&client_secret=${FLW_CLIENT_SECRET.substring(0, 10)}...&grant_type=client_credentials`);
  console.log();

  const startTime = Date.now();
  const response = await axios.post(
    "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token",
    requestBody,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      validateStatus: () => true, // Don't throw on any status
    }
  );
  const endTime = Date.now();

  console.log("📥 Response Details:");
  console.log(`  Status: ${response.status} ${response.statusText}`);
  console.log(`  Response Time: ${endTime - startTime}ms`);
  console.log();

  if (response.status === 200) {
    console.log("✅ SUCCESS! Token obtained:");
    console.log(`  Access Token: ${response.data.access_token?.substring(0, 30)}...`);
    console.log(`  Token Type: ${response.data.token_type}`);
    console.log(`  Expires In: ${response.data.expires_in} seconds`);
    console.log(`  Scope: ${response.data.scope || "N/A"}`);
    console.log();
    console.log("✅ OAuth2 authentication is working correctly!");
  } else {
    console.error("❌ FAILED! Error response:");
    console.error(`  Status: ${response.status}`);
    console.error(`  Error: ${JSON.stringify(response.data, null, 2)}`);
    console.log();
    
    if (response.status === 401) {
      console.error("❌ Authentication failed. Possible issues:");
      console.error("  1. Invalid CLIENT_ID or CLIENT_SECRET");
      console.error("  2. Credentials don't match (one is Live, one is Test)");
      console.error("  3. Credentials have extra spaces or characters");
      console.error("  4. Credentials are from wrong environment");
    } else if (response.status === 400) {
      console.error("❌ Bad request. Check:");
      console.error("  1. Request format is correct");
      console.error("  2. All required parameters are present");
    } else {
      console.error(`❌ Unexpected error: ${response.status}`);
    }
  }
} catch (error: any) {
  console.error("❌ EXCEPTION occurred:");
  console.error(`  Error: ${error.message}`);
  if (error.response) {
    console.error(`  Status: ${error.response.status}`);
    console.error(`  Data: ${JSON.stringify(error.response.data, null, 2)}`);
  } else if (error.request) {
    console.error("  No response received (network error)");
  }
  console.error(`  Stack: ${error.stack}`);
}

console.log();
console.log("=".repeat(60));
