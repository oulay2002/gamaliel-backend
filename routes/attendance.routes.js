/**
 * ROUTES PRÉSENCES
 * Gestion des présences élèves et enseignants
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } =  require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateToken);

// ========================================
// GET /api/attendance/students - Présences élèves
// ========================================
router.get('/students', async (req, res) => {
  try {
    const { student_id, class_id, start_date, end_date, status } = req.query;
    
    let sql = `
      SELECT 
        sa.*,
        s.matricule,
        s.last_name as student_last_name,
        s.first_name as student_first_name,
        c.name as class_name,
        u.full_name as recorded_by_name
      FROM student_attendance sa
      JOIN students s ON sa.student_id = s.id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN users u ON sa.recorded_by = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (student_id) {
      sql += ' AND sa.student_id = ?';
      params.push(student_id);
    }
    
    if (class_id) {
      sql += ' AND s.class_id = ?';
      params.push(class_id);
    }
    
    if (start_date) {
      sql += ' AND sa.date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND sa.date <= ?';
      params.push(end_date);
    }
    
    if (status) {
      sql += ' AND sa.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY sa.date DESC, s.last_name';
    
    const attendance = await query(sql, params);
    
    res.json({
      success: true,
      data: { attendance }
    });
    
  } catch (error) {
    console.error('Erreur get student attendance:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des présences élèves'
    });
  }
});

// ========================================
// POST /api/attendance/students - Marquer présence élève
// ========================================
router.post('/students', authorizeRoles('directeur', 'secretaire', 'enseignant'), [
  body('student_id').isInt().withMessage('ID élève invalide'),
  body('date').isDate().withMessage('Date invalide'),
  body('status').isIn(['present', 'absent', 'late', 'excused']).withMessage('Statut invalide')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { student_id, date, status, time_in, time_out, justification } = req.body;
    
    // Vérifier si une entrée existe déjà pour cette date
    const existing = await query(
      'SELECT id FROM student_attendance WHERE student_id = ? AND date = ?',
      [student_id, date]
    );
    
    if (existing.length > 0) {
      // Mettre à jour
      await query(`
        UPDATE student_attendance SET
          status = ?, time_in = ?, time_out = ?, justification = ?, recorded_by = ?
        WHERE student_id = ? AND date = ?
      `, [status, time_in, time_out, justification, req.user.id, student_id, date]);
      
      res.json({
        success: true,
        message: 'Présence mise à jour avec succès'
      });
    } else {
      // Créer
      const result = await query(`
        INSERT INTO student_attendance (student_id, date, status, time_in, time_out, justification, recorded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [student_id, date, status, time_in, time_out, justification, req.user.id]);
      
      res.status(201).json({
        success: true,
        message: 'Présence enregistrée avec succès',
        data: { id: result.insertId }
      });
    }
    
  } catch (error) {
    console.error('Erreur mark student attendance:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'enregistrement de la présence'
    });
  }
});

// ========================================
// GET /api/attendance/teachers - Présences enseignants
// ========================================
router.get('/teachers', async (req, res) => {
  try {
    const { teacher_id, start_date, end_date, status } = req.query;
    
    let sql = `
      SELECT 
        ta.*,
        t.code as teacher_code,
        t.last_name as teacher_last_name,
        t.first_name as teacher_first_name,
        u.full_name as recorded_by_name
      FROM teacher_attendance ta
      JOIN teachers t ON ta.teacher_id = t.id
      LEFT JOIN users u ON ta.recorded_by = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (teacher_id) {
      sql += ' AND ta.teacher_id = ?';
      params.push(teacher_id);
    }
    
    if (start_date) {
      sql += ' AND ta.date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND ta.date <= ?';
      params.push(end_date);
    }
    
    if (status) {
      sql += ' AND ta.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY ta.date DESC';
    
    const attendance = await query(sql, params);
    
    res.json({
      success: true,
      data: { attendance }
    });
    
  } catch (error) {
    console.error('Erreur get teacher attendance:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des présences enseignants'
    });
  }
});

// ========================================
// POST /api/attendance/teachers - Marquer présence enseignant
// ========================================
router.post('/teachers', authorizeRoles('directeur', 'secretaire'), [
  body('teacher_id').isInt().withMessage('ID enseignant invalide'),
  body('date').isDate().withMessage('Date invalide'),
  body('status').isIn(['present', 'absent', 'mission', 'conge', 'maladie']).withMessage('Statut invalide')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { teacher_id, date, status, time_in, time_out, reason, justification } = req.body;
    
    // Vérifier si une entrée existe déjà
    const existing = await query(
      'SELECT id FROM teacher_attendance WHERE teacher_id = ? AND date = ?',
      [teacher_id, date]
    );
    
    if (existing.length > 0) {
      await query(`
        UPDATE teacher_attendance SET
          status = ?, time_in = ?, time_out = ?, reason = ?, justification = ?, recorded_by = ?
        WHERE teacher_id = ? AND date = ?
      `, [status, time_in, time_out, reason, justification, req.user.id, teacher_id, date]);
      
      res.json({
        success: true,
        message: 'Présence mise à jour avec succès'
      });
    } else {
      const result = await query(`
        INSERT INTO teacher_attendance (teacher_id, date, status, time_in, time_out, reason, justification, recorded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [teacher_id, date, status, time_in, time_out, reason, justification, req.user.id]);
      
      res.status(201).json({
        success: true,
        message: 'Présence enregistrée avec succès',
        data: { id: result.insertId }
      });
    }
    
  } catch (error) {
    console.error('Erreur mark teacher attendance:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'enregistrement de la présence'
    });
  }
});

// ========================================
// GET /api/attendance/stats - Statistiques de présence
// ========================================
router.get('/stats/summary', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (start_date) {
      whereClause += ' AND date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      whereClause += ' AND date <= ?';
      params.push(end_date);
    }
    
    // Stats élèves
    const studentStats = await query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM student_attendance ${whereClause}
      GROUP BY status
    `, params);
    
    // Stats enseignants
    const teacherStats = await query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM teacher_attendance ${whereClause}
      GROUP BY status
    `, params);
    
    res.json({
      success: true,
      data: {
        students: studentStats,
        teachers: teacherStats
      }
    });
    
  } catch (error) {
    console.error('Erreur get attendance stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    });
  }
});

module.exports = router;
