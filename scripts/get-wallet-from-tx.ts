import { createClient } from '@supabase/supabase-js';
const supabaseUrl = "https://ksdzzqdafodlstfkqzuv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtzc" + "np6cWRhZm9kbHN0Zmtxenl2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTYxODQyOCwiZXhwIjoyMDU3MTk0NDI4fQ.IU_u7f6IbhJMdpFMZVE0VL6i7v4m7sPPDIY6DICJqyE";
const db = createClient(supabaseUrl, supabaseKey);

(async () => {
  const { data } = await db.from('offramp_transactions').select('*').eq('id', 'offramp_HxGHdoghoGB8').single();
  if (data) {
    const sep = "=".repeat(80);
    console.log(`\n${sep}`);
    console.log(`📍 WALLET ADDRESS FOR TESTING`);
    console.log(`${sep}\n`);
    console.log(`Transaction ID: ${data.id}`);
    console.log(`Wallet Address: ${data.wallet_address}`);
    console.log(`Status: ${data.status}\n`);
    console.log(`${sep}`);
    console.log(`\n📤 SEND YOUR 5-10 SEND TOKENS TO:\n`);
    console.log(`   ${data.wallet_address}\n`);
    console.log(`${sep}\n`);
  } else {
    console.log('Transaction not found');
  }
})();
