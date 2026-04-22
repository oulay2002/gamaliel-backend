/**
 * MIDDLEWARE D'AUTHENTIFICATION
 * Vérification des tokens JWT et des permissions
 */

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Middleware de vérification du token JWT
async function authenticateToken(req, res, next) {
  try {
    // Récupérer le token depuis l'en-tête Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Accès refusé. Token manquant.'
      });
    }
    
    // Vérifier le token
    // On ajoute la clé de secours 'gamaliel_secret_key_2024'
const decoded = jwt.verify(token, process.env.JWT_SECRET || 'gamaliel_secret_key_2024');
    
    // Récupérer l'utilisateur depuis la base de données
    const user = await query(
      'SELECT id, username, email, role, full_name, is_active FROM users WHERE id = ? AND is_active = TRUE',
      [decoded.id]
    );
    
    if (!user || user.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Utilisateur inexistant ou désactivé'
      });
    }
    
    // Attacher l'utilisateur à la requête
    req.user = user[0];
    req.token = decoded;
    
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Token invalide'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expiré. Veuillez vous reconnecter.'
      });
    }
    
    console.error('Erreur d\'authentification:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur d\'authentification'
    });
  }
}

// Middleware de vérification des rôles
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Non authentifié'
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé. Permissions insuffisantes.'
      });
    }
    
    next();
  };
}

// Middleware de vérification des permissions personnalisées
function authorizePermission(permission) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Non authentifié'
      });
    }
    
    // Le directeur a tous les droits
    if (req.user.role === 'directeur') {
      return next();
    }
    
    // Vérifier les permissions spécifiques (à implémenter selon les besoins)
    // Pour l'instant, on autorise tous les utilisateurs authentifiés
    next();
  };
}

// Middleware optionnel d'authentification
// (ne bloque pas si pas de token, mais attache l'utilisateur s'il est présent)
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
     // ✅ APRÈS (avec la clé de secours)
const decoded = jwt.verify(token, process.env.JWT_SECRET || 'gamaliel_secret_key_2024');
      const user = await query(
        'SELECT id, username, email, role, full_name FROM users WHERE id = ? AND is_active = TRUE',
        [decoded.id]
      );
      
      if (user && user.length > 0) {
        req.user = user[0];
        req.token = decoded;
      }
    }
    
    next();
  } catch (error) {
    // Ignorer les erreurs et continuer sans authentification
    next();
  }
}

module.exports = {
  authenticateToken,
  authorizeRoles,
  authorizePermission,
  optionalAuth
};
