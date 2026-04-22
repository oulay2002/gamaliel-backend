/**
 * ROUTES MOBILE SYNC - MYGAMALIEL
 * API endpoints pour la synchronisation mobile
 * Authentification requise via JWT token
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth.middleware');

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// ========================================
// 1. SYNCHRONISATION ÉLÈVES & PARENTS
// ========================================

/**
 * GET /api/mobile/students/by-phone/:phone
 * Récupérer les élèves d'un parent par son numéro de téléphone
 */
router.get('/students/by-phone/:phone', async (req, res) => {
    try {
        const phone = req.params.phone;

        // Trouver le parent par téléphone
        const parent = await query(
            'SELECT id, username, full_name, email FROM users WHERE phone = ? AND role = "parent"',
            [phone]
        );

        if (!parent || parent.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Parent non trouvé avec ce numéro de téléphone'
            });
        }

        // Récupérer les enfants liés à ce parent
        const students = await query(`
            SELECT 
                s.id,
                s.matricule,
                s.last_name,
                s.first_name,
                s.gender,
                s.birth_date,
                s.photo_path,
                c.name as class_name,
                c.level as class_level
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.parent_user_id = ? AND s.is_active = TRUE
            ORDER BY s.last_name, s.first_name
        `, [parent[0].id]);

        res.json({
            success: true,
            data: {
                parent: parent[0],
                students: students,
                count: students.length
            }
        });

    } catch (error) {
        console.error('Erreur récupération élèves par téléphone:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/mobile/students/by-username/:username
 * Récupérer les élèves d'un parent par son username
 */
router.get('/students/by-username/:username', async (req, res) => {
    try {
        const username = req.params.username;

        // Trouver le parent par username
        const parent = await query(
            'SELECT id, username, full_name, email, phone FROM users WHERE username = ? AND role = "parent"',
            [username]
        );

        if (!parent || parent.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Parent non trouvé'
            });
        }

        // Récupérer les enfants
        const students = await query(`
            SELECT 
                s.id,
                s.matricule,
                s.last_name,
                s.first_name,
                s.gender,
                s.birth_date,
                s.photo_path,
                c.name as class_name,
                c.level as class_level
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            WHERE s.parent_user_id = ? AND s.is_active = TRUE
            ORDER BY s.last_name, s.first_name
        `, [parent[0].id]);

        res.json({
            success: true,
            data: {
                parent: parent[0],
                students: students,
                count: students.length
            }
        });

    } catch (error) {
        console.error('Erreur récupération élèves par username:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================
// 2. SYNCHRONISATION PAIEMENTS
// ========================================

/**
 * GET /api/mobile/payments/student/:matricule
 * Récupérer tous les paiements d'un élève par son matricule
 */
router.get('/payments/student/:matricule', async (req, res) => {
    try {
        const matricule = req.params.matricule;

        // Trouver l'élève par matricule
        const student = await query(
            'SELECT id, matricule, last_name, first_name, class_id FROM students WHERE matricule = ?',
            [matricule]
        );

        if (!student || student.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Élève non trouvé'
            });
        }

        // Récupérer les paiements
        const payments = await query(`
            SELECT 
                p.id,
                p.student_id,
                p.amount,
                p.type,
                p.payment_mode,
                p.reference,
                p.payment_date,
                p.receipt_number,
                p.notes,
                p.created_at,
                u.full_name as recorded_by_name
            FROM payments p
            LEFT JOIN users u ON p.recorded_by = u.id
            WHERE p.student_id = ?
            ORDER BY p.payment_date DESC
        `, [student[0].id]);

        // Calculer les totaux
        const total = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        const byType = {};
        payments.forEach(p => {
            if (!byType[p.type]) byType[p.type] = 0;
            byType[p.type] += parseFloat(p.amount);
        });

        res.json({
            success: true,
            data: {
                student: student[0],
                payments: payments,
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
            error: error.message
        });
    }
});

/**
 * GET /api/mobile/payments/receipt/:receiptNumber
 * Récupérer un reçu spécifique par son numéro
 */
router.get('/payments/receipt/:receiptNumber', async (req, res) => {
    try {
        const receiptNumber = req.params.receiptNumber;

        const payment = await query(`
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
            WHERE p.receipt_number = ?
            LIMIT 1
        `, [receiptNumber]);

        if (!payment || payment.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Reçu non trouvé'
            });
        }

        res.json({
            success: true,
            data: payment[0]
        });

    } catch (error) {
        console.error('Erreur récupération reçu:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================
// 3. SYNCHRONISATION NOTES (COMPOSITIONS)
// ========================================

/**
 * GET /api/mobile/grades/student/:matricule
 * Récupérer toutes les notes d'un élève
 */
router.get('/grades/student/:matricule', async (req, res) => {
    try {
        const matricule = req.params.matricule;

        // Trouver l'élève
        const student = await query(
            'SELECT id, matricule, last_name, first_name, class_id FROM students WHERE matricule = ?',
            [matricule]
        );

        if (!student || student.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Élève non trouvé'
            });
        }

        // Récupérer les notes
        const grades = await query(`
            SELECT 
                g.id,
                g.student_id,
                g.composition_id,
                g.grade,
                g.max_score,
                g.rank,
                g.appreciation,
                g.graded_at,
                c.composition_name,
                c.composition_number,
                c.period,
                c.date as composition_date,
                s.name as subject_name,
                s.coefficient as subject_coefficient,
                u.full_name as teacher_name
            FROM grades g
            JOIN compositions c ON g.composition_id = c.id
            JOIN subjects s ON c.subject_id = s.id
            LEFT JOIN users u ON c.created_by = u.id
            WHERE g.student_id = ?
            ORDER BY c.period, c.composition_number, s.name
        `, [student[0].id]);

        // Calculer les moyennes par matière
        const averages = {};
        grades.forEach(g => {
            if (!averages[g.subject_name]) {
                averages[g.subject_name] = {
                    sum: 0,
                    count: 0,
                    coefficient: g.subject_coefficient
                };
            }
            averages[g.subject_name].sum += parseFloat(g.grade);
            averages[g.subject_name].count++;
        });

        const averagesResult = {};
        Object.keys(averages).forEach(subject => {
            averagesResult[subject] = {
                average: (averages[subject].sum / averages[subject].count).toFixed(2),
                coefficient: averages[subject].coefficient
            };
        });

        res.json({
            success: true,
            data: {
                student: student[0],
                grades: grades,
                averages: averagesResult,
                count: grades.length
            }
        });

    } catch (error) {
        console.error('Erreur récupération notes:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/mobile/averages/student/:matricule
 * Récupérer les moyennes générales d'un élève
 */
router.get('/averages/student/:matricule', async (req, res) => {
    try {
        const matricule = req.params.matricule;

        const student = await query(
            'SELECT id, matricule, last_name, first_name, class_id FROM students WHERE matricule = ?',
            [matricule]
        );

        if (!student || student.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Élève non trouvé'
            });
        }

        // Récupérer les moyennes par période
        const averages = await query(`
            SELECT 
                c.period,
                s.name as subject_name,
                AVG(g.grade) as average,
                s.coefficient,
                COUNT(g.id) as grade_count
            FROM grades g
            JOIN compositions c ON g.composition_id = c.id
            JOIN subjects s ON c.subject_id = s.id
            WHERE g.student_id = ?
            GROUP BY c.period, s.name, s.coefficient
            ORDER BY c.period, s.name
        `, [student[0].id]);

        // Calculer la moyenne générale par période
        const periodAverages = {};
        averages.forEach(a => {
            if (!periodAverages[a.period]) {
                periodAverages[a.period] = { sum: 0, count: 0 };
            }
            periodAverages[a.period].sum += parseFloat(a.average) * a.coefficient;
            periodAverages[a.period].count += a.coefficient;
        });

        const generalAverages = {};
        Object.keys(periodAverages).forEach(period => {
            generalAverages[period] = {
                average: (periodAverages[period].sum / periodAverages[period].count).toFixed(2),
                appreciation: getAppreciation(periodAverages[period].sum / periodAverages[period].count)
            };
        });

        res.json({
            success: true,
            data: {
                student: student[0],
                averagesByPeriod: averages,
                generalAverages: generalAverages
            }
        });

    } catch (error) {
        console.error('Erreur récupération moyennes:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper function for appreciation
function getAppreciation(average) {
    if (average >= 16) return 'Très bien';
    if (average >= 14) return 'Bien';
    if (average >= 12) return 'Assez bien';
    if (average >= 10) return 'Passable';
    return 'À renforcer';
}

// ========================================
// 4. SYNCHRONISATION DEVOIRS (CAHIER DE TEXTE)
// ========================================

/**
 * GET /api/mobile/homeworks/student/:matricule
 * Récupérer tous les devoirs d'un élève
 */
router.get('/homeworks/student/:matricule', async (req, res) => {
    try {
        const matricule = req.params.matricule;

        // Trouver l'élève
        const student = await query(
            'SELECT id, matricule, last_name, first_name, class_id FROM students WHERE matricule = ?',
            [matricule]
        );

        if (!student || student.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Élève non trouvé'
            });
        }

        const classId = student[0].class_id;

        // Récupérer les devoirs de la classe
        const homeworks = await query(`
            SELECT 
                h.id,
                h.class_id,
                h.subject_id,
                h.teacher_id,
                h.title,
                h.description,
                h.file_path,
                h.file_name,
                h.file_size,
                h.due_date,
                h.is_published,
                h.published_at,
                h.viewed_count,
                h.downloaded_count,
                s.name as subject_name,
                u.full_name as teacher_name,
                c.name as class_name
            FROM homeworks h
            LEFT JOIN subjects s ON h.subject_id = s.id
            LEFT JOIN users u ON h.teacher_id = u.id
            LEFT JOIN classes c ON h.class_id = c.id
            WHERE h.class_id = ? AND h.is_published = TRUE
            ORDER BY h.published_at DESC
            LIMIT 50
        `, [classId]);

        // Formater les devoirs
        const formattedHomeworks = homeworks.map(h => ({
            id: h.id,
            title: h.title,
            description: h.description,
            subject: h.subject_name,
            teacher: h.teacher_name,
            className: h.class_name,
            dueDate: h.due_date,
            publishedAt: h.published_at,
            hasFile: h.file_path ? true : false,
            fileName: h.file_name,
            fileSize: h.file_size,
            downloadUrl: h.file_path ? `/uploads/${h.file_path.split('/').pop()}` : null,
            viewedCount: h.viewed_count,
            downloadedCount: h.downloaded_count
        }));

        res.json({
            success: true,
            data: {
                student: student[0],
                homeworks: formattedHomeworks,
                count: formattedHomeworks.length
            }
        });

    } catch (error) {
        console.error('Erreur récupération devoirs:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/mobile/homeworks/download/:id
 * Télécharger un fichier de devoir
 */
router.get('/homeworks/download/:id', async (req, res) => {
    try {
        const homeworkId = req.params.id;

        const homework = await query(
            'SELECT file_path, file_name FROM homeworks WHERE id = ?',
            [homeworkId]
        );

        if (!homework || homework.length === 0 || !homework[0].file_path) {
            return res.status(404).json({
                success: false,
                error: 'Fichier non trouvé'
            });
        }

        // Incrémenter le compteur de téléchargements
        await query(
            'UPDATE homeworks SET downloaded_count = downloaded_count + 1 WHERE id = ?',
            [homeworkId]
        );

        // Envoyer le fichier
        const filePath = homework[0].file_path;
        const fileName = homework[0].file_name || 'devoir.pdf';

        res.download(filePath, fileName);

    } catch (error) {
        console.error('Erreur téléchargement devoir:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================
// 5. SYNCHRONISATION GÉNÉRALE
// ========================================

/**
 * GET /api/mobile/sync/all/:matricule
 * Récupérer TOUTES les données d'un élève en une seule requête
 */
router.get('/sync/all/:matricule', async (req, res) => {
    try {
        const matricule = req.params.matricule;

        // Élève
        const student = await query(
            'SELECT id, matricule, last_name, first_name, class_id FROM students WHERE matricule = ?',
            [matricule]
        );

        if (!student || student.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Élève non trouvé'
            });
        }

        const classId = student[0].class_id;

        // Paiements
        const payments = await query(`
            SELECT id, amount, type, payment_date, receipt_number
            FROM payments
            WHERE student_id = ?
            ORDER BY payment_date DESC
            LIMIT 20
        `, [student[0].id]);

        // Notes (composition)
        let grades = [];
        try {
            grades = await query(`
                SELECT c.subject, c.period, c.score, c.coefficient, c.teacher_comment
                FROM compositions c
                WHERE c.student_id = ?
                ORDER BY c.period DESC
                LIMIT 50
            `, [student[0].id]);
        } catch (err) {
            console.warn('⚠️ Table compositions non prête:', err.message);
        }

        // Devoirs (simplifié)
        let homeworks = [];
        try {
            homeworks = await query(`
                SELECT id, subject, description, due_date, file_path, created_by, created_at
                FROM homeworks
                WHERE due_date IS NULL OR due_date >= CURDATE()
                ORDER BY created_at DESC
                LIMIT 20
            `);
        } catch (err) {
            console.warn('⚠️ Table homeworks:', err.message);
        }

        // Présences
        let attendance = [];
        try {
            attendance = await query(`
                SELECT date, status, notes
                FROM student_attendance
                WHERE student_id = ?
                ORDER BY date DESC
                LIMIT 30
            `, [student[0].id]);
        } catch (err) {
            console.warn('⚠️ Table attendance:', err.message);
        }

        res.json({
            success: true,
            data: {
                student: student[0],
                payments: payments,
                grades: grades,
                homeworks: homeworks,
                attendance: attendance,
                syncTimestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Erreur synchronisation générale:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
