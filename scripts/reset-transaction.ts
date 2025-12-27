import { createClient } from '@supabase/supabase-js';
const supabaseUrl = "https://ksdzzqdafodlstfkqzuv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtzc" + "np6cWRhZm9kbHN0Zmtxenl2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTYxODQyOCwiZXhwIjoyMDU3MTk0NDI4fQ.IU_u7f6IbhJMdpFMZVE0VL6i7v4m7sPPDIY6DICJqyE";
const db = createClient(supabaseUrl, supabaseKey);

(async () => {
  // Find the wallet address from the screenshot
  const walletAddress = '0x9317ff359B6Ef71cD945cA791691e8806815b8d9';
  
  const { data } = await db
    .from('offramp_transactions')
    .update({
      status: 'pending',
      token_address: null,
      token_symbol: null,
      token_amount: null,
      token_amount_raw: null,
      token_received_at: null,
      all_tokens_detected: null,
    })
    .eq('wallet_address', walletAddress)
    .select();

  if (data && data.length > 0) {
    console.log(`✅ Reset transaction: ${data[0].id}`);
    console.log(`   Wallet: ${walletAddress}`);
    console.log(`   Status: ${data[0].status}`);
  } else {
    console.log('❌ Transaction not found');
  }
})();
