import { createClient } from '@supabase/supabase-js';

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
  
  const statements = [
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS virtual_account_assigned_at TIMESTAMP WITH TIME ZONE',
    'CREATE INDEX IF NOT EXISTS idx_users_paystack_customer ON users(paystack_customer_code)',
    'CREATE INDEX IF NOT EXISTS idx_users_virtual_account ON users(default_virtual_account_number)'
  ];
  
  console.log(`📝 Executing ${statements.length} SQL statements...\n`);
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`[${i + 1}/${statements.length}] ${statement.substring(0, 80)}...`);
    
    try {
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql_query: statement 
      });
      
      if (error) {
        console.error(`❌ Error:`, error);
      } else {
        console.log(`✅ Success`);
      }
    } catch (err) {
      console.error(`❌ Exception:`, err);
    }
  }
  
  console.log('\n✅ Migration 008 completed!');
  console.log('\n📊 Verifying changes...');
  
  // Verify the changes
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, paystack_customer_code, default_virtual_account_number, virtual_account_assigned_at')
    .limit(3);
  
  if (error) {
    console.error('❌ Error verifying changes:', error);
  } else {
    console.log('✅ users table accessible with new columns');
    if (users && users.length > 0) {
      console.log('Sample data:', users);
    } else {
      console.log('No users in database yet');
    }
  }
}

runMigration().catch(console.error);

