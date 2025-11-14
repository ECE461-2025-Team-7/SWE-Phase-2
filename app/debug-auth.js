// app/debug-auth.js
import bcrypt from 'bcrypt';
import S3AuthAdapter from './src/adapters/S3AuthAdapter.js';
import 'dotenv/config';

const DEFAULT_PASSWORD = "correcthorsebatterystaple123(!__+@**(A'\"`;DROP TABLE artifacts;";

async function debugAuth() {
  const authAdapter = new S3AuthAdapter();
  
  console.log('=== Configuration ===');
  console.log(`Bucket: ${authAdapter.bucket}`);
  console.log(`Prefix: ${authAdapter.prefix}`);
  console.log(`Region: ${process.env.S3_AUTH_REGION || process.env.AWS_REGION}`);
  console.log();
  
  try {
    // Try to get the user
    console.log('=== Fetching user from S3 ===');
    const user = await authAdapter.getUser('ece30861defaultadminuser');
    
    if (!user) {
      console.log('❌ User not found in S3!');
      console.log('Run: node seed-admin.js');
      return;
    }
    
    console.log('✓ User found!');
    console.log(`Name: ${user.name}`);
    console.log(`Admin: ${user.is_admin}`);
    console.log(`Created: ${user.created_at}`);
    console.log(`Password hash: ${user.password_hash.substring(0, 20)}...`);
    console.log();
    
    // Test password comparison
    console.log('=== Testing password ===');
    console.log(`Testing password: "${DEFAULT_PASSWORD}"`);
    
    const isValid = await bcrypt.compare(DEFAULT_PASSWORD, user.password_hash);
    
    if (isValid) {
      console.log('✅ Password matches!');
    } else {
      console.log('❌ Password does NOT match!');
      console.log('This means the stored hash is different from the expected password.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

debugAuth();
