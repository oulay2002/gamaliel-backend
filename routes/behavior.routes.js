/**
 * BEHAVIOR / CONDUITE ROUTES
 * Endpoints pour enregistrer et consulter les rapports de comportement
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Alias "teacher" pour "enseignant"
function authorizeTeacher(...roles) {
  const allRoles = [...roles, 'teacher'];
  return authorizeRoles(...allRoles);
}

// ========================================
// POST /api/teachers-mobile/behaviors
// Enregistrer un rapport de comportement
// ========================================
router.post('/behaviors', authorizeTeacher('enseignant', 'directeur'), [
  body('student_id').isInt().withMessage('ID élève invalide'),
  body('class_id').isInt().withMessage('ID classe invalide'),
  body('behavior_type').notEmpty().withMessage('Type de comportement requis'),
  body('description').optional().isString(),
  body('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('recorded_date').isDate().withMessage('Date invalide')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { student_id, class_id, behavior_type, description, severity = 'medium', recorded_date } = req.body;
    const teacherId = req.user.id;

    // Vérifier que l'enseignant a accès à cette classe
    const accessCheck = await query(`
      SELECT id FROM classes
      WHERE id = ? AND (teacher_id = ? OR teacher_id = ?)
    `, [class_id, teacherId, req.user.username]);

    if (accessCheck.length === 0) {
      return res.status(403).json({
        success: false,
        error: "Accès non autorisé à cette classe"
      });
    }

    // Vérifier que l'élève appartient à cette classe
    const studentCheck = await query(`
      SELECT id FROM students WHERE id = ? AND class_id = ?
    `, [student_id, class_id]);

    if (studentCheck.length === 0) {
      return res.status(400).json({
        success: false,
        error: "L'élève n'appartient pas à cette classe"
      });
    }

    // Insérer le rapport de comportement
    const result = await query(`
      INSERT INTO student_behaviors
      (student_id, teacher_id, class_id, behavior_type, description, severity, recorded_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [student_id, teacherId, class_id, behavior_type, description || null, severity, recorded_date]);

    res.status(201).json({
      success: true,
      message: "Rapport de comportement enregistré",
      data: { id: result.insertId }
    });

  } catch (error) {
    console.error('Erreur create behavior:', error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de l'enregistrement du comportement"
    });
  }
});

// ========================================
// GET /api/teachers-mobile/behaviors
// Lister les rapports de comportement
// ========================================
router.get('/behaviors', authorizeTeacher('enseignant', 'directeur'), async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { class_id, student_id, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT sb.*, 
             s.last_name, s.first_name, s.matricule,
             c.name as class_name,
             u.username as teacher_username
      FROM student_behaviors sb
      JOIN students s ON sb.student_id = s.id
      JOIN classes c ON sb.class_id = c.id
      LEFT JOIN users u ON sb.teacher_id = u.id
      WHERE c.teacher_id = ?
    `;
    const params = [teacherId];

    if (class_id) { sql += ' AND sb.class_id = ?'; params.push(class_id); }
    if (student_id) { sql += ' AND sb.student_id = ?'; params.push(student_id); }

    sql += ' ORDER BY sb.recorded_date DESC, sb.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const behaviors = await query(sql, params);

    res.json({
      success: true,
      data: { behaviors },
      count: behaviors.length
    });

  } catch (error) {
    console.error('Erreur get behaviors:', error);
    res.status(500).json({ success: false, error: "Erreur lors de la récupération des rapports" });
  }
});

// ========================================
// GET /api/parents-mobile/child/:childId/behaviors
// Vue parent : comportement de son enfant
// ========================================
router.get('/child/:childId/behaviors', async (req, res) => {
  try {
    const { childId } = req.params;
    const parentId = req.user.id;

    // Vérifier que le parent possède cet enfant
    const parentCheck = await query(`
      SELECT id FROM students WHERE id = ? AND parent_user_id = ?
    `, [childId, parentId]);

    if (parentCheck.length === 0) {
      return res.status(403).json({ success: false, error: "Accès non autorisé" });
    }

    const behaviors = await query(`
      SELECT sb.*, 
             c.name as class_name,
             u.username as teacher_username,
             sb.behavior_type as type,
             sb.description,
             sb.severity,
             sb.recorded_date as date
      FROM student_behaviors sb
      JOIN classes c ON sb.class_id = c.id
      LEFT JOIN users u ON sb.teacher_id = u.id
      WHERE sb.student_id = ?
      ORDER BY sb.recorded_date DESC
    `, [childId]);

    res.json({ success: true, data: { behaviors }, count: behaviors.length });

  } catch (error) {
    console.error('Erreur get child behaviors:', error);
    res.status(500).json({ success: false, error: "Erreur lors de la récupération des rapports" });
  }
});

module.exports = router;
