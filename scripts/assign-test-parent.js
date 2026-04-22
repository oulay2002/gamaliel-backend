/**
 * SCRIPT: Assigner des élèves au parent adassa_test
 * 
 * Utilisation:
 * node scripts/assign-test-parent.js
 */

const { query } = require('../config/database');

async function assignTestParent() {
    try {
        console.log('🔍 Recherche du parent adassa_test...');
        
        const parent = await query(
            'SELECT id, username, full_name, role FROM users WHERE username = ?',
            ['adassa_test']
        );

        if (!parent || parent.length === 0) {
            console.error('❌ Parent adassa_test non trouvé');
            console.log('💡 Créez d\'abord le compte parent dans l\'application');
            process.exit(1);
        }

        const parentId = parent[0].id;
        console.log(`✅ Parent trouvé: ID=${parentId}, Nom=${parent[0].full_name}`);

        // Vérifier si le parent a déjà des élèves
        const existingChildren = await query(
            'SELECT COUNT(*) as count FROM students WHERE parent_user_id = ? AND is_active = TRUE',
            [parentId]
        );

        console.log(`📊 Enfants actuels: ${existingChildren[0].count}`);

        if (existingChildren[0].count > 0) {
            console.log('ℹ️  Le parent a déjà des enfants assignés');
        }

        // Trouver les élèves SANS parent assigné
        const studentsWithoutParent = await query(`
            SELECT id, matricule, last_name, first_name, class_id
            FROM students
            WHERE parent_user_id IS NULL AND is_active = TRUE
            LIMIT 5
        `);

        if (studentsWithoutParent.length === 0) {
            console.log('⚠️  Aucun élève sans parent trouvé');
            console.log('💡 Vous pouvez assigner manuellement un élève:');
            console.log(`   UPDATE students SET parent_user_id = ${parentId} WHERE matricule = 'ELEVE-XXX';`);
            process.exit(0);
        }

        console.log(`\n📋 Élèves disponibles sans parent (${studentsWithoutParent.length}):`);
        studentsWithoutParent.forEach(s => {
            console.log(`   - ${s.matricule}: ${s.last_name} ${s.first_name} (ID=${s.id})`);
        });

        // Assigner le premier élève trouvé au parent
        const student = studentsWithoutParent[0];
        
        console.log(`\n🔗 Assignation de ${student.matricule} (${student.last_name} ${student.first_name}) au parent...`);

        await query(
            'UPDATE students SET parent_user_id = ? WHERE id = ?',
            [parentId, student.id]
        );

        console.log('✅ Assignation réussie!');

        // Vérifier
        const updatedChildren = await query(
            'SELECT id, matricule, last_name, first_name FROM students WHERE parent_user_id = ? AND is_active = TRUE',
            [parentId]
        );

        console.log(`\n👶 Enfants assignés maintenant (${updatedChildren.length}):`);
        updatedChildren.forEach(child => {
            console.log(`   - ${child.matricule}: ${child.last_name} ${child.first_name}`);
        });

        console.log('\n🎉 Test terminé! Connectez-vous avec adassa_test dans l\'app Android');

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
    }
}

assignTestParent();
