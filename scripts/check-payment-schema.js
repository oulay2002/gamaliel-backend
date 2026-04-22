// backend/scripts/check-payment-schema.js
const { query } = require('../config/database');

(async () => {
    try {
        console.log('🔍 Structure de la table payments:\n');
        
        const columns = await query('SHOW COLUMNS FROM payments');
        columns.forEach(col => {
            console.log(`   - ${col.Field} (${col.Type})`);
        });
        
        console.log('\n📋 Derniers paiements enregistrés:\n');
        const payments = await query('SELECT * FROM payments ORDER BY id DESC LIMIT 5');
        payments.forEach(p => {
            console.log(`   ID: ${p.id}, Student: ${p.student_id}, Amount: ${p.amount}, Type: ${p.type}`);
            console.log(`   Date: ${p.payment_date}, Ref: ${p.reference || 'N/A'}, Receipt: ${p.receipt_number || 'N/A'}`);
            console.log(`   Status: ${p.status || 'N/A'}, Mode: ${p.payment_mode || 'N/A'}\n`);
        });
    } catch (error) {
        console.error('❌ Erreur: ' + error.message);
    }
})();
