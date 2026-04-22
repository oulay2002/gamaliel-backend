// backend/scripts/fix-payment-25k-and-create-teacher.js
const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

(async () => {
    try {
        console.log('🔧 Correction du paiement et création du compte enseignant...\n');
        
        // 1. Corriger le paiement de 25000 FCFA (student_id 7 → 5)
        const result = await query(
            'UPDATE payments SET student_id = 5 WHERE id = 2'
        );
        console.log(`✅ Paiement 25000 FCFA corrigé: student_id 7 → 5`);

        // 2. Vérifier les paiements d'Adassa
        const payments = await query(
            'SELECT * FROM payments WHERE student_id = 5 ORDER BY payment_date DESC'
        );
        console.log(`\n💰 Paiements pour ADASSA MURIELLE:`);
        payments.forEach(p => {
            console.log(`   - ${p.amount} FCFA (${p.type}) le ${p.payment_date}`);
        });

        // 3. Créer le compte enseignant CM1
        const teacherUsername = 'cm1_teacher';
        const teacherPassword = 'teacher123';
        const teacherFullName = 'Enseignant CM1';
        const teacherEmail = 'cm1.teacher@gamaliel.ecole';
        
        // Vérifier si l'enseignant existe déjà
        const existing = await query('SELECT id FROM users WHERE username = ?', [teacherUsername]);
        
        if (existing && existing.length > 0) {
            console.log(`\n👨‍🏫 Enseignant existe déjà: ID ${existing[0].id}`);
        } else {
            const passwordHash = await bcrypt.hash(teacherPassword, 10);
            
            const teacherResult = await query(`
                INSERT INTO users (username, email, password_hash, role, full_name, is_active)
                VALUES (?, ?, ?, 'enseignant', ?, TRUE)
            `, [teacherUsername, teacherEmail, passwordHash, teacherFullName]);
            
            console.log(`\n👨‍🏫 Compte enseignant créé:`);
            console.log(`   ID: ${teacherResult.insertId}`);
            console.log(`   Username: ${teacherUsername}`);
            console.log(`   Mot de passe: ${teacherPassword}`);
            console.log(`   Rôle: enseignant`);
        }

        // 4. Lier l'enseignant à la classe CM1 (class_id = 5)
        await query(`
            UPDATE classes SET teacher_id = (SELECT id FROM users WHERE username = ?)
            WHERE id = 5
        `, [teacherUsername]);
        console.log(`\n✅ Enseignant lié à la classe CM1`);

        console.log('\n🎉 Configuration terminée!');
        console.log('\n📱 Test avec enseignant:');
        console.log(`   Username: cm1_teacher`);
        console.log(`   Password: teacher123`);
        console.log(`   Rôle: enseignant`);
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
})();
