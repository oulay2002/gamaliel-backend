// backend/scripts/check-homework-schema.js
const { query } = require('../config/database');

(async () => {
    try {
        console.log('🔍 Structure de la table homeworks:\n');
        
        const columns = await query('SHOW COLUMNS FROM homeworks');
        columns.forEach(col => {
            console.log(`   - ${col.Field} (${col.Type})`);
        });
        
        console.log('\n📋 Derniers devoirs enregistrés:\n');
        const homeworks = await query('SELECT * FROM homeworks ORDER BY id DESC LIMIT 5');
        homeworks.forEach(h => {
            console.log(`   ID: ${h.id}, Class: ${h.class_id || 'N/A'}, Subject: ${h.subject || 'N/A'}`);
            console.log(`   Description: ${(h.description || '').substring(0, 50)}`);
            console.log(`   Due: ${h.due_date}, Created: ${h.created_at}\n`);
        });
    } catch (error) {
        console.error('❌ Erreur: ' + error.message);
    }
})();
