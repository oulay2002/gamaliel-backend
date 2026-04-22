/**
 * SCRIPT: Afficher la structure des tables MySQL
 */

const { query } = require('../config/database');

async function showSchema() {
    const tables = ['classes', 'students', 'teachers', 'payments', 'users', 'parents'];
    
    for (const table of tables) {
        console.log(`\n📋 Table: ${table}`);
        try {
            const cols = await query(`DESCRIBE ${table}`);
            cols.forEach(col => {
                console.log(`   ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : ''} ${col.Key === 'PRI' ? 'PRIMARY KEY' : ''}`);
            });
        } catch (e) {
            console.log(`   ⚠️ Table n'existe pas: ${e.message}`);
        }
    }
}

if (require.main === module) {
    showSchema().then(() => process.exit(0));
}

module.exports = showSchema;
