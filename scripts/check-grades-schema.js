/**
 * SCRIPT: Vérifier la structure de la table grades
 * 
 * node scripts/check-grades-schema.js
 */

const { query } = require('../config/database');

async function checkSchema() {
    try {
        console.log('🔍 Structure de la table grades:\n');
        
        const columns = await query('SHOW COLUMNS FROM grades');
        columns.forEach(col => {
            console.log(`   - ${col.Field} (${col.Type})`);
        });
        
        console.log('\n📋 Dernières notes enregistrées:\n');
        const grades = await query('SELECT * FROM grades ORDER BY id DESC LIMIT 5');
        grades.forEach(g => {
            console.log(`   ID: ${g.id}, Student: ${g.student_id}, Grade: ${g.grade}, Composition: ${g.composition_id}`);
        });
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

checkSchema();
