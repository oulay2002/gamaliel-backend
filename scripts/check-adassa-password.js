/**
 * SCRIPT: Vérifier et réinitialiser le mot de passe de adassa_test
 * 
 * node scripts/check-adassa-password.js
 */

const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

async function checkPassword() {
    try {
        console.log('🔍 Recherche du compte adassa_test...');
        
        const user = await query(
            'SELECT id, username, role, password_hash, full_name FROM users WHERE username = ?',
            ['adassa_test']
        );

        if (!user || user.length === 0) {
            console.error('❌ Compte adassa_test non trouvé');
            return;
        }

        console.log(`✅ Compte trouvé: ID=${user[0].id}, Rôle=${user[0].role}, Nom=${user[0].full_name}`);

        // Tester le mot de passe actuel
        const testPassword = async (password) => {
            const isValid = await bcrypt.compare(password, user[0].password_hash);
            console.log(`🔑 Test "${password}": ${isValid ? '✅ VALIDE' : '❌ INVALIDE'}`);
            return isValid;
        };

        console.log('\n🧪 Tests de mots de passe:');
        const isValid1 = await testPassword('test123456');
        const isValid2 = await testPassword('adassa123');
        const isValid3 = await testPassword('password');
        const isValid4 = await testPassword('123456');

        if (!isValid1 && !isValid2 && !isValid3 && !isValid4) {
            console.log('\n⚠️  Aucun des mots de passe testés ne fonctionne');
            console.log('💡 Voulez-vous réinitialiser le mot de passe à "test123456" ?');
            console.log('   Exécutez: node scripts/reset-adassa-password.js');
        } else {
            console.log('\n🎉 Mot de passe trouvé!');
        }

    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

checkPassword();
