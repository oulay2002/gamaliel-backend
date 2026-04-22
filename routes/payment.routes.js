/**
 * ROUTES PAIEMENTS
 * Gestion complète des paiements et reçus
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

// ========================================
// POST /api/payments/web-sync - Route publique pour sync web app
// ========================================
router.post('/web-sync', [
  body('student_matricule').notEmpty().withMessage('Matricule requis'),
  body('amount').isFloat({ min: 0 }).withMessage('Montant invalide'),
  body('type').isIn(['Scolarité', 'Cantine', 'Transport', 'Frais Annexes']).withMessage('Type invalide'),
  body('payment_date').isDate().withMessage('Date invalide')
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
      student_matricule, amount, type, payment_mode,
      payment_date, notes, receipt_number
    } = req.body;

    // Trouver l'élève par matricule
    const student = await query(
      'SELECT id, matricule, last_name, first_name FROM students WHERE matricule = ? AND is_active = TRUE',
      [student_matricule]
    );

    if (!student || student.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Élève non trouvé avec le matricule: ${student_matricule}`
      });
    }

    const studentId = student[0].id;
    const receiptNum = receipt_number || 'REC-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const result = await query(`
      INSERT INTO payments (
        student_id, amount, type, payment_mode, reference,
        payment_date, receipt_number, notes
      ) VALUES (?, ?, ?, ?, '', ?, ?, ?)
    `, [
      studentId, amount, type, payment_mode || 'Especes',
      payment_date, receiptNum, notes || ''
    ]);

    console.log(`💰 [Web Sync] Paiement créé: ${receiptNum} - ${amount} F pour ${student[0].last_name} ${student[0].first_name}`);

    res.status(201).json({
      success: true,
      message: 'Paiement enregistré avec succès',
      data: {
        id: result.insertId,
        receipt_number: receiptNum,
        student_name: `${student[0].last_name} ${student[0].first_name}`,
        amount: amount
      }
    });
  } catch (error) {
    console.error('❌ Erreur web-sync paiement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// POST /api/payments - Enregistrer un paiement (AUTHENTIFIÉ)
// ========================================
router.post('/', authenticateToken, authorizeRoles('directeur', 'comptable', 'secretaire'), [
  body('student_id').isInt().withMessage('ID élève invalide'),
  body('amount').isFloat({ min: 0 }).withMessage('Montant invalide'),
  body('type').isIn(['Scolarité', 'Cantine', 'Transport', 'Frais Annexes']).withMessage('Type invalide'),
  body('payment_date').isDate().withMessage('Date invalide')
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
      student_id, amount, type, payment_mode, reference,
      payment_date, notes, paid_by, paid_by_phone
    } = req.body;

    // Vérifier que l'étudiant existe
    const student = await query('SELECT id FROM students WHERE id = ? AND is_active = TRUE', [student_id]);
    if (!student || student.length === 0) {
      return res.status(404).json({ success: false, error: 'Élève non trouvé' });
    }

    // Générer un numéro de reçu unique
    const receiptNumber = 'REC-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const result = await query(`
      INSERT INTO payments (
        student_id, amount, type, payment_mode, reference,
        payment_date, receipt_number, notes, paid_by, paid_by_phone, recorded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      student_id, amount, type, payment_mode || 'Especes', reference || '',
      payment_date, receiptNumber, notes || '', paid_by || '', paid_by_phone || '',
      req.user.id
    ]);

    console.log(`💰 Paiement créé: ${receiptNumber} -> ID ${result.insertId} par utilisateur ${req.user.id}`);

    // Journaliser l'action
    await query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)',
      [req.user.id, 'CREATE_PAYMENT', 'payment', result.insertId]
    );

    // ========================================
    // ENREGISTRER DANS sync_changes POUR SYNC MOBILE
    // ========================================
    try {
      const studentInfo = await query(
        'SELECT matricule FROM students WHERE id = ?',
        [student_id]
      );
      await query(`
        INSERT INTO sync_changes
        (device_id, user_id, change_type, collection, action, entity_id, data, timestamp, synced)
        VALUES ('web_sync', ?, 'payment', 'payments', 'create', ?, ?, NOW(), 1)
      `, [
        req.user.id,
        result.insertId,
        JSON.stringify({
          payment_id: result.insertId,
          student_id,
          matricule: studentInfo?.[0]?.matricule,
          amount,
          type,
          receipt_number: receiptNumber,
          payment_date
        })
      ]);
    } catch (syncError) {
      console.warn('⚠️ Erreur sync_changes (ignorer):', syncError.message);
    }

    // ========================================
    // ENVOYER NOTIFICATION FIREBASE AUX PARENTS
    // ========================================
    try {
      const studentInfo = await query(`
        SELECT s.id, s.matricule, s.last_name, s.first_name, s.parent_user_id,
               u.id as parent_id, u.email as parent_email
        FROM students s
        LEFT JOIN users u ON s.parent_user_id = u.id
        WHERE s.id = ?
      `, [student_id]);

      if (studentInfo && studentInfo.length > 0) {
        const student = studentInfo[0];

        // Importer le service Firebase
        const { sendPaymentNotification } = require('../services/firebaseService');

        // Récupérer les tokens FCM du parent
        const deviceTokens = await query(
          'SELECT device_token FROM device_tokens WHERE user_id = ? AND is_active = TRUE',
          [student.parent_id]
        );

        if (deviceTokens && deviceTokens.length > 0) {
          for (const tokenRow of deviceTokens) {
            await sendPaymentNotification(tokenRow.device_token, {
              id: result.insertId,
              studentName: `${student.last_name} ${student.first_name}`,
              studentId: student.matricule,
              amount: amount,
              type: type,
              receiptNumber: receiptNumber
            });
          }
          console.log('🔔 Notification paiement envoyée aux parents de', student.last_name);
        }

        // Créer une notification dans la base
        await query(`
          INSERT INTO notifications (user_id, type, title, body, data, priority)
          VALUES (?, 'payment', ?, ?, ?, 'normal')
        `, [
          student.parent_id,
          '💰 Paiement enregistré',
          `Paiement de ${amount} FCFA (${type}) enregistré avec succès. Reçu: ${receiptNumber}`,
          JSON.stringify({
            paymentId: result.insertId,
            amount: amount,
            type: type,
            receiptNumber: receiptNumber,
            studentName: `${student.last_name} ${student.first_name}`
          })
        ]);
      }
    } catch (notifError) {
      console.error('⚠️ Erreur notification paiement:', notifError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Paiement enregistré avec succès',
      data: { id: result.insertId, receipt_number: receiptNumber }
    });

  } catch (error) {
    console.error('Erreur création paiement:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Routes protégées
router.use(authenticateToken);

// ========================================
// GET /api/payments - Liste des paiements
// ========================================
router.get('/', async (req, res) => {
  try {
    const { student_id, type, start_date, end_date, page = 1, limit = 50 } = req.query;

    let sql = `
      SELECT
        p.*,
        s.matricule,
        s.last_name as student_last_name,
        s.first_name as student_first_name,
        c.name as class_name,
        u.full_name as recorded_by_name
      FROM payments p
      JOIN students s ON p.student_id = s.id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN users u ON p.recorded_by = u.id
      WHERE 1=1
    `;

    const params = [];

    if (student_id) {
      sql += ' AND p.student_id = ?';
      params.push(student_id);
    }

    if (type) {
      sql += ' AND p.type = ?';
      params.push(type);
    }

    if (start_date) {
      sql += ' AND p.payment_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      sql += ' AND p.payment_date <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY p.payment_date DESC, p.created_at DESC LIMIT ? OFFSET ?';
    const offset = (page - 1) * limit;
    params.push(parseInt(limit), offset);

    const payments = await query(sql, params);

    res.json({
      success: true,
      data: { payments }
    });

  } catch (error) {
    console.error('Erreur get payments:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des paiements'
    });
  }
});

// ========================================
// DELETE /api/payments/:id - Supprimer un paiement
// ========================================
router.delete('/:id', authorizeRoles('directeur', 'comptable'), async (req, res) => {
  try {
    // Vérifier si le paiement existe
    const existing = await query('SELECT id FROM payments WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Paiement non trouvé'
      });
    }

    // Supprimer le paiement
    await query('DELETE FROM payments WHERE id = ?', [req.params.id]);

    // Journaliser l'action
    await query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)',
      [req.user.id, 'DELETE_PAYMENT', 'payment', req.params.id]
    );

    res.json({
      success: true,
      message: 'Paiement supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur delete payment:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression du paiement'
    });
  }
});

// ========================================
// GET /api/payments/stats - Statistiques des paiements
// ========================================
router.get('/stats/summary', authorizeRoles('directeur', 'comptable'), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (start_date) {
      whereClause += ' AND payment_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND payment_date <= ?';
      params.push(end_date);
    }

    // Total par type
    const byType = await query(`
      SELECT type, SUM(amount) as total, COUNT(*) as count
      FROM payments ${whereClause}
      GROUP BY type
    `, params);

    // Total général
    const totalResult = await query(`
      SELECT SUM(amount) as total, COUNT(*) as count
      FROM payments ${whereClause}
    `, params);

    // Paiements par mois
    const byMonth = await query(`
      SELECT DATE_FORMAT(payment_date, '%Y-%m') as month, SUM(amount) as total
      FROM payments ${whereClause}
      GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `, params);

    res.json({
      success: true,
      data: {
        by_type: byType,
        total: totalResult[0],
        by_month: byMonth
      }
    });

  } catch (error) {
    console.error('Erreur get payment stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    });
  }
});

module.exports = router;
