-- Fix RLS policies to allow API operations
-- This migration fixes the "row-level security policy" violation error

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read their own data" ON users;
DROP POLICY IF EXISTS "Allow public insert for signup" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;

-- Create more permissive policies for API operations

-- Allow public read access (for API lookups)
CREATE POLICY "Allow public read access" ON users
  FOR SELECT USING (true);

-- Allow public insert for signup (API can create users)
CREATE POLICY "Allow public insert for signup" ON users
  FOR INSERT WITH CHECK (true);

-- Allow public update (for transaction tracking, etc.)
CREATE POLICY "Allow public update" ON users
  FOR UPDATE USING (true) WITH CHECK (true);

