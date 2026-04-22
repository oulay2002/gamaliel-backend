const bcrypt = require('bcryptjs');

async function generateHash() {
  const password = 'admin123';
  
  // Générer un sel
  const salt = await bcrypt.genSalt(10);
  
  // Hacher le mot de passe
  const hash = await bcrypt.hash(password, salt);
  
  console.log('========================================');
  console.log('Mot de passe:', password);
  console.log('Hash généré:', hash);
  console.log('========================================');
  console.log('\nCopiez ce hash et exécutez ce SQL :\n');
  console.log("UPDATE users SET password_hash = '" + hash + "' WHERE username = 'admin';");
  console.log('========================================');
}

generateHash();