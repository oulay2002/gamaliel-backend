/**
 * Create observations table for teacher-to-parent communication
 * Usage: node scripts/create-observations-table.js
 */

const { query } = require('../config/database');

async function createTable() {
  console.log('Creating observations table...\n');

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS observations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        teacher_id INT NOT NULL,
        teacher_name VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        observation_type VARCHAR(50) DEFAULT 'general',
        subject VARCHAR(200) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_student (student_id),
        INDEX idx_teacher (teacher_id),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ observations table created successfully!');
  } catch (e) {
    console.log('Note:', e.sqlMessage || e.message);
  }
}

createTable().catch(e => console.error('Fatal:', e.message));
