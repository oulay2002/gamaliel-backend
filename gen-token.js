const jwt = require('jsonwebtoken');

// ⚠️ Remplace par ton VRAI JWT_SECRET depuis Railway (Variables)
const SECRET = 'COPIE_TON_JWT_SECRET_DEPUIS_RAILWAY_ICI';

const token = jwt.sign(
  { userId: 1, email: 'admin@gamaliel.com', role: 'admin' },
  SECRET,
  { expiresIn: '24h' }
);

console.log(token);
