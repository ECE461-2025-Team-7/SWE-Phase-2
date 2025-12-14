// Update admin password
import bcrypt from 'bcrypt';
import S3AuthAdapter from './src/adapters/S3AuthAdapter.js';
import 'dotenv/config';

const USERNAME = 'ece30861defaultadminuser';
const NEW_PASSWORD = "correcthorsebatterystaple123(!__+@**(A'\"`;DROP TABLE artifacts;";

async function updatePassword() {
  const authAdapter = new S3AuthAdapter();
  
  console.log('Updating admin password...');
  
  try {
    // Get existing user
    const user = await authAdapter.getUser(USERNAME);
    if (!user) {
      console.error('User not found!');
      process.exit(1);
    }
    
    // Hash new password
    console.log('Hashing new password...');
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(NEW_PASSWORD, saltRounds);
    
    // Update user with new password hash
    console.log('Updating user in S3...');
    await authAdapter.createUser({
      name: user.name,
      is_admin: user.is_admin,
      password_hash: password_hash,
      created_at: user.created_at
    });
    
    console.log('✅ Password updated successfully!');
    
  } catch (error) {
    console.error('❌ Failed to update password:');
    console.error(error);
    process.exit(1);
  }
}

updatePassword();
