// Script to create first superadmin
// Run with: node scripts/create-superadmin.js
// Or with env vars: SUPERADMIN_USERNAME=admin SUPERADMIN_PASSWORD=pass123 SUPERADMIN_NAME="Admin" node scripts/create-superadmin.js

// Try to load .env.local if dotenv is available
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // dotenv not available, use environment variables directly
}

const mysql = require('mysql2/promise');
const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function createSuperAdmin() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'family_tree',
      port: parseInt(process.env.DB_PORT || '3306'),
    });

    const username = process.env.SUPERADMIN_USERNAME || 'superadmin';
    const password = process.env.SUPERADMIN_PASSWORD || 'admin123';
    const name = process.env.SUPERADMIN_NAME || 'Super Admin';

    const hashedPassword = hashPassword(password);

    // Check if superadmin already exists
    const [existing] = await connection.query(
      "SELECT * FROM users WHERE role = 'superadmin'"
    );

    if (existing.length > 0) {
      console.log('Superadmin already exists');
      process.exit(0);
    }

    // Create superadmin
    await connection.query(
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
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createSuperAdmin();
