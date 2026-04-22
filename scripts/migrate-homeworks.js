// backend/scripts/migrate-homeworks.js
const { query } = require('../config/database');

(async () => {
    try {
        console.log('🔧 Migration de la table homeworks...\n');
        
        // Ajouter les colonnes une par une avec try/catch
        const columns = [
            { name: 'type', sql: "ALTER TABLE homeworks ADD COLUMN type ENUM('file', 'book') DEFAULT 'file' AFTER description" },
            { name: 'book_name', sql: 'ALTER TABLE homeworks ADD COLUMN book_name VARCHAR(255) NULL AFTER type' },
            { name: 'page_numbers', sql: 'ALTER TABLE homeworks ADD COLUMN page_numbers VARCHAR(50) NULL AFTER book_name' },
            { name: 'instructions', sql: 'ALTER TABLE homeworks ADD COLUMN instructions TEXT NULL AFTER description' }
        ];
        
        for (const col of columns) {
            try {
                await query(col.sql);
                console.log(`✅ Colonne '${col.name}' ajoutée`);
            } catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME') {
                    console.log(`⏭️  Colonne '${col.name}' existe déjà`);
                } else {
                    console.log(`❌ Erreur pour '${col.name}': ${e.message}`);
                }
            }
        }
        
        console.log('\n✅ Migration terminée!');
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
})();
