/**
 * SCRIPT: Vérifier les paiements pour ADASSA MURIELLE
 * 
 * node scripts/check-adassa-payments.js
 */

const { query } = require('../config/database');

async function checkPayments() {
    try {
        console.log('🔍 Recherche des paiements pour ADASSA MURIELLE...\n');
        
        // 1. Trouver l'élève
        const student = await query(
            'SELECT id, matricule, last_name, first_name, class_id, parent_user_id FROM students WHERE last_name = ? AND first_name = ?',
            ['ADASSA', 'MURIELLE']
        );

        if (!student || student.length === 0) {
            console.error('❌ Élève ADASSA MURIELLE non trouvé');
            return;
        }

        const studentId = student[0].id;
        console.log(`✅ Élève trouvé:`);
        console.log(`   ID: ${studentId}`);
        console.log(`   Matricule: ${student[0].matricule}`);
        console.log(`   Nom: ${student[0].last_name} ${student[0].first_name}`);
        console.log(`   Classe ID: ${student[0].class_id}`);
        console.log(`   Parent User ID: ${student[0].parent_user_id}\n`);

        // 2. Trouver les paiements
        const payments = await query(
            'SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC',
            [studentId]
        );

        if (!payments || payments.length === 0) {
            console.log('⚠️ Aucun paiement trouvé pour cet élève');
            console.log('\n💡 Vérifiez que le paiement a été enregistré avec le bon student_id:');
            console.log(`   INSERT INTO payments (student_id, amount, type, ...) VALUES (${studentId}, 75000, ...);\n`);
            
            // Chercher tous les paiements récents
            const recentPayments = await query(
                'SELECT * FROM payments ORDER BY payment_date DESC LIMIT 5'
            );
            
            if (recentPayments.length > 0) {
                console.log('📋 Derniers paiements enregistrés:');
                recentPayments.forEach(p => {
                    console.log(`   - ID: ${p.id}, Student ID: ${p.student_id}, Montant: ${p.amount} FCFA, Date: ${p.payment_date}`);
                });
            }
        } else {
            console.log(`✅ ${payments.length} paiement(s) trouvé(s):`);
            payments.forEach(p => {
                console.log(`   - ID: ${p.id}, Montant: ${p.amount} FCFA, Type: ${p.type}, Date: ${p.payment_date}, Ref: ${p.reference || 'N/A'}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

checkPayments();
