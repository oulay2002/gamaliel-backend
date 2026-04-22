const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/pv - PV conseils de classe
router.get('/pv', verifyToken, (req, res) => {
    const { class_id, trimester } = req.query;
    
    let query = `
        SELECT r.*, c.name as class_name 
        FROM pv_reports r 
        JOIN classes c ON r.class_id = c.id 
        WHERE 1=1
    `;
    const params = [];

    if (class_id) {
        query += ' AND r.class_id = ?';
        params.push(class_id);
    }

    if (trimester) {
        query += ' AND r.trimester = ?';
        params.push(trimester);
    }

    query += ' ORDER BY r.date DESC';

    db.all(query, params, (err, reports) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        res.json({ success: true, data: { reports } });
    });
});

// POST /api/reports/pv - Créer un PV
router.post('/pv', verifyToken, (req, res) => {
    const { class_id, trimester, date, classComment, data } = req.body;

    if (!class_id || !trimester || !date) {
        return res.status(400).json({
            error: 'Données invalides',
            message: 'Champs requis manquants'
        });
    }

    db.run(
        `INSERT INTO pv_reports (class_id, trimester, date, classComment, data) 
         VALUES (?, ?, ?, ?, ?)`,
        [class_id, trimester, date, classComment, JSON.stringify(data)],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erreur serveur' });
            res.status(201).json({ 
                success: true, 
                message: 'PV créé avec succès',
                data: { id: this.lastID, ...req.body } 
            });
        }
    );
});

module.exports = router;
