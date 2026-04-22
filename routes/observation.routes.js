/**
 * OBSERVATIONS - Teacher to Parent Communication
 * Teachers send observations about students, parents receive them.
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

function authorizeTeacher(...roles) {
  const allRoles = [...roles, 'teacher'];
  return authorizeRoles(...allRoles);
}

// ========================================
// POST /api/teachers-mobile/observations
// Teacher sends an observation about a student
// ========================================
router.post('/observations', authorizeTeacher('enseignant', 'directeur'), [
  body('student_id').isInt().withMessage('ID élève invalide'),
  body('message').notEmpty().withMessage('Message requis'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { student_id, message, observation_type = 'general', subject = '' } = req.body;
    const teacherId = req.user.id;

    // Get teacher name
    const teacher = await query('SELECT username, full_name FROM users WHERE id = ?', [teacherId]);
    const teacherName = teacher[0]?.full_name || teacher[0]?.username || 'Enseignant';

    const result = await query(`
      INSERT INTO observations
      (student_id, teacher_id, teacher_name, message, observation_type, subject, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [student_id, teacherId, teacherName, message, observation_type, subject]);

    res.status(201).json({
      success: true,
      message: 'Observation envoyée',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Erreur create observation:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'envoi de l\'observation' });
  }
});

// ========================================
// GET /api/teachers-mobile/observations
// List observations sent by teacher
// ========================================
router.get('/observations', authorizeTeacher('enseignant', 'directeur'), async (req, res) => {
  try {
    const { student_id, limit = 50, offset = 0 } = req.query;
    let sql = 'SELECT * FROM observations WHERE teacher_id = ?';
    const params = [req.user.id];

    if (student_id) {
      sql += ' AND student_id = ?';
      params.push(student_id);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const observations = await query(sql, params);
    res.json({ success: true, data: { observations }, count: observations.length });
  } catch (error) {
    console.error('Erreur get observations:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération' });
  }
});

// ========================================
// GET /api/parents-mobile/child/:childId/observations
// Parent receives observations about their child
// ========================================
router.get('/child/:childId/observations', async (req, res) => {
  try {
    const childId = req.params.childId;
    const userId = req.user.id;

    // Verify parent owns this child
    const child = await query(
      'SELECT s.*, c.name as class_name FROM students s LEFT JOIN classes c ON s.class_id = c.id WHERE s.id = ? AND s.parent_user_id = ?',
      [childId, userId]
    );

    if (!child || child.length === 0) {
      return res.status(404).json({ success: false, error: 'Enfant non trouvé' });
    }

    const observations = await query(`
      SELECT o.id, o.message, o.observation_type, o.subject, o.teacher_name, o.created_at
      FROM observations o
      WHERE o.student_id = ?
      ORDER BY o.created_at DESC
    `, [childId]);

    res.json({
      success: true,
      data: { child: child[0], observations },
      count: observations.length
    });
  } catch (error) {
    console.error('Erreur get parent observations:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération' });
  }
});

module.exports = router;
