#!/bin/bash

# Run RLS Fix Migration via psql
# You'll be prompted for the database password

echo "Running RLS Fix Migration..."
echo "You'll be prompted for the database password"
echo ""

psql -h db.ksdzzqdafodlstfkqzuv.supabase.co \
     -p 5432 \
     -d postgres \
     -U postgres \
     -f supabase/migrations/004_complete_rls_fix.sql

echo ""
echo "Migration completed!"
echo "If you see errors, check the output above."

