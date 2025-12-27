import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const mnemonic = process.env.OFFRAMP_MASTER_MNEMONIC;
  
  return NextResponse.json({
    exists: !!mnemonic,
    type: typeof mnemonic,
    length: mnemonic?.length || 0,
    wordCount: mnemonic?.split(/\s+/).length || 0,
    first3Words: mnemonic?.split(/\s+/).slice(0, 3).join(" ") || "",
    last3Words: mnemonic?.split(/\s+/).slice(-3).join(" ") || "",
    preview: mnemonic ? `${mnemonic.substring(0, 20)}...` : "NOT SET",
  });
}

