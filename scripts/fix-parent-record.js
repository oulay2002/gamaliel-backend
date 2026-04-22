/**
 * SCRIPT: Créer l'entrée parent manquante pour adassa_test
 * 
 * Le problème: Le user existe mais pas dans la table 'parents'
 * Le endpoint /api/parents/my-children check la table 'parents'
 * 
 * node scripts/fix-parent-record.js
 */

const { query } = require('../config/database');

async function fixParentRecord() {
    try {
        const parentId = 26; // adassa_test
        
        console.log('🔍 Vérification du parent dans users...');
        const user = await query(
            'SELECT id, username, role FROM users WHERE id = ?',
            [parentId]
        );
        
        if (!user || user.length === 0) {
            console.error('❌ User adassa_test non trouvé');
            return;
        }
        
        console.log(`✅ User trouvé: ${user[0].username} (${user[0].role})`);
        
        // Vérifier si l'entrée parents existe
        console.log('🔍 Vérification dans la table parents...');
        const parentRecord = await query(
            'SELECT * FROM parents WHERE user_id = ?',
            [parentId]
        );
        
        if (parentRecord && parentRecord.length > 0) {
            console.log('✅ Entrée parents existe déjà');
        } else {
            console.log('❌ Entrée parents manquante - Création...');
            
            await query(`
                INSERT INTO parents (user_id, student_ids, notification_enabled)
                VALUES (?, '[]', TRUE)
            `, [parentId]);
            
            console.log('✅ Entrée parents créée');
        }
        
        // Vérifier les enfants assignés
        const children = await query(
            'SELECT id, matricule, last_name, first_name FROM students WHERE parent_user_id = ? AND is_active = TRUE',
            [parentId]
        );
        
        console.log(`\n👶 Enfants assignés (${children.length}):`);
        children.forEach(child => {
            console.log(`   ✅ ${child.matricule}: ${child.last_name} ${child.first_name}`);
        });
        
        if (children.length === 0) {
            console.log('\n⚠️ Aucun enfant assigné - Assignation de ADASSA MURIELLE...');
            
            await query(
                'UPDATE students SET parent_user_id = ? WHERE matricule = ?',
                [parentId, '2026-CM1-001']
            );
            
            console.log('✅ ADASSA MURIELLE assignée');
        }
        
        console.log('\n🎉 Correction terminée! Testez maintenant avec adassa_test');
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

fixParentRecord();
