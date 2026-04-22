const express = require('express');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');

const router = express.Router();

// ========================================
// POST /api/users - Créer un utilisateur (publique pour l'app web)
// ========================================
router.post('/users', async (req, res) => {
  try {
    const { username, password, full_name, email, phone, role, class_name } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ success: false, error: 'Username, password et role requis' });
    }

    // Vérifier si l'utilisateur existe déjà
    const existing = await query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Nom d\'utilisateur déjà utilisé' });
    }

    // Hacher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Insérer l'utilisateur
    const result = await query(`
      INSERT INTO users (username, email, password_hash, role, full_name, phone, is_active)
      VALUES (?, ?, ?, ?, ?, ?, TRUE)
    `, [username, email || '', passwordHash, role, full_name || '', phone || '']);

    console.log(`👤 Utilisateur créé: ${username} (${role}) -> ID ${result.insertId}`);

    // Si c'est un enseignant avec une classe, lier à la classe
    if (role === 'enseignant' && class_name) {
      try {
        await query(`
          UPDATE classes SET teacher_id = ? WHERE name = ?
        `, [result.insertId, class_name]);
        console.log(`📚 Enseignant ${username} lié à la classe ${class_name}`);
      } catch (classErr) {
        console.warn('⚠️ Échec liaison classe:', classErr.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: {
        id: result.insertId,
        username: username,
        role: role,
        full_name: full_name
      }
    });
  } catch (error) {
    console.error('❌ Erreur création utilisateur:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// GET /api/teachers/my-info - Informations de l'enseignant connecté
// ========================================
router.get('/teachers/my-info', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'enseignant') {
      return res.status(403).json({ success: false, error: 'Accès réservé aux enseignants' });
    }

    // Trouver la classe de l'enseignant
    const classes = await query(
      'SELECT id, name, level FROM classes WHERE teacher_id = ? LIMIT 1',
      [req.user.id]
    );

    // Compter les élèves dans cette classe
    let studentCount = 0;
    if (classes.length > 0) {
      const countResult = await query(
        'SELECT COUNT(*) as count FROM students WHERE class_id = ? AND is_active = TRUE',
        [classes[0].id]
      );
      studentCount = countResult[0]?.count || 0;
    }

    res.json({
      success: true,
      data: {
        class: classes.length > 0 ? classes[0].name : 'Non assigné',
        class_id: classes.length > 0 ? String(classes[0].id) : '',
        className: classes.length > 0 ? classes[0].name : 'Non assigné',
        classLevel: classes.length > 0 ? classes[0].level : '',
        studentCount: studentCount
      }
    });
  } catch (error) {
    console.error('❌ Erreur récupération infos enseignant:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Configuration de Multer pour le stockage des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// ========================================
// ROUTE PUBLIQUE : Créer un devoir (depuis l'app web)
// ========================================
router.post('/homeworks', async (req, res) => {
  try {
    const { subject, description, due_date, class_name } = req.body;

    if (!subject || !description) {
      return res.status(400).json({ success: false, error: 'Sujet et description requis' });
    }

    // Convertir due_date en format MySQL si besoin
    let dueDateValue = due_date;
    if (due_date && due_date.includes('/')) {
      const parts = due_date.split('/');
      if (parts.length === 3) {
        dueDateValue = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    const result = await query(
      'INSERT INTO homeworks (subject, description, due_date, created_by) VALUES (?, ?, ?, ?)',
      [subject, description, dueDateValue || null, 1]
    );

    console.log(`📚 Devoir créé: ${subject} -> ID ${result.insertId}`);

    res.status(201).json({
      success: true,
      message: 'Devoir publié avec succès !',
      data: { id: result.insertId, subject }
    });
  } catch (error) {
    console.error('Erreur publication devoir:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// STUDENTS - ROUTE PUBLIQUE (SANS AUTH)
// Création depuis le frontend web/mobile
// ========================================
router.post('/students', async (req, res) => {
  try {
    const {
      matricule, lastName, firstName, gender, birthDate, birthPlace,
      className, fatherName, fatherPhone, fatherEmail,
      motherName, motherPhone, motherEmail
    } = req.body;

    if (!matricule || !lastName || !firstName) {
      return res.status(400).json({ success: false, error: 'Matricule, nom et prénom requis' });
    }

    // Vérifier si l'élève existe déjà
    const existing = await query('SELECT id FROM students WHERE matricule = ?', [matricule]);
    if (existing && existing.length > 0) {
      return res.json({ success: true, message: 'Élève existe déjà', data: { id: existing[0].id } });
    }

    // Trouver la classe par nom
    let classId = null;
    if (className) {
      const classes = await query('SELECT id FROM classes WHERE name = ?', [className]);
      if (classes && classes.length > 0) {
        classId = classes[0].id;
      }
    }

    const genderMapped = gender === 'Garçon' ? 'M' : (gender === 'Fille' ? 'F' : 'M');

    const [result] = await query(`
      INSERT INTO students
      (matricule, last_name, first_name, gender, birth_date, birth_place,
       class_id, father_name, father_phone, father_email,
       mother_name, mother_phone, mother_email,
       is_active, enrollment_year)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, YEAR(CURDATE()))
    `, [
      matricule, lastName, firstName, genderMapped,
      birthDate || null, birthPlace || '',
      classId,
      fatherName || '', fatherPhone || '', fatherEmail || '',
      motherName || '', motherPhone || '', motherEmail || ''
    ]);

    console.log(`✅ Élève créé: ${matricule} -> ID ${result.insertId}`);

    res.status(201).json({
      success: true,
      message: 'Élève créé avec succès',
      data: { id: result.insertId, matricule }
    });

  } catch (error) {
    console.error('Erreur création élève:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// ROUTES PROTÉGÉES (AUTH REQUIRED)
// ========================================
router.use(authenticateToken);

// ========================================
// STUDENTS - CRUD PROTÉGÉ
// ========================================
router.get('/students', async (req, res) => {
  try {
    const students = await query(`
      SELECT s.*, c.name as class_name 
      FROM students s 
      LEFT JOIN classes c ON s.class_id = c.id 
      WHERE s.is_active = 1 
      ORDER BY s.last_name, s.first_name
    `);
    res.json({ success: true, data: { students } });
  } catch (error) {
    console.error('Erreur liste élèves:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/students/:id', async (req, res) => {
  try {
    const students = await query(`
      SELECT s.*, c.name as class_name 
      FROM students s 
      LEFT JOIN classes c ON s.class_id = c.id 
      WHERE s.id = ?
    `, [req.params.id]);

    if (!students || students.length === 0) {
      return res.status(404).json({ success: false, error: 'Élève non trouvé' });
    }

    res.json({ success: true, data: { student: students[0] } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/students/:id', async (req, res) => {
  try {
    const { lastName, firstName, class_id, fatherPhone, motherPhone } = req.body;

    await query(`
      UPDATE students 
      SET last_name = COALESCE(?, last_name),
          first_name = COALESCE(?, first_name),
          class_id = COALESCE(?, class_id),
          father_phone = COALESCE(?, father_phone),
          mother_phone = COALESCE(?, mother_phone),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [lastName, firstName, class_id, fatherPhone, motherPhone, req.params.id]);

    res.json({ success: true, message: 'Élève mis à jour' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/students/:id', async (req, res) => {
  try {
    await query('UPDATE students SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Élève désactivé' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// TEACHERS
// ========================================
router.get('/teachers', async (req, res) => {
  try {
    const teachers = await query('SELECT * FROM teachers WHERE is_active = TRUE ORDER BY last_name');
    res.json({ success: true, data: { teachers } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur' });
  }
});

// ========================================
// DEVOIRS (HOMEWORK)
// ========================================
router.post('/teacher/homework/upload', upload.single('file'), async (req, res) => {
  try {
    const { subject, description, dueDate } = req.body;
    const filePath = req.file ? req.file.path : null;

    const result = await query(
      'INSERT INTO homeworks (subject, description, due_date, file_path, created_by) VALUES (?, ?, ?, ?, ?)',
      [subject, description, dueDate, filePath, req.user.id]
    );

    res.status(201).json({
      success: true,
      message: 'Devoir publié avec succès !',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Erreur publication devoir:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la publication : ' + error.message
    });
  }
});

// ========================================
// AUTRES ROUTES
// ========================================
router.get('/subjects', async (req, res) => {
  try {
    const subjects = await query('SELECT * FROM subjects WHERE is_active = TRUE ORDER BY name');
    res.json({ success: true, data: { subjects } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur' });
  }
});

router.get('/report-cards', async (req, res) => {
  try {
    const { student_id, class_id, period } = req.query;
    let sql = 'SELECT * FROM report_cards WHERE 1=1';
    const params = [];
    if (student_id) { sql += ' AND student_id = ?'; params.push(student_id); }
    const reportCards = await query(sql, params);
    res.json({ success: true, data: { reportCards } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erreur' });
  }
});

module.exports = router;
