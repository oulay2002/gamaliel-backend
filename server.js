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

// ========================================
// ROUTES DE SANTÉ
// ========================================
app.get('/', (req, res) => {
  console.log('✅ GET / reçu');
  res.json({ status: 'ok', message: 'API Gamaliel en ligne' });
});

app.get('/api/health', (req, res) => {
  console.log('✅ GET /api/health reçu');
  res.json({ success: true, message: 'API opérationnelle' });
});

// ========================================
// ROUTE DE LOGIN (CRUCIAL : DOIT ÊTRE AVANT LES CATCH-ALL)
// ========================================
app.post('/auth/login', async (req, res) => {
  console.log('🔐 POST /auth/login reçu - Corps:', JSON.stringify(req.body));
  
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      console.log('❌ Champs manquants');
      return res.status(400).json({ success: false, error: 'Email et mot de passe requis' });
    }
    
    // Connexion MySQL
    const connection = await mysql.createConnection({
      host: process.env.MYSQLHOST || 'localhost',
      user: process.env.MYSQLUSER || 'root',
      password: process.env.MYSQLPASSWORD || '',
      database: process.env.MYSQLDATABASE || 'railway',
      port: process.env.MYSQLPORT || 3306
    });
    
    console.log('🔍 Recherche utilisateur:', email);
    
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    
    await connection.end();
    
    if (users.length === 0) {
      console.log('❌ Utilisateur NON TROUVÉ:', email);
      return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
    }
    
    const user = users[0];
    console.log('✅ Utilisateur trouvé, vérification mot de passe...');
    
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      console.log('❌ Mot de passe INCORRECT');
      return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
    }
    
    console.log('🎉 LOGIN RÉUSSI:', email);
    
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
    res.status(500).json({ success: false, error: 'Erreur serveur: ' + error.message });
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