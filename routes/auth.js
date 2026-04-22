const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { verifyToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/auth/login
// @desc    Connexion utilisateur
// @access  Public
router.post('/login', (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: 'Données invalides',
            message: 'Identifiant et mot de passe requis'
        });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                error: 'Erreur serveur',
                message: 'Erreur lors de la connexion'
            });
        }

        if (!user) {
            return res.status(401).json({
                error: 'Échec connexion',
                message: 'Identifiant incorrect'
            });
        }

        // Vérifier le mot de passe
        const isValidPassword = bcrypt.compareSync(password, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Échec connexion',
                message: 'Mot de passe incorrect'
            });
        }

        // Vérifier le rôle
        if (role && user.role !== role) {
            return res.status(403).json({
                error: 'Rôle incorrect',
                message: 'Ce compte n\'a pas le rôle requis'
            });
        }

        // Générer le token JWT
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                role: user.role,
                name: user.name 
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        res.json({
            success: true,
            message: 'Connexion réussie',
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    role: user.role
                }
            }
        });
    });
});

// @route   GET /api/auth/me
// @desc    Récupérer les infos utilisateur connecté
// @access  Privé
router.get('/me', verifyToken, (req, res) => {
    db.get('SELECT id, username, name, role, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
            console.error(err);
            return res.status(500).json({
                error: 'Erreur serveur'
            });
        }

        if (!user) {
            return res.status(404).json({
                error: 'Utilisateur non trouvé'
            });
        }

        res.json({
            success: true,
            data: { user }
        });
    });
});

// @route   POST /api/auth/register
// @desc    Créer un nouvel utilisateur (Admin only)
// @access  Privé (Directeur seulement)
router.post('/register', (req, res) => {
    const { username, password, name, role } = req.body;

    // Validation
    if (!username || !password || !name || !role) {
        return res.status(400).json({
            error: 'Données invalides',
            message: 'Tous les champs sont requis'
        });
    }

    // Vérifier le rôle
    if (!['directeur', 'secretaire', 'comptable'].includes(role)) {
        return res.status(400).json({
            error: 'Rôle invalide',
            message: 'Rôle non autorisé'
        });
    }

    // Hacher le mot de passe
    const hashedPassword = bcrypt.hashSync(password, 10);

    db.run(
        'INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
        [username, hashedPassword, name, role],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({
                        error: 'Utilisateur existe déjà',
                        message: 'Ce nom d\'utilisateur est déjà pris'
                    });
                }
                console.error(err);
                return res.status(500).json({
                    error: 'Erreur serveur'
                });
            }

            res.status(201).json({
                success: true,
                message: 'Utilisateur créé avec succès',
                data: {
                    id: this.lastID,
                    username,
                    name,
                    role
                }
            });
        }
    );
});

// @route   PUT /api/auth/password
// @desc    Changer le mot de passe
// @access  Privé
router.put('/password', verifyToken, (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({
            error: 'Données invalides',
            message: 'Mots de passe requis'
        });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({
            error: 'Mot de passe trop court',
            message: 'Le mot de passe doit contenir au moins 6 caractères'
        });
    }

    db.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }

        // Vérifier le mot de passe actuel
        const isValidPassword = bcrypt.compareSync(currentPassword, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Mot de passe incorrect',
                message: 'Le mot de passe actuel est incorrect'
            });
        }

        // Hacher le nouveau mot de passe
        const hashedPassword = bcrypt.hashSync(newPassword, 10);

        db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Erreur serveur' });
            }

            res.json({
                success: true,
                message: 'Mot de passe mis à jour avec succès'
            });
        });
    });
});

// @route   GET /api/auth/users
// @desc    Récupérer tous les utilisateurs (Admin only)
// @access  Privé (Directeur seulement)
router.get('/users', verifyToken, checkRole('directeur'), (req, res) => {
    db.all('SELECT id, username, name, role, created_at FROM users', [], (err, users) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }

        res.json({
            success: true,
            data: { users }
        });
    });
});

// @route   DELETE /api/auth/users/:id
// @desc    Supprimer un utilisateur (Admin only)
// @access  Privé (Directeur seulement)
router.delete('/users/:id', verifyToken, checkRole('directeur'), (req, res) => {
    const userId = req.params.id;

    // Empêcher la suppression de son propre compte
    if (parseInt(userId) === req.user.id) {
        return res.status(400).json({
            error: 'Action interdite',
            message: 'Vous ne pouvez pas supprimer votre propre compte'
        });
    }

    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }

        if (this.changes === 0) {
            return res.status(404).json({
                error: 'Utilisateur non trouvé'
            });
        }

        res.json({
            success: true,
            message: 'Utilisateur supprimé avec succès'
        });
    });
});

module.exports = router;
