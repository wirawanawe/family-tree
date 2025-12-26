// Script to create first superadmin
// Run with: npx ts-node scripts/create-superadmin.ts

import pool from '../lib/db';
import { hashPassword } from '../lib/auth';

async function createSuperAdmin() {
  try {
    const username = process.env.SUPERADMIN_USERNAME || 'superadmin';
    const password = process.env.SUPERADMIN_PASSWORD || 'admin123';
    const name = process.env.SUPERADMIN_NAME || 'Super Admin';

    const hashedPassword = hashPassword(password);

    // Check if superadmin already exists
    const [existing]: any = await pool.query(
      "SELECT * FROM users WHERE role = 'superadmin'"
    );

    if (existing.length > 0) {
      console.log('Superadmin already exists');
      process.exit(0);
    }

    // Create superadmin
    await pool.query(
      `INSERT INTO users (username, password, name, role, status)
       VALUES (?, ?, ?, 'superadmin', 'approved')`,
      [username, hashedPassword, name]
    );

    console.log('Superadmin created successfully!');
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log('Please change the password after first login!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating superadmin:', error);
    process.exit(1);
  }
}

createSuperAdmin();
