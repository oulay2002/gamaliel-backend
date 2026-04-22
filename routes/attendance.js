const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/attendance/students - Présences élèves
router.get('/students', verifyToken, (req, res) => {
    const { student_id, date, status } = req.query;
    
    let query = `
        SELECT a.*, s.matricule, s.lastName, s.firstName 
        FROM student_attendance a 
        JOIN students s ON a.student_id = s.id 
        WHERE 1=1
    `;
    const params = [];

    if (student_id) {
        query += ' AND a.student_id = ?';
        params.push(student_id);
    }

    if (date) {
        query += ' AND a.date = ?';
        params.push(date);
    }

    if (status) {
        query += ' AND a.status = ?';
        params.push(status);
    }

    query += ' ORDER BY a.date DESC';

    db.all(query, params, (err, attendance) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        res.json({ success: true, data: { attendance } });
    });
});

// POST /api/attendance/students - Créer une présence élève
router.post('/students', verifyToken, (req, res) => {
    const { student_id, date, timeIn, status, justification } = req.body;

    if (!student_id || !date || !status) {
        return res.status(400).json({
            error: 'Données invalides',
            message: 'Champs requis manquants'
        });
    }

    db.run(
        `INSERT INTO student_attendance (student_id, date, timeIn, status, justification) 
         VALUES (?, ?, ?, ?, ?)`,
        [student_id, date, timeIn, status, justification],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erreur serveur' });
            res.status(201).json({ 
                success: true, 
                message: 'Présence enregistrée',
                data: { id: this.lastID, ...req.body } 
            });
        }
    );
});

// GET /api/attendance/teachers - Présences enseignants
router.get('/teachers', verifyToken, (req, res) => {
    const { teacher_id, date, status } = req.query;
    
    let query = `
        SELECT a.*, t.lastName, t.firstName 
        FROM teacher_attendance a 
        JOIN teachers t ON a.teacher_id = t.id 
        WHERE 1=1
    `;
    const params = [];

    if (teacher_id) {
        query += ' AND a.teacher_id = ?';
        params.push(teacher_id);
    }

    if (date) {
        query += ' AND a.date = ?';
        params.push(date);
    }

    if (status) {
        query += ' AND a.status = ?';
        params.push(status);
    }

    query += ' ORDER BY a.date DESC';

    db.all(query, params, (err, attendance) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        res.json({ success: true, data: { attendance } });
    });
});

// POST /api/attendance/teachers - Créer une présence enseignant
router.post('/teachers', verifyToken, (req, res) => {
    const { teacher_id, date, status, reason, justification } = req.body;

    if (!teacher_id || !date || !status) {
        return res.status(400).json({
            error: 'Données invalides',
            message: 'Champs requis manquants'
        });
    }

    db.run(
        `INSERT INTO teacher_attendance (teacher_id, date, status, reason, justification) 
         VALUES (?, ?, ?, ?, ?)`,
        [teacher_id, date, status, reason, justification],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erreur serveur' });
            res.status(201).json({ 
                success: true, 
                message: 'Présence enregistrée',
                data: { id: this.lastID, ...req.body } 
            });
        }
    );
});

module.exports = router;
