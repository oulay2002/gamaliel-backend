const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
    constructor() {
        this.transporter = null;
        this.initialized = false;
        this.init();
    }

    init() {
        const emailService = process.env.EMAIL_SERVICE;
        const emailUser = process.env.EMAIL_USER;
        const emailPass = process.env.EMAIL_PASS;

        if (!emailService || !emailUser || !emailPass) {
            console.log('⚠️ Service email non configuré (notifications désactivées)');
            return;
        }

        try {
            this.transporter = nodemailer.createTransport({
                service: emailService,
                auth: {
                    user: emailUser,
                    pass: emailPass
                }
            });

            // Vérifier la connexion
            this.transporter.verify((error, success) => {
                if (error) {
                    console.log('❌ Erreur configuration email:', error.message);
                } else {
                    console.log('✅ Service email prêt à envoyer des notifications');
                    this.initialized = true;
                }
            });
        } catch (error) {
            console.log('❌ Erreur initialisation email:', error.message);
        }
    }

    /**
     * Envoyer un email
     */
    async sendEmail(to, subject, html, attachments = []) {
        if (!this.initialized) {
            console.log('⚠️ Email non envoyé - service non initialisé');
            return { success: false, error: 'Service email non configuré' };
        }

        try {
            const mailOptions = {
                from: `"École Gamaliel" <${process.env.EMAIL_USER}>`,
                to: Array.isArray(to) ? to.join(',') : to,
                subject: subject,
                html: html,
                attachments: attachments
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log('✅ Email envoyé:', info.messageId);
            
            return {
                success: true,
                messageId: info.messageId
            };
        } catch (error) {
            console.error('❌ Erreur envoi email:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Template: Confirmation de paiement
     */
    createPaymentTemplate(studentName, amount, type, date, receiptNumber) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 0 auto; }
                    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                    .header h1 { margin: 0; font-size: 24px; }
                    .header p { margin: 10px 0 0 0; opacity: 0.9; }
                    .content { padding: 30px; background: #f9f9f9; }
                    .info-box { background: white; padding: 20px; border-left: 4px solid #3b82f6; margin: 20px 0; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                    .info-row:last-child { border-bottom: none; }
                    .info-label { color: #666; font-weight: 600; }
                    .info-value { color: #1e3a8a; font-weight: bold; }
                    .success-box { background: #d1fae5; border: 2px solid #10b981; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center; }
                    .success-box h2 { color: #065f46; margin: 0 0 10px 0; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
                    .button { display: inline-block; padding: 12px 30px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎓 École Gamaliel</h1>
                        <p>Confirmation de Paiement</p>
                    </div>
                    <div class="content">
                        <div class="success-box">
                            <h2>✅ Paiement enregistré avec succès</h2>
                            <p>Nous avons bien reçu votre paiement</p>
                        </div>
                        
                        <p>Bonjour,</p>
                        <p>Nous vous confirmons la réception de votre paiement effectué pour :</p>
                        
                        <div class="info-box">
                            <div class="info-row">
                                <span class="info-label">Élève :</span>
                                <span class="info-value">${studentName}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Type :</span>
                                <span class="info-value">${type}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Montant :</span>
                                <span class="info-value">${amount.toLocaleString()} FCFA</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Date :</span>
                                <span class="info-value">${new Date(date).toLocaleDateString('fr-FR')}</span>
                            </div>
                            ${receiptNumber ? `
                            <div class="info-row">
                                <span class="info-label">Reçu N° :</span>
                                <span class="info-value">${receiptNumber}</span>
                            </div>
                            ` : ''}
                        </div>
                        
                        <p>Un reçu vous a été délivré. Conservez-le précieusement.</p>
                        <p style="text-align: center;">
                            <a href="#" class="button">Accéder à mon espace</a>
                        </p>
                        <p>Merci pour votre confiance.</p>
                        <p>Cordialement,<br><strong>L'équipe de l'École Gamaliel</strong></p>
                    </div>
                    <div class="footer">
                        <p>© 2024 École Gamaliel. Tous droits réservés.</p>
                        <p>Ceci est un email automatique, merci de ne pas y répondre.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Template: Notification d'absence
     */
    createAbsenceTemplate(studentName, date, status, justification) {
        const statusConfig = {
            'absent': { icon: '⚠️', color: '#ef4444', text: 'Absent(e)' },
            'late': { icon: '🕐', color: '#f59e0b', text: 'En retard' },
            'excused': { icon: '✅', color: '#10b981', text: 'Absence excusée' }
        };
        
        const config = statusConfig[status] || statusConfig['absent'];
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; }
                    .container { max-width: 600px; margin: 0 auto; }
                    .header { background: linear-gradient(135deg, #dc2626, #ef4444); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                    .alert-box { background: #fef2f2; border: 2px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 6px; }
                    .alert-icon { font-size: 48px; text-align: center; margin-bottom: 15px; }
                    .info-row { padding: 10px 0; border-bottom: 1px solid #fee2e2; }
                    .info-label { font-weight: 600; color: #991b1b; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>${config.icon} Notification d'Absence</h1>
                    </div>
                    <div class="alert-box">
                        <div class="alert-icon">${config.icon}</div>
                        <h2 style="color: #991b1b; text-align: center;">${config.text}</h2>
                        <div class="info-row">
                            <span class="info-label">Élève :</span> ${studentName}
                        </div>
                        <div class="info-row">
                            <span class="info-label">Date :</span> ${new Date(date).toLocaleDateString('fr-FR')}
                        </div>
                        ${justification ? `
                        <div class="info-row">
                            <span class="info-label">Justification :</span> ${justification}
                        </div>
                        ` : ''}
                    </div>
                    <p>Veuillez prendre les dispositions nécessaires pour rattraper les cours manqués.</p>
                    <div class="footer">
                        <p>© 2024 École Gamaliel</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Template: Rappel de paiement impayé
     */
    createReminderTemplate(studentName, amount, dueDate, daysLate) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; }
                    .container { max-width: 600px; margin: 0 auto; }
                    .header { background: linear-gradient(135deg, #f59e0b, #f97316); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                    .warning-box { background: #fffbeb; border: 2px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 6px; }
                    .amount-box { background: #fef3c7; padding: 20px; text-align: center; border-radius: 6px; margin: 20px 0; }
                    .amount { font-size: 36px; color: #92400e; font-weight: bold; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                    .button { display: inline-block; padding: 12px 30px; background: #f59e0b; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>⚠️ Rappel de Paiement</h1>
                    </div>
                    <div class="warning-box">
                        <h2 style="color: #92400e;">Cher parent,</h2>
                        <p>Nous vous rappelons qu'un paiement est en attente de régularisation.</p>
                        ${daysLate > 0 ? `<p style="color: #dc2626;"><strong>Retard : ${daysLate} jours</strong></p>` : ''}
                    </div>
                    <div class="amount-box">
                        <p style="margin: 0; color: #92400e; font-size: 14px;">Montant dû :</p>
                        <div class="amount">${amount.toLocaleString()} FCFA</div>
                        <p style="margin: 10px 0 0 0; color: #92400e;">Échéance : ${new Date(dueDate).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <p>Merci de bien vouloir régulariser votre situation dans les plus brefs délais.</p>
                    <p style="text-align: center;">
                        <a href="#" class="button">Effectuer le paiement</a>
                    </p>
                    <p>Pour toute question, n'hésitez pas à contacter l'administration.</p>
                    <div class="footer">
                        <p>© 2024 École Gamaliel</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Envoyer notification de paiement
     */
    async sendPaymentNotification(email, studentName, amount, type, date, receiptNumber) {
        const html = this.createPaymentTemplate(studentName, amount, type, date, receiptNumber);
        return await this.sendEmail(email, '✅ Confirmation de paiement - École Gamaliel', html);
    }

    /**
     * Envoyer notification d'absence
     */
    async sendAbsenceNotification(email, studentName, date, status, justification) {
        const html = this.createAbsenceTemplate(studentName, date, status, justification);
        return await this.sendEmail(email, `📢 Notification d'absence - ${new Date(date).toLocaleDateString('fr-FR')}`, html);
    }

    /**
     * Envoyer rappel de paiement
     */
    async sendPaymentReminder(email, studentName, amount, dueDate, daysLate = 0) {
        const html = this.createReminderTemplate(studentName, amount, dueDate, daysLate);
        return await this.sendEmail(email, '⚠️ Rappel de paiement - École Gamaliel', html);
    }
}

// Export singleton
module.exports = new EmailService();
