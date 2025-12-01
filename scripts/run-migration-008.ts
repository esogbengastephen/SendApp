import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://ksdzzqdafodlstfkqzuv.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 Running migration 008: Add User Paystack Fields...');
  
  const migrationPath = path.join(__dirname, '../supabase/migrations/008_add_user_paystack_fields.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
  
  // Split by semicolon and filter out empty statements
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`📝 Found ${statements.length} SQL statements to execute`);
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);
    console.log(statement.substring(0, 100) + '...');
    
    try {
      // Execute raw SQL using the Supabase SQL editor approach
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql_query: statement 
      });
      
      if (error) {
        console.error(`❌ Error executing statement ${i + 1}:`, error);
        // Continue with other statements
      } else {
        console.log(`✅ Statement ${i + 1} executed successfully`);
      }
    } catch (err) {
      console.error(`❌ Exception executing statement ${i + 1}:`, err);
    }
  }
  
  console.log('\n✅ Migration 008 completed!');
  console.log('\n📊 Verifying changes...');
  
  // Verify the changes
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, paystack_customer_code, default_virtual_account_number, virtual_account_assigned_at')
    .limit(5);
  
  if (error) {
    console.error('❌ Error verifying changes:', error);
  } else {
    console.log('✅ users table accessible with new columns');
    console.log('Sample data:', users);
  }
}

runMigration().catch(console.error);

