// backend/scripts/fix-payment-student.js
const { query } = require('../config/database');

(async () => {
    try {
        const result = await query(
            'UPDATE payments SET student_id = 5 WHERE amount = 75000 AND student_id = 7'
        );
        console.log('✅ ' + result.affectedRows + ' paiement(s) corrigé(s)');

        const payments = await query('SELECT * FROM payments WHERE student_id = 5');
        console.log('\n💰 Paiements pour ADASSA MURIELLE:');
        payments.forEach(p => {
            console.log('   - ' + p.amount + ' FCFA (' + p.type + ') le ' + p.payment_date);
        });
    } catch (error) {
        console.error('❌ Erreur: ' + error.message);
    }
})();
