const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// GET /api/documents - Récupérer les documents
router.get('/', verifyToken, (req, res) => {
    db.all('SELECT * FROM documents ORDER BY created_at DESC', [], (err, documents) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        res.json({ success: true, data: { documents } });
    });
});

// POST /api/documents - Upload un document
router.post('/', verifyToken, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier' });
    }

    const { name, type } = req.body;

    db.run(
        `INSERT INTO documents (name, type, url, size, uploaded_by) 
         VALUES (?, ?, ?, ?, ?)`,
        [name, type, req.file.path, req.file.size, req.user.id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erreur serveur' });
            res.status(201).json({ 
                success: true, 
                message: 'Document uploadé',
                data: { id: this.lastID, name, type, url: req.file.path } 
            });
        }
    );
});

// DELETE /api/documents/:id - Supprimer un document
router.delete('/:id', verifyToken, (req, res) => {
    db.run('DELETE FROM documents WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        res.json({ success: true, message: 'Document supprimé' });
    });
});

module.exports = router;
