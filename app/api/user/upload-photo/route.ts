import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { userId, image, filename } = await request.json();

    if (!userId || !image) {
      return NextResponse.json(
        { success: false, error: "User ID and image are required" },
        { status: 400 }
      );
    }

    // Extract base64 data (remove data:image/...;base64, prefix)
    const base64Data = image.split(",")[1];
    if (!base64Data) {
      return NextResponse.json(
        { success: false, error: "Invalid image format" },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(base64Data, "base64");
    
    // Generate unique filename - always use jpg extension for consistency
    const fileName = `${userId}-${Date.now()}.jpg`;
    const filePath = `profiles/${fileName}`;

    // Normalize content type - always use image/jpeg (standard MIME type)
    // Some systems use image/jpg but Supabase expects image/jpeg
    const contentType = "image/jpeg";

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("profiles")
      .upload(filePath, imageBuffer, {
        contentType: contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("[Upload Photo] Storage error:", uploadError);
      
      // If bucket doesn't exist, return error with instructions
      if (uploadError.message?.includes("Bucket not found")) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Storage bucket 'profiles' not found. Please create it in Supabase Storage.",
            details: "Go to Supabase Dashboard → Storage → Create Bucket → Name it 'profiles' and set it to Public"
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: uploadError.message },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from("profiles")
      .getPublicUrl(filePath);

    const photoUrl = urlData.publicUrl;

    // Update user's photo_url in database
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ photo_url: photoUrl })
      .eq("id", userId);

    if (updateError) {
      console.error("[Upload Photo] Update error:", updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      photoUrl,
    });
  } catch (error: any) {
    console.error("[Upload Photo] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

