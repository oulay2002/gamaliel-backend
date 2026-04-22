/**
 * SCRIPT: Réinitialiser le rate limiting pour adassa_test
 * 
 * Le backend bloque les connexions après trop de tentatives échouées
 * 
 * node scripts/reset-rate-limit.js
 */

const { query } = require('../config/database');

async function resetRateLimit() {
    try {
        console.log('🔍 Recherche de rate limiting pour adassa_test...');
        
        // Vérifier les tables de rate limit
        const tables = await query('SHOW TABLES');
        console.log('Tables:', tables.map(t => Object.values(t)[0]));
        
        // Essayer de supprimer les entrées de rate limit
        const possibleTables = ['login_attempts', 'rate_limits', 'failed_logins', 'login_attempts_cache'];
        
        for (const table of possibleTables) {
            try {
                const exists = await query(`SELECT COUNT(*) as count FROM ${table} WHERE username = ? OR identifier = ?`, ['adassa_test', 'adassa_test']);
                if (exists.length > 0) {
                    await query(`DELETE FROM ${table} WHERE username = ? OR identifier = ?`, ['adassa_test', 'adassa_test']);
                    console.log(`✅ ${table}: entrées supprimées`);
                }
            } catch (e) {
                // Table n'existe pas
            }
        }
        
        // Alternative: redémarrer le backend pour vider le cache mémoire
        console.log('\n💡 Si le rate limit est en mémoire, redémarrez le backend:');
        console.log('   npm start (dans le dossier backend)');
        
        console.log('\n🎉 Réinitialisation terminée!');
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

resetRateLimit();
