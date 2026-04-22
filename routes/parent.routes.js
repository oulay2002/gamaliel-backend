/**
 * ROUTES PARENTS - MYGAMALIEL
 * API endpoints spécifiques pour les parents
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth.middleware');

// ========================================
// ROUTE SANS AUTHENTIFICATION
// Pour la synchronisation automatique après inscription
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

        // Trouver l'élève par matricule (le frontend envoie le matricule, pas l'ID numérique)
        let studentNumericId = null;
        if (studentId.includes('-')) {
            // C'est un matricule, chercher l'ID numérique
            const student = await query(
                'SELECT id FROM students WHERE matricule = ?',
                [studentId]
            );
            if (student && student.length > 0) {
                studentNumericId = student[0].id;
                console.log(`🔍 Élève trouvé: matricule=${studentId} -> id=${studentNumericId}`);
            } else {
                console.warn(`⚠️ Élève non trouvé avec matricule: ${studentId}`);
            }
        } else {
            // C'est déjà un ID numérique
            studentNumericId = parseInt(studentId);
        }

        // Créer le compte du père si les informations existent
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

                const bcrypt = require('bcryptjs');
                const passwordHash = await bcrypt.hash(fatherPassword, 10);

                const [fatherResult] = await query(`
                    INSERT INTO users (username, email, password_hash, role, full_name, phone, is_active)
                    VALUES (?, ?, ?, 'parent', ?, ?, TRUE)
                `, [fatherUsername, parentInfo.fatherEmail || '', passwordHash, parentInfo.fatherName, parentInfo.fatherPhone]);

                await query(`
                    INSERT INTO parents (user_id, student_ids, notification_enabled)
                    VALUES (?, ?, TRUE)
                `, [fatherResult.insertId, JSON.stringify([studentNumericId])]);

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
            } else {
                console.log(`ℹ️ Père existe déjà: ${existingFather[0].username}`);
                // Assigner l'élève au parent existant
                if (studentNumericId) {
                    await query(`
                        UPDATE students SET parent_user_id = ? WHERE id = ? AND parent_user_id IS NULL
                    `, [existingFather[0].id, studentNumericId]);
                }
            }
        }

        // Créer le compte de la mère si les informations existent
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

                const bcrypt = require('bcryptjs');
                const passwordHash = await bcrypt.hash(motherPassword, 10);

                const [motherResult] = await query(`
                    INSERT INTO users (username, email, password_hash, role, full_name, phone, is_active)
                    VALUES (?, ?, ?, 'parent', ?, ?, TRUE)
                `, [motherUsername, parentInfo.motherEmail || '', passwordHash, parentInfo.motherName, parentInfo.motherPhone]);

                await query(`
                    INSERT INTO parents (user_id, student_ids, notification_enabled)
                    VALUES (?, ?, TRUE)
                `, [motherResult.insertId, JSON.stringify([studentNumericId])]);

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
            } else {
                console.log(`ℹ️ Mère existe déjà: ${existingMother[0].username}`);
                // Assigner l'élève au parent existant
                if (studentNumericId) {
                    await query(`
                        UPDATE students SET parent_user_id = ? WHERE id = ? AND parent_user_id IS NULL
                    `, [existingMother[0].id, studentNumericId]);
                }
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
// ROUTES AVEC AUTHENTIFICATION
// ========================================

// Middleware d'authentification pour les autres routes
router.use(authenticateToken);

// ========================================
// GET /api/parents/my-children
// Récupérer les enfants du parent connecté
// ========================================
router.get('/my-children', async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        // Vérifier que c'est un parent
        if (userRole !== 'parent') {
            return res.status(403).json({
                success: false,
                error: 'Accès réservé aux parents'
            });
        }

        // Récupérer les informations du parent
        const parentInfo = await query(
            'SELECT * FROM parents WHERE user_id = ?',
            [userId]
        );

        if (!parentInfo || parentInfo.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Informations parent non trouvées'
            });
        }

        // Récupérer les enfants depuis la table students
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
                parent: parentInfo[0],
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
// GET /api/parents/child/:childId/grades
// Récupérer les notes d'un enfant
// ========================================
router.get('/child/:childId/grades', async (req, res) => {
    try {
        const childId = req.params.childId;
        const userId = req.user.id;

        // Vérifier que l'enfant appartient au parent + récupérer le niveau de classe
        const child = await query(
            `SELECT s.*, c.name as class_name, 
                    CASE 
                        WHEN c.name LIKE 'CP%' THEN c.name
                        WHEN c.name LIKE 'CE%' THEN c.name
                        WHEN c.name LIKE 'CM%' THEN c.name
                        ELSE c.name
                    END as class_level
             FROM students s 
             LEFT JOIN classes c ON s.class_id = c.id 
             WHERE s.id = ? AND s.parent_user_id = ?`,
            [childId, userId]
        );

        if (!child || child.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Enfant non trouvé'
            });
        }

        const classLevel = child[0].class_name;

        // Récupérer les notes avec le max_score de la matière
        let grades = [];
        try {
            grades = await query(`
                SELECT
                    g.id,
                    CAST(g.grade AS DECIMAL(5,2)) as grade,
                    g.\`rank\`,
                    g.appreciation,
                    g.graded_at,
                    g.subject_name,
                    COALESCE(CAST(s.max_score AS DECIMAL(5,2)),
                        CASE
                            WHEN g.subject_name IN ('Dictée') THEN 10
                            WHEN g.subject_name IN ('Étude de texte','Éveil au milieu','Mathématiques') AND ? IN ('CE1','CE2') THEN 30
                            WHEN g.subject_name IN ('Étude de texte','Éveil au milieu','Mathématiques') AND ? IN ('CM1','CM2') THEN 50
                            WHEN g.subject_name IN ('Dictée','Copie','Écriture','AEC','Expression écrite','Mathématiques','EDHC','Lecture','Discrimination visuelle','Discrimination auditive','Enrichissement du vocabulaire','Anglais','Éducation chrétienne') THEN 10
                            WHEN g.subject_name IN ('Dessin','Chant/Poésie') THEN 5
                            WHEN g.subject_name IN ('Anglais','Éducation chrétienne') AND ? IN ('CE1','CE2','CM1','CM2') THEN 20
                            ELSE 20
                        END
                    ) as max_score,
                    c.name as composition_name,
                    c.period,
                    c.composition_number,
                    c.composition_name,
                    c.coefficient,
                    c.academic_year,
                    c.date as composition_date,
                    1 as coefficient
                FROM grades g
                LEFT JOIN compositions c ON g.composition_id = c.id
                LEFT JOIN subjects s ON g.subject_name = s.name
                WHERE g.student_id = ?
                ORDER BY g.graded_at DESC
            `, [classLevel, classLevel, classLevel, childId]);

            // Convertir les grades en nombres pour l'app mobile
            grades = grades.map(g => {
                const compName = g.composition_name || g.composition || g.period || `Composition`;
                return {
                    ...g,
                    id: String(g.id), // Convertir ID en string pour l'app mobile
                    grade: parseFloat(g.grade) || 0,
                    max_score: parseFloat(g.max_score) || 20,
                    rank: g.rank ? parseInt(g.rank) : null,
                    composition_name: compName,
                    compositionName: compName // Alias pour l'app mobile
                };
            });
        } catch (err) {
            console.warn('⚠️ Table grades inaccessible:', err.message);
            grades = [];
        }

        res.json({
            success: true,
            data: {
                child: child[0],
                grades: grades,
                count: grades.length
            }
        });
    } catch (error) {
        console.error('Erreur récupération notes:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des notes'
        });
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

        // Vérifier que l'enfant appartient au parent
        const child = await query(
            'SELECT class_id FROM students WHERE id = ? AND parent_user_id = ?',
            [childId, userId]
        );

        if (!child || child.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Enfant non trouvé'
            });
        }

        // Récupérer tous les devoirs
        let homeworks = [];
        try {
            homeworks = await query(`
                SELECT
                    h.id,
                    h.subject,
                    h.description,
                    h.instructions,
                    h.type,
                    h.file_path,
                    h.book_name,
                    h.page_numbers,
                    h.due_date,
                    h.created_by,
                    h.created_at,
                    u.full_name as teacher_name
                FROM homeworks h
                LEFT JOIN users u ON h.created_by = u.id
                ORDER BY h.created_at DESC
                LIMIT 50
            `);

            // Mapper pour l'app mobile avec type correct
            homeworks = homeworks.map(h => {
                // Déterminer le type EXACT
                const hwType = h.type || 'file';
                return {
                    id: String(h.id),
                    title: h.subject || 'Devoir',
                    subject: h.subject || 'Général',
                    subjectName: h.subject,
                    subject_name: h.subject,
                    description: h.description || h.instructions || '',
                    instructions: h.instructions || h.description || '',
                    type: hwType,
                    file_path: h.file_path || null,
                    filePath: h.file_path || null,
                    book_name: h.book_name || null,
                    bookName: h.book_name || null,
                    page_numbers: h.page_numbers || null,
                    pageNumbers: h.page_numbers || null,
                    due_date: h.due_date || null,
                    dueDate: h.due_date || null,
                    teacher_name: h.teacher_name || 'Enseignant',
                    teacherName: h.teacher_name || 'Enseignant',
                    className: 'N/A',
                    class_name: 'N/A',
                    created_at: h.created_at || null,
                    createdAt: h.created_at || null,
                    created_by: h.created_by || null
                };
            });
        } catch (err) {
            console.warn('⚠️ Table homeworks inaccessible:', err.message);
            homeworks = [];
        }

        res.json({
            success: true,
            data: {
                child: child[0],
                homeworks: homeworks,
                count: homeworks.length
            }
        });
    } catch (error) {
        console.error('Erreur récupération devoirs:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des devoirs'
        });
    }
});

// ========================================
// GET /api/parents/child/:childId/attendance
// Récupérer les présences/absences d'un enfant
// ========================================
router.get('/child/:childId/attendance', async (req, res) => {
    try {
        const childId = req.params.childId;
        const userId = req.user.id;

        // Vérifier que l'enfant appartient au parent
        const child = await query(
            'SELECT * FROM students WHERE id = ? AND parent_user_id = ?',
            [childId, userId]
        );

        if (!child || child.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Enfant non trouvé'
            });
        }

        // Récupérer les présences
        let attendance = [];
        try {
            attendance = await query(`
                SELECT
                    id,
                    date,
                    status,
                    justification,
                    created_at as recorded_at
                FROM student_attendance
                WHERE student_id = ?
                ORDER BY date DESC
                LIMIT 100
            `, [childId]);
        } catch (err) {
            console.warn('⚠️ Table student_attendance inaccessible:', err.message);
            attendance = [];
        }

        // Calculer les statistiques
        const stats = {
            total: attendance.length,
            present: attendance.filter(a => a.status === 'present').length,
            absent: attendance.filter(a => a.status === 'absent').length,
            late: attendance.filter(a => a.status === 'late').length,
            excused: attendance.filter(a => a.status === 'excused').length
        };

        res.json({
            success: true,
            data: {
                child: child[0],
                attendance: attendance,
                stats: stats,
                count: attendance.length
            }
        });
    } catch (error) {
        console.error('Erreur récupération présences:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des présences'
        });
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

        // Vérifier que l'enfant appartient au parent
        const child = await query(
            'SELECT s.*, c.name as class_name, c.fee as tuition_fee, c.canteen_fee, c.transport_fee, c.annexes_fee FROM students s LEFT JOIN classes c ON s.class_id = c.id WHERE s.id = ? AND s.parent_user_id = ?',
            [childId, userId]
        );

        if (!child || child.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Enfant non trouvé'
            });
        }

        const tuitionFee = parseFloat(child[0].tuition_fee) || 0;
        const canteenFee = parseFloat(child[0].canteen_fee) || 0;
        const transportFee = parseFloat(child[0].transport_fee) || 0;
        const annexesFee = parseFloat(child[0].annexes_fee) || 0;
        const totalFees = tuitionFee + canteenFee + transportFee + annexesFee;

        // Récupérer les paiements
        let payments = [];
        try {
            payments = await query(`
                SELECT
                    id,
                    amount,
                    type,
                    payment_mode,
                    reference,
                    payment_date,
                    receipt_number,
                    notes,
                    created_at
                FROM payments
                WHERE student_id = ?
                ORDER BY payment_date DESC
                LIMIT 100
            `, [childId]);

            // Mapper les champs pour l'app mobile
            payments = payments.map(p => ({
                ...p,
                status: 'completed', // Par défaut car pas de colonne status
                paidAt: p.payment_date,
                createdAt: p.created_at,
                receipt: p.receipt_number,
                paymentMethod: p.payment_mode
            }));
        } catch (err) {
            console.warn('⚠️ Première requête payments échouée:', err.message);
            // Fallback: requête simplifiée
            try {
                payments = await query(`
                    SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC LIMIT 100
                `, [childId]);

                payments = payments.map(p => ({
                    ...p,
                    status: 'completed',
                    paidAt: p.payment_date,
                    createdAt: p.created_at,
                    receipt: p.receipt_number,
                    paymentMethod: p.payment_mode
                }));
            } catch (err2) {
                console.warn('⚠️ Fallback payments échoué:', err2.message);
                payments = [];
            }
        }

        // Calculer les totaux
        const total = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        const byType = {};
        payments.forEach(p => {
            if (!byType[p.type]) byType[p.type] = 0;
            byType[p.type] += parseFloat(p.amount || 0);
        });

        res.json({
            success: true,
            data: {
                child: child[0],
                payments: payments,
                tuitionFee: totalFees,
                feeDetails: {
                    tuition: tuitionFee,
                    canteen: canteenFee,
                    transport: transportFee,
                    annexes: annexesFee
                },
                stats: {
                    total: total,
                    count: payments.length,
                    byType: byType
                }
            }
        });
    } catch (error) {
        console.error('Erreur récupération paiements:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des paiements'
        });
    }
});

// ========================================
// GET /api/parents/messages
// Récupérer les messages du parent
// ========================================
router.get('/messages', async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        // Récupérer les messages reçus
        let messages = [];
        let unreadCount = [{ count: 0 }];
        try {
            messages = await query(`
                SELECT
                    m.id,
                    m.sender_id,
                    m.subject,
                    m.body,
                    m.priority,
                    m.is_read,
                    m.read_at,
                    m.sent_at,
                    u.full_name as sender_name,
                    u.email as sender_email
                FROM messages m
                LEFT JOIN message_recipients mr ON m.id = mr.message_id
                LEFT JOIN users u ON m.sender_id = u.id
                WHERE mr.user_id = ?
                ORDER BY m.sent_at DESC
                LIMIT ? OFFSET ?
            `, [userId, limit, offset]);

            // Compter les non-lus
            unreadCount = await query(
                'SELECT COUNT(*) as count FROM message_recipients WHERE user_id = ? AND is_read = FALSE',
                [userId]
            );
        } catch (err) {
            console.warn('⚠️ Table messages/message_recipients inaccessible:', err.message);
            messages = [];
            unreadCount = [{ count: 0 }];
        }

        res.json({
            success: true,
            data: {
                messages: messages,
                unreadCount: unreadCount[0]?.count || 0,
                count: messages.length
            }
        });
    } catch (error) {
        console.error('Erreur récupération messages:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des messages'
        });
    }
});

// ========================================
// POST /api/parents/messages/send
// Envoyer un message à l'enseignant
// ========================================
router.post('/messages/send', async (req, res) => {
    try {
        const userId = req.user.id;
        const { recipient_id, subject, body, class_id } = req.body;

        if (!subject || !body) {
            return res.status(400).json({
                success: false,
                error: 'Sujet et message requis'
            });
        }

        // Créer le message
        const [result] = await query(`
            INSERT INTO messages
            (sender_id, recipient_type, recipient_ids, class_id, subject, body, sent_at, created_by)
            VALUES (?, 'specific', ?, ?, ?, ?, NOW(), ?)
        `, [userId, JSON.stringify([recipient_id]), class_id || null, subject, body, userId]);

        // Créer l'entrée dans message_recipients pour le destinataire
        if (recipient_id) {
            await query(`
                INSERT INTO message_recipients (message_id, user_id)
                VALUES (?, ?)
            `, [result.insertId, recipient_id]);
        }

        res.status(201).json({
            success: true,
            message: 'Message envoyé avec succès',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Erreur envoi message:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'envoi du message'
        });
    }
});

// ========================================
// PUT /api/parents/messages/:id/read
// Marquer un message comme lu
// ========================================
router.put('/messages/:id/read', async (req, res) => {
    try {
        const messageId = req.params.id;
        const userId = req.user.id;

        await query(`
            UPDATE message_recipients
            SET is_read = TRUE, read_at = NOW()
            WHERE message_id = ? AND user_id = ?
        `, [messageId, userId]);

        res.json({
            success: true,
            message: 'Message marqué comme lu'
        });
    } catch (error) {
        console.error('Erreur marque comme lu:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la mise à jour'
        });
    }
});

// ========================================
// GET /api/parents/dashboard
// Tableau de bord parent (statistiques)
// ========================================
router.get('/dashboard', async (req, res) => {
    try {
        const userId = req.user.id;

        // Récupérer le nombre d'enfants
        const childrenCount = await query(
            'SELECT COUNT(*) as count FROM students WHERE parent_user_id = ? AND is_active = TRUE',
            [userId]
        );

        // Récupérer les enfants
        const children = await query(
            'SELECT id FROM students WHERE parent_user_id = ? AND is_active = TRUE',
            [userId]
        );

        const childIds = children.map(c => c.id);

        // Récupérer les dernières notes
        let recentGrades = [];
        if (childIds.length > 0) {
            try {
                recentGrades = await query(`
                    SELECT
                        g.grade,
                        g.\`rank\`,
                        g.appreciation,
                        s.name as subject_name,
                        c.name as composition_name,
                        st.last_name,
                        st.first_name
                    FROM grades g
                    LEFT JOIN compositions c ON g.composition_id = c.id
                    LEFT JOIN subjects s ON c.subject_id = s.id
                    LEFT JOIN students st ON g.student_id = st.id
                    WHERE g.student_id IN (?)
                    ORDER BY g.graded_at DESC
                    LIMIT 10
                `, [childIds]);
            } catch (err) {
                console.warn('⚠️ Dashboard grades query failed:', err.message);
                recentGrades = [];
            }
        }

        // Récupérer les devoirs récents
        let recentHomeworks = [];
        if (childIds.length > 0) {
            try {
                recentHomeworks = await query(`
                    SELECT
                        h.subject as title,
                        h.due_date,
                        h.description
                    FROM homeworks h
                    ORDER BY h.created_at DESC
                    LIMIT 10
                `);
            } catch (err) {
                console.warn('⚠️ Dashboard homeworks query failed:', err.message);
                recentHomeworks = [];
            }
        }

        // Récupérer les paiements récents
        let recentPayments = [];
        try {
            recentPayments = await query(`
                SELECT
                    amount,
                    type,
                    payment_date,
                    receipt_number
                FROM payments
                WHERE student_id IN(?)
                ORDER BY payment_date DESC
                LIMIT 5
            `, [childIds]);
        } catch (err) {
            console.warn('⚠️ Dashboard payments query failed:', err.message);
            recentPayments = [];
        }

        res.json({
            success: true,
            data: {
                childrenCount: childrenCount[0]?.count || 0,
                recentGrades: recentGrades,
                recentHomeworks: recentHomeworks,
                recentPayments: recentPayments
            }
        });
    } catch (error) {
        console.error('Erreur dashboard parent:', error);
        res.status(500).json({ success: false, error: 'Erreur lors de la récupération du tableau de bord' });
    }
});

// ========================================
// GET /api/parents-mobile/child/:childId/behaviors
// Parent receives behavior reports about their child (conduite)
// ========================================
router.get('/child/:childId/behaviors', async (req, res) => {
    try {
        const childId = req.params.childId;
        const userId = req.user.id;

        const child = await query(
            'SELECT s.*, c.name as class_name FROM students s LEFT JOIN classes c ON s.class_id = c.id WHERE s.id = ? AND s.parent_user_id = ?',
            [childId, userId]
        );

        if (!child || child.length === 0) {
            return res.status(404).json({ success: false, error: 'Enfant non trouvé' });
        }

        const behaviors = await query(`
            SELECT sb.id, sb.behavior_type, sb.description, sb.severity, sb.recorded_date, sb.created_at
            FROM student_behaviors sb
            WHERE sb.student_id = ?
            ORDER BY sb.recorded_date DESC, sb.created_at DESC
        `, [childId]);

        const typeLabels = {
            'lecon_non_apprise': "Leçon non apprise ou travail non fait",
            'travail_non_serieux': "Travail non sérieux en classe",
            'empeche_travailler': "A empêché les autres de travailler",
            'pas_leve_main': "N'a pas levé la main pour parler",
            'pas_materiel': "Matériel ou documents manquants",
            'pas_respecte_materiel': "Matériel ou locaux non respectés",
            'manque_respect': "Manque de respect (impolitesse, insolence)",
            'violence_physique': "Violence physique",
            'mot_non_signe': "Mot ou cahier non signé"
        };

        const severityLabels = {
            'low': 'Faible', 'medium': 'Moyen', 'high': 'Élevé', 'critical': 'Critique'
        };

        const severityColors = {
            'low': '#10B981', 'medium': '#F59E0B', 'high': '#EF4444', 'critical': '#DC2626'
        };

        const formatted = behaviors.map(b => ({
            id: b.id,
            behaviorType: b.behavior_type,
            behaviorLabel: typeLabels[b.behavior_type] || b.behavior_type,
            description: b.description || '',
            severity: b.severity,
            severityLabel: severityLabels[b.severity] || b.severity,
            severityColor: severityColors[b.severity] || '#64748B',
            recordedDate: b.recorded_date,
            createdAt: b.created_at
        }));

        res.json({ success: true, data: { child: child[0], behaviors: formatted }, count: formatted.length });
    } catch (error) {
        console.error('Erreur get parent behaviors:', error);
        res.status(500).json({ success: false, error: 'Erreur lors de la récupération' });
    }
});

module.exports = router;
