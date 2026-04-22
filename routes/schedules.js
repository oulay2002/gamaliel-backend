const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/schedules - Récupérer les emplois du temps
router.get('/', verifyToken, (req, res) => {
    const { class_id } = req.query;
    
    let query = `
        SELECT s.*, c.name as class_name, t.lastName as teacher_name 
        FROM schedules s 
        LEFT JOIN classes c ON s.class_id = c.id 
        LEFT JOIN teachers t ON s.teacher_id = t.id 
        WHERE 1=1
    `;
    const params = [];

    if (class_id) {
        query += ' AND s.class_id = ?';
        params.push(class_id);
    }

    query += ' ORDER BY s.day, s.timeStart';

    db.all(query, params, (err, schedules) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        res.json({ success: true, data: { schedules } });
    });
});

// POST /api/schedules - Créer un emploi du temps
router.post('/', verifyToken, (req, res) => {
    const { class_id, teacher_id, subject, day, timeStart, timeEnd } = req.body;

    if (!class_id || !subject || !day || !timeStart) {
        return res.status(400).json({
            error: 'Données invalides',
            message: 'Champs requis manquants'
        });
    }

    db.run(
        `INSERT INTO schedules (class_id, teacher_id, subject, day, timeStart, timeEnd) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [class_id, teacher_id || null, subject, day, timeStart, timeEnd],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erreur serveur' });
            res.status(201).json({ 
                success: true, 
                message: 'Emploi du temps créé',
                data: { id: this.lastID, ...req.body } 
            });
        }
    );
});

// DELETE /api/schedules/:id - Supprimer un emploi du temps
router.delete('/:id', verifyToken, (req, res) => {
    db.run('DELETE FROM schedules WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        res.json({ success: true, message: 'Emploi du temps supprimé' });
    });
});

module.exports = router;
