/**
 * ROUTES PARAMÈTRES/SETTINGS
 * Gestion des paramètres de l'application
 */

const express = require('express');
const { query } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// ========================================
// GET /api/settings - Récupérer les paramètres
// ========================================
router.get('/', async (req, res) => {
    try {
        const settings = await query('SELECT * FROM settings');

        const settingsObj = {};
        settings.forEach(s => {
            settingsObj[s.key] = s.value;
        });

        res.json({
            success: true,
            data: { settings: settingsObj }
        });

    } catch (error) {
        console.error('Erreur get settings:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des paramètres'
        });
    }
});

// ========================================
// PUT /api/settings - Mettre à jour les paramètres
// ========================================
router.put('/', authorizeRoles('directeur', 'secretaire'), async (req, res) => {
    try {
        const settings = req.body;

        const queries = Object.keys(settings).map(key => {
            return query(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
          value = VALUES(value),
          updated_at = CURRENT_TIMESTAMP
      `, [key, settings[key]]);
        });

        await Promise.all(queries);

        res.json({
            success: true,
            message: 'Paramètres mis à jour avec succès'
        });

    } catch (error) {
        console.error('Erreur update settings:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la mise à jour des paramètres'
        });
    }
});

module.exports = router;
