/**
 * ROUTES ÉLÈVES
 * CRUD complet pour la gestion des élèves
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

// ========================================
// POST /api/students - Créer un élève (AUTHENTIFIÉ)
// ========================================
router.post('/', authenticateToken, authorizeRoles('directeur', 'secretaire'), [
  body('matricule').notEmpty().withMessage('Matricule requis'),
  body('last_name').notEmpty().withMessage('Nom requis'),
  body('first_name').notEmpty().withMessage('Prénoms requis'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      matricule, last_name, first_name, gender, birth_date, birth_place,
      nationality, class_id, father_name, father_phone, father_job, father_email,
      mother_name, mother_phone, mother_job, mother_email, guardian_name,
      guardian_phone, guardian_relationship, address, city, enrollment_year,
      // Support de l'ancien format (camelCase)
      lastName, firstName, gender: genderOld, birthDate, birthPlace, className,
      fatherName, fatherPhone, fatherEmail, motherName, motherPhone, motherEmail
    } = req.body;

    // Support des deux formats de données
    const finalMatricule = matricule || req.body.matricule;
    const finalLastName = last_name || lastName;
    const finalFirstName = first_name || firstName;
    const finalGender = gender || genderOld || 'M';
    const finalBirthDate = birth_date || birthDate || '2015-01-01';
    const finalBirthPlace = birth_place || birthPlace || '';
    const finalFatherName = father_name || fatherName || '';
    const finalFatherPhone = father_phone || fatherPhone || '';
    const finalFatherEmail = father_email || fatherEmail || '';
    const finalMotherName = mother_name || motherName || '';
    const finalMotherPhone = mother_phone || motherPhone || '';
    const finalMotherEmail = mother_email || motherEmail || '';

    if (!finalMatricule || !finalLastName || !finalFirstName) {
      return res.status(400).json({ success: false, error: 'Matricule, nom et prénom requis' });
    }

    // Vérifier si l'élève existe déjà
    const existing = await query('SELECT id FROM students WHERE matricule = ?', [finalMatricule]);
    if (existing && existing.length > 0) {
      return res.json({ success: true, message: 'Élève existe déjà', data: { id: existing[0].id } });
    }

    // Trouver la classe par nom ou ID
    let classId = class_id;
    if (!classId && className) {
      const classes = await query('SELECT id FROM classes WHERE name = ?', [className]);
      if (classes && classes.length > 0) {
        classId = classes[0].id;
      }
    }

    const genderMapped = finalGender === 'Garçon' || finalGender === 'Garcon' ? 'M' :
      (finalGender === 'Fille' ? 'F' : 'M');

    const result = await query(`
      INSERT INTO students
      (matricule, last_name, first_name, gender, birth_date, birth_place,
       class_id, father_name, father_phone, father_email,
       mother_name, mother_phone, mother_email,
       is_active, enrollment_year, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `, [
      finalMatricule, finalLastName, finalFirstName, genderMapped,
      finalBirthDate, finalBirthPlace,
      classId,
      finalFatherName, finalFatherPhone, finalFatherEmail,
      finalMotherName, finalMotherPhone, finalMotherEmail,
      enrollment_year || new Date().getFullYear() + '-2026',
      req.user.id
    ]);

    console.log(`✅ Élève créé: ${finalMatricule} -> ID ${result.insertId} par utilisateur ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Élève créé avec succès',
      data: { id: result.insertId, matricule: finalMatricule }
    });

  } catch (error) {
    console.error('Erreur création élève:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// ROUTE PUBLIQUE : Recherche élève par matricule
// ========================================
router.get('/search', async (req, res) => {
  try {
    if (!req.query.matricule) {
      return res.status(400).json({ success: false, error: 'Matricule requis' });
    }

    const students = await query(`
      SELECT s.id, s.matricule, s.last_name, s.first_name, s.class_id, c.name as class_name,
             s.father_name, s.father_phone, s.father_email,
             s.mother_name, s.mother_phone, s.mother_email
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE s.matricule = ? AND s.is_active = TRUE
    `, [req.query.matricule]);

    res.json({
      success: true,
      data: { students, count: students.length }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// GET /api/students/matricule/:matricule - PUBLIC (pour inscription parent mobile)
// ========================================
router.get('/matricule/:matricule', async (req, res) => {
  try {
    const searchMatricule = req.params.matricule.trim();
    const students = await query(
      `SELECT s.*, c.name as class_name, c.level as class_level
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE TRIM(s.matricule) = ?`,
      [searchMatricule]
    );

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Élève non trouvé avec le matricule: ' + req.params.matricule
      });
    }

    const student = students[0];
    const responseData = {
      id: student.id,
      matricule: student.matricule,
      lastName: student.last_name,
      firstName: student.first_name,
      gender: student.gender,
      dateOfBirth: student.birth_date,
      placeOfBirth: student.birth_place || '',
      nationality: student.nationality || '',
      photo: student.photo || null,
      classId: student.class_id || '',
      className: student.class_name || null,
      enrollmentYear: student.enrollment_year || '',
      isActive: student.is_active === 1,
      familyInfo: {
        fatherName: student.father_name || null,
        fatherPhone: student.father_phone || null,
        motherName: student.mother_name || null,
        motherPhone: student.mother_phone || null,
      },
      createdAt: student.created_at,
      updatedAt: student.updated_at
    };

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Erreur get student by matricule:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'élève par matricule'
    });
  }
});

// Middleware : Tous les utilisateurs authentifiés peuvent lire
router.use(authenticateToken);

// ========================================
// GET /api/students - Liste des élèves
// ========================================
router.get('/', async (req, res) => {
  try {
    // Si matricule est fourni, chercher un seul élève
    if (req.query.matricule) {
      const students = await query(`
        SELECT s.*, c.name as class_name, c.level as class_level
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        WHERE s.matricule = ? AND s.is_active = TRUE
      `, [req.query.matricule]);

      return res.json({
        success: true,
        data: { students, count: students.length }
      });
    }

    // 1. Récupération et conversion des paramètres en nombres entiers
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const sql = `
            SELECT s.*, c.name as class_name, c.level as class_level
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.is_active = TRUE
            ORDER BY s.last_name, s.first_name
            LIMIT ? OFFSET ?`;

    // 2. Utilisation de la fonction 'query' importée (et non db.query)
    const rows = await query(sql, [limit, offset]);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Erreur SQL:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des élèves"
    });
  }
});

// ========================================
// GET /api/students/matricule/:matricule - Rechercher par matricule
// ========================================
router.get('/matricule/:matricule', async (req, res) => {
  try {
    const searchMatricule = req.params.matricule.trim();
    const students = await query(
      `SELECT s.*, c.name as class_name, c.level as class_level
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE TRIM(s.matricule) = ?`,
      [searchMatricule]
    );

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Élève non trouvé avec le matricule: ' + req.params.matricule
      });
    }

    const student = students[0];

    // Construire la réponse avec familyInfo
    const responseData = {
      id: student.id,
      matricule: student.matricule,
      lastName: student.last_name,
      firstName: student.first_name,
      gender: student.gender,
      dateOfBirth: student.birth_date,
      placeOfBirth: student.birth_place || '',
      nationality: student.nationality || '',
      photo: student.photo || null,
      classId: student.class_id || '',
      className: student.class_name || null,
      enrollmentYear: student.enrollment_year || '',
      isActive: student.is_active === 1,
      familyInfo: {
        fatherName: student.father_name || null,
        fatherPhone: student.father_phone || null,
        motherName: student.mother_name || null,
        motherPhone: student.mother_phone || null,
      },
      createdAt: student.created_at,
      updatedAt: student.updated_at
    };

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Erreur get student by matricule:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'élève par matricule'
    });
  }
});

// ========================================
// GET /api/students/:id - Détails d'un élève
// ========================================
router.get('/:id', async (req, res) => {
  try {
    const student = await query(
      `SELECT s.*, c.name as class_name, c.level as class_level
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE s.id = ?`,
      [req.params.id]
    );

    if (student.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Élève non trouvé'
      });
    }

    res.json({
      success: true,
      data: { student: student[0] }
    });

  } catch (error) {
    console.error('Erreur get student:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'élève'
    });
  }
});

// ========================================
// PUT /api/students/:id - Modifier un élève
// ========================================
router.put('/:id', authorizeRoles('directeur', 'secretaire'), async (req, res) => {
  try {
    const {
      last_name, first_name, gender, birth_date, birth_place,
      nationality, class_id, father_name, father_phone, father_job, father_email,
      mother_name, mother_phone, mother_job, mother_email, guardian_name,
      guardian_phone, guardian_relationship, address, city
    } = req.body;

    // Vérifier si l'élève existe
    const existing = await query('SELECT id FROM students WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Élève non trouvé'
      });
    }

    // Mettre à jour
    await query(`
      UPDATE students SET
        last_name = ?, first_name = ?, gender = ?, birth_date = ?, birth_place = ?,
        nationality = ?, class_id = ?, father_name = ?, father_phone = ?, father_job = ?, father_email = ?,
        mother_name = ?, mother_phone = ?, mother_job = ?, mother_email = ?, guardian_name = ?,
        guardian_phone = ?, guardian_relationship = ?, address = ?, city = ?
      WHERE id = ?
    `, [
      last_name, first_name, gender, birth_date, birth_place,
      nationality, class_id, father_name, father_phone, father_job, father_email,
      mother_name, mother_phone, mother_job, mother_email, guardian_name,
      guardian_phone, guardian_relationship, address, city, req.params.id
    ]);

    // Journaliser l'action
    await query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)',
      [req.user.id, 'UPDATE_STUDENT', 'student', req.params.id]
    );

    res.json({
      success: true,
      message: 'Élève modifié avec succès'
    });

  } catch (error) {
    console.error('Erreur update student:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la modification de l\'élève'
    });
  }
});

// ========================================
// DELETE /api/students/:id - Supprimer un élève
// ========================================
router.delete('/:id', authorizeRoles('directeur'), async (req, res) => {
  try {
    // Vérifier si l'élève existe
    const existing = await query('SELECT id FROM students WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Élève non trouvé'
      });
    }

    // Désactiver plutôt que supprimer (soft delete)
    await query('UPDATE students SET is_active = FALSE WHERE id = ?', [req.params.id]);

    // Journaliser l'action
    await query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)',
      [req.user.id, 'DELETE_STUDENT', 'student', req.params.id]
    );

    res.json({
      success: true,
      message: 'Élève supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur delete student:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression de l\'élève'
    });
  }
});

// ========================================
// GET /api/students/:id/payments - Historique des paiements
// ========================================
router.get('/:id/payments', async (req, res) => {
  try {
    const payments = await query(
      `SELECT p.*, u.full_name as recorded_by_name
       FROM payments p
       LEFT JOIN users u ON p.recorded_by = u.id
       WHERE p.student_id = ?
       ORDER BY p.payment_date DESC`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: { payments }
    });

  } catch (error) {
    console.error('Erreur get student payments:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des paiements'
    });
  }
});

// ========================================
// GET /api/students/:id/attendance - Historique des présences
// ========================================
router.get('/:id/attendance', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let sql = `
      SELECT sa.*, u.full_name as recorded_by_name
      FROM student_attendance sa
      LEFT JOIN users u ON sa.recorded_by = u.id
      WHERE sa.student_id = ?
    `;

    const params = [req.params.id];

    if (start_date) {
      sql += ' AND sa.date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      sql += ' AND sa.date <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY sa.date DESC';

    const attendance = await query(sql, params);

    res.json({
      success: true,
      data: { attendance }
    });

  } catch (error) {
    console.error('Erreur get student attendance:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des présences'
    });
  }
});

// ========================================
// GET /api/students/:id/grades - Notes de l'élève
// ========================================
router.get('/:id/grades', async (req, res) => {
  try {
    const grades = await query(`
      SELECT g.*, c.composition_name, c.composition_number, c.date as composition_date,
             s.name as subject_name, u.full_name as graded_by_name
      FROM grades g
      JOIN compositions c ON g.composition_id = c.id
      JOIN subjects s ON c.subject_id = s.id
      LEFT JOIN users u ON g.graded_by = u.id
      WHERE g.student_id = ?
      ORDER BY c.date DESC, s.name
    `, [req.params.id]);

    res.json({
      success: true,
      data: { grades }
    });

  } catch (error) {
    console.error('Erreur get student grades:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des notes'
    });
  }
});

module.exports = router;
