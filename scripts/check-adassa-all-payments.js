// backend/scripts/check-adassa-all-payments.js
const { query } = require('../config/database');

(async () => {
    try {
        console.log('🔍 Recherche de TOUS les paiements pour Adassa...\n');
        
        // 1. Trouver l'élève
        const student = await query(
            'SELECT id, matricule, last_name, first_name, class_id FROM students WHERE matricule = ?',
            ['2026-CM1-001']
        );

        if (!student || student.length === 0) {
            console.error('❌ Élève 2026-CM1-001 non trouvé');
            return;
        }

        const studentId = student[0].id;
        console.log(`✅ Élève trouvé:`);
        console.log(`   ID: ${studentId}`);
        console.log(`   Matricule: ${student[0].matricule}`);
        console.log(`   Nom: ${student[0].last_name} ${student[0].first_name}\n`);

        // 2. Chercher TOUS les paiements pour cet élève
        console.log('📋 Paiements avec student_id =', studentId);
        const payments1 = await query('SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC', [studentId]);
        
        if (payments1.length === 0) {
            console.log('   ⚠️ Aucun paiement trouvé avec ce student_id\n');
        } else {
            payments1.forEach(p => {
                console.log(`   - ID: ${p.id}, Montant: ${p.amount} FCFA, Type: ${p.type}, Date: ${p.payment_date}`);
                console.log(`     Ref: ${p.reference || 'N/A'}, Reçu: ${p.receipt_number || 'N/A'}, Mode: ${p.payment_mode}`);
            });
        }

        // 3. Chercher les paiements de 25000 FCFA (tous students)
        console.log('\n💰 Tous les paiements de 25000 FCFA:');
        const payments25k = await query('SELECT * FROM payments WHERE amount = 25000 ORDER BY payment_date DESC');
        
        if (payments25k.length === 0) {
            console.log('   ⚠️ Aucun paiement de 25000 trouvé');
        } else {
            payments25k.forEach(p => {
                console.log(`   - ID: ${p.id}, Student ID: ${p.student_id}, Date: ${p.payment_date}`);
            });
        }

        // 4. Derniers 5 paiements (tous)
        console.log('\n📊 Derniers 5 paiements enregistrés:');
        const recent = await query('SELECT * FROM payments ORDER BY id DESC LIMIT 5');
        recent.forEach(p => {
            console.log(`   - ID: ${p.id}, Student: ${p.student_id}, Montant: ${p.amount}, Type: ${p.type}`);
        });
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
})();
