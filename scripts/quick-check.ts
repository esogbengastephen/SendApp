import { createClient } from '@supabase/supabase-js';
const supabaseUrl = "https://ksdzzqdafodlstfkqzuv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtzc" + "np6cWRhZm9kbHN0Zmtxenl2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTYxODQyOCwiZXhwIjoyMDU3MTk0NDI4fQ.IU_u7f6IbhJMdpFMZVE0VL6i7v4m7sPPDIY6DICJqyE";
const db = createClient(supabaseUrl, supabaseKey);

(async () => {
  const { data } = await db.from('offramp_transactions').select('wallet_address,status').eq('id', 'offramp_xL8Ofn5QzVyC').single();
  console.log(`\n📤 Send ${data?.wallet_address ? data.wallet_address : 'No wallet found'}\n`);
})();
