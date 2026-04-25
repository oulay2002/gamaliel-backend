const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// 🔹 Import du middleware d'authentification (UNE SEULE FOIS)
const authenticateToken = require('./middleware/auth');

const app = express();

// ✅ MIDDLEWARES - DOIVENT ÊTRE EN PREMIER
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// ROUTE: POST /api/login - Authentification
// ============================================
app.post('/api/login', async (req, res) => {
  console.log('🔥🔥🔥 /api/login HIT! Body:', req.body); 
    try {
    const { email, password } = req.body;
      
    // 🔧 Validation basique
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email et mot de passe requis' 
      });
    }
    
    // 🔧 TODO: Remplacer par ta vraie vérification MySQL
    // Exemple pour test :
    const VALID_ADMIN = {
      email: 'admin@gamaliel.com',
      password: 'admin123'  // ⚠️ À changer en prod !
    };
    
    if (email !== VALID_ADMIN.email || password !== VALID_ADMIN.password) {
      return res.status(401).json({ 
        success: false, 
        error: 'Identifiants invalides' 
      });
    }
    
    // ✅ Générer un token JWT
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        userId: 1, 
        email: VALID_ADMIN.email, 
        role: 'admin' 
      },
      process.env.JWT_SECRET || 'fallback_secret_change_in_prod',
      { expiresIn: '24h' }
    );
    
    console.log(`✅ Login réussi: ${email}`);
    
    res.json({
      success: true,
      message: 'Connexion réussie',
      token,
      user: {
        id: 1,
        email: VALID_ADMIN.email,
        role: 'admin',
        name: 'Administrateur'
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur login:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur serveur lors de la connexion' 
    });
  }
});

// === ROUTE DEBUG PUBLIQUE (à supprimer après) ===
app.get('/debug/alive', (req, res) => {
  console.log('✅✅✅ /debug/alive HIT at', new Date().toISOString());
  res.json({ 
    success: true, 
    message: 'Server is alive!', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Logger pour débogage
app.use((req, res, next) => {
  console.log(`📥 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ========================================
// ROUTES PUBLIQUES (Sans token)
// ========================================

// Health checks
app.get('/', (req, res) => res.json({ status: 'ok', message: 'API Gamaliel en ligne' }));
app.get('/health', (req, res) => res.json({ status: 'healthy', timestamp: new Date().toISOString() }));
app.get('/api/health', (req, res) => res.json({ success: true, message: 'API opérationnelle' }));

// Login - COMPATIBLE MOBILE (accepte email OU username)
app.post('/auth/login', async (req, res) => {
  const { email, username, password } = req.body;
  const identifier = email || username;
  
  console.log('🔐 Login attempt:', identifier);
  
  if (!identifier || !password) {
    return res.status(400).json({ success: false, error: 'Email et mot de passe requis' });
  }
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQLHOST,
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE,
      port: process.env.MYSQLPORT || 3306
    });
    
    // Chercher par email (l'identifiant mobile est mappé à email)
    const [users] = await connection.execute('SELECT * FROM users WHERE email = ?', [identifier]);
    await connection.end();
    
    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
    }
    
    const user = users[0];
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
    }
    
    // Générer token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      message: 'Connexion réussie',
      token: token,  // ← Important pour le mobile
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('💥 Login error:', error.message);
    res.status(500).json({ success: false, error: 'Erreur serveur: ' + error.message });
  }
});

// Refresh token (optionnel mais recommandé)
app.post('/auth/refresh', authenticateToken, async (req, res) => {
  try {
    const newToken = jwt.sign(
      { id: req.user.id, email: req.user.email, role: req.user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ success: true, token: newToken });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur refresh token' });
  }
});

// ========================================
// ROUTES PROTÉGÉES (Avec token)
// ========================================

// 🔹 STUDENTS - Route demandée par ton app mobile
app.get('/api/students', authenticateToken, async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQLHOST,
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE,
      port: process.env.MYSQLPORT || 3306
    });
    
    // 🔧 Ajuste cette requête selon TA structure de base de données réelle
    const [students] = await connection.execute(`
      SELECT id, email, nom, prenom, role, status, created_at 
      FROM users 
      WHERE role IN ('parent', 'student', 'enseignant')
      ORDER BY nom, prenom
    `);
    
    await connection.end();
    
    res.json({
      success: true,
       students,
      count: students.length
    });
  } catch (error) {
    console.error('❌ Error fetching students:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// 🔹 DASHBOARD - Exemple de route protégée
app.get('/api/dashboard/:role', authenticateToken, async (req, res) => {
  try {
    // Vérifier que l'utilisateur a le bon rôle
    if (req.user.role !== req.params.role && req.user.role !== 'directeur') {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }
    
    // Données factices pour l'exemple (à remplacer par tes vraies requêtes)
   res.json({
  success: true,
  data: {                    
    role: req.params.role,
    stats: { students: 150, teachers: 12, classes: 8 },
    message: `Dashboard ${req.params.role} chargé`
  }
});
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// 🔹 NOTES - Exemple
app.get('/api/notes/:matricule', authenticateToken, async (req, res) => {
  try {
    // 🔧 Remplace par ta vraie requête SQL
    res.json({
      success: true,
      data: {
        matricule: req.params.matricule,
        notes: [
          { matiere: 'Maths', note: 15, coef: 2 },
          { matiere: 'Français', note: 14, coef: 3 }
        ]
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// 🔹 ABSENCES - Exemple
app.get('/api/absences/:matricule', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        matricule: req.params.matricule,
        absences: []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// 🔹 PAYMENTS - Exemple
app.get('/api/payments/:matricule', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        matricule: req.params.matricule,
        payments: [],
        balance: 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// 🔹 MESSAGES - Exemple
app.get('/api/messages/:userId', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        userId: req.params.userId,
        messages: []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ========================================
// ROUTES DE SETUP (À supprimer en production)
// ========================================

app.get('/setup/create-users-table', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQLHOST,
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE,
      port: process.env.MYSQLPORT || 3306
    });
    
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
    
    await connection.end();
    res.json({ success: true, message: 'Table users créée' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/setup/add-admin', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash('123456', 10);
    const connection = await mysql.createConnection({
      host: process.env.MYSQLHOST,
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE,
      port: process.env.MYSQLPORT || 3306
    });
    
    await connection.execute(
      'INSERT INTO users (email, password, role, nom, prenom) VALUES (?, ?, ?, ?, ?)',
      ['admin@gamaliel.com', hashedPassword, 'directeur', 'Admin', 'Gamaliel']
    );
    
    await connection.end();
    res.json({ success: true, message: 'Admin créé', password: '123456' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/setup/create-test-user', async (req, res) => {
  try {
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
    
    await connection.execute(
      'INSERT INTO users (email, password, role, nom, prenom) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, role, 'Test', role]
    );
    
    await connection.end();
    res.json({ success: true, email, password, role });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// ROUTE: Dashboard Stats (pour l'app mobile)
// ============================================
app.get('/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    
    // Stats différentes selon le rôle
    let stats = {};
    
    if (role === 'admin' || role === 'directeur') {
      stats = {
        totalStudents: 150,
        totalTeachers: 12,
        totalClasses: 8,
        totalParents: 145,
        pendingPayments: 23,
        todayAttendance: 142
      };
    } else if (role === 'teacher') {
      stats = {
        myClasses: 4,
        myStudents: 85,
        pendingGrades: 12,
        todaySchedule: 3
      };
    } else if (role === 'parent') {
      stats = {
        myChildren: 2,
        pendingPayments: 1,
        unreadNotifications: 3,
        nextMeeting: '2026-04-28'
      };
    }
    
    res.json({
      success: true,
      message: 'Dashboard stats récupérées',
      data: stats
    });
  } catch (error) {
    console.error('❌ Erreur dashboard stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur serveur lors de la récupération des stats' 
    });
  }
});

// ============================================
// ROUTE: Register Mobile Notifications (Firebase)
// ============================================
app.post('/mobile/notifications/register', authenticateToken, async (req, res) => {
  try {
    const { deviceToken, platform } = req.body; // platform: 'android' | 'ios'
    const userId = req.user.userId;
    
    if (!deviceToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'Device token requis' 
      });
    }
    
    // 🔧 Ici, tu devrais sauvegarder le token dans ta base MySQL
    // Exemple de requête (à adapter à ton schéma) :
    /*
    await db.query(
      `INSERT INTO user_devices (user_id, device_token, platform, created_at) 
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE device_token = ?, updated_at = NOW()`,
      [userId, deviceToken, platform, deviceToken]
    );
    */
    
    console.log(`📱 Token enregistré: User ${userId}, Platform: ${platform || 'unknown'}`);
    
    res.json({
      success: true,
      message: 'Token de notification enregistré avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur registration notifications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de l\'enregistrement du token' 
    });
  }
});

// ========================================
// DÉMARRAGE DU SERVEUR
// ========================================
const PORT = process.env.PORT || 3001;

// === CATCH-ALL 404 (à la fin, après toutes les routes) ===

// CATCH-ALL (404) - DOIT ÊTRE À LA FIN
// ========================================
app.all('*', (req, res) => {
  console.log('⚠️ Route non trouvée:', req.method, req.url);
  res.status(404).json({ error: 'Route non trouvée', path: req.url });
});

// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('🎓 API GAMALIEL DÉMARRÉE');
  console.log(`🌐 Port: ${PORT}`);
  console.log('========================================');
});

module.exports = app;// Deploy trigger: Sat Apr 25 13:58:32     2026
