/**
 * ROUTES ENSEIGNANT MOBILE
 * Endpoints pour l'application mobile des enseignants
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Routes qui acceptent "enseignant" OU "teacher" (compatibilité mobile)
function authorizeTeacher(...roles) {
  const allRoles = [...roles, 'teacher']; // Ajouter "teacher" comme alias
  return authorizeRoles(...allRoles);
}

// ========================================
// GET /api/teachers-mobile/my-classes
// Récupérer les classes de l'enseignant
// ========================================
router.get('/my-classes', authorizeTeacher('enseignant', 'directeur'), async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Simple query - just find classes where this teacher is the main teacher
    const classes = await query(`
      SELECT DISTINCT c.*,
             COUNT(DISTINCT s.id) as student_count
      FROM classes c
      LEFT JOIN students s ON s.class_id = c.id AND s.is_active = TRUE
      WHERE c.teacher_id = ?
      GROUP BY c.id
      ORDER BY c.name
    `, [teacherId]);

    res.json({
      success: true,
      data: { classes }
    });

  } catch (error) {
    console.error('Erreur get teacher classes:', error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des classes"
    });
  }
});

// ========================================
// GET /api/teachers-mobile/class/:classId/students
// Récupérer les élèves d'une classe
// ========================================
router.get('/class/:classId/students', authorizeTeacher('enseignant', 'directeur'), async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.user.id;
    const username = req.user.username;

    // Vérifier que l'enseignant a accès à cette classe
    // teacher_id peut être un ID numérique OU un username (compatibilité legacy)
    // Note: co_teacher_ids check removed until migration is applied
    const accessCheck = await query(`
      SELECT id FROM classes
      WHERE id = ? AND (teacher_id = ? OR teacher_id = ?)
    `, [classId, userId, username]);

    if (accessCheck.length === 0) {
      return res.status(403).json({
        success: false,
        error: "Accès non autorisé à cette classe"
      });
    }

    const students = await query(`
      SELECT s.*, c.name as class_name
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE s.class_id = ? AND s.is_active = TRUE
      ORDER BY s.last_name, s.first_name
    `, [classId]);

    res.json({
      success: true,
      data: {
        classInfo: { id: classId },
        students,
        count: students.length
      }
    });

  } catch (error) {
    console.error('Erreur get class students:', error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des élèves"
    });
  }
});

// ========================================
// POST /api/teachers-mobile/attendance/mark
// Marquer les présences
// ========================================
router.post('/attendance/mark', authorizeTeacher('enseignant', 'directeur'), [
  body('class_id').isInt().withMessage('ID classe invalide'),
  body('date').isDate().withMessage('Date invalide'),
  body('attendance').isArray().withMessage('Liste de présences requise')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { class_id, date, attendance } = req.body;

    // Vérifier l'accès à la classe
    const accessCheck = await query(`
      SELECT id FROM classes
      WHERE id = ? AND (teacher_id = ? OR teacher_id = ?)
    `, [class_id, req.user.id, req.user.username]);

    if (accessCheck.length === 0) {
      return res.status(403).json({
        success: false,
        error: "Accès non autorisé à cette classe"
      });
    }

    // Insérer les présences
    let successCount = 0;
    for (const record of attendance) {
      await query(`
        INSERT INTO student_attendance 
        (student_id, date, status, recorded_by, created_at)
        VALUES (?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
          status = VALUES(status),
          recorded_by = VALUES(recorded_by),
          updated_at = NOW()
      `, [record.student_id, date, record.status, req.user.id]);
      successCount++;
    }

    res.json({
      success: true,
      message: `${successCount} présences enregistrées avec succès`
    });

  } catch (error) {
    console.error('Erreur mark attendance:', error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de l'enregistrement des présences"
    });
  }
});

// ========================================
// GET /api/teachers-mobile/subjects
// Récupérer les matières par niveau de classe
// ========================================
router.get('/subjects', authorizeTeacher('enseignant', 'directeur'), async (req, res) => {
  try {
    const { class_level } = req.query;
    let sql = 'SELECT name, max_score, class_level FROM subjects WHERE is_active = TRUE AND class_level IS NOT NULL';
    const params = [];

    if (class_level) {
      sql += ' AND class_level = ?';
      params.push(class_level);
    }

    sql += ' ORDER BY class_level, name';

    const subjects = await query(sql, params);
    res.json({ success: true, data: { subjects } });
  } catch (error) {
    console.error('Erreur get subjects:', error);
    res.status(500).json({ success: false, error: "Erreur lors de la récupération des matières" });
  }
});

// ========================================
// POST /api/teachers-mobile/compositions
// Créer une composition
// ========================================
router.post('/compositions', authorizeTeacher('enseignant', 'directeur'), [
  body('class_id').isInt().withMessage('ID classe invalide'),
  body('name').notEmpty().withMessage('Nom requis'),
  body('period').notEmpty().withMessage('Période requise'),
  body('start_date').isDate().withMessage('Date de début invalide'),
  body('end_date').isDate().withMessage('Date de fin invalide')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { class_id, name, period, start_date, end_date } = req.body;
    const teacherId = req.user.id;

    console.log('📝 Composition request:', { class_id, name, period, start_date, end_date, teacherId });

    // Vérifier l'accès à la classe
    const accessCheck = await query(`
      SELECT id FROM classes
      WHERE id = ? AND (teacher_id = ? OR teacher_id = ?)
    `, [class_id, teacherId, req.user.username]);

    if (accessCheck.length === 0) {
      return res.status(403).json({
        success: false,
        error: `Accès refusé. teacher_id=${teacherId}, class_id=${class_id}`
      });
    }

    const academicYear = new Date().getFullYear() + '-2026';

    // Check table exists
    const tableCheck = await query("SHOW TABLES LIKE 'compositions'");
    if (tableCheck.length === 0) {
      return res.status(500).json({
        success: false,
        error: "Table 'compositions' inexistante. Exécutez: node scripts/run-migration.js"
      });
    }

    const result = await query(`
      INSERT INTO compositions
      (class_id, name, period, start_date, end_date, academic_year, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [class_id, name, period, start_date, end_date, academicYear, teacherId]);

    res.status(201).json({
      success: true,
      message: "Composition créée avec succès",
      data: { id: result.insertId }
    });

  } catch (error) {
    console.error('❌ Erreur create composition:', error);
    console.error('❌ SQL Error:', error.sqlMessage, '| Code:', error.code);
    res.status(500).json({
      success: false,
      error: `Erreur SQL: ${error.sqlMessage || error.message || 'Inconnue'}`
    });
  }
});

// ========================================
// GET /api/teachers-mobile/my-compositions
// Récupérer mes compositions
// ========================================
router.get('/my-compositions', authorizeTeacher('enseignant', 'directeur'), async (req, res) => {
  try {
    const teacherId = req.user.id;

    const compositions = await query(`
      SELECT DISTINCT comp.*, c.name as class_name
      FROM compositions comp
      JOIN classes c ON comp.class_id = c.id
      WHERE c.teacher_id = ? 
         OR FALSE
      ORDER BY comp.created_at DESC
    `, [teacherId, teacherId]);

    res.json({
      success: true,
      data: { compositions }
    });

  } catch (error) {
    console.error('Erreur get compositions:', error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des compositions"
    });
  }
});

// ========================================
// POST /api/teachers-mobile/compositions/:id/grades
// Ajouter des notes à une composition
// ========================================
router.post('/compositions/:id/grades', authorizeTeacher('enseignant', 'directeur'), [
  body('grades').isArray().withMessage('Liste de notes requise')
], async (req, res) => {
  try {
    console.log('📝 [Grades] Request body:', JSON.stringify(req.body, null, 2));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('❌ Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const compositionId = req.params.id;
    const { grades } = req.body;

    console.log(`📝 [Grades] ${grades.length} notes reçues pour composition #${compositionId}`);

    // Vérifier l'accès à la composition
    const accessCheck = await query(`
      SELECT comp.id FROM compositions comp
      JOIN classes c ON comp.class_id = c.id
      WHERE comp.id = ? AND (c.teacher_id = ? OR FALSE)
    `, [compositionId, req.user.id, req.user.id]);

    if (accessCheck.length === 0) {
      return res.status(403).json({
        success: false,
        error: "Accès non autorisé à cette composition"
      });
    }

    let successCount = 0;
    for (const g of grades) {
      const gradeValue = parseFloat(g.grade) || parseFloat(g.score) || 0;
      const subjectName = g.remarks || g.appreciation || g.subject || 'Non spécifié';
      const isPresent = g.is_present !== undefined ? (g.is_present ? 1 : 0) : 1;
      const rank = g.rank || null;

      await query(`
        INSERT INTO grades
        (composition_id, student_id, subject_name, grade, \`rank\`, is_present, appreciation, graded_by, graded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          subject_name = VALUES(subject_name),
          grade = VALUES(grade),
          \`rank\` = VALUES(\`rank\`),
          is_present = VALUES(is_present),
          appreciation = VALUES(appreciation),
          graded_at = NOW()
      `, [
        compositionId,
        g.student_id,
        subjectName,
        gradeValue,
        rank,
        isPresent,
        subjectName,
        req.user.id
      ]);
      successCount++;
    }

    console.log(`✅ [Grades] ${successCount} notes enregistrées pour composition #${compositionId}`);

    // ========================================
    // ENVOYER NOTIFICATION PUSH AUX PARENTS
    // ========================================
    try {
      // Récupérer les infos de la composition
      const compData = await query(`
        SELECT comp.name, comp.composition_name, comp.composition_number, comp.period,
               c.name as class_name, sub.name as subject_name
        FROM compositions comp
        LEFT JOIN classes c ON comp.class_id = c.id
        LEFT JOIN subjects sub ON comp.subject_id = sub.id
        WHERE comp.id = ?
      `, [compositionId]);

      if (compData && compData.length > 0) {
        const comp = compData[0];
        const compName = comp.name || comp.composition_name || `Composition ${comp.composition_number || ''}`;
        const className = comp.class_name || 'Classe';
        const subjectName = comp.subject_name || 'Matière';

        // Récupérer les tokens FCM des parents de cette classe
        const { sendGradeNotificationToClass } = require('../services/firebaseService');
        const notifResult = await sendGradeNotificationToClass(grades, compName, className, subjectName);
        if (notifResult.success) {
          console.log(`✅ Notification notes envoyée aux parents de ${className}`);
        }
      }
    } catch (notifError) {
      console.warn('⚠️ Échec notification push notes (non-critique):', notifError.message);
    }

    res.json({
      success: true,
      message: `${successCount} notes enregistrées avec succès`
    });

  } catch (error) {
    console.error('❌ Erreur save grades:', error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de l'enregistrement des notes"
    });
  }
});

// ========================================
// POST /api/teachers-mobile/homeworks
// Publier un devoir
// ========================================
router.post('/homeworks', authorizeTeacher('enseignant', 'directeur'), [
  body('subject').notEmpty().withMessage('Matière requise'),
  body('description').notEmpty().withMessage('Description requise')
], async (req, res) => {
  try {
    console.log('📥 [POST /homeworks] Body reçu:', JSON.stringify(req.body, null, 2));
    console.log('👤 User ID:', req.user?.id, 'Username:', req.user?.username);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('⚠️ Erreurs validation:', errors.array());
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { subject, description, instructions, due_date, type, book_name, page_numbers, class_name } = req.body;

    // Déterminer le type de devoir
    const homeworkType = type || 'file';

    // Convertir due_date si format DD/MM/YYYY
    let dueDateValue = due_date;
    if (due_date && due_date.includes('/')) {
      const parts = due_date.split('/');
      if (parts.length === 3) {
        dueDateValue = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    const result = await query(`
      INSERT INTO homeworks
      (subject, description, instructions, type, book_name, page_numbers, due_date, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [subject, description, instructions || description, homeworkType, book_name || null, page_numbers || null, dueDateValue || null, req.user.id]);

    console.log(`📚 [Mobile] Devoir créé: ${subject} (Type: ${homeworkType}) -> ID ${result.insertId}`);

    // Notification push aux parents
    try {
      const { sendHomeworkNotification } = require('../services/firebaseService');
      const homeworkData = {
        id: result.insertId,
        subject: subject,
        type: homeworkType,
        book_name: book_name,
        page_numbers: page_numbers,
        due_date: dueDateValue
      };
      const notifResult = await sendHomeworkNotification(homeworkData, class_name || 'Classe', 'Enseignant');
      if (notifResult.success) {
        console.log('✅ Notification push devoir envoyée');
      }
    } catch (notifError) {
      console.warn('⚠️ Échec notification push devoir:', notifError.message);
    }

    res.status(201).json({
      success: true,
      message: "Devoir publié avec succès",
      data: { id: result.insertId }
    });

  } catch (error) {
    console.error('❌ Erreur create homework:', error);
    console.error('  Message:', error.message);
    console.error('  Code SQL:', error.code);
    console.error('  SQL State:', error.sqlState);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// GET /api/teachers-mobile/my-homeworks
// Récupérer mes devoirs
// ========================================
router.get('/my-homeworks', authorizeTeacher('enseignant', 'directeur'), async (req, res) => {
  try {
    const homeworks = await query(`
      SELECT h.*
      FROM homeworks h
      WHERE h.created_by = ?
      ORDER BY h.created_at DESC
    `, [req.user.id]);

    res.json({
      success: true,
      data: { homeworks }
    });

  } catch (error) {
    console.error('Erreur get homeworks:', error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des devoirs"
    });
  }
});

// ========================================
// POST /api/teachers-mobile/messages/send
// Envoyer un message
// ========================================
router.post('/messages/send', authorizeTeacher('enseignant', 'directeur'), [
  body('recipient_type').isIn(['parent', 'teacher', 'all', 'class']).withMessage('Type de destinataire invalide'),
  body('subject').notEmpty().withMessage('Sujet requis'),
  body('body').notEmpty().withMessage('Message requis')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { recipient_type, recipient_ids, class_id, subject, body, attachments } = req.body;

    const result = await query(`
      INSERT INTO messages 
      (sender_id, recipient_type, recipient_ids, class_id, subject, body, attachments, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [req.user.id, recipient_type, JSON.stringify(recipient_ids || []), class_id || null, subject, body, JSON.stringify(attachments || [])]);

    res.status(201).json({
      success: true,
      message: "Message envoyé avec succès",
      data: { id: result.insertId }
    });

  } catch (error) {
    console.error('Erreur send message:', error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de l'envoi du message"
    });
  }
});

// ========================================
// GET /api/teachers-mobile/messages
// Récupérer mes messages
// ========================================
router.get('/messages', authorizeTeacher('enseignant', 'directeur'), async (req, res) => {
  try {
    // Vérifier si la table messages existe
    const tableCheck = await query(`
      SELECT COUNT(*) as table_exists 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = 'messages'
    `);

    if (!tableCheck[0] || tableCheck[0].table_exists === 0) {
      return res.json({
        success: true,
        data: { messages: [] },
        message: "La fonctionnalité messages sera bientôt disponible"
      });
    }

    const messages = await query(`
      SELECT m.*, u.full_name as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.sender_id = ? 
         OR (m.recipient_type = 'all' 
             OR (m.recipient_type = 'teacher' AND JSON_CONTAINS(m.recipient_ids, CAST(? AS JSON))))
      ORDER BY m.created_at DESC
      LIMIT 50
    `, [req.user.id, req.user.id]);

    res.json({
      success: true,
      data: { messages }
    });

  } catch (error) {
    console.error('Erreur get messages:', error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération des messages"
    });
  }
});

// ========================================
// GET /api/teachers-mobile/dashboard
// Dashboard enseignant
// ========================================
router.get('/dashboard', authorizeTeacher('enseignant', 'directeur'), async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Nombre de classes
    const classCount = await query(`
      SELECT COUNT(DISTINCT c.id) as count
      FROM classes c
      WHERE c.teacher_id = ?
    `, [teacherId]);

    // Nombre total d'élèves
    const studentCount = await query(`
      SELECT COUNT(DISTINCT s.id) as count
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE c.teacher_id = ?
    `, [teacherId]);

    // Devoirs en attente
    const pendingHomeworks = await query(`
      SELECT COUNT(*) as count
      FROM homeworks
      WHERE created_by = ? AND due_date >= CURDATE()
    `, [teacherId]);

    // Messages non lus (table may not exist yet - make it optional)
    let unreadMessagesCount = 0;
    try {
      const unreadMessages = await query(`
        SELECT COUNT(*) as count
        FROM messages m
        LEFT JOIN message_recipients mr ON m.id = mr.message_id AND mr.user_id = ?
        WHERE (m.sender_id != ? OR m.sender_id IS NULL)
          AND (mr.is_read = FALSE OR mr.id IS NULL)
      `, [teacherId, teacherId]);
      unreadMessagesCount = unreadMessages[0]?.count || 0;
    } catch (err) {
      // Table doesn't exist yet - that's OK for now
      unreadMessagesCount = 0;
    }

    const dashboard = {
      class_count: classCount[0]?.count || 0,
      student_count: studentCount[0]?.count || 0,
      pending_homeworks: pendingHomeworks[0]?.count || 0,
      unread_messages: unreadMessagesCount
    };

    res.json({
      success: true,
      data: { dashboard }
    });

  } catch (error) {
    console.error('Erreur get dashboard:', error);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la récupération du dashboard"
    });
  }
});

module.exports = router;
