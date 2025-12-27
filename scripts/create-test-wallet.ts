import axios from 'axios';

async function createTestWallet() {
  try {
    const timestamp = Date.now();
    const response = await axios.post('http://localhost:3000/api/offramp/generate-address', {
      userId: `test_user_${timestamp}`,
      accountNumber: '1234567890',
      accountName: 'Test User',
      bankCode: '044'
    });

    const sep = "=".repeat(80);
    console.log(`\n${sep}`);
    console.log(`✅ NEW TEST WALLET CREATED!`);
    console.log(`${sep}\n`);
    console.log(`Wallet Address: ${response.data.walletAddress}`);
    console.log(`Transaction ID: ${response.data.transactionId}`);
    console.log(`\n${sep}`);
    console.log(`\n📤 SEND YOUR SEND TOKENS TO:`);
    console.log(`\n   ${response.data.walletAddress}\n`);
    console.log(`${sep}\n`);
    console.log(`Then run swap-token API with transaction ID: ${response.data.transactionId}\n`);
    console.log(`${sep}\n`);
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

createTestWallet();
