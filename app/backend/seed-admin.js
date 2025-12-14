// app/seed-admin.js
import bcrypt from 'bcrypt';
import S3AuthAdapter from './src/adapters/S3AuthAdapter.js';
import 'dotenv/config';

const DEFAULT_ADMIN = {
  name: 'ece30861defaultadminuser',
  is_admin: true,
  password: "correcthorsebatterystaple123(!__+@**(A'\"`;DROP TABLE artifacts;"
};

async function seedAdmin() {
  const authAdapter = new S3AuthAdapter();
  
  console.log('Seeding default admin user...');
  console.log(`Bucket: ${authAdapter.bucket}`);
  console.log(`Prefix: ${authAdapter.prefix}`);
  
  try {
    // Check if user already exists
    const existingUser = await authAdapter.getUser(DEFAULT_ADMIN.name);
    
    if (existingUser) {
      console.log('✓ Default admin user already exists.');
      return;
    }
    
    // Hash the password
    console.log('Hashing password...');
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(DEFAULT_ADMIN.password, saltRounds);
    
    // Create the user
    console.log('Creating user in S3...');
    await authAdapter.createUser({
      name: DEFAULT_ADMIN.name,
      is_admin: DEFAULT_ADMIN.is_admin,
      password_hash: password_hash
    });
    
    console.log('✅ Default admin user created successfully!');
    console.log(`Username: ${DEFAULT_ADMIN.name}`);
    console.log(`Admin: ${DEFAULT_ADMIN.is_admin}`);
    
  } catch (error) {
    console.error('❌ Failed to seed admin user:');
    console.error(error);
    process.exit(1);
  }
}

seedAdmin();
