-- Complete RLS Fix for Authentication System
-- This script grants full read/write permissions for API operations
-- Run this in Supabase SQL Editor to fix all permission issues

-- ============================================
-- FIX USERS TABLE POLICIES
-- ============================================

-- Drop ALL existing policies on users table
DROP POLICY IF EXISTS "Users can read their own data" ON users;
DROP POLICY IF EXISTS "Allow public insert for signup" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Allow public read access" ON users;
DROP POLICY IF EXISTS "Allow public update" ON users;

-- Create permissive policies for users table
-- Allow public read (for API lookups, checking if user exists, etc.)
CREATE POLICY "Allow public read access" ON users
  FOR SELECT 
  USING (true);

-- Allow public insert (for signup)
CREATE POLICY "Allow public insert for signup" ON users
  FOR INSERT 
  WITH CHECK (true);

-- Allow public update (for transaction tracking, profile updates, etc.)
CREATE POLICY "Allow public update" ON users
  FOR UPDATE 
  USING (true) 
  WITH CHECK (true);

-- ============================================
-- FIX CONFIRMATION_CODES TABLE POLICIES
-- ============================================

-- Drop ALL existing policies on confirmation_codes table
DROP POLICY IF EXISTS "Allow insert confirmation codes" ON confirmation_codes;
DROP POLICY IF EXISTS "Allow read confirmation codes" ON confirmation_codes;
DROP POLICY IF EXISTS "Allow update confirmation codes" ON confirmation_codes;

-- Create permissive policies for confirmation_codes table
-- Allow public insert (for storing codes)
CREATE POLICY "Allow public insert confirmation codes" ON confirmation_codes
  FOR INSERT 
  WITH CHECK (true);

-- Allow public read (for verifying codes)
CREATE POLICY "Allow public read confirmation codes" ON confirmation_codes
  FOR SELECT 
  USING (true);

-- Allow public update (for marking codes as used)
CREATE POLICY "Allow public update confirmation codes" ON confirmation_codes
  FOR UPDATE 
  USING (true) 
  WITH CHECK (true);

-- ============================================
-- VERIFY POLICIES WERE CREATED
-- ============================================

-- Check users table policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- Check confirmation_codes table policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'confirmation_codes'
ORDER BY policyname;

