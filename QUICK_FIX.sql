-- QUICK FIX: Copy and paste this entire file into Supabase SQL Editor
-- Link: https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new

-- Drop old policies
DROP POLICY IF EXISTS "Users can read their own data" ON users;
DROP POLICY IF EXISTS "Allow public insert for signup" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Allow public read access" ON users;
DROP POLICY IF EXISTS "Allow public update" ON users;

-- Create new permissive policies for users
CREATE POLICY "Allow public read access" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public insert for signup" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON users FOR UPDATE USING (true) WITH CHECK (true);

-- Drop old policies for confirmation_codes
DROP POLICY IF EXISTS "Allow insert confirmation codes" ON confirmation_codes;
DROP POLICY IF EXISTS "Allow read confirmation codes" ON confirmation_codes;
DROP POLICY IF EXISTS "Allow update confirmation codes" ON confirmation_codes;

-- Create new permissive policies for confirmation_codes
CREATE POLICY "Allow public insert confirmation codes" ON confirmation_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read confirmation codes" ON confirmation_codes FOR SELECT USING (true);
CREATE POLICY "Allow public update confirmation codes" ON confirmation_codes FOR UPDATE USING (true) WITH CHECK (true);


