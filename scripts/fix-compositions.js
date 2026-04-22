/**
 * Fix compositions table schema
 * Adds missing columns that may not exist in old schema
 */

const { query } = require('../config/database');

async function fixCompositionsTable() {
  console.log('🔧 Fixing compositions table...\n');

  const columns = [
    { name: 'name', type: 'VARCHAR(200) NOT NULL', after: 'class_id' },
    { name: 'period', type: "VARCHAR(50) NOT NULL COMMENT 'Trimestre 1, Trimestre 2, etc.'", after: 'name' },
    { name: 'start_date', type: 'DATE NOT NULL', after: 'period' },
    { name: 'end_date', type: 'DATE NOT NULL', after: 'start_date' },
    { name: 'academic_year', type: 'VARCHAR(20) NOT NULL', after: 'end_date' },
    { name: 'is_published', type: 'BOOLEAN DEFAULT FALSE', after: 'academic_year' },
    { name: 'created_by', type: 'INT NULL', after: 'is_published' },
  ];

  for (const col of columns) {
    try {
      // Check if column exists
      const check = await query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'compositions'
        AND COLUMN_NAME = ?
      `, [col.name]);

      if (check.length > 0) {
        console.log(`  ✅ Column '${col.name}' already exists`);
        continue;
      }

      // Add column
      if (col.after) {
        await query(`ALTER TABLE compositions ADD COLUMN ${col.name} ${col.type} AFTER ${col.after}`);
      } else {
        await query(`ALTER TABLE compositions ADD COLUMN ${col.name} ${col.type}`);
      }
      console.log(`  ✅ Added column '${col.name}'`);
    } catch (e) {
      console.log(`  ⚠️  Column '${col.name}': ${e.sqlMessage || e.message}`);
    }
  }

  console.log('\n✅ Compositions table fixed!');
}

fixCompositionsTable().catch(e => console.error('Fatal:', e.message));
