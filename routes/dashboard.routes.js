/**
 * ROUTES DASHBOARD
 * Statistiques et tableaux de bord
 */

const express = require('express');
const { query } =  require('../config/database');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateToken);

// ========================================
// GET /api/dashboard/stats - Statistiques générales
// ========================================
router.get('/stats', async (req, res) => {
  try {
    // Nombre d'élèves
    const studentsCount = await query(
      'SELECT COUNT(*) as total FROM students WHERE is_active = TRUE'
    );
    
    // Nombre d'élèves par classe
    const studentsByClass = await query(`
      SELECT c.name, COUNT(s.id) as count
      FROM classes c
      LEFT JOIN students s ON c.id = s.class_id AND s.is_active = TRUE
      GROUP BY c.id, c.name
      ORDER BY c.name
    `);
    
    // Total paiements (mois en cours)
    const currentMonthPayments = await query(`
      SELECT SUM(amount) as total, COUNT(*) as count
      FROM payments
      WHERE MONTH(payment_date) = MONTH(CURRENT_DATE())
      AND YEAR(payment_date) = YEAR(CURRENT_DATE())
    `);
    
    // Paiements par type (mois en cours)
    const paymentsByType = await query(`
      SELECT type, SUM(amount) as total, COUNT(*) as count
      FROM payments
      WHERE MONTH(payment_date) = MONTH(CURRENT_DATE())
      AND YEAR(payment_date) = YEAR(CURRENT_DATE())
      GROUP BY type
    `);
    
    // Présences aujourd'hui
    const todayAttendance = await query(`
      SELECT status, COUNT(*) as count
      FROM student_attendance
      WHERE date = CURRENT_DATE()
      GROUP BY status
    `);
    
    // Nombre d'enseignants
    const teachersCount = await query(
      'SELECT COUNT(*) as total FROM teachers WHERE is_active = TRUE'
    );
    
    // Nombre de classes
    const classesCount = await query(
      'SELECT COUNT(*) as total FROM classes'
    );
    
    res.json({
      success: true,
      data: {
        students: {
          total: studentsCount[0].total,
          by_class: studentsByClass
        },
        teachers: {
          total: teachersCount[0].total
        },
        classes: {
          total: classesCount[0].total
        },
        payments: {
          current_month: currentMonthPayments[0],
          by_type: paymentsByType
        },
        attendance: {
          today: todayAttendance
        }
      }
    });
    
  } catch (error) {
    console.error('Erreur get dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    });
  }
});

// ========================================
// GET /api/dashboard/chart/students - Graphique évolution élèves
// ========================================
router.get('/chart/students', async (req, res) => {
  try {
    const evolution = await query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count
      FROM students
      WHERE is_active = TRUE
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `);
    
    res.json({
      success: true,
      data: { evolution }
    });
    
  } catch (error) {
    console.error('Erreur get students chart:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du graphique'
    });
  }
});

// ========================================
// GET /api/dashboard/chart/payments - Graphique paiements
// ========================================
router.get('/chart/payments', async (req, res) => {
  try {
    const evolution = await query(`
      SELECT 
        DATE_FORMAT(payment_date, '%Y-%m') as month,
        SUM(amount) as total,
        COUNT(*) as count
      FROM payments
      WHERE payment_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
      ORDER BY month DESC
    `);
    
    res.json({
      success: true,
      data: { evolution }
    });
    
  } catch (error) {
    console.error('Erreur get payments chart:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du graphique'
    });
  }
});

module.exports = router;
