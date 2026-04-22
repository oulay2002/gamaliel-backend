/**
 * NOTIFICATION TEMPLATES - École Gamaliel
 * 
 * Pre-defined notification templates for common scenarios.
 * Use these templates to send consistent, well-formatted notifications.
 */

const templates = {
    // ==================== PAYMENT NOTIFICATIONS ====================
    
    payment_success: {
        title: '💰 Paiement enregistré',
        body: 'Votre paiement de {amount} FCFA a été enregistré avec succès.',
        data: { type: 'payment', status: 'success' },
    },
    
    payment_pending: {
        title: '⏳ Paiement en attente',
        body: 'Votre paiement de {amount} FCFA est en attente de validation.',
        data: { type: 'payment', status: 'pending' },
    },
    
    payment_reminder: {
        title: '💳 Rappel de paiement',
        body: 'Il reste {unpaidAmount} FCFA à payer pour {studentName}.',
        data: { type: 'payment_reminder' },
    },
    
    payment_due_soon: {
        title: '⚠️ Échéance proche',
        body: 'Paiement de {amount} FCFA dû dans {daysRemaining} jours.',
        data: { type: 'payment_due', urgency: 'medium' },
    },
    
    payment_overdue: {
        title: '🚨 Paiement en retard',
        body: 'Paiement de {amount} FCFA en retard depuis {daysOverdue} jours.',
        data: { type: 'payment_overdue', urgency: 'high' },
    },

    // ==================== ABSENCE NOTIFICATIONS ====================
    
    absence_reported: {
        title: '⚠️ Absence signalée',
        body: '{studentName} est absent(e) aujourd\'hui.',
        data: { type: 'absence', status: 'reported' },
    },
    
    absence_excused: {
        title: '✅ Absence excusée',
        body: 'L\'absence de {studentName} a été excusée.',
        data: { type: 'absence', status: 'excused' },
    },
    
    absence_unjustified: {
        title: '❌ Absence non justifiée',
        body: 'L\'absence de {studentName} n\'a pas encore été justifiée.',
        data: { type: 'absence', status: 'unjustified' },
    },
    
    late_arrival: {
        title: '🕐 Retard enregistré',
        body: '{studentName} est arrivé(e) en retard aujourd\'hui.',
        data: { type: 'late' },
    },

    // ==================== GRADE NOTIFICATIONS ====================
    
    new_grade: {
        title: '📊 Nouvelle note',
        body: 'Note de {score}/{maxScore} en {subjectName}.',
        data: { type: 'grade' },
    },
    
    composition_result: {
        title: '📝 Résultat de composition',
        body: '{studentName} a obtenu {score}/{maxScore} en {subjectName}.',
        data: { type: 'composition_result' },
    },
    
    excellent_performance: {
        title: '🌟 Excellente performance',
        body: 'Félicitations ! {studentName} a obtenu {score}/{maxScore} en {subjectName}.',
        data: { type: 'excellent_grade' },
    },
    
    needs_improvement: {
        title: '📚 Besoin d\'amélioration',
        body: '{studentName} a obtenu {score}/{maxScore} en {subjectName}. Encouragez-le à réviser.',
        data: { type: 'low_grade' },
    },

    // ==================== MESSAGE NOTIFICATIONS ====================
    
    new_message: {
        title: '📩 Nouveau message',
        body: '{senderName} vous a envoyé un message.',
        data: { type: 'message' },
    },
    
    message_from_school: {
        title: '🏫 Message de l\'école',
        body: '{senderName}: {messagePreview}',
        data: { type: 'school_message', priority: 'high' },
    },
    
    message_from_teacher: {
        title: '👨‍🏫 Message du professeur',
        body: '{senderName}: {messagePreview}',
        data: { type: 'teacher_message' },
    },

    // ==================== ANNOUNCEMENT NOTIFICATIONS ====================
    
    general_announcement: {
        title: '📢 Annonce',
        body: '{announcementTitle}',
        data: { type: 'announcement' },
    },
    
    urgent_announcement: {
        title: '🚨 Annonce importante',
        body: '{announcementTitle}',
        data: { type: 'urgent_announcement', priority: 'high' },
    },
    
    event_reminder: {
        title: '📅 Événement à venir',
        body: '{eventName} dans {daysRemaining} jours.',
        data: { type: 'event_reminder' },
    },
    
    holiday_notice: {
        title: '🎉 Jour férié',
        body: 'L\'école sera fermée le {date}.',
        data: { type: 'holiday' },
    },

    // ==================== COMPOSITION/EXAM NOTIFICATIONS ====================
    
    composition_scheduled: {
        title: '📝 Composition programmée',
        body: 'Composition de {subjectName} le {date}.',
        data: { type: 'composition_scheduled' },
    },
    
    composition_reminder: {
        title: '📚 Rappel de composition',
        body: 'Composition de {subjectName} demain.',
        data: { type: 'composition_reminder' },
    },
    
    results_published: {
        title: '📊 Résultats publiés',
        body: 'Les résultats de la composition de {subjectName} sont disponibles.',
        data: { type: 'results_published' },
    },

    // ==================== ATTENDANCE NOTIFICATIONS ====================
    
    attendance_excellent: {
        title: '🌟 Excellente assiduité',
        body: '{studentName} a une assiduité parfaite ce mois-ci !',
        data: { type: 'attendance_excellent' },
    },
    
    attendance_warning: {
        title: '⚠️ Assiduité préoccupante',
        body: '{studentName} a {absenceCount} absences ce mois-ci.',
        data: { type: 'attendance_warning' },
    },

    // ==================== GENERAL NOTIFICATIONS ====================
    
    welcome: {
        title: '👋 Bienvenue',
        body: 'Bienvenue sur l\'application École Gamaliel !',
        data: { type: 'welcome' },
    },
    
    account_created: {
        title: '✅ Compte créé',
        body: 'Votre compte École Gamaliel a été créé avec succès.',
        data: { type: 'account_created' },
    },
    
    password_reset: {
        title: '🔑 Réinitialisation du mot de passe',
        body: 'Une demande de réinitialisation a été effectuée.',
        data: { type: 'password_reset' },
    },
    
    profile_updated: {
        title: '✅ Profil mis à jour',
        body: 'Votre profil a été mis à jour avec succès.',
        data: { type: 'profile_updated' },
    },
};

/**
 * Format a notification template with actual values
 * 
 * @param {string} templateKey - Key of the template to use
 * @param {object} values - Values to replace in the template
 * @returns {object} - Formatted notification
 */
function formatNotification(templateKey, values = {}) {
    const template = templates[templateKey];
    
    if (!template) {
        console.warn(`Template "${templateKey}" not found`);
        return {
            title: 'Notification',
            body: 'Vous avez une nouvelle notification',
            data: { type: 'general' },
        };
    }

    // Replace placeholders with actual values
    let title = template.title;
    let body = template.body;

    Object.entries(values).forEach(([key, value]) => {
        const placeholder = new RegExp(`\\{${key}\\}`, 'g');
        title = title.replace(placeholder, value || '');
        body = body.replace(placeholder, value || '');
    });

    return {
        title,
        body,
        data: { ...template.data, ...values },
    };
}

/**
 * Get all available template keys
 * 
 * @returns {string[]} - Array of template keys
 */
function getAvailableTemplates() {
    return Object.keys(templates);
}

/**
 * Get a specific template
 * 
 * @param {string} key - Template key
 * @returns {object} - Template object
 */
function getTemplate(key) {
    return templates[key] || null;
}

// Export
module.exports = {
    templates,
    formatNotification,
    getAvailableTemplates,
    getTemplate,
};
