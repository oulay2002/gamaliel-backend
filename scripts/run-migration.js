/**
 * Migration script - Execute all missing tables one by one
 * Usage: node scripts/run-migration.js
 */

const { query } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Starting migration...\n');

  const sqlFile = path.join(__dirname, '..', 'database', 'migration_missing_tables.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  // Split by semicolons but respect comments and newlines
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('USE '));

  console.log(`📋 Found ${statements.length} statements to execute\n`);

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ') + '...';

    try {
      await query(stmt);
      success++;
      console.log(`  ✅ [${i + 1}/${statements.length}] ${preview}`);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY' || e.code === 'ER_DUP_FIELDNAME' || 
          (e.sqlMessage && e.sqlMessage.includes('already exists'))) {
        skipped++;
        console.log(`  ⏭️  [${i + 1}/${statements.length}] Skipped (already exists): ${preview}`);
      } else if (e.sqlMessage && e.sqlMessage.includes('check that column/key exists')) {
        skipped++;
        console.log(`  ⏭️  [${i + 1}/${statements.length}] Skipped (column exists): ${preview}`);
      } else {
        errors++;
        console.log(`  ❌ [${i + 1}/${statements.length}] Error: ${e.sqlMessage || e.message}`);
        console.log(`     Statement: ${preview}\n`);
      }
    }
  }

  console.log(`\n📊 Results: ✅ ${success} success | ⏭️  ${skipped} skipped | ❌ ${errors} errors`);
}

runMigration().catch(e => console.error('Fatal:', e.message));
