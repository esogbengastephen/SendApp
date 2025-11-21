import { NextRequest, NextResponse } from "next/server";
import { isValidSendTag } from "@/utils/validation";

/**
 * Resolve SendTag to wallet address
 * TODO: Integrate with Send API when available
 * For now, this is a placeholder that validates the format
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

    // Validate SendTag format
    if (!isValidSendTag(sendTag)) {
      return NextResponse.json(
        { success: false, error: "Invalid SendTag format. Must start with @ and contain only alphanumeric characters and underscores" },
        { status: 400 }
      );
    }

    // TODO: Integrate with Send API to resolve SendTag to wallet address
    // Example API call (when available):
    // const response = await fetch(`${SEND_API_URL}/resolve/${sendTag}`, {
    //   headers: {
    //     'Authorization': `Bearer ${SEND_API_KEY}`,
    //   },
    // });
    // const data = await response.json();
    // return NextResponse.json({ success: true, walletAddress: data.walletAddress });

    // Placeholder response
    // In production, this should call the actual Send API
    return NextResponse.json({
      success: true,
      message: "SendTag resolution will be implemented when Send API is available",
      sendTag,
      // walletAddress: "0x..." // Will be populated from Send API
    });
  } catch (error: any) {
    console.error("SendTag resolution error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

