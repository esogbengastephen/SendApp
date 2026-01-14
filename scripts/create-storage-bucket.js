#!/usr/bin/env node

/**
 * Script to create the 'profiles' storage bucket in Supabase
 * This bucket will be used to store user profile pictures
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ksdzzqdafodlstfkqzuv.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.log('\nTo run this script:');
  console.log('  SUPABASE_SERVICE_ROLE_KEY=your_key_here node scripts/create-storage-bucket.js');
  console.log('\nOr add it to your .env.local file and run:');
  console.log('  node scripts/create-storage-bucket.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createStorageBucket() {
  console.log('🪣 Creating Supabase Storage Bucket...\n');

  try {
    // Check if bucket already exists
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError);
      process.exit(1);
    }

    const bucketExists = existingBuckets?.some(bucket => bucket.name === 'profiles');
    
    if (bucketExists) {
      console.log('✅ Bucket "profiles" already exists!');
      console.log('   No action needed.\n');
      return;
    }

    // Create the bucket using REST API directly
    console.log('Creating bucket "profiles"...');
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
        console.log('✅ Bucket "profiles" already exists!');
        console.log('   No action needed.\n');
        return;
      }
      console.error('❌ Error creating bucket:', result);
      console.log('\n⚠️  If you see a permission error, you may need to create it manually in the Supabase Dashboard.');
      console.log('   Go to: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/storage/buckets');
      process.exit(1);
    }

    console.log('✅ Bucket "profiles" created successfully!');
    console.log('\n📋 Bucket Details:');
    console.log('   Name: profiles');
    console.log('   Public: true');
    console.log('   Max File Size: 5MB');
    console.log('   Allowed Types: JPEG, PNG, WebP, GIF');
    
    // Now set up RLS policies for the bucket
    console.log('\n🔒 Setting up Row Level Security policies...');
    
    // Note: RLS policies for storage are set via SQL
    // We'll provide SQL instructions
    console.log('\n📝 Next Steps:');
    console.log('   1. Go to: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/storage/policies');
    console.log('   2. Select the "profiles" bucket');
    console.log('   3. Add the following policies:');
    console.log('\n   Policy 1: Allow public read access');
    console.log('   - Policy Name: Public Read');
    console.log('   - Allowed Operation: SELECT');
    console.log('   - Policy Definition: true');
    console.log('\n   Policy 2: Allow authenticated users to upload');
    console.log('   - Policy Name: Authenticated Upload');
    console.log('   - Allowed Operation: INSERT');
    console.log('   - Policy Definition: auth.role() = \'authenticated\'');
    console.log('\n   Policy 3: Allow users to update their own files');
    console.log('   - Policy Name: Update Own Files');
    console.log('   - Allowed Operation: UPDATE');
    console.log('   - Policy Definition: auth.uid()::text = (storage.foldername(name))[1]');
    console.log('\n   Policy 4: Allow users to delete their own files');
    console.log('   - Policy Name: Delete Own Files');
    console.log('   - Allowed Operation: DELETE');
    console.log('   - Policy Definition: auth.uid()::text = (storage.foldername(name))[1]');
    
    console.log('\n✅ Bucket creation complete!');
    console.log('   Profile picture uploads will work once RLS policies are set up.\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

createStorageBucket();

