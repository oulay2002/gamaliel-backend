/**
 * RESET PASSWORDS
 * Resets all default user passwords to known values
 */

const { query } = require('./config/database');
const bcrypt = require('bcryptjs');

const usersToReset = [
  { username: 'admin', password: 'admin123' },
  { username: 'secret', password: 'secret123' },
  { username: 'compta', password: 'compta123' },
  { username: 'teacher', password: 'teacher123' },
  { username: 'parent', password: 'parent123' }
];

async function resetPasswords() {
  try {
    console.log('🔑 Resetting user passwords...');

    for (const user of usersToReset) {
      // Check if user exists
      const existing = await query('SELECT id FROM users WHERE username = ?', [user.username]);

      if (existing.length === 0) {
        console.log(`  ⚠️  User "${user.username}" not found. Skipping.`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(user.password, 10);

      await query(
        'UPDATE users SET password_hash = ? WHERE username = ?',
        [hashedPassword, user.username]
      );

      console.log(`  ✅ Password reset for: ${user.username}`);
    }

    console.log('✅ All passwords reset successfully!');
  } catch (error) {
    console.error('❌ Error resetting passwords:', error.message);
  }
}

resetPasswords();
