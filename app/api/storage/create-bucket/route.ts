import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * API endpoint to create the 'profiles' storage bucket
 * This is a one-time setup endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" },
        { status: 500 }
      );
    }

    // Check if bucket already exists
    const { data: existingBuckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      console.error("[Create Bucket] Error listing buckets:", listError);
      return NextResponse.json(
        { success: false, error: listError.message },
        { status: 500 }
      );
    }

    const bucketExists = existingBuckets?.some(bucket => bucket.name === 'profiles');
    
    if (bucketExists) {
      return NextResponse.json({
        success: true,
        message: "Bucket 'profiles' already exists",
        bucket: existingBuckets.find(b => b.name === 'profiles')
      });
    }

    // Create the bucket using REST API directly
    const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({
        name: 'profiles',
        public: true,
        file_size_limit: 5242880, // 5MB
        allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      })
    });

    const result = await response.json();

    if (!response.ok) {
      if (result.message?.includes('already exists') || result.error?.includes('already exists')) {
        return NextResponse.json({
          success: true,
          message: "Bucket 'profiles' already exists",
        });
      }
      
      console.error("[Create Bucket] Error:", result);
      return NextResponse.json(
        { success: false, error: result.message || result.error || "Failed to create bucket" },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Bucket 'profiles' created successfully",
      bucket: result
    });

  } catch (error: any) {
    console.error("[Create Bucket] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

