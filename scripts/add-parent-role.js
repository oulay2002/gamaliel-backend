/**
 * SCRIPT: Ajouter le rôle 'parent' à la table users
 */

const { query } = require('../config/database');

async function addParentRole() {
    console.log('🔧 Ajout du rôle parent à la table users...');
    
    try {
        await query(`
            ALTER TABLE users 
            MODIFY COLUMN role ENUM('directeur','secretaire','comptable','enseignant','parent') NOT NULL
        `);
        console.log('✅ Rôle parent ajouté avec succès!');
        
        // Vérifier
        const result = await query(`DESCRIBE users`);
        const roleCol = result.find(c => c.Field === 'role');
        console.log('📋 Colonne role:', roleCol.Type);
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

if (require.main === module) {
    addParentRole().then(() => process.exit(0));
}

module.exports = addParentRole;
