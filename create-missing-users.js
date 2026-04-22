/**
 * CREATE MISSING USERS
 * Creates teacher and parent accounts if they don't exist
 */

const { query } = require('./config/database');
const bcrypt = require('bcryptjs');

const missingUsers = [
  {
    username: 'teacher',
    email: 'teacher@ecole.com',
    password: 'teacher123',
    full_name: 'Enseignant Test',
    role: 'enseignant',
    phone: '0405060708',
    is_active: true
  },
  {
    username: 'parent',
    email: 'parent@ecole.com',
    password: 'parent123',
    full_name: 'Parent Test',
    role: 'parent',
    phone: '0506070809',
    is_active: true
  }
];

async function createMissingUsers() {
  try {
    console.log('👥 Creating missing users...');

    for (const user of missingUsers) {
      // Check if user already exists
      const existing = await query('SELECT id FROM users WHERE username = ?', [user.username]);

      if (existing.length > 0) {
        console.log(`  ⏭️  User "${user.username}" already exists. Skipping.`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(user.password, 10);

      await query(`
        INSERT INTO users (username, email, password_hash, role, full_name, phone, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        user.username,
        user.email,
        hashedPassword,
        user.role,
        user.full_name,
        user.phone,
        user.is_active ? 1 : 0
      ]);

      console.log(`  ✅ Created user: ${user.username} (${user.role})`);
    }

    console.log('✅ All missing users created successfully!');
  } catch (error) {
    console.error('❌ Error creating users:', error.message);
  }
}

createMissingUsers();
