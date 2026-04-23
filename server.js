/**
 * SERVEUR MINIMAL - ÉCOLE GAMALIEL
 * Version Cloud-Ready
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes de santé
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'API Gamaliel en ligne' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API opérationnelle',
    timestamp: new Date().toISOString()
  });
});

// Route de test pour login (temporaire)
app.post('/api/auth/login', (req, res) => {
  console.log('📩 Login attempt:', req.body);
  res.json({ 
    success: true, 
    message: 'Login endpoint functional',
    user: { email: req.body.email, role: 'test' }
  });
});

// Démarrer le serveur
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('🎓 API GAMALIEL DÉMARRÉE');
  console.log(`🌐 Port: ${PORT}`);
  console.log(`🔗 Interface: 0.0.0.0`);
  console.log('========================================');
});

// Garder le processus actif
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

module.exports = app;