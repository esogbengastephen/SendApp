import { NextRequest, NextResponse } from "next/server";
import { isValidSendTag } from "@/utils/validation";
import { supabase } from "@/lib/supabase";

/**
 * Resolve SendTag to wallet address
 * 
 * Based on SendApp repository structure:
 * - Tags table: stores SendTag names (e.g., "lightblock")
 * - send_account_tags: junction table linking tags to send_accounts
 * - send_accounts: stores wallet addresses
 * 
 * Query flow: tags -> send_account_tags -> send_accounts -> wallet_address
 * 
 * Format: SendTags use forward slash prefix (e.g., /lightblock)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sendTag } = body;

    if (!sendTag) {
      return NextResponse.json(
        { success: false, error: "SendTag is required" },
        { status: 400 }
      );
    }

    // Validate SendTag format (must start with /)
    if (!isValidSendTag(sendTag)) {
      return NextResponse.json(
        { success: false, error: "Invalid SendTag format. Must start with / and contain only alphanumeric characters and underscores (e.g., /lightblock)" },
        { status: 400 }
      );
    }

    // Remove the leading slash for database queries
    const tagName = sendTag.substring(1).toLowerCase();

    // Check if any API configuration is available
    const hasSendApi = !!process.env.SEND_API_URL;
    const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    if (!hasSendApi && !hasSupabase) {
      console.warn("SendTag resolution: No API configuration found. Set SEND_API_URL or configure Supabase.");
      return NextResponse.json(
        {
          success: false,
          error: "SendTag API is not configured. Please configure SEND_API_URL or Supabase credentials. For now, please use a wallet address (0x...) instead.",
        },
        { status: 503 }
      );
    }

    // Method 1: Try Supabase direct query (most reliable if we have access)
    if (hasSupabase) {
      try {
        console.log(`Attempting to resolve SendTag ${sendTag} (tagName: ${tagName}) via Supabase`);
        
        // Query: tags -> send_account_tags -> send_accounts
        // First, get the tag by name
        const { data: tagData, error: tagError } = await supabase
          .from("tags")
          .select("id, name, status")
          .eq("name", tagName)
          .eq("status", "confirmed") // Only confirmed tags
          .maybeSingle();

        if (tagError) {
          if (tagError.code === "PGRST116") {
            // Tag not found - this is expected if tag doesn't exist
            console.log(`Tag "${tagName}" not found in database`);
          } else {
            console.error("Error querying tags table:", tagError);
            // If it's a table/permission error, log it but continue
            if (tagError.code === "42P01" || tagError.message?.includes("does not exist")) {
              console.warn("Tags table may not exist or may not be accessible. Check Supabase configuration.");
            }
          }
        } else if (tagData) {
          console.log(`Found tag: ${tagData.name} (id: ${tagData.id})`);
          
          // Found the tag, now get the send_account via send_account_tags
          const { data: accountTagData, error: accountTagError } = await supabase
            .from("send_account_tags")
            .select("send_account_id")
            .eq("tag_id", tagData.id)
            .limit(1)
            .maybeSingle();

          if (accountTagError) {
            if (accountTagError.code === "PGRST116") {
              console.log(`No send_account_tags found for tag ${tagData.id}`);
            } else {
              console.error("Error querying send_account_tags table:", accountTagError);
            }
          } else if (accountTagData) {
            console.log(`Found send_account_tags link: ${accountTagData.send_account_id}`);
            
            // Found the account tag link, now get the wallet address
            const { data: accountData, error: accountError } = await supabase
              .from("send_accounts")
              .select("wallet_address")
              .eq("id", accountTagData.send_account_id)
              .maybeSingle();

            if (accountError) {
              if (accountError.code === "PGRST116") {
                console.log(`No send_account found for id ${accountTagData.send_account_id}`);
              } else {
                console.error("Error querying send_accounts table:", accountError);
              }
            } else if (accountData?.wallet_address) {
              const walletAddress = accountData.wallet_address;
              if (/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
                console.log(`Successfully resolved SendTag ${sendTag} to ${walletAddress} via Supabase`);
                return NextResponse.json({
                  success: true,
                  walletAddress,
                  sendTag,
                });
              } else {
                console.warn(`Invalid wallet address format: ${walletAddress}`);
              }
            }
          }
        }
      } catch (supabaseError: any) {
        console.error("Supabase query error:", supabaseError);
        // Continue to try other methods
      }
    }

    // Method 2: Try Send's public API endpoints (if configured)
    if (hasSendApi) {
      const apiEndpoints = [
        `${process.env.SEND_API_URL}/api/sendtags/${tagName}`,
        `${process.env.SEND_API_URL}/api/sendtag/${tagName}`,
        `${process.env.SEND_API_URL}/api/tags/${tagName}/wallet`,
      ];

      for (const endpoint of apiEndpoints) {
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };

          // Add authentication if API key is available
          if (process.env.SEND_API_KEY) {
            headers["Authorization"] = `Bearer ${process.env.SEND_API_KEY}`;
          }

          const response = await fetch(endpoint, {
            method: "GET",
            headers,
            signal: AbortSignal.timeout(5000), // 5 second timeout
          });

          if (response.ok) {
            const data = await response.json();
            
            // Handle different response formats
            let walletAddress: string | null = null;

            if (data.walletAddress || data.wallet_address || data.address) {
              walletAddress = data.walletAddress || data.wallet_address || data.address;
            } else if (Array.isArray(data) && data.length > 0) {
              const firstResult = data[0];
              walletAddress = firstResult.wallet_address || firstResult.walletAddress || firstResult.address;
            } else if (data.data?.walletAddress || data.data?.wallet_address) {
              walletAddress = data.data.walletAddress || data.data.wallet_address;
            }

            if (walletAddress && /^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
              console.log(`Successfully resolved SendTag ${sendTag} to ${walletAddress} via ${endpoint}`);
              return NextResponse.json({
                success: true,
                walletAddress,
                sendTag,
              });
            }
          }
        } catch (endpointError: any) {
          console.log(`Failed to resolve via ${endpoint}:`, endpointError.message);
          continue;
        }
      }
    }

    // Method 3: Try Supabase PostgREST endpoint (alternative approach)
    if (hasSupabase) {
      try {
        // Try querying via PostgREST with a view or function if available
        const postgrestUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/resolve_sendtag?tag_name=${encodeURIComponent(tagName)}`;
        
        const response = await fetch(postgrestUrl, {
          method: "GET",
          headers: {
            "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const data = await response.json();
          const walletAddress = data?.wallet_address || data?.walletAddress || data?.address;
          
          if (walletAddress && /^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            console.log(`Successfully resolved SendTag ${sendTag} to ${walletAddress} via PostgREST RPC`);
            return NextResponse.json({
              success: true,
              walletAddress,
              sendTag,
            });
          }
        }
      } catch (postgrestError: any) {
        console.log("PostgREST RPC not available:", postgrestError.message);
        // Continue to error response
      }
    }

    // If all methods failed, return error
    console.warn(`Could not resolve SendTag ${sendTag} via any available method`);
    
    return NextResponse.json(
      {
        success: false,
        error: "SendTag not found. Please verify the SendTag exists (e.g., /lightblock) or use a wallet address (0x...) instead.",
      },
      { status: 404 }
    );
  } catch (error: any) {
    console.error("SendTag resolution error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error while resolving SendTag" },
      { status: 500 }
    );
  }
}

