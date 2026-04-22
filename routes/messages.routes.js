/**
 * ROUTES MESSAGES
 * Gestion des messages entre école, parents et enseignants
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
        const uploadDir = path.join(__dirname, '../uploads/messages');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'message-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

router.use(authenticateToken);

// ========================================
// GET /api/messages/my-inbox
// Messages reçus par l'utilisateur connecté
// ========================================
router.get('/my-inbox', async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 50, offset = 0 } = req.query;

        const messages = await query(`
            SELECT 
                m.id,
                m.sender_id,
                m.subject,
                m.body,
                m.priority,
                m.is_read,
                m.read_at,
                m.sent_at,
                m.created_at,
                u.full_name as sender_name,
                u.email as sender_email,
                cl.name as class_name
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            LEFT JOIN message_recipients mr ON m.id = mr.message_id
            LEFT JOIN classes cl ON m.class_id = cl.id
            WHERE mr.user_id = ?
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
        `, [userId, parseInt(limit), parseInt(offset)]);

        res.json({
            success: true,
            data: {
                messages: messages,
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
// GET /api/messages/my-sent
// Messages envoyés par l'utilisateur
// ========================================
router.get('/my-sent', async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 50, offset = 0 } = req.query;

        const messages = await query(`
            SELECT 
                m.id,
                m.recipient_type,
                m.subject,
                m.body,
                m.priority,
                m.sent_at,
                m.created_at,
                cl.name as class_name,
                COUNT(mr.id) as recipient_count,
                SUM(CASE WHEN mr.is_read = TRUE THEN 1 ELSE 0 END) as read_count
            FROM messages m
            LEFT JOIN message_recipients mr ON m.id = mr.message_id
            LEFT JOIN classes cl ON m.class_id = cl.id
            WHERE m.sender_id = ?
            GROUP BY m.id
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
        `, [userId, parseInt(limit), parseInt(offset)]);

        res.json({
            success: true,
            data: {
                messages: messages,
                count: messages.length
            }
        });
    } catch (error) {
        console.error('Erreur récupération messages envoyés:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des messages'
        });
    }
});

// ========================================
// GET /api/messages/:id
// Détails d'un message
// ========================================
router.get('/:id', async (req, res) => {
    try {
        const messageId = req.params.id;
        const userId = req.user.id;

        // Vérifier que l'utilisateur est destinataire
        const recipient = await query(`
            SELECT * FROM message_recipients 
            WHERE message_id = ? AND user_id = ?
        `, [messageId, userId]);

        if (recipient.length === 0 && req.user.role !== 'directeur') {
            return res.status(403).json({
                success: false,
                error: 'Accès non autorisé'
            });
        }

        // Marquer comme lu
        if (recipient.length > 0 && !recipient[0].is_read) {
            await query(`
                UPDATE message_recipients 
                SET is_read = TRUE, read_at = NOW()
                WHERE message_id = ? AND user_id = ?
            `, [messageId, userId]);
        }

        const message = await query(`
            SELECT 
                m.*,
                u.full_name as sender_name,
                u.email as sender_email,
                cl.name as class_name
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            LEFT JOIN classes cl ON m.class_id = cl.id
            WHERE m.id = ?
        `, [messageId]);

        res.json({
            success: true,
            data: message[0]
        });
    } catch (error) {
        console.error('Erreur détails message:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération du message'
        });
    }
});

// ========================================
// POST /api/messages
// Envoyer un message
// ========================================
router.post('/', authenticateToken, upload.array('attachments', 5), [
    body('recipient_type').notEmpty().withMessage('Type de destinataire requis'),
    body('subject').notEmpty().withMessage('Sujet requis'),
    body('body').notEmpty().withMessage('Contenu requis'),
    body('class_id').optional().isInt().withMessage('ID classe invalide'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { recipient_type, subject, body, class_id, priority = 'normal' } = req.body;
        const senderId = req.user.id;
        const userRole = req.user.role;

        // Traiter les pièces jointes
        let attachments = [];
        if (req.files && req.files.length > 0) {
            attachments = req.files.map(f => ({
                name: f.originalname,
                path: f.path,
                size: f.size
            }));
        }

        // Créer le message
        const [result] = await query(`
            INSERT INTO messages 
            (sender_id, recipient_type, recipient_ids, class_id, subject, body, attachments, priority, sent_at, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
        `, [senderId, recipient_type, '[]', class_id || null, subject, body, JSON.stringify(attachments), priority, senderId]);

        const messageId = result.insertId;

        // Déterminer les destinataires
        let recipientIds = [];

        if (recipient_type === 'all_parents') {
            // Tous les parents
            const parents = await query(`SELECT id FROM users WHERE role = 'parent' AND is_active = TRUE`);
            recipientIds = parents.map(p => p.id);
        } else if (recipient_type === 'all_teachers') {
            // Tous les enseignants
            const teachers = await query(`SELECT id FROM users WHERE role = 'enseignant' AND is_active = TRUE`);
            recipientIds = teachers.map(t => t.id);
        } else if (recipient_type === 'class_parents' && class_id) {
            // Parents d'une classe spécifique
            const parents = await query(`
                SELECT DISTINCT s.parent_user_id 
                FROM students s 
                WHERE s.class_id = ? AND s.parent_user_id IS NOT NULL
            `, [class_id]);
            recipientIds = parents.map(p => p.parent_user_id);
        } else if (recipient_type === 'specific' && req.body.recipient_ids) {
            // Destinataires spécifiques
            recipientIds = JSON.parse(req.body.recipient_ids);
        }

        // Créer les entrées dans message_recipients
        if (recipientIds.length > 0) {
            const recipientValues = recipientIds.map(id => `(${messageId}, ${id})`).join(',');
            await query(`
                INSERT INTO message_recipients (message_id, user_id) VALUES ${recipientValues}
            `);
        }

        // Créer des notifications pour les destinataires
        if (recipientIds.length > 0) {
            const notificationValues = recipientIds.map(id => `(${id}, 'message', ?, ?, ?, 'normal')`).join(',');
            await query(`
                INSERT INTO notifications (user_id, type, title, body, data) VALUES ${notificationValues}
            `, ['Nouveau message', subject, JSON.stringify({ message_id: messageId })]);
        }

        res.status(201).json({
            success: true,
            message: 'Message envoyé avec succès',
            data: {
                id: messageId,
                recipient_count: recipientIds.length
            }
        });
    } catch (error) {
        console.error('Erreur envoi message:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'envoi du message: ' + error.message
        });
    }
});

// ========================================
// PUT /api/messages/:id/read
// Marquer un message comme lu
// ========================================
router.put('/:id/read', authenticateToken, async (req, res) => {
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
// PUT /api/messages/read-all
// Marquer tous les messages comme lus
// ========================================
router.put('/read-all', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        await query(`
            UPDATE message_recipients 
            SET is_read = TRUE, read_at = NOW()
            WHERE user_id = ? AND is_read = FALSE
        `, [userId]);

        res.json({
            success: true,
            message: 'Tous les messages marqués comme lus'
        });
    } catch (error) {
        console.error('Erreur marque tout comme lu:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la mise à jour'
        });
    }
});

// ========================================
// DELETE /api/messages/:id
// Supprimer un message
// ========================================
router.delete('/:id', authorizeRoles('directeur'), async (req, res) => {
    try {
        const messageId = req.params.id;

        // Récupérer les fichiers attachés
        const message = await query(`SELECT attachments FROM messages WHERE id = ?`, [messageId]);

        if (message && message.length > 0) {
            const attachments = JSON.parse(message[0].attachments || '[]');

            // Supprimer les fichiers physiques
            for (const attachment of attachments) {
                if (attachment.path && fs.existsSync(attachment.path)) {
                    fs.unlinkSync(attachment.path);
                }
            }
        }

        await query(`DELETE FROM messages WHERE id = ?`, [messageId]);

        res.json({
            success: true,
            message: 'Message supprimé avec succès'
        });
    } catch (error) {
        console.error('Erreur suppression message:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la suppression'
        });
    }
});

module.exports = router;
