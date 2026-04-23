const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  console.log('✅ GET / reçu');
  res.json({ status: 'ok', message: 'API en ligne' });
});

app.get('/api/health', (req, res) => {
  console.log('✅ GET /api/health reçu');
  res.json({ success: true, timestamp: new Date().toISOString() });
});

// Démarrer
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('🎓 API GAMALIEL DÉMARRÉE');
  console.log(`🌐 Port: ${PORT}`);
  console.log('========================================');
  console.log('🔄 Processus actif - en attente de connexions...');
});

// 🔥 GARDER LE PROCESSUS ACTIF (CRUCIAL POUR RAILWAY)
console.log('📌 Keep-alive activé pour empêcher la sortie du processus');
setInterval(() => {
  // Empêche Node.js de se terminer
}, 2147483647).unref();

// Gestion erreurs
process.on('uncaughtException', (err) => {
  console.error('❌ EXCEPTION:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ PROMESSE:', reason);
});

module.exports = app;