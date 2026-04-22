const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', verifyToken, (req, res) => {
    db.all('SELECT * FROM teachers ORDER BY lastName', [], (err, teachers) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        res.json({ success: true, data: { teachers } });
    });
});

router.post('/', verifyToken, (req, res) => {
    const teacher = req.body;
    db.run(
        `INSERT INTO teachers (code, class_id, lastName, firstName, phone, email, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [teacher.code, teacher.class_id, teacher.lastName, teacher.firstName, teacher.phone, teacher.email, teacher.role || 'Enseignant'],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erreur serveur' });
            res.status(201).json({ success: true, data: { id: this.lastID, ...teacher } });
        }
    );
});

router.put('/:id', verifyToken, (req, res) => {
    const { code, class_id, lastName, firstName, phone, email, role } = req.body;
    db.run(
        'UPDATE teachers SET code=?, class_id=?, lastName=?, firstName=?, phone=?, email=?, role=? WHERE id=?',
        [code, class_id, lastName, firstName, phone, email, role, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: 'Erreur serveur' });
            res.json({ success: true, message: 'Enseignant mis à jour' });
        }
    );
});

router.delete('/:id', verifyToken, (req, res) => {
    db.run('DELETE FROM teachers WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        res.json({ success: true, message: 'Enseignant supprimé' });
    });
});

module.exports = router;
