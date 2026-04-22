/**
 * Fix compositions table - add missing start_date and end_date columns
 */
const { query } = require('../config/database');

async function fix() {
  console.log('Fixing start_date/end_date columns...\n');

  // Step 1: Remove invalid rows (0000-00-00 dates)
  try {
    await query("UPDATE compositions SET start_date = NULL, end_date = NULL WHERE start_date = '0000-00-00' OR end_date = '0000-00-00'");
    console.log('Cleaned invalid date rows');
  } catch (e) { /* Table may be empty or already clean */ }

  // Step 2: Add start_date (allow NULL for existing rows)
  try {
    const check = await query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'compositions' AND COLUMN_NAME = 'start_date'`);
    if (check.length === 0) {
      await query("ALTER TABLE compositions ADD COLUMN start_date DATE NULL DEFAULT NULL AFTER period");
      console.log('✅ Added start_date');
    } else { console.log('  start_date exists'); }
  } catch (e) { console.log('  start_date:', e.sqlMessage); }

  // Step 3: Add end_date
  try {
    const check = await query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'compositions' AND COLUMN_NAME = 'end_date'`);
    if (check.length === 0) {
      await query("ALTER TABLE compositions ADD COLUMN end_date DATE NULL DEFAULT NULL AFTER start_date");
      console.log('✅ Added end_date');
    } else { console.log('  end_date exists'); }
  } catch (e) { console.log('  end_date:', e.sqlMessage); }

  // Step 4: Set default dates for NULL rows
  try {
    await query("UPDATE compositions SET start_date = CURDATE(), end_date = CURDATE() WHERE start_date IS NULL");
    console.log('✅ Set default dates for NULL rows');
  } catch (e) {}

  // Step 5: Make NOT NULL now
  try {
    await query("ALTER TABLE compositions MODIFY start_date DATE NOT NULL");
    await query("ALTER TABLE compositions MODIFY end_date DATE NOT NULL");
    console.log('✅ Set NOT NULL constraint');
  } catch (e) { console.log('  NOT NULL:', e.sqlMessage); }

  console.log('\n✅ Done!');
}

fix().catch(e => console.error(e.message));
