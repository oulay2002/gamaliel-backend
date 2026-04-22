const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/payments - Récupérer tous les paiements
router.get('/', verifyToken, (req, res) => {
    const { student_id, type, start_date, end_date } = req.query;
    
    let query = `
        SELECT p.*, s.matricule, s.lastName, s.firstName 
        FROM payments p 
        JOIN students s ON p.student_id = s.id 
        WHERE 1=1
    `;
    const params = [];

    if (student_id) {
        query += ' AND p.student_id = ?';
        params.push(student_id);
    }

    if (type) {
        query += ' AND p.type = ?';
        params.push(type);
    }

    if (start_date) {
        query += ' AND p.date >= ?';
        params.push(start_date);
    }

    if (end_date) {
        query += ' AND p.date <= ?';
        params.push(end_date);
    }

    query += ' ORDER BY p.date DESC';

    db.all(query, params, (err, payments) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        res.json({ success: true, data: { payments } });
    });
});

// POST /api/payments - Créer un paiement
router.post('/', verifyToken, (req, res) => {
    const { student_id, type, amount, mode, date, receipt_number } = req.body;

    if (!student_id || !type || !amount || !mode) {
        return res.status(400).json({
            error: 'Données invalides',
            message: 'Champs requis manquants'
        });
    }

    db.run(
        `INSERT INTO payments (student_id, type, amount, mode, date, receipt_number) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [student_id, type, amount, mode, date || new Date().toISOString().split('T')[0], receipt_number],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erreur serveur' });
            res.status(201).json({ 
                success: true, 
                message: 'Paiement enregistré',
                data: { id: this.lastID, ...req.body } 
            });
        }
    );
});

// DELETE /api/payments/:id - Supprimer un paiement
router.delete('/:id', verifyToken, (req, res) => {
    db.run('DELETE FROM payments WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        res.json({ success: true, message: 'Paiement supprimé' });
    });
});

// GET /api/payments/stats - Statistiques des paiements
router.get('/stats/summary', verifyToken, (req, res) => {
    db.all(
        `SELECT type, SUM(amount) as total, COUNT(*) as count 
         FROM payments 
         GROUP BY type`,
        [],
        (err, stats) => {
            if (err) return res.status(500).json({ error: 'Erreur serveur' });
            res.json({ success: true, data: { stats } });
        }
    );
});

module.exports = router;
