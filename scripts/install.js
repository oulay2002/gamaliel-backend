#!/usr/bin/env node

/**
 * SCRIPT D'INSTALLATION AUTOMATIQUE
 * École Gamaliel - Version 2.0
 * 
 * Ce script automatise l'installation du backend
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  log('\n🎓 ========================================', 'blue');
  log('   INSTALLATION AUTOMATIQUE - ÉCOLE GAMALIEL', 'blue');
  log('   Version 2.0 - Multi-Utilisateurs', 'blue');
  log('========================================\n', 'blue');
  
  // Étape 1 : Vérifier Node.js
  log('📦 Étape 1/6 : Vérification de Node.js...', 'yellow');
  try {
    const nodeVersion = execSync('node --version').toString().trim();
    log(`   ✓ Node.js installé: ${nodeVersion}`, 'green');
  } catch (error) {
    log('   ❌ Node.js non installé. Veuillez l\'installer depuis https://nodejs.org/', 'red');
    process.exit(1);
  }
  
  // Étape 2 : Vérifier MySQL
  log('\n📦 Étape 2/6 : Vérification de MySQL...', 'yellow');
  try {
    execSync('mysql --version', { stdio: 'ignore' });
    log('   ✓ MySQL installé', 'green');
  } catch (error) {
    log('   ⚠ MySQL non trouvé dans le PATH. Assurez-vous qu\'il est installé.', 'yellow');
  }
  
  // Étape 3 : Installer les dépendances npm
  log('\n📦 Étape 3/6 : Installation des dépendances...', 'yellow');
  try {
    log('   Installation en cours... (cela peut prendre quelques minutes)', 'blue');
    execSync('npm install', { stdio: 'inherit' });
    log('   ✓ Dépendances installées', 'green');
  } catch (error) {
    log('   ❌ Échec de l\'installation des dépendances', 'red');
    process.exit(1);
  }
  
  // Étape 4 : Configuration .env
  log('\n📦 Étape 4/6 : Configuration du fichier .env...', 'yellow');
  
  const envPath = path.join(__dirname, '.env');
  let envConfig = '';
  
  if (fs.existsSync(envPath)) {
    const answer = await question('   Le fichier .env existe déjà. Voulez-vous le reconfigurer ? (o/n): ');
    if (answer.toLowerCase() !== 'o') {
      log('   ✓ Fichier .env conservé', 'green');
    } else {
      log('   Configuration du fichier .env...', 'blue');
    }
  }
  
  if (!fs.existsSync(envPath) || answer?.toLowerCase() === 'o') {
    const dbPassword = await question('   Mot de passe MySQL root: ');
    const jwtSecret = await question('   Secret JWT (laisser vide pour générer): ');
    
    const generatedSecret = jwtSecret || `secret_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    envConfig = `# ========================================
# CONFIGURATION - ÉCOLE GAMALIEL
# ========================================

PORT=3000
NODE_ENV=development

# ========================================
# BASE DE DONNÉES MYSQL
# ========================================
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=${dbPassword}
DB_NAME=ecole_gamaliel_db
DB_PORT=3306

# ========================================
# JWT - AUTHENTIFICATION
# ========================================
JWT_SECRET=${generatedSecret}
JWT_EXPIRE=7d

# ========================================
# EMAIL (Optionnel)
# ========================================
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=

# ========================================
# UPLOAD DE FICHIERS
# ========================================
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880

# ========================================
# URLS
# ========================================
FRONTEND_URL=http://localhost:8080
API_URL=http://localhost:3000
`;
    
    fs.writeFileSync(envPath, envConfig);
    log('   ✓ Fichier .env créé', 'green');
  }
  
  // Étape 5 : Créer la base de données
  log('\n📦 Étape 5/6 : Configuration de la base de données...', 'yellow');
  
  const dbAnswer = await question('   Voulez-vous créer/configurer la base de données ? (o/n): ');
  
  if (dbAnswer.toLowerCase() === 'o') {
    try {
      log('   Exécution du script SQL...', 'blue');
      
      const schemaPath = path.join(__dirname, 'database', 'schema.sql');
      if (!fs.existsSync(schemaPath)) {
        log('   ❌ Fichier schema.sql non trouvé', 'red');
        process.exit(1);
      }
      
      // Lire le fichier .env pour obtenir le mot de passe
      const envContent = fs.readFileSync(envPath, 'utf8');
      const dbPasswordMatch = envContent.match(/DB_PASSWORD=(.+)/);
      const dbPassword = dbPasswordMatch ? dbPasswordMatch[1] : '';
      
      // Exécuter le script SQL
      execSync(`mysql -u root -p"${dbPassword}" < "${schemaPath}"`, { 
        stdio: 'inherit',
        cwd: __dirname
      });
      
      log('   ✓ Base de données configurée', 'green');
    } catch (error) {
      log('   ❌ Échec de la configuration de la base de données', 'red');
      log('   Vous pouvez exécuter manuellement : mysql -u root -p < database/schema.sql', 'yellow');
    }
  }
  
  // Étape 6 : Créer le dossier uploads
  log('\n📦 Étape 6/6 : Création des dossiers...', 'yellow');
  
  const uploadsPath = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
    log('   ✓ Dossier uploads créé', 'green');
  }
  
  // Résumé
  log('\n🎉 ========================================', 'green');
  log('   INSTALLATION TERMINÉE AVEC SUCCÈS !', 'green');
  log('========================================\n', 'green');
  
  log('📋 PROCHAINES ÉTAPES :\n', 'blue');
  log('1. Démarrer le serveur :', 'yellow');
  log('   npm run dev\n', 'white');
  
  log('2. Activer le mode multi-utilisateurs :', 'yellow');
  log('   Ouvrir backend/frontend-api-config.js', 'white');
  log('   Changer USE_BACKEND: true\n', 'white');
  
  log('3. Se connecter à l\'application :', 'yellow');
  log('   URL: http://localhost:3000/api/health', 'white');
  log('   Username: admin', 'white');
  log('   Password: admin123\n', 'white');
  
  log('⚠️  IMPORTANT : Changez le mot de passe admin immédiatement !\n', 'red');
  
  log('📚 Documentation complète : INSTALLATION.md\n', 'blue');
  log('========================================\n', 'green');
  
  rl.close();
}

main().catch(error => {
  log(`\n❌ Erreur: ${error.message}`, 'red');
  process.exit(1);
});
