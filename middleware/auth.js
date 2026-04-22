const jwt = require('jsonwebtoken');

// Middleware de vérification JWT
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({
            error: 'Token requis',
            message: 'Accès non autorisé'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({
            error: 'Token invalide',
            message: 'Session expirée ou invalide'
        });
    }
};

// Middleware de vérification des rôles
const checkRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Non authentifié',
                message: 'Veuillez vous connecter'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Accès refusé',
                message: 'Permissions insuffisantes'
            });
        }

        next();
    };
};

module.exports = {
    verifyToken,
    checkRole
};
