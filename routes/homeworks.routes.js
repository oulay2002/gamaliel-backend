/**
 * ROUTES HOMEWORKS (Devoirs)
 * Gestion des devoirs et documents à télécharger
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configuration multer pour upload de fichiers
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads/homeworks');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'homework-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Type de fichier non autorisé'));
        }
    }
});

// ========================================
// POST /api/homeworks/web-sync - Route publique pour sync web app (avec upload fichier)
// ========================================
router.post('/web-sync', upload.single('file'), async (req, res) => {
    try {
        console.log('📥 [web-sync] Requête reçue!');
        console.log('📥 Body:', JSON.stringify(req.body));
        console.log('📥 Headers:', JSON.stringify(req.headers));
        console.log('📥 Method:', req.method);
        console.log('📥 File:', req.file ? req.file.filename : 'aucun');

        const {
            subject,
            description,
            due_date,
            class_name,
            type,
            book_name,
            page_numbers,
            instructions
        } = req.body;

        if (!subject || !description) {
            return res.status(400).json({ success: false, error: 'Matière et description requises' });
        }

        // Convertir due_date en format MySQL si besoin
        let dueDateValue = due_date;
        if (due_date && due_date.includes('/')) {
            const parts = due_date.split('/');
            if (parts.length === 3) {
                dueDateValue = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }

        // Déterminer le type de devoir
        let homeworkType = type || 'file';
        let filePath = null;
        let fileName = null;

        // Si un fichier a été uploadé
        if (req.file) {
            filePath = `/uploads/homeworks/${req.file.filename}`;
            fileName = req.file.originalname;
            homeworkType = 'file';
            console.log(`📎 Fichier uploadé: ${fileName} -> ${filePath}`);
        } else if (homeworkType === 'book') {
            // Devoir type livre
            filePath = null;
            fileName = null;
        }

        // Préparer la requête SQL
        const sql = `INSERT INTO homeworks
       (subject, description, due_date, type, book_name, page_numbers, instructions, file_path, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`;
        const params = [subject, description, dueDateValue || null, homeworkType, book_name || null, page_numbers || null, instructions || description, filePath];

        console.log('📝 SQL:', sql.replace(/\?/g, (_, i) => `'${params[i]}'`));

        // Insérer le devoir
        const result = await query(sql, params);

        console.log(`📚 [Web Sync] Devoir créé: ${subject} (${homeworkType}) -> Classe: ${class_name} -> ID ${result.insertId}`);

        // ========================================
        // ENVOYER NOTIFICATION PUSH AUX PARENTS
        // ========================================
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

            const notifResult = await sendHomeworkNotification(homeworkData, class_name, 'Enseignant');
            if (notifResult.success) {
                console.log('✅ Notification push devoir envoyée aux parents');
            }
        } catch (notifError) {
            console.warn('⚠️ Échec notification push devoir (non-critique):', notifError.message);
        }

        res.status(201).json({
            success: true,
            message: 'Devoir publié avec succès !',
            data: {
                id: result.insertId,
                subject,
                type: homeworkType,
                filePath: filePath,
                fileName: fileName,
                bookName: book_name,
                pageNumbers: page_numbers,
                className: class_name
            }
        });
    } catch (error) {
        console.error('❌ Erreur web-sync devoir:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// GET /api/homeworks/:id/file - Télécharger le fichier d'un devoir
// ========================================
router.get('/:id/file', async (req, res) => {
    try {
        const homeworkId = req.params.id;

        const homeworks = await query(
            'SELECT file_path FROM homeworks WHERE id = ?',
            [homeworkId]
        );

        if (!homeworks || homeworks.length === 0) {
            return res.status(404).json({ success: false, error: 'Devoir non trouvé' });
        }

        const hw = homeworks[0];
        if (!hw.file_path) {
            return res.status(404).json({ success: false, error: 'Aucun fichier pour ce devoir' });
        }

        const filePath = path.join(__dirname, '..', hw.file_path);
        const fileName = path.basename(hw.file_path);
        console.log(`📥 Téléchargement fichier: ${filePath}`);

        // Vérifier que le fichier existe
        if (!require('fs').existsSync(filePath)) {
            console.error(`❌ Fichier introuvable sur le disque: ${filePath}`);
            return res.status(404).json({ success: false, error: 'Fichier introuvable sur le serveur' });
        }

        // Envoyer le fichier avec les headers appropriés
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        res.sendFile(filePath);
    } catch (error) {
        console.error('❌ Erreur téléchargement:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Middleware d'authentification pour les autres routes
router.post('/', async (req, res) => {
    try {
        const {
            subject,
            description,
            due_date,
            class_name,
            type,
            book_name,
            page_numbers,
            instructions
        } = req.body;

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

        // Déterminer le type de devoir
        const homeworkType = type || 'file';

        // Insérer le devoir avec les nouveaux champs
        const result = await query(
            `INSERT INTO homeworks 
             (subject, description, due_date, type, book_name, page_numbers, instructions, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [subject, description, dueDateValue || null, homeworkType, book_name || null, page_numbers || null, instructions || description, 1]
        );

        console.log(`📚 Devoir créé: ${subject} (Type: ${homeworkType}) -> ID ${result.insertId}`);

        // ========================================
        // ENVOYER NOTIFICATION PUSH AUX PARENTS
        // ========================================
        try {
            const { sendHomeworkNotification } = require('../services/firebaseService');

            // Préparer les données du devoir pour la notification
            const homeworkData = {
                id: result.insertId,
                subject: subject,
                type: homeworkType,
                book_name: book_name,
                page_numbers: page_numbers,
                due_date: dueDateValue
            };

            // Nom de l'enseignant (par défaut)
            const teacherName = 'Enseignant';

            // Envoyer la notification
            const notifResult = await sendHomeworkNotification(homeworkData, class_name, teacherName);
            if (notifResult.success) {
                console.log('✅ Notification push envoyée aux parents');
            }
        } catch (notifError) {
            console.warn('⚠️ Échec notification push (non-critique):', notifError.message);
        }

        res.status(201).json({
            success: true,
            message: 'Devoir publié avec succès !',
            data: {
                id: result.insertId,
                subject,
                type: homeworkType,
                bookName: book_name,
                pageNumbers: page_numbers
            }
        });
    } catch (error) {
        console.error('Erreur publication devoir:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Middleware d'authentification
router.use(authenticateToken);

// ========================================
// GET /api/homeworks/my-child
// Récupérer les devoirs pour les enfants du parent
// ========================================
router.get('/my-child', async (req, res) => {
    try {
        const userId = req.user.id;

        // Vérifier que c'est un parent
        if (req.user.role !== 'parent') {
            return res.status(403).json({
                success: false,
                error: 'Accès réservé aux parents'
            });
        }

        // Récupérer les IDs des enfants
        const parentData = await query(`SELECT student_ids FROM parents WHERE user_id = ?`, [userId]);

        if (!parentData || parentData.length === 0) {
            return res.json({
                success: true,
                data: { homeworks: [], count: 0 }
            });
        }

        const studentIds = JSON.parse(parentData[0].student_ids || '[]');

        if (studentIds.length === 0) {
            return res.json({
                success: true,
                data: { homeworks: [], count: 0 }
            });
        }

        // Récupérer les devoirs (tous, triés par date)
        const homeworks = await query(`
            SELECT
                h.id,
                h.subject,
                h.description,
                h.instructions,
                h.type,
                h.book_name,
                h.page_numbers,
                h.due_date,
                h.file_path,
                h.created_by,
                h.created_at,
                u.full_name as teacher_name,
                'Classe' as class_name,
                h.subject as subject_name
            FROM homeworks h
            LEFT JOIN users u ON h.created_by = u.id
            ORDER BY h.created_at DESC
            LIMIT 50
        `, []);

        res.json({
            success: true,
            data: {
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
// GET /api/homeworks/class/:classId
// Récupérer les devoirs d'une classe
// ========================================
router.get('/class/:classId', async (req, res) => {
    try {
        const classId = req.params.classId;
        const { limit = 50, offset = 0 } = req.query;

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
                h.published_at,
                h.viewed_count,
                h.downloaded_count,
                sub.name as subject_name,
                cl.name as class_name,
                u.full_name as teacher_name
            FROM homeworks h
            LEFT JOIN subjects sub ON h.subject_id = sub.id
            LEFT JOIN classes cl ON h.class_id = cl.id
            LEFT JOIN users u ON h.teacher_id = u.id
            WHERE h.class_id = ?
            AND h.is_published = TRUE
            ORDER BY h.published_at DESC
            LIMIT ? OFFSET ?
        `, [classId, parseInt(limit), parseInt(offset)]);

        res.json({
            success: true,
            data: {
                homeworks: homeworks,
                count: homeworks.length
            }
        });
    } catch (error) {
        console.error('Erreur récupération devoirs classe:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des devoirs'
        });
    }
});

// ========================================
// GET /api/homeworks/:id
// Détails d'un devoir
// ========================================
router.get('/:id', async (req, res) => {
    try {
        const homeworkId = req.params.id;

        const homework = await query(`
            SELECT 
                h.*,
                sub.name as subject_name,
                cl.name as class_name,
                u.full_name as teacher_name,
                u.email as teacher_email
            FROM homeworks h
            LEFT JOIN subjects sub ON h.subject_id = sub.id
            LEFT JOIN classes cl ON h.class_id = cl.id
            LEFT JOIN users u ON h.teacher_id = u.id
            WHERE h.id = ?
        `, [homeworkId]);

        if (!homework || homework.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Devoir non trouvé'
            });
        }

        // Incrémenter le compteur de vues
        await query(`UPDATE homeworks SET viewed_count = viewed_count + 1 WHERE id = ?`, [homeworkId]);

        res.json({
            success: true,
            data: homework[0]
        });
    } catch (error) {
        console.error('Erreur détails devoir:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération du devoir'
        });
    }
});

// ========================================
// GET /api/homeworks/:id/download
// Télécharger un devoir
// ========================================
router.get('/:id/download', async (req, res) => {
    try {
        const homeworkId = req.params.id;

        const homework = await query(`SELECT file_path, file_name FROM homeworks WHERE id = ?`, [homeworkId]);

        if (!homework || homework.length === 0 || !homework[0].file_path) {
            return res.status(404).json({
                success: false,
                error: 'Fichier non disponible'
            });
        }

        const filePath = homework[0].file_path;
        const fileName = homework[0].file_name || 'devoir.pdf';

        // Vérifier si le fichier existe
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'Fichier non trouvé sur le serveur'
            });
        }

        // Incrémenter le compteur de téléchargements
        await query(`UPDATE homeworks SET downloaded_count = downloaded_count + 1 WHERE id = ?`, [homeworkId]);

        res.download(filePath, fileName);
    } catch (error) {
        console.error('Erreur téléchargement devoir:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors du téléchargement'
        });
    }
});

// ========================================
// POST /api/homeworks
// Créer un devoir (Enseignant/Directeur/Secrétaire)
// ========================================
router.post('/', authorizeRoles('directeur', 'secretaire', 'enseignant'), upload.single('file'), [
    body('class_id').notEmpty().withMessage('Classe requise'),
    body('subject_id').notEmpty().withMessage('Matière requise'),
    body('title').notEmpty().withMessage('Titre requis'),
    body('description').optional(),
    body('due_date').optional().isISO8601().withMessage('Date invalide'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { class_id, subject_id, title, description, due_date, is_published } = req.body;

        let filePath = null;
        let fileName = null;
        let fileSize = null;

        if (req.file) {
            filePath = req.file.path;
            fileName = req.file.originalname;
            fileSize = req.file.size;
        }

        const teacherId = req.user.id;
        const published = is_published === 'true' || is_published === true;

        const result = await query(`
            INSERT INTO homeworks
            (class_id, subject_id, teacher_id, title, description, file_path, file_name, file_size, due_date, is_published, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [class_id, subject_id, teacherId, title, description, filePath, fileName, fileSize, due_date, published, teacherId]);

        // ========================================
        // ENREGISTRER DANS sync_changes POUR SYNC MOBILE
        // ========================================
        try {
            const classData = await query('SELECT name FROM classes WHERE id = ?', [class_id]);
            await query(`
                INSERT INTO sync_changes
                (device_id, user_id, change_type, collection, action, entity_id, data, timestamp, synced)
                VALUES ('web_sync', ?, 'homework', 'homeworks', 'create', ?, ?, NOW(), 1)
            `, [
                teacherId,
                result.insertId,
                JSON.stringify({
                    homework_id: result.insertId,
                    class_id,
                    class_name: classData?.[0]?.name,
                    title,
                    description,
                    file_name: fileName,
                    due_date,
                    is_published: published
                })
            ]);
        } catch (syncError) {
            console.warn('⚠️ Erreur sync_changes (ignorer):', syncError.message);
        }

        // Si publié, créer une notification pour les parents
        if (published) {
            // Récupérer les parents des élèves de la classe
            const parentsData = await query(`
                SELECT DISTINCT s.parent_user_id
                FROM students s
                WHERE s.class_id = ? AND s.parent_user_id IS NOT NULL
            `, [class_id]);

            const notificationPromises = parentsData.map(async (p) => {
                if (p.parent_user_id) {
                    await query(`
                        INSERT INTO notifications (user_id, type, title, body, data, priority)
                        VALUES (?, 'homework', ?, ?, ?, 'normal')
                    `, [
                        p.parent_user_id,
                        'Nouveau devoir',
                        `Un nouveau devoir a été publié en ${title}`,
                        JSON.stringify({ homework_id: result.insertId, class_id, subject_id })
                    ]);
                }
            });

            await Promise.all(notificationPromises);
        }

        res.status(201).json({
            success: true,
            message: published ? 'Devoir publié avec succès !' : 'Devoir créé (non publié)',
            data: {
                id: result.insertId,
                title,
                is_published: published
            }
        });
    } catch (error) {
        console.error('Erreur création devoir:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la création du devoir: ' + error.message
        });
    }
});

// ========================================
// PUT /api/homeworks/:id
// Mettre à jour un devoir
// ========================================
router.put('/:id', authorizeRoles('directeur', 'secretaire', 'enseignant'), async (req, res) => {
    try {
        const homeworkId = req.params.id;
        const { title, description, due_date, is_published } = req.body;

        await query(`
            UPDATE homeworks 
            SET title = ?, description = ?, due_date = ?, is_published = ?
            WHERE id = ?
        `, [title, description, due_date, is_published !== undefined ? is_published : true, homeworkId]);

        res.json({
            success: true,
            message: 'Devoir mis à jour avec succès'
        });
    } catch (error) {
        console.error('Erreur mise à jour devoir:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la mise à jour'
        });
    }
});

// ========================================
// DELETE /api/homeworks/:id
// Supprimer un devoir
// ========================================
router.delete('/:id', authorizeRoles('directeur', 'secretaire'), async (req, res) => {
    try {
        const homeworkId = req.params.id;

        // Récupérer le chemin du fichier
        const homework = await query(`SELECT file_path FROM homeworks WHERE id = ?`, [homeworkId]);

        if (homework && homework.length > 0 && homework[0].file_path) {
            // Supprimer le fichier physique
            const filePath = homework[0].file_path;
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await query(`DELETE FROM homeworks WHERE id = ?`, [homeworkId]);

        res.json({
            success: true,
            message: 'Devoir supprimé avec succès'
        });
    } catch (error) {
        console.error('Erreur suppression devoir:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la suppression'
        });
    }
});

// ========================================
// GET /api/homeworks/teacher/my-classes
// Récupérer les devoirs par classe pour un enseignant
// ========================================
router.get('/teacher/my-classes', authorizeRoles('directeur', 'enseignant'), async (req, res) => {
    try {
        const teacherId = req.user.id;

        // Récupérer les classes de l'enseignant
        const teacherData = await query(`SELECT class_ids FROM teachers WHERE user_id = ?`, [teacherId]);

        let classIds = [];
        if (teacherData && teacherData.length > 0 && teacherData[0].class_ids) {
            classIds = JSON.parse(teacherData[0].class_ids);
        }

        // Si l'enseignant n'a pas de classes assignées, retourner vide
        if (classIds.length === 0) {
            return res.json({
                success: true,
                data: { classes: [], homeworks: [] }
            });
        }

        // Récupérer les informations des classes
        const classes = await query(`
            SELECT id, name, level, academic_year
            FROM classes
            WHERE id IN (?)
            ORDER BY name
        `, [classIds]);

        // Récupérer les devoirs récents pour chaque classe
        const homeworks = await query(`
            SELECT 
                h.id,
                h.class_id,
                h.title,
                h.is_published,
                h.published_at,
                h.viewed_count,
                h.downloaded_count,
                cl.name as class_name,
                COUNT(h.id) as homework_count
            FROM homeworks h
            LEFT JOIN classes cl ON h.class_id = cl.id
            WHERE h.class_id IN (?) AND h.teacher_id = ?
            GROUP BY h.class_id, h.id
            ORDER BY h.published_at DESC
        `, [classIds, teacherId]);

        res.json({
            success: true,
            data: {
                classes: classes,
                homeworks: homeworks
            }
        });
    } catch (error) {
        console.error('Erreur récupération classes enseignant:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des classes'
        });
    }
});

module.exports = router;
