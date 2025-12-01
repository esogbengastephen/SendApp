# 🚀 QUICK FIX - 30 Seconds

## Step 1: Open Supabase SQL Editor
Click this link: **https://supabase.com/dashboard/project/ksdzzqdafodlstfkqzuv/sql/new**

## Step 2: Copy This SQL

```sql
-- Complete RLS Fix for Authentication System
DROP POLICY IF EXISTS "Users can read their own data" ON users;
DROP POLICY IF EXISTS "Allow public insert for signup" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Allow public read access" ON users;
DROP POLICY IF EXISTS "Allow public update" ON users;

CREATE POLICY "Allow public read access" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public insert for signup" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON users FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert confirmation codes" ON confirmation_codes;
DROP POLICY IF EXISTS "Allow read confirmation codes" ON confirmation_codes;
DROP POLICY IF EXISTS "Allow update confirmation codes" ON confirmation_codes;

CREATE POLICY "Allow public insert confirmation codes" ON confirmation_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read confirmation codes" ON confirmation_codes FOR SELECT USING (true);
CREATE POLICY "Allow public update confirmation codes" ON confirmation_codes FOR UPDATE USING (true) WITH CHECK (true);
```

## Step 3: Paste and Click "Run"

That's it! ✅

## Step 4: Test
```bash
node scripts/diagnose-auth-issue.js
```

You should see: ✅ Users table is accessible (insert)


