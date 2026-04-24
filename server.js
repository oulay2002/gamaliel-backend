const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

// Middlewares (DOIVENT être en premier)
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger toutes les requêtes pour déboguer
app.use((req, res, next) => {
  console.log(`📥 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Route temporaire pour créer la table users (À SUPPRIMER APRÈS USAGE)
app.get('/setup/create-users-table', async (req, res) => {
  console.log('🔧 Création de la table users...');
  
  try {
    const mysql = require('mysql2/promise');
    
    const connection = await mysql.createConnection({
      host: process.env.MYSQLHOST || 'localhost',
      user: process.env.MYSQLUSER || 'root',
      password: process.env.MYSQLPASSWORD || '',
      database: process.env.MYSQLDATABASE || 'railway',
      port: process.env.MYSQLPORT || 3306
    });
    
    // Créer la table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        nom VARCHAR(100),
        prenom VARCHAR(100),
        status VARCHAR(20) DEFAULT 'actif',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ Table users créée avec succès');
    
    await connection.end();
    
    res.json({
      success: true,
      message: 'Table users créée avec succès',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur création table:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route temporaire pour ajouter l'admin (À SUPPRIMER APRÈS USAGE)
app.get('/setup/add-admin', async (req, res) => {
  console.log('🔧 Ajout de l\'utilisateur admin...');
  
  try {
    const mysql = require('mysql2/promise');
    const bcrypt = require('bcryptjs');
    
    // Générer le hash pour "123456"
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    const connection = await mysql.createConnection({
      host: process.env.MYSQLHOST || 'localhost',
      user: process.env.MYSQLUSER || 'root',
      password: process.env.MYSQLPASSWORD || '',
      database: process.env.MYSQLDATABASE || 'railway',
      port: process.env.MYSQLPORT || 3306
    });
    
    // Insérer l'admin
    await connection.execute(`
      INSERT INTO users (email, password, role, nom, prenom, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['admin@gamaliel.com', hashedPassword, 'directeur', 'Admin', 'Gamaliel', 'actif']);
    
    console.log('✅ Admin créé avec succès');
    
    await connection.end();
    
    res.json({
      success: true,
      message: 'Utilisateur admin créé avec succès',
      password: '123456',
      hashedPassword: hashedPassword,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur création admin:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// ROUTES DE SANTÉ
// ========================================
app.get('/', (req, res) => {
  console.log('✅ GET / reçu');
  res.json({ status: 'ok', message: 'API Gamaliel en ligne' });
});

// Health check pour Railway (SANS /api/)
app.get('/health', (req, res) => {
  console.log('✅ GET /health reçu (Railway healthcheck)');
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  console.log('✅ GET /api/health reçu');
  res.json({ success: true, message: 'API opérationnelle' });
});

// ========================================
// ROUTE DE LOGIN (COMPATIBLE MOBILE)
// ========================================
app.post('/auth/login', async (req, res) => {
  // 🔧 ACCEPTER email OU username (pour compatibilité mobile)
  const { email, username, password } = req.body;
  const identifier = email || username;  // Prend email en priorité, sinon username
  
  console.log('========================================');
  console.log('🔐 LOGIN ATTEMPT - DÉTAILS COMPLETS');
  console.log('📦 Body:', JSON.stringify(req.body));
  console.log('🔑 Identifier utilisé:', identifier);
  console.log('========================================');
  
  try {
    // 🔧 Vérifier identifier (pas email seul)
    if (!identifier || !password) {
      console.log('❌ Champs manquants - identifier:', identifier, 'password:', password);
      return res.status(400).json({ 
        success: false, 
        error: 'Email et mot de passe requis' 
      });
    }
    
    console.log('🔍 Recherche utilisateur avec identifier:', identifier);
    
    // Connexion MySQL
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: process.env.MYSQLHOST,
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE,
      port: process.env.MYSQLPORT || 3306
    });
    
    // Chercher par email dans la DB (l'identifiant mobile est mappé à email)
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE email = ?',
      [identifier]  // 🔧 Utiliser identifier ici
    );
    
    await connection.end();
    
    if (users.length === 0) {
      console.log('❌ Utilisateur NON TROUVÉ:', identifier);
      return res.status(401).json({ 
        success: false, 
        error: 'Email ou mot de passe incorrect' 
      });
    }
    
    const user = users[0];
    console.log('✅ Utilisateur trouvé, vérification mot de passe...');
    
    // Vérifier le mot de passe avec bcrypt
    const bcrypt = require('bcryptjs');
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      console.log('❌ Mot de passe INCORRECT');
      return res.status(401).json({ 
        success: false, 
        error: 'Email ou mot de passe incorrect' 
      });
    }
    
    console.log('🎉 LOGIN RÉUSSI:', identifier);
    
    res.json({
      success: true,
      message: 'Connexion réussie',
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('💥 ERREUR LOGIN:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur serveur: ' + error.message 
    });
  }
});

// Route temporaire pour créer un utilisateur test (À SUPPRIMER APRÈS)
app.get('/setup/create-test-user', async (req, res) => {
  console.log('🔧 Création utilisateur test...');
  
  try {
    const mysql = require('mysql2/promise');
    const bcrypt = require('bcryptjs');
    
    // Récupérer les paramètres depuis l'URL (?role=parent&email=test@test.com)
    const role = req.query.role || 'parent';
    const email = req.query.email || `${role}@test.com`;
    const password = '123456';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const connection = await mysql.createConnection({
      host: process.env.MYSQLHOST,
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE,
      port: process.env.MYSQLPORT || 3306
    });
    
    // Insérer l'utilisateur
    await connection.execute(
      `INSERT INTO users (email, password, role, nom, prenom, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email, hashedPassword, role, 'Test', role === 'parent' ? 'Parent' : 'Enseignant', 'actif']
    );
    
    await connection.end();
    
    console.log(`✅ Utilisateur ${role} créé: ${email}`);
    
    res.json({
      success: true,
      message: `Utilisateur ${role} créé avec succès`,
      email: email,
      password: password,
      role: role,
      hashedPassword: hashedPassword
    });
    
  } catch (error) {
    console.error('❌ Erreur création utilisateur:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// CATCH-ALL POUR DÉBOGAGE (à la FIN)
// ========================================
app.all('*', (req, res) => {
  console.log('⚠️ Route non gérée:', req.method, req.url);
  res.status(404).json({ error: 'Route non trouvée', path: req.url });
});

// MODIFICATION POUR RAILWAY - Date: 2026-04-23

// ========================================
// DÉMARRAGE
// ========================================
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('🎓 API GAMALIEL DÉMARRÉE');
  console.log(`🌐 Port: ${PORT}`);
  console.log('========================================');
});

process.stdin.resume();

module.exports = app;