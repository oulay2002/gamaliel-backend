/**
 * SCRIPT: Réparer les parent_user_id des élèves existants
 * Exécuter une seule fois pour lier les élèves aux parents existants
 */

const { query } = require('../config/database');

async function fixParentStudentLinks() {
    console.log('🔧 Réparation des liens parents-élèves...');

    try {
        // Récupérer tous les parents avec leurs téléphones
        const parents = await query(`
            SELECT u.id, u.phone, u.full_name
            FROM users u
            WHERE u.role = 'parent'
        `);

        console.log(`📋 ${parents.length} parents trouvés`);

        let updatedCount = 0;

        for (const parent of parents) {
            // Chercher les élèves dont le père ou la mère a ce téléphone
            const students = await query(`
                SELECT id, last_name, first_name, father_phone, mother_phone, parent_user_id
                FROM students
                WHERE is_active = TRUE
                AND (father_phone = ? OR mother_phone = ?)
                AND (parent_user_id IS NULL OR parent_user_id != ?)
            `, [parent.phone, parent.phone, parent.id]);

            if (students.length > 0) {
                for (const student of students) {
                    await query(`
                        UPDATE students
                        SET parent_user_id = ?
                        WHERE id = ?
                    `, [parent.id, student.id]);

                    console.log(`  ✓ ${student.last_name} ${student.first_name} -> Parent: ${parent.full_name} (ID: ${parent.id})`);
                    updatedCount++;
                }
            }
        }

        console.log(`\n✅ ${updatedCount} élèves liés à leurs parents`);

    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

// Exécuter si appelé directement
if (require.main === module) {
    fixParentStudentLinks().then(() => {
        console.log('🏁 Script terminé');
        process.exit(0);
    });
}

module.exports = fixParentStudentLinks;
