const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', verifyToken, (req, res) => {
    db.all('SELECT * FROM classes ORDER BY name', [], (err, classes) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        res.json({ success: true, data: { classes } });
    });
});

router.get('/:id', verifyToken, (req, res) => {
    db.get('SELECT * FROM classes WHERE id = ?', [req.params.id], (err, classItem) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        if (!classItem) return res.status(404).json({ error: 'Classe non trouvée' });
        res.json({ success: true, data: { class: classItem } });
    });
});

router.post('/', verifyToken, (req, res) => {
    const { name, fee, canteen, transport, annexes } = req.body;
    db.run(
        'INSERT INTO classes (name, fee, canteen, transport, annexes) VALUES (?, ?, ?, ?, ?)',
        [name, fee || 0, canteen || 0, transport || 0, annexes || 0],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erreur serveur' });
            res.status(201).json({ success: true, data: { id: this.lastID, ...req.body } });
        }
    );
});

router.put('/:id', verifyToken, (req, res) => {
    const { name, fee, canteen, transport, annexes } = req.body;
    db.run(
        'UPDATE classes SET name=?, fee=?, canteen=?, transport=?, annexes=? WHERE id=?',
        [name, fee, canteen, transport, annexes, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ error: 'Erreur serveur' });
            res.json({ success: true, message: 'Classe mise à jour' });
        }
    );
});

router.delete('/:id', verifyToken, (req, res) => {
    db.run('DELETE FROM classes WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        res.json({ success: true, message: 'Classe supprimée' });
    });
});

module.exports = router;
