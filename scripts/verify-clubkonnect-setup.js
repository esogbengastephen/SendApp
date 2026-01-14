#!/usr/bin/env node

/**
 * ClubKonnect Setup Verification Script
 * 
 * This script helps verify your ClubKonnect API setup
 * Run: node scripts/verify-clubkonnect-setup.js
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 ClubKonnect Setup Verification\n');
console.log('=' .repeat(50));

// Check if .env.local exists
const envPath = path.join(__dirname, '..', '.env.local');
let envVars = {};

if (fs.existsSync(envPath)) {
  console.log('✅ .env.local file found\n');
  
  // Read and parse .env.local
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
} else {
  console.log('❌ .env.local file not found\n');
  console.log('Please create .env.local in your project root with:');
  console.log('  CLUBKONNECT_API_KEY=your_key');
  console.log('  CLUBKONNECT_API_USERNAME=your_userid');
  console.log('  CLUBKONNECT_API_PASSWORD=your_password\n');
  process.exit(1);
}

// Check required variables
console.log('📋 Checking Environment Variables:\n');

const requiredVars = [
  'CLUBKONNECT_API_KEY',
  'CLUBKONNECT_API_USERNAME',
  'CLUBKONNECT_API_PASSWORD'
];

let allPresent = true;

requiredVars.forEach(varName => {
  if (envVars[varName]) {
    const value = envVars[varName];
    const displayValue = value.length > 20 
      ? value.substring(0, 20) + '...' 
      : value;
    console.log(`  ✅ ${varName}: ${displayValue}`);
    
    // Validate format
    if (varName === 'CLUBKONNECT_API_USERNAME' && !value.startsWith('CK')) {
      console.log(`     ⚠️  Warning: UserID usually starts with "CK"`);
    }
    if (varName === 'CLUBKONNECT_API_KEY' && value.length < 20) {
      console.log(`     ⚠️  Warning: API Key seems too short`);
    }
  } else {
    console.log(`  ❌ ${varName}: NOT SET`);
    allPresent = false;
  }
});

console.log('');

if (!allPresent) {
  console.log('❌ Missing required environment variables!');
  console.log('Please add them to .env.local and restart your server.\n');
  process.exit(1);
}

// Get public IP
console.log('🌐 Checking Your Public IP Address:\n');

https.get('https://api.ipify.org', (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    const publicIP = data.trim();
    console.log(`  Your Public IP: ${publicIP}`);
    console.log(`\n  ⚠️  IMPORTANT: Make sure this IP is whitelisted in ClubKonnect!`);
    console.log(`  Whitelist URL: https://www.clubkonnect.com/APIParaWhitelistServerIPV1.asp\n`);
    
    // Summary
    console.log('=' .repeat(50));
    console.log('📊 Setup Summary:\n');
    console.log('✅ Environment variables: Configured');
    console.log(`✅ Public IP: ${publicIP}`);
    console.log('\n⚠️  Action Required:');
    console.log('   1. Whitelist your IP address in ClubKonnect');
    console.log('   2. Restart your development server');
    console.log('   3. Test a purchase\n');
    console.log('📚 Documentation:');
    console.log('   - Quick Setup: CLUBKONNECT_QUICK_SETUP.md');
    console.log('   - Full Guide: docs/setup/CLUBKONNECT_SETUP_GUIDE.md\n');
  });
}).on('error', (err) => {
  console.log('  ⚠️  Could not fetch IP address');
  console.log(`  Error: ${err.message}\n`);
  console.log('  You can check your IP at: https://whatismyipaddress.com\n');
});

