/**
 * SERVEUR PRINCIPAL - ÉCOLE GAMALIEL
 * API REST Multi-Utilisateurs
 * 
 * @version 2.0.0
 * @author École Gamaliel
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Import des routes
const authRoutes = require('./routes/auth.routes');
const genericRoutes = require('./routes/generic.routes'); // Contient teachers, subjects, report-cards, settings, documents, users
const studentRoutes = require('./routes/student.routes');
const paymentRoutes = require('./routes/payment.routes');
const compositionRoutes = require('./routes/composition.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const classRoutes = require('./routes/class.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

// Nouvelles routes MyGamaliel
const parentRoutes = require('./routes/parents.routes');
const homeworkRoutes = require('./routes/homeworks.routes');
const messageRoutes = require('./routes/messages.routes');
const notificationRoutes = require('./routes/notifications.routes');
const parentMobileRoutes = require('./routes/parent.routes'); // Routes spécifiques pour mobile
const mobileSyncRoutes = require('./routes/mobile-sync.routes'); // Synchronisation mobile
const syncRoutes = require('./routes/sync.routes'); // Nouvelle synchronisation MyGamaliel v2.0
const teacherMobileRoutes = require('./routes/teacher-mobile.routes'); // Routes mobile enseignant
const behaviorRoutes = require('./routes/behavior.routes'); // Comportement / Conduite
const observationRoutes = require('./routes/observation.routes'); // Observations enseignant → parent

// Logger structuré
const logger = require('./middleware/logger');

// Initialiser Firebase (optionnel - pour les notifications push)
let firebaseInitialized = false;
try {
  const { initializeFirebase } = require('./services/firebaseService');
  const firebaseConfigPath = path.join(__dirname, 'config', 'firebase-service-account.json');
  firebaseInitialized = initializeFirebase(firebaseConfigPath);
} catch (error) {
  console.log('⚠️  Firebase non configuré - Les notifications push seront désactivées');
  console.log('📖 Voir FIREBASE_SETUP.md pour la configuration');
}

// Initialisation de l'application
const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// MIDDLEWARES DE SÉCURITÉ
// ========================================

// Logger structuré (avant tout le reste)
app.use(logger.requestLogger);

// Helmet pour les en-têtes HTTP sécurisés
app.use(helmet({
  contentSecurityPolicy: false, // Désactivé pour le développement
  crossOriginEmbedderPolicy: false
}));

// CORS - Autoriser toutes les origines (pour développement)
app.use(cors({
  origin: '*',  // ← Changez ceci pour accepter toutes les origines
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'X-Sync-Since']
}));

// Rate limiting - Protection contre les attaques par force brute
// Increased limits for development: mobile apps send many concurrent requests
const isDevelopment = process.env.NODE_ENV !== 'production';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 500 : 100, // 500 in dev, 100 in prod
  message: {
    success: false,
    error: 'Trop de requêtes, veuillez réessayer plus tard'
  }
});
app.use('/api/', limiter);

// Rate limiting plus strict pour l'authentification
// Increased from 5 to 15 to allow for typos and retries
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 20 : 10, // 20 in dev, 10 in prod
  message: {
    success: false,
    error: 'Trop de tentatives de connexion. Veuillez attendre 15 minutes ou réinitialiser le serveur.'
  }
});

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Dossier uploads pour les fichiers statiques
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========================================
// ROUTES API
// ========================================

// Route de test
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API École Gamaliel est opérationnelle',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Routes d'authentification (avec rate limiting renforcé)
app.use('/api/auth', authLimiter, authRoutes);

// Routes protégées
app.use('/api/students', studentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/compositions', compositionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/homeworks', homeworkRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/parents-mobile', parentMobileRoutes); // Routes spécifiques pour mobile
app.use('/api/teachers-mobile', teacherMobileRoutes); // Routes mobile enseignant
app.use('/api/teachers-mobile', behaviorRoutes); // Comportement / Conduite
app.use('/api/teachers-mobile', observationRoutes); // Observations enseignant → parent
app.use('/api/mobile', mobileSyncRoutes); // Routes de synchronisation mobile (DOIT ÊTRE AVANT /api)
app.use('/api/sync', syncRoutes); // NOUVEAU: Routes de synchronisation MyGamaliel v2.0
app.use('/api', genericRoutes); // Routes génériques (teachers, subjects, report-cards, settings, documents, users)

// ========================================
// GESTION DES ERREURS
// ========================================

// Erreur 404
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée'
  });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);

  // Erreur MySQL
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({
      success: false,
      error: 'Donnée en double'
    });
  }

  // Erreur de validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  // Erreur JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Token invalide'
    });
  }

  // Erreur par défaut
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Erreur serveur interne'
  });
});

// ========================================
// DÉMARRAGE DU SERVEUR (Cloud Ready)
// ========================================

async function startServer() {
  try {
    // Tester la connexion à la base de données avec réessais
    const db = require('./config/database');
    let dbConnected = false;
    
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        dbConnected = await db.testConnection();
        if (dbConnected) {
          console.log('✅ Connexion à la base de données réussie');
          break;
        }
      } catch (err) {
        console.log(`⏳ Tentative ${attempt}/10 - DB non prête: ${err.message}`);
      }
      if (attempt < 10) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    if (!dbConnected) {
      console.error('❌ Échec de connexion à la base de données après 10 tentatives');
      // Ne pas exit(1) - laisser Railway redémarrer automatiquement
      return;
    }

    // Créer les utilisateurs par défaut
    const { seedDefaultUsers } = require('./seed-users');
    await seedDefaultUsers().catch(err => console.log('⚠️ Seed users:', err.message));

    // Démarrer le serveur
    const PORT = process.env.PORT || 3001;
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('============================================================');
      console.log('   🎓 API ÉCOLE GAMALIEL - DÉMARRÉE');
      console.log(`   🌐 Serveur: accessible sur le port ${PORT}`);
      console.log(`   📊 Environnement: ${process.env.NODE_ENV}`);
      console.log('============================================================');
    });

    // Gestion propre des signaux
    const shutdown = (signal) => {
      console.log(`\n📡 Signal ${signal} reçu, fermeture en cours...`);
      server.close(() => {
        console.log('✅ Serveur fermé proprement');
        process.exit(0);
      });
      // Force close après 10 secondes
      setTimeout(() => {
        console.error('❌ Fermeture forcée après timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Erreur au démarrage:', error);
    // Ne pas exit(1) - laisser Railway gérer le redémarrage automatique
  }
}

// Démarrer le serveur
startServer();

module.exports = app;