// Create a test user with simple password
import bcrypt from 'bcrypt';
import S3AuthAdapter from './src/adapters/S3AuthAdapter.js';
import 'dotenv/config';

const TEST_USER = {
  name: 'testadmin',
  is_admin: true,
  password: 'testpass123'
};

async function createTestUser() {
  const authAdapter = new S3AuthAdapter();
  
  console.log('Creating test admin user...');
  
  try {
    // Check if user exists
    const existing = await authAdapter.getUser(TEST_USER.name);
    if (existing) {
      console.log('Test user already exists');
      return;
    }
    
    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(TEST_USER.password, saltRounds);
    
    // Create user
    await authAdapter.createUser({
      name: TEST_USER.name,
      is_admin: TEST_USER.is_admin,
      password_hash
    });
    
    console.log('✅ Test user created!');
    console.log('Username:', TEST_USER.name);
    console.log('Password:', TEST_USER.password);
    
  } catch (error) {
    console.error('Failed:', error);
  }
}

createTestUser();
