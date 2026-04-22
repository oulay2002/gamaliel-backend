/**
 * SEED DEFAULT USERS
 * Creates default users if they don't exist
 */

const { query } = require('./config/database');
const bcrypt = require('bcryptjs');

const defaultUsers = [
  {
    username: 'admin',
    email: 'admin@ecole.com',
    password: 'admin123',
    full_name: 'Administrateur',
    role: 'directeur',
    phone: '0102030405',
    is_active: true
  },
  {
    username: 'secret',
    email: 'secret@ecole.com',
    password: 'secret123',
    full_name: 'Secretaire',
    role: 'secretaire',
    phone: '0203040506',
    is_active: true
  },
  {
    username: 'compta',
    email: 'compta@ecole.com',
    password: 'compta123',
    full_name: 'Comptable',
    role: 'comptable',
    phone: '0304050607',
    is_active: true
  },
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

async function seedDefaultUsers() {
  try {
    // Check if users table exists
    const tables = await query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = '${process.env.DB_NAME || 'ecole_gamaliel_db'}' 
      AND TABLE_NAME = 'users'
    `);

    if (tables.length === 0) {
      console.log('⚠️  Table "users" not found. Skipping seed.');
      return;
    }

    // Check if admin user already exists
    const existingAdmin = await query('SELECT id FROM users WHERE username = ?', ['admin']);

    if (existingAdmin.length > 0) {
      console.log('✅ Default users already exist. Skipping seed.');
      return;
    }

    console.log('🌱 Seeding default users...');

    for (const user of defaultUsers) {
      const hashedPassword = await bcrypt.hash(user.password, 10);

      await query(`
        INSERT IGNORE INTO users (username, email, password_hash, role, full_name, phone, is_active, created_at, updated_at)
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

    console.log('✅ Default users seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding default users:', error.message);
  }
}

module.exports = { seedDefaultUsers };
