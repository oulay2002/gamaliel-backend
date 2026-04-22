const express = require('express');
const db = require('../database');
const { verifyToken, checkRole } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/students
// @desc    Récupérer tous les élèves
// @access  Privé
router.get('/', verifyToken, (req, res) => {
    const { class: classId, search, limit, offset } = req.query;
    
    let query = `
        SELECT s.*, c.name as class_name 
        FROM students s 
        LEFT JOIN classes c ON s.class_id = c.id 
        WHERE 1=1
    `;
    const params = [];

    if (classId) {
        query += ' AND s.class_id = ?';
        params.push(classId);
    }

    if (search) {
        query += ' AND (s.lastName LIKE ? OR s.firstName LIKE ? OR s.matricule LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY s.lastName ASC';

    if (limit) {
        query += ' LIMIT ?';
        params.push(parseInt(limit));
    }

    if (offset) {
        query += ' OFFSET ?';
        params.push(parseInt(offset));
    }

    db.all(query, params, (err, students) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }

        // Compter le total
        db.get('SELECT COUNT(*) as total FROM students', [], (err, count) => {
            res.json({
                success: true,
                data: {
                    students,
                    total: count ? count.total : 0
                }
            });
        });
    });
});

// @route   GET /api/students/:id
// @desc    Récupérer un élève par ID
// @access  Privé
router.get('/:id', verifyToken, (req, res) => {
    db.get(`
        SELECT s.*, c.name as class_name 
        FROM students s 
        LEFT JOIN classes c ON s.class_id = c.id 
        WHERE s.id = ?
    `, [req.params.id], (err, student) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }

        if (!student) {
            return res.status(404).json({ error: 'Élève non trouvé' });
        }

        res.json({
            success: true,
            data: { student }
        });
    });
});

// @route   GET /api/students/matricule/:matricule
// @desc    Récupérer un élève par matricule
// @access  Privé
router.get('/matricule/:matricule', verifyToken, (req, res) => {
    db.get(`
        SELECT s.*, c.name as class_name 
        FROM students s 
        LEFT JOIN classes c ON s.class_id = c.id 
        WHERE s.matricule = ?
    `, [req.params.matricule], (err, student) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }

        if (!student) {
            return res.status(404).json({ error: 'Élève non trouvé' });
        }

        res.json({
            success: true,
            data: { student }
        });
    });
});

// @route   POST /api/students
// @desc    Créer un nouvel élève
// @access  Privé (Secrétaire, Directeur)
router.post('/', verifyToken, checkRole('secretaire', 'directeur'), (req, res) => {
    const student = req.body;

    // Validation des champs requis
    const requiredFields = ['matricule', 'lastName', 'firstName', 'gender', 'parentPhone'];
    for (const field of requiredFields) {
        if (!student[field]) {
            return res.status(400).json({
                error: 'Données invalides',
                message: `Champ requis: ${field}`
            });
        }
    }

    // Vérifier si le matricule existe déjà
    db.get('SELECT id FROM students WHERE matricule = ?', [student.matricule], (err, existing) => {
        if (existing) {
            return res.status(400).json({
                error: 'Matricule existe déjà',
                message: 'Ce matricule est déjà utilisé'
            });
        }

        // Insérer l'élève
        const query = `
            INSERT INTO students (
                matricule, class_id, gender, lastName, firstName, birthDate, birthPlace,
                nationality, religion, photo, fatherName, fatherJob, fatherPhone, fatherEmail,
                motherName, motherJob, motherPhone, motherEmail, parentPhone, phone2,
                email, address, city, district, bloodType, medicalInfo, siblingCount, enrollmentType
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            student.matricule,
            student.class_id || null,
            student.gender,
            student.lastName,
            student.firstName,
            student.birthDate || null,
            student.birthPlace || null,
            student.nationality || 'Ivoirienne',
            student.religion || null,
            student.photo || null,
            student.fatherName || null,
            student.fatherJob || null,
            student.fatherPhone || null,
            student.fatherEmail || null,
            student.motherName || null,
            student.motherJob || null,
            student.motherPhone || null,
            student.motherEmail || null,
            student.parentPhone,
            student.phone2 || null,
            student.email || null,
            student.address || null,
            student.city || 'Abidjan',
            student.district || null,
            student.bloodType || null,
            student.medicalInfo || null,
            student.siblingCount || 1,
            student.enrollmentType || 'Nouveau'
        ];

        db.run(query, params, function(err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Erreur serveur' });
            }

            res.status(201).json({
                success: true,
                message: 'Élève créé avec succès',
                data: {
                    id: this.lastID,
                    ...student
                }
            });
        });
    });
});

// @route   PUT /api/students/:id
// @desc    Mettre à jour un élève
// @access  Privé (Secrétaire, Directeur)
router.put('/:id', verifyToken, checkRole('secretaire', 'directeur'), (req, res) => {
    const studentId = req.params.id;
    const student = req.body;

    db.get('SELECT id FROM students WHERE id = ?', [studentId], (err, existing) => {
        if (err || !existing) {
            return res.status(404).json({ error: 'Élève non trouvé' });
        }

        const query = `
            UPDATE students SET
                class_id = ?, gender = ?, lastName = ?, firstName = ?, birthDate = ?,
                birthPlace = ?, nationality = ?, religion = ?, photo = ?, fatherName = ?,
                fatherJob = ?, fatherPhone = ?, fatherEmail = ?, motherName = ?,
                motherJob = ?, motherPhone = ?, motherEmail = ?, parentPhone = ?,
                phone2 = ?, email = ?, address = ?, city = ?, district = ?,
                bloodType = ?, medicalInfo = ?, siblingCount = ?, enrollmentType = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        const params = [
            student.class_id || null,
            student.gender,
            student.lastName,
            student.firstName,
            student.birthDate || null,
            student.birthPlace || null,
            student.nationality || 'Ivoirienne',
            student.religion || null,
            student.photo || null,
            student.fatherName || null,
            student.fatherJob || null,
            student.fatherPhone || null,
            student.fatherEmail || null,
            student.motherName || null,
            student.motherJob || null,
            student.motherPhone || null,
            student.motherEmail || null,
            student.parentPhone,
            student.phone2 || null,
            student.email || null,
            student.address || null,
            student.city || 'Abidjan',
            student.district || null,
            student.bloodType || null,
            student.medicalInfo || null,
            student.siblingCount || 1,
            student.enrollmentType || 'Nouveau',
            studentId
        ];

        db.run(query, params, (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Erreur serveur' });
            }

            res.json({
                success: true,
                message: 'Élève mis à jour avec succès'
            });
        });
    });
});

// @route   DELETE /api/students/:id
// @desc    Supprimer un élève
// @access  Privé (Directeur seulement)
router.delete('/:id', verifyToken, checkRole('directeur'), (req, res) => {
    const studentId = req.params.id;

    db.run('DELETE FROM students WHERE id = ?', [studentId], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Élève non trouvé' });
        }

        res.json({
            success: true,
            message: 'Élève supprimé avec succès'
        });
    });
});

// @route   GET /api/students/stats/general
// @desc    Statistiques générales des élèves
// @access  Privé
router.get('/stats/general', verifyToken, (req, res) => {
    const stats = {};

    // Total élèves
    db.get('SELECT COUNT(*) as total FROM students', [], (err, result) => {
        stats.total = result ? result.total : 0;

        // Par genre
        db.get('SELECT gender, COUNT(*) as count FROM students GROUP BY gender', [], (err, genders) => {
            stats.byGender = {};
            if (genders) {
                stats.byGender[genders.gender] = genders.count;
            }

            res.json({
                success: true,
                data: { stats }
            });
        });
    });
});

module.exports = router;
