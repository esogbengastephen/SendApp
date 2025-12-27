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

    console.log('\nFull response:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

createTestWallet();
