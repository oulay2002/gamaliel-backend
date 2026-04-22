/**
 * ROUTES PARENTS
 * Gestion des comptes parents et des liens avec les élèves
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');
const bcrypt = require('bcryptjs');

const router = express.Router();

// ========================================
// ROUTE SANS AUTH - Sync auto après inscription
// ========================================
router.post('/sync-auto-created', async (req, res) => {
    try {
        const { studentId, parentInfo } = req.body;

        if (!studentId || !parentInfo) {
            return res.status(400).json({
                success: false,
                error: 'Données incomplètes'
            });
        }

        const createdAccounts = [];

        // Trouver l'élève par matricule
        let studentNumericId = null;
        if (studentId.includes('-')) {
            const student = await query(
                'SELECT id FROM students WHERE matricule = ?',
                [studentId]
            );
            if (student && student.length > 0) {
                studentNumericId = student[0].id;
                console.log(`🔍 Élève trouvé: matricule=${studentId} -> id=${studentNumericId}`);
            }
        } else {
            studentNumericId = parseInt(studentId);
        }

        // Créer le compte du père
        if (parentInfo.fatherName && parentInfo.fatherPhone) {
            const existingFather = await query(
                'SELECT * FROM users WHERE phone = ?',
                [parentInfo.fatherPhone]
            );

            if (!existingFather || existingFather.length === 0) {
                const lastNameClean = parentInfo.fatherName.toLowerCase().replace(/[^a-z]/g, '');
                const matriculePart = studentId.split('-').pop() || '001';
                const fatherUsername = `pere.${lastNameClean}.${matriculePart}`;
                const fatherPassword = `pere${matriculePart}`;
                const fatherEmail = parentInfo.fatherEmail && parentInfo.fatherEmail.trim() !== ''
                    ? parentInfo.fatherEmail
                    : `${fatherUsername}@gamaliel.local`;

                const passwordHash = await bcrypt.hash(fatherPassword, 10);

                const fatherResult = await query(`
                    INSERT INTO users (username, email, password_hash, role, full_name, phone, is_active)
                    VALUES (?, ?, ?, 'parent', ?, ?, TRUE)
                `, [fatherUsername, fatherEmail, passwordHash, parentInfo.fatherName, parentInfo.fatherPhone]);

                await query(
                    'INSERT INTO parents (user_id, student_ids, notification_enabled) VALUES (?, ?, TRUE)',
                    [fatherResult.insertId, JSON.stringify([studentNumericId])]
                );

                if (studentNumericId) {
                    await query(`
                        UPDATE students SET parent_user_id = ? WHERE id = ?
                    `, [fatherResult.insertId, studentNumericId]);
                }

                createdAccounts.push({
                    type: 'Père',
                    username: fatherUsername,
                    password: fatherPassword,
                    userId: fatherResult.insertId
                });

                console.log('✅ Compte père créé dans MySQL:', fatherUsername);
            }
        }

        // Créer le compte de la mère
        if (parentInfo.motherName && parentInfo.motherPhone) {
            const existingMother = await query(
                'SELECT * FROM users WHERE phone = ?',
                [parentInfo.motherPhone]
            );

            if (!existingMother || existingMother.length === 0) {
                const lastNameClean = parentInfo.motherName.toLowerCase().replace(/[^a-z]/g, '');
                const matriculePart = studentId.split('-').pop() || '001';
                const motherUsername = `mere.${lastNameClean}.${matriculePart}`;
                const motherPassword = `mere${matriculePart}`;
                const motherEmail = parentInfo.motherEmail && parentInfo.motherEmail.trim() !== ''
                    ? parentInfo.motherEmail
                    : `${motherUsername}@gamaliel.local`;

                const passwordHash = await bcrypt.hash(motherPassword, 10);

                const motherResult = await query(`
                    INSERT INTO users (username, email, password_hash, role, full_name, phone, is_active)
                    VALUES (?, ?, ?, 'parent', ?, ?, TRUE)
                `, [motherUsername, motherEmail, passwordHash, parentInfo.motherName, parentInfo.motherPhone]);

                await query(
                    'INSERT INTO parents (user_id, student_ids, notification_enabled) VALUES (?, ?, TRUE)',
                    [motherResult.insertId, JSON.stringify([studentNumericId])]
                );

                if (studentNumericId) {
                    await query(`
                        UPDATE students SET parent_user_id = ? WHERE id = ? AND parent_user_id IS NULL
                    `, [motherResult.insertId, studentNumericId]);
                }

                createdAccounts.push({
                    type: 'Mère',
                    username: motherUsername,
                    password: motherPassword,
                    userId: motherResult.insertId
                });

                console.log('✅ Compte mère créé dans MySQL:', motherUsername);
            }
        }

        res.json({
            success: true,
            message: `${createdAccounts.length} compte(s) parent(s) créé(s) dans MySQL`,
            data: {
                accounts: createdAccounts,
                count: createdAccounts.length,
                studentId: studentNumericId
            }
        });

    } catch (error) {
        console.error('Erreur synchronisation parent:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================
// ROUTES PROTÉGÉES (AUTH REQUIRED)
// ========================================
router.use(authenticateToken);

// ========================================
// GET /api/parents/my-children
// Récupérer les enfants du parent connecté
// ========================================
router.get('/my-children', async (req, res) => {
    try {
        const userId = req.user.id;

        // Vérifier que c'est un parent
        if (req.user.role !== 'parent') {
            return res.status(403).json({
                success: false,
                error: 'Accès réservé aux parents'
            });
        }

        // Récupérer les enfants
        const children = await query(`
            SELECT 
                s.id,
                s.matricule,
                s.last_name,
                s.first_name,
                s.gender,
                s.birth_date,
                s.photo_path,
                c.id as class_id,
                c.name as class_name,
                c.level as class_level
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.parent_user_id = ? AND s.is_active = TRUE
            ORDER BY s.last_name, s.first_name
        `, [userId]);

        res.json({
            success: true,
            data: {
                children: children,
                count: children.length
            }
        });
    } catch (error) {
        console.error('Erreur récupération enfants:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des enfants'
        });
    }
});

// ========================================
// GET /api/parents/:id/children
// Récupérer les enfants d'un parent (Admin/Directeur/Secrétaire)
// ========================================
router.get('/:id/children', authorizeRoles('directeur', 'secretaire'), async (req, res) => {
    try {
        const parentId = req.params.id;

        const children = await query(`
            SELECT 
                s.id,
                s.matricule,
                s.last_name,
                s.first_name,
                s.gender,
                s.birth_date,
                s.photo_path,
                c.id as class_id,
                c.name as class_name,
                c.level as class_level
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.parent_user_id = ? AND s.is_active = TRUE
            ORDER BY s.last_name, s.first_name
        `, [parentId]);

        res.json({
            success: true,
            data: {
                children: children,
                count: children.length
            }
        });
    } catch (error) {
        console.error('Erreur récupération enfants:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des enfants'
        });
    }
});

// ========================================
// POST /api/parents
// Créer un compte parent
// ========================================
router.post('/', authorizeRoles('directeur', 'secretaire'), [
    body('username').notEmpty().withMessage('Nom d\'utilisateur requis'),
    body('password').notEmpty().withMessage('Mot de passe requis'),
    body('full_name').notEmpty().withMessage('Nom complet requis'),
    body('email').optional().isEmail().withMessage('Email invalide'),
    body('phone').optional().notEmpty().withMessage('Téléphone requis'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { username, password, full_name, email, phone } = req.body;

        // Hacher le mot de passe
        const passwordHash = await bcrypt.hash(password, 10);

        // Créer l'utilisateur parent
        const [result] = await query(`
            INSERT INTO users (username, email, password_hash, role, full_name, phone, is_active)
            VALUES (?, ?, ?, 'parent', ?, ?, TRUE)
        `, [username, email, passwordHash, full_name, phone]);

        const parentId = result.insertId;

        // Créer l'entrée dans parents
        await query(`
            INSERT INTO parents (user_id, student_ids, notification_enabled)
            VALUES (?, '[]', TRUE)
        `, [parentId]);

        res.status(201).json({
            success: true,
            message: 'Compte parent créé avec succès',
            data: {
                id: parentId,
                username: username,
                full_name: full_name
            }
        });
    } catch (error) {
        console.error('Erreur création parent:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                error: 'Ce nom d\'utilisateur ou email existe déjà'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Erreur lors de la création du compte parent'
        });
    }
});

// ========================================
// PUT /api/parents/:studentId/assign
// Assigner un élève à un parent
// ========================================
router.put('/:studentId/assign', authorizeRoles('directeur', 'secretaire'), async (req, res) => {
    try {
        const { studentId } = req.params;
        const { parentId } = req.body;

        if (!parentId) {
            return res.status(400).json({
                success: false,
                error: 'ID du parent requis'
            });
        }

        // Mettre à jour l'élève
        await query(`
            UPDATE students 
            SET parent_user_id = ?
            WHERE id = ?
        `, [parentId, studentId]);

        // Mettre à jour la liste des enfants du parent
        const parent = await query(`SELECT student_ids FROM parents WHERE user_id = ?`, [parentId]);

        if (parent && parent.length > 0) {
            let studentIds = JSON.parse(parent[0].student_ids || '[]');
            if (!studentIds.includes(parseInt(studentId))) {
                studentIds.push(parseInt(studentId));
                await query(`
                    UPDATE parents 
                    SET student_ids = ?
                    WHERE user_id = ?
                `, [JSON.stringify(studentIds), parentId]);
            }
        }

        res.json({
            success: true,
            message: 'Élève assigné au parent avec succès'
        });
    } catch (error) {
        console.error('Erreur assignation parent:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'assignation'
        });
    }
});

// ========================================
// GET /api/parents
// Lister tous les parents (Admin)
// ========================================
router.get('/', authorizeRoles('directeur', 'secretaire'), async (req, res) => {
    try {
        const parents = await query(`
            SELECT 
                u.id,
                u.username,
                u.full_name,
                u.email,
                u.phone,
                u.is_active,
                u.created_at,
                p.student_ids,
                JSON_LENGTH(p.student_ids) as children_count
            FROM users u
            LEFT JOIN parents p ON u.id = p.user_id
            WHERE u.role = 'parent'
            ORDER BY u.created_at DESC
        `);

        res.json({
            success: true,
            data: {
                parents: parents,
                count: parents.length
            }
        });
    } catch (error) {
        console.error('Erreur liste parents:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des parents'
        });
    }
});

// ========================================
// GET /api/parents/:id
// Détails d'un parent
// ========================================
router.get('/:id', authorizeRoles('directeur', 'secretaire', 'comptable'), async (req, res) => {
    try {
        const parentId = req.params.id;

        const parent = await query(`
            SELECT 
                u.id,
                u.username,
                u.full_name,
                u.email,
                u.phone,
                u.is_active,
                u.created_at,
                p.student_ids,
                p.notification_enabled,
                p.sms_enabled,
                p.email_enabled
            FROM users u
            LEFT JOIN parents p ON u.id = p.user_id
            WHERE u.id = ? AND u.role = 'parent'
        `, [parentId]);

        if (!parent || parent.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Parent non trouvé'
            });
        }

        // Récupérer les enfants
        const children = await query(`
            SELECT 
                s.id,
                s.matricule,
                s.last_name,
                s.first_name,
                s.birth_date,
                c.name as class_name
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.parent_user_id = ? AND s.is_active = TRUE
        `, [parentId]);

        res.json({
            success: true,
            data: {
                parent: parent[0],
                children: children
            }
        });
    } catch (error) {
        console.error('Erreur détails parent:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des détails'
        });
    }
});

// ========================================
// PUT /api/parents/:id
// Mettre à jour un parent
// ========================================
router.put('/:id', authorizeRoles('directeur', 'secretaire'), async (req, res) => {
    try {
        const parentId = req.params.id;
        const { full_name, email, phone, notification_enabled, sms_enabled, email_enabled } = req.body;

        // Mettre à jour users
        await query(`
            UPDATE users 
            SET full_name = ?, email = ?, phone = ?
            WHERE id = ? AND role = 'parent'
        `, [full_name, email, phone, parentId]);

        // Mettre à jour parents
        await query(`
            UPDATE parents
            SET notification_enabled = ?, sms_enabled = ?, email_enabled = ?
            WHERE user_id = ?
        `, [
            notification_enabled !== undefined ? notification_enabled : true,
            sms_enabled !== undefined ? sms_enabled : true,
            email_enabled !== undefined ? email_enabled : true,
            parentId
        ]);

        res.json({
            success: true,
            message: 'Parent mis à jour avec succès'
        });
    } catch (error) {
        console.error('Erreur mise à jour parent:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la mise à jour'
        });
    }
});

// ========================================
// DELETE /api/parents/:id
// Supprimer un parent
// ========================================
router.delete('/:id', authorizeRoles('directeur'), async (req, res) => {
    try {
        const parentId = req.params.id;

        // Supprimer (cascade vers parents et students.parent_user_id = NULL)
        await query(`DELETE FROM users WHERE id = ? AND role = 'parent'`, [parentId]);

        res.json({
            success: true,
            message: 'Parent supprimé avec succès'
        });
    } catch (error) {
        console.error('Erreur suppression parent:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la suppression'
        });
    }
});

// ========================================
// GET /api/parents/child/:childId/grades
// Récupérer les notes d'un enfant
// ========================================
router.get('/child/:childId/grades', async (req, res) => {
    try {
        const childId = req.params.childId;
        const userId = req.user.id;

        // Vérifier que l'enfant appartient au parent
        const child = await query(`
            SELECT id FROM students WHERE id = ? AND parent_user_id = ?
        `, [childId, userId]);

        if (!child || child.length === 0) {
            return res.status(403).json({ success: false, error: 'Accès refusé' });
        }

        let grades = [];
        try {
            const rawGrades = await query(`
                SELECT 
                    g.id,
                    g.grade,
                    g.\`rank\`,
                    g.is_present,
                    g.appreciation,
                    c.composition_name,
                    c.composition_number,
                    c.date,
                    c.coefficient,
                    c.max_grade,
                    s.name as subject_name
                FROM grades g
                JOIN compositions c ON g.composition_id = c.id
                JOIN subjects s ON c.subject_id = s.id
                WHERE g.student_id = ?
                ORDER BY c.date DESC, s.name ASC
                LIMIT 100
            `, [childId]);

            // Formater simple pour l'app mobile
            grades = (rawGrades || []).map(g => {
                const gradeVal = parseFloat(g.grade) || 0;
                const maxVal = parseFloat(g.max_grade) || 20;
                return {
                    id: g.id,
                    matiere: g.subject_name || 'Matière',
                    sujet: g.subject_name || 'Matière',
                    note: gradeVal,
                    moyenne: maxVal,
                    coef: g.coefficient || 1,
                    rang: g.rank || 0,
                    appreciation: g.appreciation || '',
                    date: g.date || '',
                    present: g.is_present === 1
                };
            });
        } catch (err) {
            console.warn('⚠️ Table grades:', err.message);
            grades = [];
        }

        res.json({ success: true, data: { grades } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// GET /api/parents/child/:childId/homeworks
// Récupérer les devoirs d'un enfant
// ========================================
router.get('/child/:childId/homeworks', async (req, res) => {
    try {
        const childId = req.params.childId;
        const userId = req.user.id;

        const child = await query(`
            SELECT class_id FROM students WHERE id = ? AND parent_user_id = ?
        `, [childId, userId]);

        if (!child || child.length === 0) {
            return res.status(403).json({ success: false, error: 'Accès refusé' });
        }

        const classId = child[0].class_id;

        let homeworks = [];
        try {
            const rawHomeworks = await query(`
                SELECT id, subject, description, instructions, type, book_name, page_numbers, due_date, file_path, created_by, created_at
                FROM homeworks
                ORDER BY created_at DESC
                LIMIT 50
            `);

            // Formater pour l'app mobile (Android/Kotlin)
            homeworks = (rawHomeworks || []).map(h => {
                // Convertir due_date en ISO si besoin
                let dueDateIso = h.due_date;
                if (h.due_date && h.due_date.includes('/')) {
                    const parts = h.due_date.split('/');
                    if (parts.length === 3) {
                        dueDateIso = `${parts[2]}-${parts[1]}-${parts[0]}T00:00:00.000Z`;
                    }
                }

                return {
                    id: h.id,
                    title: h.subject || 'Devoir',
                    subject: h.subject || 'Général',
                    subject_name: h.subject || 'Général',
                    description: h.description || '',
                    instructions: h.instructions || '',
                    type: h.type || 'file', // IMPORTANT: "file" ou "book"
                    book_name: h.book_name || '',
                    page_numbers: h.page_numbers || '',
                    due_date: dueDateIso || '',
                    dueDate: dueDateIso || '',
                    file_path: h.file_path || '',
                    filePath: h.file_path || '',
                    created_at: h.created_at ? new Date(h.created_at).toISOString() : '',
                    created_by: h.created_by || null
                };
            });
        } catch (err) {
            console.warn('⚠️ Table homeworks:', err.message);
            homeworks = [];
        }

        res.json({ success: true, data: { homeworks } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// GET /api/parents/child/:childId/payments
// Récupérer les paiements d'un enfant
// ========================================
router.get('/child/:childId/payments', async (req, res) => {
    try {
        const childId = req.params.childId;
        const userId = req.user.id;

        const child = await query(`
            SELECT s.id, s.class_id, c.name as class_name, c.fee as tuition_fee, c.canteen_fee, c.transport_fee, c.annexes_fee
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.id = ? AND s.parent_user_id = ?
        `, [childId, userId]);

        if (!child || child.length === 0) {
            return res.status(403).json({ success: false, error: 'Accès refusé' });
        }

        const tuitionFee = parseFloat(child[0].tuition_fee) || 0;
        const canteenFee = parseFloat(child[0].canteen_fee) || 0;
        const transportFee = parseFloat(child[0].transport_fee) || 0;
        const annexesFee = parseFloat(child[0].annexes_fee) || 0;
        const totalFees = tuitionFee + canteenFee + transportFee + annexesFee;

        const payments = await query(`
            SELECT id, amount, type, payment_mode, payment_date, receipt_number, notes
            FROM payments
            WHERE student_id = ?
            ORDER BY payment_date DESC
        `, [childId]);

        res.json({
            success: true,
            data: {
                payments,
                tuitionFee: totalFees,
                child: child[0]
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// GET /api/parents/child/:childId/attendance
// Récupérer les présences d'un enfant
// ========================================
router.get('/child/:childId/attendance', async (req, res) => {
    try {
        const childId = req.params.childId;
        const userId = req.user.id;

        const child = await query(`
            SELECT id FROM students WHERE id = ? AND parent_user_id = ?
        `, [childId, userId]);

        if (!child || child.length === 0) {
            return res.status(403).json({ success: false, error: 'Accès refusé' });
        }

        let attendance = [];
        try {
            attendance = await query(`
                SELECT date, status, justification
                FROM student_attendance
                WHERE student_id = ?
                ORDER BY date DESC
                LIMIT 50
            `, [childId]);
        } catch (err) {
            console.warn('⚠️ Table attendance:', err.message);
        }

        res.json({ success: true, data: { attendance } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
