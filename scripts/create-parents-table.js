/**
 * SCRIPT: Créer la table parents si elle n'existe pas
 */

const { query } = require('../config/database');

async function createParentsTable() {
    console.log('🔧 Création de la table parents...');
    
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS parents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                student_ids TEXT,
                notification_enabled TINYINT(1) DEFAULT 1,
                sms_enabled TINYINT(1) DEFAULT 0,
                email_enabled TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id)
            )
        `);
        
        console.log('✅ Table parents créée avec succès!');
        
        // Vérifier
        const cols = await query('DESCRIBE parents');
        console.log('📋 Structure:');
        cols.forEach(c => console.log(`   ${c.Field} (${c.Type})`));
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

if (require.main === module) {
    createParentsTable().then(() => process.exit(0));
}

module.exports = createParentsTable;
