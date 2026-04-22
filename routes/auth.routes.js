/**
 * ROUTES D'AUTHENTIFICATION - ÉCOLE GAMALIEL
 * Contenu complet et corrigé
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

// ========================================
// LOGIN (Connexion)
// ========================================
console.log
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Nom d\'utilisateur requis'),
  body('password').notEmpty().withMessage('Mot de passe requis')
], async (req, res) => {
  // LOG: Voir ce que le client envoie
  console.log('📥 LOGIN REQUEST received:', JSON.stringify(req.body, null, 2));

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { username, password } = req.body;
    console.log('🔍 Searching for user:', username);

    const users = await query(
      'SELECT * FROM users WHERE (username = ? OR email = ? OR phone = ?) AND is_active = TRUE',
      [username, username, username]
    );

    console.log('👥 Users found:', users.length);
    if (users.length > 0) {
      console.log('📋 User data:', { id: users[0].id, username: users[0].username, role: users[0].role, hasPassword: !!users[0].password_hash });
    }

    if (users.length === 0) {
      console.log('❌ User not found in database');
      return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    }

    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    console.log('🔑 Password valid:', isValidPassword);

    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    }

    await query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    // Générer le token JWT
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET || 'gamaliel_secret_key_2024', // Ajout d'une clé par défaut
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
          email: user.email,
          role: user.role,
          full_name: user.full_name
        }
      }
    });
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur lors de la connexion' });
  }
});

// ========================================
// REGISTER (Version Corrigée et Sûre)
// ========================================
router.post('/register', [
  body('username').isLength({ min: 3 }).withMessage('Le nom d\'utilisateur doit faire au moins 3 caractères'),
  body('email').isEmail().withMessage('Email invalide'),
  body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit faire au moins 6 caractères'),
  body('role').isIn(['directeur', 'secretaire', 'comptable', 'enseignant', 'parent']).withMessage('Rôle invalide'),
  body('full_name').notEmpty().withMessage('Nom complet requis')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { username, email, password, role, full_name, phone } = req.body;

    // 1. Vérifier si l'utilisateur existe déjà
    const existing = await query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Ce nom d\'utilisateur ou cet email est déjà utilisé'
      });
    }

    // 2. Hacher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. Créer l'utilisateur
    // On met phone à null s'il n'est pas fourni
    const result = await query(
      'INSERT INTO users (username, email, password_hash, role, full_name, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, passwordHash, role, full_name, phone || null]
    );

    // 4. Journaliser l'action (Corrigé : on utilise l'ID du nouvel utilisateur)
    try {
      await query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)',
        [result.insertId, 'SELF_REGISTER', 'user', result.insertId]
      );
    } catch (auditErr) {
      console.warn("Avertissement: Impossible d'écrire le log d'audit (table peut-être manquante)");
    }

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: {
        id: result.insertId,
        username,
        email,
        role,
        full_name
      }
    });

  } catch (error) {
    // Affiche l'erreur précise dans votre console PC pour débugger
    console.error('ERREUR SERVEUR LORS DU REGISTER:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur : ' + error.message
    });
  }
});

// ========================================
// ME (Infos utilisateur connecté)
// ========================================
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({ success: true, data: { user: req.user } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

module.exports = router;