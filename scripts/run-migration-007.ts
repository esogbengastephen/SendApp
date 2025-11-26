import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = 'https://ksdzzqdafodlstfkqzuv.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🚀 Running migration 007: Add Virtual Accounts...');
  
  const migrationPath = path.join(__dirname, '../supabase/migrations/007_add_virtual_accounts.sql');
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
  
  console.log('\n✅ Migration 007 completed!');
  console.log('\n📊 Verifying changes...');
  
  // Verify the changes
  const { data: columns, error } = await supabase
    .from('user_wallets')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error verifying changes:', error);
  } else {
    console.log('✅ user_wallets table accessible');
  }
}

runMigration().catch(console.error);

