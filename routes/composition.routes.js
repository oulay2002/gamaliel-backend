/**
 * ROUTES COMPOSITIONS & NOTES
 * Gestion des évaluations et saisie des notes
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, getConnection } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateToken);

// ========================================
// GET /api/compositions - Liste des compositions
// ========================================
router.get('/', async (req, res) => {
  try {
    const { class_id, subject_id, academic_year } = req.query;

    let sql = `
      SELECT
        c.*,
        cl.name as class_name,
        s.name as subject_name,
        u.full_name as created_by_name
      FROM compositions c
      JOIN classes cl ON c.class_id = cl.id
      LEFT JOIN subjects s ON c.subject_id = s.id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE 1=1
    `;

    const params = [];

    if (class_id) {
      sql += ' AND c.class_id = ?';
      params.push(class_id);
    }

    if (subject_id) {
      sql += ' AND c.subject_id = ?';
      params.push(subject_id);
    }

    if (academic_year) {
      sql += ' AND c.academic_year = ?';
      params.push(academic_year);
    }

    sql += ' ORDER BY c.date DESC';

    const compositions = await query(sql, params);

    res.json({
      success: true,
      data: { compositions }
    });

  } catch (error) {
    console.error('Erreur get compositions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des compositions'
    });
  }
});

// ========================================
// POST /api/compositions - Créer une composition
// ========================================
router.post('/', authorizeRoles('directeur', 'enseignant'), [
  body('class_id').isInt().withMessage('Classe invalide'),
  body('subject_id').isInt().withMessage('Matière invalide'),
  body('composition_number').isInt({ min: 1 }).withMessage('Numéro invalide'),
  body('date').isDate().withMessage('Date invalide')
], async (req, res) => {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      class_id, subject_id, composition_number, composition_name,
      date, coefficient, max_grade, academic_year
    } = req.body;

    // Insérer la composition
    const result = await connection.query(`
      INSERT INTO compositions (
        class_id, subject_id, composition_number, composition_name,
        date, coefficient, max_grade, academic_year, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      class_id, subject_id, composition_number, composition_name,
      date, coefficient || 1, max_grade || 20, academic_year, req.user.id
    ]);

    const compositionId = result[0].insertId;

    // Récupérer tous les élèves de la classe
    const students = await connection.query(
      'SELECT id FROM students WHERE class_id = ? AND is_active = TRUE',
      [class_id]
    );

    // Créer des entrées de notes vides pour chaque élève
    if (students.length > 0) {
      const gradeValues = students.map(student =>
        `(${compositionId}, ${student.id}, NULL, TRUE, NULL, ${req.user.id})`
      ).join(',');

      await connection.query(`
        INSERT INTO grades (composition_id, student_id, grade, is_present, appreciation, graded_by)
        VALUES ${gradeValues}
      `);
    }

    await connection.commit();

    // Journaliser l'action
    await query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)',
      [req.user.id, 'CREATE_COMPOSITION', 'composition', compositionId]
    );

    res.status(201).json({
      success: true,
      message: 'Composition créée avec succès',
      data: { id: compositionId }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Erreur create composition:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la création de la composition'
    });
  } finally {
    connection.release();
  }
});

// ========================================
// GET /api/compositions/:id/grades - Récupérer les notes d'une composition
// ========================================
router.get('/:id/grades', authorizeRoles('directeur', 'enseignant'), async (req, res) => {
  try {
    const compositionId = req.params.id;

    // Vérifier l'accès à la composition
    const accessCheck = await query(`
      SELECT comp.id FROM compositions comp
      WHERE comp.id = ?
    `, [compositionId]);

    if (accessCheck.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Composition non trouvée'
      });
    }

    // Récupérer les notes
    const grades = await query(`
      SELECT
        g.id,
        g.composition_id,
        g.student_id,
        g.grade,
        g.is_present,
        g.appreciation,
        g.rank,
        g.graded_at,
        s.first_name,
        s.last_name,
        s.matricule
      FROM grades g
      JOIN students s ON g.student_id = s.id
      WHERE g.composition_id = ?
      ORDER BY g.grade DESC
    `, [compositionId]);

    res.json({
      success: true,
      data: { grades }
    });

  } catch (error) {
    console.error('Erreur get grades:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des notes'
    });
  }
});

// ========================================
// POST /api/compositions/:id/grades - Enregistrer les notes
// ========================================
router.post('/:id/grades', authorizeRoles('directeur', 'enseignant'), async (req, res) => {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    const { grades } = req.body; // Tableau de {student_id, grade, is_present, appreciation}

    if (!grades || !Array.isArray(grades)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: 'Données de notes invalides'
      });
    }

    // Mettre à jour chaque note
    for (const gradeData of grades) {
      await connection.query(`
        UPDATE grades SET
          grade = ?,
          is_present = ?,
          appreciation = ?,
          graded_by = ?
        WHERE composition_id = ? AND student_id = ?
      `, [
        gradeData.grade,
        gradeData.is_present !== false,
        gradeData.appreciation,
        req.user.id,
        req.params.id,
        gradeData.student_id
      ]);
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Notes enregistrées avec succès'
    });

  } catch (error) {
    await connection.rollback();
    console.error('Erreur save grades:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'enregistrement des notes'
    });
  } finally {
    connection.release();
  }
});

// ========================================
// DELETE /api/compositions/:id - Supprimer une composition
// ========================================
router.delete('/:id', authorizeRoles('directeur'), async (req, res) => {
  try {
    // Vérifier si la composition existe
    const existing = await query('SELECT id FROM compositions WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Composition non trouvée'
      });
    }

    // Supprimer (les notes seront supprimées en cascade)
    await query('DELETE FROM compositions WHERE id = ?', [req.params.id]);

    // Journaliser l'action
    await query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)',
      [req.user.id, 'DELETE_COMPOSITION', 'composition', req.params.id]
    );

    res.json({
      success: true,
      message: 'Composition supprimée avec succès'
    });

  } catch (error) {
    console.error('Erreur delete composition:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression de la composition'
    });
  }
});

module.exports = router;
