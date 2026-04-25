const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    console.log('❌ Token manquant');
    return res.status(401).json({ 
      success: false, 
      error: 'Token requis' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('❌ Token invalide:', err.message);
      return res.status(403).json({ 
        success: false, 
        error: 'Token invalide ou expiré' 
      });
    }
    req.user = user; // { id, email, role }
    next();
  });
};

module.exports = authenticateToken;