const express = require('express');
const db = require('../database');
const { verifyToken, checkRole } = require('../middleware/auth');
const { 
    sendNotificationEmail, 
    createPaymentNotification,
    createAbsenceNotification,
    createPaymentReminderEmail 
} = require('../services/emailService');

const router = express.Router();

// GET /api/notifications/email/templates - Templates disponibles
router.get('/email/templates', verifyToken, (req, res) => {
    res.json({
        success: true,
        data: {
            templates: [
                { id: 'payment', name: 'Confirmation de paiement' },
                { id: 'absence', name: 'Notification d\'absence' },
                { id: 'reminder', name: 'Rappel de paiement' },
                { id: 'custom', name: 'Message personnalisé' }
            ]
        }
    });
});

// POST /api/notifications/email/payment - Envoyer notification de paiement
router.post('/email/payment', verifyToken, async (req, res) => {
    const { student_id, email, payment_id } = req.body;

    try {
        // Récupérer les infos du paiement et de l'élève
        const result = await new Promise((resolve, reject) => {
            db.get(`
                SELECT p.*, s.lastName, s.firstName 
                FROM payments p 
                JOIN students s ON p.student_id = s.id 
                WHERE p.id = ?
            `, [payment_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!result) {
            return res.status(404).json({ error: 'Paiement non trouvé' });
        }

        const studentName = `${result.lastName} ${result.firstName}`;
        const html = createPaymentNotification(
            studentName, 
            result.amount, 
            result.type, 
            result.date
        );

        const emailResult = await sendNotificationEmail(email, 
            'Confirmation de paiement - École Gamaliel', 
            html
        );

        if (emailResult.success) {
            res.json({ 
                success: true, 
                message: 'Email envoyé avec succès',
                messageId: emailResult.messageId 
            });
        } else {
            res.status(500).json({ error: emailResult.error });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/notifications/email/absence - Envoyer notification d'absence
router.post('/email/absence', verifyToken, async (req, res) => {
    const { student_id, email, date, status } = req.body;

    try {
        const student = await new Promise((resolve, reject) => {
            db.get('SELECT lastName, firstName FROM students WHERE id = ?', [student_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!student) {
            return res.status(404).json({ error: 'Élève non trouvé' });
        }

        const html = createAbsenceNotification(
            `${student.lastName} ${student.firstName}`,
            date,
            status
        );

        const emailResult = await sendNotificationEmail(email,
            `Notification d'absence - ${new Date(date).toLocaleDateString('fr-FR')}`,
            html
        );

        res.json({ 
            success: emailResult.success,
            messageId: emailResult.messageId 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/notifications/email/reminders - Envoyer rappels de paiements impayés
router.post('/email/reminders', verifyToken, checkRole('directeur', 'comptable'), async (req, res) => {
    const { student_ids } = req.body;

    try {
        // Récupérer les élèves avec paiements impayés
        const students = await new Promise((resolve, reject) => {
            db.all(`
                SELECT s.id, s.lastName, s.firstName, s.parentPhone, s.email,
                       SUM(p.amount) as total_due
                FROM students s
                LEFT JOIN payments p ON s.id = p.student_id
                WHERE s.id IN (${student_ids.join(',')})
                GROUP BY s.id
                HAVING total_due > 0
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        let sent = 0;
        let failed = 0;

        for (const student of students) {
            const email = student.email || student.parentPhone;
            if (!email) continue;

            const html = createPaymentReminderEmail(
                `${student.lastName} ${student.firstName}`,
                student.total_due,
                new Date().toISOString()
            );

            const result = await sendNotificationEmail(email,
                'Rappel de paiement - École Gamaliel',
                html
            );

            if (result.success) sent++;
            else failed++;
        }

        res.json({
            success: true,
            message: `Rappels envoyés`,
            data: { sent, failed }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/notifications/email/custom - Envoyer email personnalisé
router.post('/email/custom', verifyToken, async (req, res) => {
    const { to, subject, message } = req.body;

    if (!to || !subject || !message) {
        return res.status(400).json({ error: 'Champs requis manquants' });
    }

    try {
        const html = `
            <!DOCTYPE html>
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #1e3a8a;">${subject}</h2>
                    <div style="background: #f9f9f9; padding: 20px; border-radius: 6px;">
                        ${message.replace(/\n/g, '<br>')}
                    </div>
                </div>
            </body>
            </html>
        `;

        const result = await sendNotificationEmail(to, subject, html);

        res.json({
            success: result.success,
            messageId: result.messageId
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/notifications/email/history - Historique des notifications
router.get('/email/history', verifyToken, (req, res) => {
    // Pour une implémentation complète, créer une table notification_logs
    res.json({
        success: true,
        data: { logs: [] }
    });
});

module.exports = router;
