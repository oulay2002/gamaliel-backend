/**
 * SERVICE FIREBASE - NOTIFICATIONS PUSH
 * Configuration pour Firebase Cloud Messaging (FCM)
 * 
 * @version 2.0.0
 * @author École Gamaliel
 */

let admin = null;
let initialized = false;

/**
 * Initialiser Firebase Admin SDK
 * 
 * @param {string} serviceAccountPath - Chemin vers le fichier JSON de compte de service
 * @returns {boolean} - true si initialisé avec succès
 */
function initializeFirebase(serviceAccountPath) {
    if (initialized) {
        console.log('✓ Firebase déjà initialisé');
        return true;
    }

    try {
        const fs = require('fs');
        const path = require('path');

        // Vérifier si le fichier de configuration existe
        const configPath = serviceAccountPath || path.join(__dirname, 'config', 'firebase-service-account.json');

        if (!fs.existsSync(configPath)) {
            console.warn('⚠️  Fichier de configuration Firebase non trouvé:', configPath);
            console.warn('📖 Suivez FIREBASE_SETUP.md pour la configuration');
            return false;
        }

        // Charger le compte de service
        const serviceAccount = require(configPath);

        // Initialiser Firebase Admin SDK
        admin = require('firebase-admin');

        // Vérifier si déjà initialisé (peut arriver avec hot-reload)
        try {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                messaging: {
                    maxBatchSize: 500
                }
            });
            console.log('✓ Firebase Admin initialisé avec succès');
        } catch (err) {
            if (err.code === 'app/duplicate-app') {
                console.log('✓ Firebase déjà initialisé (app duplicate)');
                admin = require('firebase-admin');
            } else {
                throw err;
            }
        }

        initialized = true;
        return true;

    } catch (error) {
        console.error('❌ Erreur initialisation Firebase:', error.message);
        console.error('📖 Voir FIREBASE_SETUP.md pour l\'aide');
        return false;
    }
}

/**
 * Envoyer une notification push à un utilisateur
 * 
 * @param {string} userId - ID de l'utilisateur
 * @param {object} notification - { title, body, data }
 * @returns {Promise<object>} - Résultat de l'envoi
 */
async function sendToUser(userId, notification) {
    if (!initialized || !admin) {
        console.warn('⚠️  Firebase non initialisé, notification ignorée');
        return { success: false, error: 'Firebase not initialized' };
    }

    try {
        const db = require('../config/database');

        // Récupérer les tokens d'appareil de l'utilisateur
        const tokens = await db.query(`
            SELECT endpoint, p256dh_key, auth_key, platform
            FROM push_subscriptions
            WHERE user_id = ? AND active = 1
        `, [userId]);

        if (!tokens || tokens.length === 0) {
            console.log(`ℹ️  Aucun appareil trouvé pour l'utilisateur ${userId}`);
            return { success: true, sent: 0, message: 'No devices found' };
        }

        // Envoyer à chaque appareil
        const promises = tokens.map(async (token) => {
            try {
                // Pour les appareils Android avec FCM
                if (token.platform === 'android' && token.endpoint) {
                    const message = {
                        token: token.endpoint,
                        notification: {
                            title: notification.title,
                            body: notification.body
                        },
                        data: notification.data ? {
                            ...notification.data,
                            click_action: notification.data.page || 'DASHBOARD'
                        } : undefined
                    };

                    const response = await admin.messaging().send(message);
                    console.log('✓ Notification envoyée:', response);
                    return { success: true, messageId: response };
                }

                // Pour le web (VAPID)
                if (token.platform === 'web' && token.p256dh_key && token.auth_key) {
                    const message = {
                        token: token.endpoint,
                        notification: {
                            title: notification.title,
                            body: notification.body,
                            icon: '/icon-192.png',
                            badge: '/badge-72.png'
                        },
                        data: notification.data || {},
                        webpush: {
                            fcm_options: {
                                link: notification.data?.url || 'https://mygamaliel.com'
                            }
                        }
                    };

                    const response = await admin.messaging().send(message);
                    console.log('✓ Notification web envoyée:', response);
                    return { success: true, messageId: response };
                }

                return { success: false, error: 'Unsupported platform' };

            } catch (error) {
                console.error('❌ Erreur envoi notification:', error.message);

                // Si le token est invalide, le désactiver
                if (error.code === 'messaging/invalid-registration-token' ||
                    error.code === 'messaging/registration-token-not-registered') {
                    await db.query(`
                        UPDATE push_subscriptions SET active = 0 WHERE endpoint = ?
                    `, [token.endpoint]);
                }

                return { success: false, error: error.message };
            }
        });

        const results = await Promise.allSettled(promises);
        const sentCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

        return {
            success: sentCount > 0,
            sent: sentCount,
            total: tokens.length,
            results
        };

    } catch (error) {
        console.error('❌ Erreur sendToUser:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Envoyer une notification à plusieurs utilisateurs
 * 
 * @param {Array<string>} userIds - Liste des IDs d'utilisateurs
 * @param {object} notification - { title, body, data }
 * @returns {Promise<object>} - Résultat de l'envoi
 */
async function sendToMultipleUsers(userIds, notification) {
    if (!initialized || !admin) {
        return { success: false, error: 'Firebase not initialized' };
    }

    const results = await Promise.all(
        userIds.map(userId => sendToUser(userId, notification))
    );

    const totalSent = results.reduce((sum, r) => sum + (r.sent || 0), 0);
    const totalDevices = results.reduce((sum, r) => sum + (r.total || 0), 0);

    return {
        success: totalSent > 0,
        sent: totalSent,
        total: totalDevices,
        results
    };
}

/**
 * Envoyer une notification à TOUS les utilisateurs
 * 
 * @param {object} notification - { title, body, data }
 * @returns {Promise<object>} - Résultat de l'envoi
 */
async function sendToAll(notification) {
    if (!initialized || !admin) {
        return { success: false, error: 'Firebase not initialized' };
    }

    try {
        const db = require('../config/database');

        // Récupérer tous les utilisateurs actifs
        const users = await db.query(`
            SELECT DISTINCT user_id FROM push_subscriptions WHERE active = 1
        `);

        const userIds = users.map(u => u.user_id);

        console.log(`📤 Envoi de notification à ${userIds.length} utilisateurs...`);

        return await sendToMultipleUsers(userIds, notification);

    } catch (error) {
        console.error('❌ Erreur sendToAll:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Envoyer une notification topic (par abonnement)
 * 
 * @param {string} topic - Nom du topic (ex: 'parents', 'teachers', 'class_CP1')
 * @param {object} notification - { title, body, data }
 * @returns {Promise<object>} - Résultat de l'envoi
 */
async function sendToTopic(topic, notification) {
    if (!initialized || !admin) {
        return { success: false, error: 'Firebase not initialized' };
    }

    try {
        const message = {
            topic: topic,
            notification: {
                title: notification.title,
                body: notification.body
            },
            data: notification.data || {},
            android: {
                priority: 'high',
                notification: {
                    click_action: notification.data?.page || 'DASHBOARD'
                }
            },
            webpush: {
                fcm_options: {
                    link: notification.data?.url || 'https://mygamaliel.com'
                }
            }
        };

        const response = await admin.messaging().send(message);
        console.log('✓ Notification topic envoyée:', response);

        return {
            success: true,
            messageId: response,
            topic: topic
        };

    } catch (error) {
        console.error('❌ Erreur sendToTopic:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * S'abonner un utilisateur à un topic
 * 
 * @param {string} userId - ID de l'utilisateur
 * @param {string} topic - Nom du topic
 * @returns {Promise<object>} - Résultat
 */
async function subscribeToTopic(userId, topic) {
    if (!initialized || !admin) {
        return { success: false, error: 'Firebase not initialized' };
    }

    try {
        const db = require('../config/database');

        // Récupérer tous les tokens de l'utilisateur
        const tokens = await db.query(`
            SELECT endpoint FROM push_subscriptions
            WHERE user_id = ? AND active = 1
        `, [userId]);

        if (!tokens || tokens.length === 0) {
            return { success: false, error: 'No devices found' };
        }

        const registrationIds = tokens.map(t => t.endpoint);

        const response = await admin.messaging().subscribeToTopic(
            registrationIds,
            topic
        );

        console.log(`✓ Utilisateur ${userId} abonné au topic ${topic}`);

        return {
            success: true,
            response
        };

    } catch (error) {
        console.error('❌ Erreur subscribeToTopic:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Se désabonner d'un topic
 * 
 * @param {string} userId - ID de l'utilisateur
 * @param {string} topic - Nom du topic
 * @returns {Promise<object>} - Résultat
 */
async function unsubscribeFromTopic(userId, topic) {
    if (!initialized || !admin) {
        return { success: false, error: 'Firebase not initialized' };
    }

    try {
        const db = require('../config/database');
        const tokens = await db.query(`
            SELECT endpoint FROM push_subscriptions
            WHERE user_id = ? AND active = 1
        `, [userId]);

        if (!tokens || tokens.length === 0) {
            return { success: false, error: 'No devices found' };
        }

        const registrationIds = tokens.map(t => t.endpoint);

        const response = await admin.messaging().unsubscribeFromTopic(
            registrationIds,
            topic
        );

        console.log(`✓ Utilisateur ${userId} désabonné du topic ${topic}`);

        return {
            success: true,
            response
        };

    } catch (error) {
        console.error('❌ Erreur unsubscribeFromTopic:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Obtenir les statistiques d'envoi
 * 
 * @returns {Promise<object>} - Statistiques
 */
async function getStats() {
    if (!initialized || !admin) {
        return { initialized: false };
    }

    try {
        const db = require('../config/database');

        const stats = await db.query(`
            SELECT 
                platform,
                COUNT(*) as count,
                SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as active_count
            FROM push_subscriptions
            GROUP BY platform
        `);

        return {
            initialized: true,
            subscriptions: stats,
            total: stats.reduce((sum, s) => sum + s.count, 0),
            active: stats.reduce((sum, s) => sum + s.active_count, 0)
        };

    } catch (error) {
        console.error('❌ Erreur getStats:', error.message);
        return { initialized: true, error: error.message };
    }
}

/**
 * Envoyer une notification de nouveau devoir aux parents
 *
 * @param {object} homework - Données du devoir
 * @param {string} className - Nom de la classe
 * @param {string} teacherName - Nom de l'enseignant
 * @returns {Promise<object>} - Résultat de l'envoi
 */
async function sendHomeworkNotification(homework, className, teacherName) {
    if (!initialized || !admin) {
        console.warn('⚠️ Firebase non initialisé, notification ignorée');
        return { success: false, error: 'Firebase non initialisé' };
    }

    try {
        // Préparer la notification
        const isBookType = homework.type === 'book' || homework.book_name;
        const icon = isBookType ? '📖' : '📄';
        const typeLabel = isBookType ? 'devoir (livre)' : 'devoir (fichier)';

        const message = {
            notification: {
                title: `${icon} Nouveau devoir publié`,
                body: `${homework.subject} - ${className}\n${teacherName}`
            },
            data: {
                type: 'new_homework',
                homeworkId: String(homework.id),
                subject: homework.subject,
                className: className,
                teacherName: teacherName,
                homeworkType: homework.type || 'file',
                bookName: homework.book_name || '',
                pageNumbers: homework.page_numbers || '',
                dueDate: homework.due_date || '',
                timestamp: new Date().toISOString()
            },
            topic: `homeworks_${className}`,
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'homework_notifications',
                    defaultVibrateTimings: true
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1
                    }
                }
            }
        };

        const response = await admin.messaging().send(message);
        console.log(`📚 Notification devoir envoyée aux parents de ${className}: ${response}`);

        return { success: true, messageId: response };

    } catch (error) {
        console.error('❌ Erreur sendHomeworkNotification:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Envoyer une notification de nouveau devoir aux parents via tokens
 *
 * @param {Array<string>} tokens - Tokens FCM des parents
 * @param {object} homework - Données du devoir
 * @param {string} className - Nom de la classe
 * @param {string} teacherName - Nom de l'enseignant
 * @returns {Promise<object>} - Résultat de l'envoi
 */
async function sendHomeworkNotificationToTokens(tokens, homework, className, teacherName) {
    if (!initialized || !admin) {
        console.warn('⚠️ Firebase non initialisé, notification ignorée');
        return { success: false, error: 'Firebase non initialisé' };
    }

    if (!tokens || tokens.length === 0) {
        console.log('⚠️ Aucun token parent pour notification devoir');
        return { success: false, error: 'Aucun token' };
    }

    try {
        const isBookType = homework.type === 'book' || homework.book_name;
        const icon = isBookType ? '📖' : '📄';

        const messages = tokens.map(token => ({
            token: token,
            notification: {
                title: `${icon} Nouveau devoir publié`,
                body: `${homework.subject} - ${className}`
            },
            data: {
                type: 'new_homework',
                homeworkId: String(homework.id),
                subject: homework.subject,
                className: className,
                teacherName: teacherName,
                homeworkType: homework.type || 'file',
                bookName: homework.book_name || '',
                pageNumbers: homework.page_numbers || '',
                dueDate: homework.due_date || '',
                timestamp: new Date().toISOString()
            },
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'homework_notifications',
                    defaultVibrateTimings: true
                }
            }
        }));

        const response = await admin.messaging().sendEachForMulticast({
            messages: messages
        });

        console.log(`📚 Notifications devoir envoyées: ${response.successCount}/${response.totalCount} réussies`);

        return {
            success: response.successCount > 0,
            successCount: response.successCount,
            failureCount: response.failureCount,
            total: response.totalCount
        };

    } catch (error) {
        console.error('❌ Erreur sendHomeworkNotificationToTokens:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Envoyer une notification de notes aux parents d'une classe
 *
 * @param {Array<object>} grades - Notes enregistrées [{student_id, grade, ...}]
 * @param {string} compositionName - Nom de la composition
 * @param {string} className - Nom de la classe
 * @param {string} subjectName - Nom de la matière
 * @returns {Promise<object>} - Résultat de l'envoi
 */
async function sendGradeNotificationToClass(grades, compositionName, className, subjectName) {
    if (!initialized || !admin) {
        console.warn('⚠️ Firebase non initialisé, notification ignorée');
        return { success: false, error: 'Firebase non initialisé' };
    }

    try {
        // Récupérer les tokens FCM des parents de cette classe
        const { query } = require('../config/database');

        // Trouver les IDs des étudiants concernés
        const studentIds = grades.map(g => g.student_id).filter(Boolean);
        if (studentIds.length === 0) {
            return { success: false, error: 'Aucun student_id' };
        }

        // Trouver les parents de ces étudiants
        const parentDevices = await query(`
            SELECT DISTINCT pd.fcm_token
            FROM parent_devices pd
            JOIN students s ON pd.parent_user_id = s.parent_user_id
            WHERE s.id IN (?) AND pd.fcm_token IS NOT NULL
        `, [studentIds]);

        const tokens = parentDevices.map(d => d.fcm_token).filter(Boolean);

        if (tokens.length === 0) {
            console.log('⚠️ Aucun token FCM trouvé pour les parents de cette classe');
            return { success: false, error: 'Aucun token parent trouvé' };
        }

        console.log(`📱 Envoi notification notes à ${tokens.length} parents (${className} - ${subjectName})`);

        // Préparer la notification
        const message = {
            notification: {
                title: `📊 Nouvelles notes publiées`,
                body: `${subjectName} - ${className}\n${compositionName} (${grades.length} note(s))`
            },
            data: {
                type: 'grade',
                compositionName: compositionName,
                className: className,
                subject: subjectName,
                gradeCount: String(grades.length),
                timestamp: new Date().toISOString()
            },
            tokens: tokens,
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'grade_notifications',
                    defaultVibrateTimings: true
                }
            }
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`📊 Notification notes envoyée: ${response.successCount} succès, ${response.failureCount} échecs`);

        return { success: true, successCount: response.successCount, failureCount: response.failureCount };

    } catch (error) {
        console.error('❌ Erreur sendGradeNotificationToClass:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    initializeFirebase,
    sendToUser,
    sendToMultipleUsers,
    sendToAll,
    sendToTopic,
    subscribeToTopic,
    unsubscribeFromTopic,
    sendHomeworkNotification,
    sendHomeworkNotificationToTokens,
    sendGradeNotificationToClass,
    getStats,
    isInitialized: () => initialized,
    getAdmin: () => admin
};
