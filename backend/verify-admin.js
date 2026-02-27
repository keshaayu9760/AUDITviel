/**
 * Quick verification script to check if admin address is configured correctly
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { ethers } = require('ethers');

function resolveAdminAddress() {
  // Check ADMIN_ADDRESS first
  if (process.env.ADMIN_ADDRESS) {
    const addr = process.env.ADMIN_ADDRESS.trim();
    if (ethers.isAddress(addr)) {
      console.log('✓ Using ADMIN_ADDRESS from environment:', addr);
      return addr.toLowerCase();
    } else {
      console.error('✗ Invalid ADMIN_ADDRESS format:', addr);
      return null;
    }
  }
  
  // Check ADMIN_PUBLIC_ADDRESS
  if (process.env.ADMIN_PUBLIC_ADDRESS) {
    const addr = process.env.ADMIN_PUBLIC_ADDRESS.trim();
    if (ethers.isAddress(addr)) {
      console.log('✓ Using ADMIN_PUBLIC_ADDRESS from environment:', addr);
      return addr.toLowerCase();
    }
  }
  
  // Fallback to deriving from private key
  const key = process.env.ADMIN_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (key) {
    try {
      const wallet = new ethers.Wallet(key.startsWith('0x') ? key : `0x${key}`);
      console.log('✓ Derived admin address from private key:', wallet.address);
      return wallet.address.toLowerCase();
    } catch (err) {
      console.error('✗ Error deriving address:', err.message);
      return null;
    }
  }
  
  console.error('✗ No ADMIN_ADDRESS, ADMIN_PUBLIC_ADDRESS, or ADMIN_PRIVATE_KEY found');
  return null;
}

const adminAddress = resolveAdminAddress();

if (adminAddress) {
  console.log('\n✅ Admin address is configured correctly!');
  console.log('   Address:', adminAddress);
  console.log('\n💡 If you still see "Admin address not configured" in the UI:');
  console.log('   1. Make sure your backend server is running');
  console.log('   2. Restart the backend server to load the new environment variable');
  console.log('   3. Check backend console logs for: "[adminAuth] ✓ Admin address loaded"');
} else {
  console.log('\n❌ Admin address is NOT configured!');
  console.log('   Please check your backend/.env file');
  process.exit(1);
}


