# Profile Picture Storage Setup

## Supabase Storage Bucket Setup

To enable profile picture uploads, you need to create a storage bucket in Supabase.

### Step 1: Create Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** → **Buckets**
3. Click **New Bucket**
4. Configure:
   - **Name**: `profiles`
   - **Public bucket**: ✅ Enable (so profile pictures are publicly accessible)
   - **File size limit**: 5 MB (recommended)
   - **Allowed MIME types**: `image/*` (or specific: `image/jpeg,image/png,image/gif,image/webp`)

### Step 2: Set Up Storage Policies

Run this SQL in the Supabase SQL Editor to allow users to upload their own profile pictures:

```sql
-- Allow authenticated users to upload their own profile pictures
CREATE POLICY "Users can upload their own profile pictures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to profile pictures
CREATE POLICY "Public can view profile pictures"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profiles');

-- Allow users to update their own profile pictures
CREATE POLICY "Users can update their own profile pictures"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profiles' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own profile pictures
CREATE POLICY "Users can delete their own profile pictures"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### Step 3: Alternative - Use Service Role for Uploads

If you prefer to use the service role key for uploads (simpler, but less secure), the current implementation already uses `supabaseAdmin` which bypasses RLS. Just make sure the bucket exists and is public.

### Step 4: Verify Setup

1. The bucket should be visible in Storage → Buckets
2. Try uploading a profile picture from the profile page
3. Check that the image URL is saved in the `users.photo_url` column

## Troubleshooting

- **"Bucket not found"**: Make sure the bucket name is exactly `profiles` (lowercase)
- **"Permission denied"**: Check that the bucket is set to Public
- **Images not displaying**: Verify the Next.js config includes Supabase storage URLs (already added)

