/**
 * SCRIPT: Assigner ADASSA MURIELLE au parent adassa_test
 * 
 * Utilisation:
 * node scripts/fix-adassa-link.js
 */

const { query } = require('../config/database');

async function fixAdassaLink() {
    try {
        console.log('🔍 Correction du lien parent-adassa...');
        
        const parentId = 26; // adassa_test

        // D'abord, retirer l'assignation incorrecte
        console.log('🔄 Retrait de l\'assignation incorrecte...');
        await query(
            'UPDATE students SET parent_user_id = NULL WHERE matricule = ?',
            ['2025-CP1-001']
        );

        // Assigner ADASSA MURIELLE au parent
        console.log('🔗 Assignation de ADASSA MURIELLE au parent...');
        await query(
            'UPDATE students SET parent_user_id = ? WHERE matricule = ?',
            [parentId, '2026-CM1-001']
        );

        // Vérifier
        const children = await query(
            'SELECT id, matricule, last_name, first_name FROM students WHERE parent_user_id = ? AND is_active = TRUE',
            [parentId]
        );

        console.log(`\n👶 Enfants assignés au parent adassa_test (${children.length}):`);
        children.forEach(child => {
            console.log(`   ✅ ${child.matricule}: ${child.last_name} ${child.first_name}`);
        });

        console.log('\n🎉 Correction terminée! Connectez-vous avec adassa_test');

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
    }
}

fixAdassaLink();
