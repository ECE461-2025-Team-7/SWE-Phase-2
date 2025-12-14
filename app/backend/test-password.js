// Test password verification
import bcrypt from 'bcrypt';
import S3AuthAdapter from './src/adapters/S3AuthAdapter.js';
import 'dotenv/config';

const USERNAME = 'ece30861defaultadminuser';
const TEST_PASSWORD = "correcthorsebatterystaple123(!__+@**(A'\"`;DROP TABLE artifacts;";

async function testPassword() {
  const authAdapter = new S3AuthAdapter();
  
  console.log('Testing password...');
  console.log('Username:', USERNAME);
  console.log('Password length:', TEST_PASSWORD.length);
  console.log('Password:', TEST_PASSWORD);
  
  try {
    // Get user
    const user = await authAdapter.getUser(USERNAME);
    if (!user) {
      console.error('User not found!');
      return;
    }
    
    console.log('\nStored hash:', user.password_hash);
    
    // Test password
    const isValid = await bcrypt.compare(TEST_PASSWORD, user.password_hash);
    console.log('\nPassword valid:', isValid);
    
    // Also try comparing with what might be in S3
    const passwords = [
      "correcthorsebatterystaple123(!__+@**(A'\"`;DROP TABLE artifacts;",
      "correcthorsebatterystaple123(!__+@**(A'\"`;DROP TABLE packages;",
    ];
    
    console.log('\nTrying different password variations:');
    for (const pwd of passwords) {
      const valid = await bcrypt.compare(pwd, user.password_hash);
      console.log(`  "${pwd.substring(0, 50)}...": ${valid}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testPassword();
