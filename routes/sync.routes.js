/**
 * ROUTES DE SYNCHRONISATION MYGAMALIEL
 * Synchronisation bidirectionnelle Web ↔ Mobile
 * 
 * @version 2.0.0
 * @author École Gamaliel
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth.middleware');

// ========================================
// TABLES DE SYNCHRONISATION
// ========================================

/**
 * Initialiser les tables de synchronisation
 * Exécuter une fois au démarrage du serveur
 */
async function initSyncTables() {
    try {
        // Table des changements de synchronisation
        await query(`
            CREATE TABLE IF NOT EXISTS sync_changes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                device_id VARCHAR(255) NOT NULL,
                user_id VARCHAR(255),
                change_type VARCHAR(50) NOT NULL,
                collection VARCHAR(100) NOT NULL,
                action VARCHAR(50) NOT NULL,
                entity_id VARCHAR(255),
                data TEXT NOT NULL,
                timestamp DATETIME NOT NULL,
                synced INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Table des subscriptions push
        await query(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                device_id VARCHAR(255) NOT NULL,
                platform VARCHAR(50) NOT NULL,
                endpoint TEXT NOT NULL,
                p256dh_key VARCHAR(500),
                auth_key VARCHAR(500),
                subscription_data TEXT,
                active INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Index pour les performances (supprimer puis recréer pour MySQL)
        const tableIndexes = {
            sync_changes: [
                { name: 'idx_sync_changes_timestamp', column: 'timestamp' },
                { name: 'idx_sync_changes_device', column: 'device_id' },
                { name: 'idx_sync_changes_synced', column: 'synced' }
            ],
            push_subscriptions: [
                { name: 'idx_push_subscriptions_user', column: 'user_id' }
            ]
        };

        for (const [table, idxs] of Object.entries(tableIndexes)) {
            for (const idx of idxs) {
                try {
                    await query(`ALTER TABLE ${table} DROP INDEX ${idx.name}`);
                } catch (e) {
                    // Ignorer
                }
                try {
                    await query(`CREATE INDEX ${idx.name} ON ${table}(${idx.column})`);
                } catch (e) {
                    // Ignorer si existe déjà
                }
            }
        }

        console.log('✓ Tables de synchronisation initialisées');
    } catch (error) {
        console.error('❌ Erreur initialisation tables sync:', error.message);
    }
}

// Initialiser au chargement du module
initSyncTables();

// ========================================
// 2. PUSH - ENVOYER LES CHANGEMENTS LOCAUX
// ========================================

/**
 * POST /api/sync/push
 * Envoyer les changements locaux au serveur
 * 
 * Body:
 * {
 *   deviceId: string,
 *   changes: Array<{
 *     type: string,
 *     collection: string,
 *     action: string,
 *     data: object,
 *     timestamp: string
 *   }>,
 *   timestamp: string
 * }
 */
router.post('/push', async (req, res) => {
    const { deviceId, changes, timestamp, userId } = req.body;

    console.log(`📥 [SYNC] Push reçu - Device: ${deviceId}, Changes: ${changes?.length || 0}`);

    // Validation
    if (!deviceId || !changes || !Array.isArray(changes)) {
        return res.status(400).json({
            success: false,
            error: 'Paramètres invalides: deviceId et changes requis'
        });
    }

    try {
        const recordedChanges = [];

        for (const change of changes) {
            // Valider le changement
            if (!change.type || !change.collection || !change.action) {
                console.warn('⚠️ Changement invalide ignoré:', change);
                continue;
            }

            // Extraire l'ID de l'entité
            let entityId = null;
            if (change.data) {
                entityId = change.data.id || change.data.matricule || change.data.username || null;
            }

            // Insérer dans la table sync_changes
            const result = await query(`
                INSERT INTO sync_changes 
                (device_id, user_id, change_type, collection, action, entity_id, data, timestamp, synced)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
            `, [
                deviceId,
                userId || null,
                change.type,
                change.collection,
                change.action,
                entityId,
                JSON.stringify(change.data),
                change.timestamp || timestamp
            ]);

            recordedChanges.push({
                id: result.lastID,
                ...change
            });

            // Traiter le changement selon le type
            await processChange(change);
        }

        console.log(`✓ [SYNC] ${recordedChanges.length} changements enregistrés`);

        res.json({
            success: true,
            recorded: recordedChanges.length,
            changes: recordedChanges
        });

    } catch (error) {
        console.error('❌ [SYNC] Erreur push:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================
// 3. PULL - RÉCUPÉRER LES CHANGEMENTS DISTANTS
// ========================================

/**
 * GET /api/sync/pull
 * Récupérer les changements depuis la dernière synchronisation
 * 
 * Query:
 * - since: ISO timestamp (optionnel)
 * - deviceId: string (pour exclure ses propres changements)
 * - collections: string (optionnel, ex: "students,payments")
 */
router.get('/pull', async (req, res) => {
    const { since, deviceId, collections, userId } = req.query;

    // Par défaut, récupérer les changements des 24 dernières heures
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000);

    console.log(`📤 [SYNC] Pull demandé - Since: ${sinceDate.toISOString()}, Device: ${deviceId}`);

    try {
        let sql = `
            SELECT * FROM sync_changes
            WHERE timestamp > ?
        `;
        const params = [sinceDate.toISOString()];

        // Exclure les changements du même appareil
        if (deviceId) {
            sql += ` AND device_id != ?`;
            params.push(deviceId);
        }

        // Filtrer par collections si spécifié
        if (collections) {
            const collectionsArray = collections.split(',');
            sql += ` AND collection IN (${collectionsArray.map(() => '?').join(',')})`;
            params.push(...collectionsArray);
        }

        // Limiter à 1000 changements pour éviter les payloads trop gros
        sql += ` ORDER BY timestamp ASC LIMIT 1000`;

        const changes = await query(sql, params);

        // Parser les données JSON
        const parsedChanges = changes.map(change => ({
            id: change.id,
            device_id: change.device_id,
            user_id: change.user_id,
            type: change.change_type,
            collection: change.collection,
            action: change.action,
            entity_id: change.entity_id,
            data: JSON.parse(change.data),
            timestamp: change.timestamp
        }));

        console.log(`✓ [SYNC] ${parsedChanges.length} changements récupérés`);

        res.json({
            success: true,
            since: sinceDate.toISOString(),
            count: parsedChanges.length,
            changes: parsedChanges
        });

    } catch (error) {
        console.error('❌ [SYNC] Erreur pull:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================
// 4. STATUS - ÉTAT DE SYNCHRONISATION
// ========================================

/**
 * GET /api/sync/status
 * Obtenir l'état de synchronisation d'un appareil
 */
router.get('/status', async (req, res) => {
    const { deviceId } = req.query;

    if (!deviceId) {
        return res.status(400).json({
            success: false,
            error: 'deviceId requis'
        });
    }

    try {
        // Dernier changement sync
        const lastChange = await query(`
            SELECT MAX(timestamp) as last_timestamp, COUNT(*) as pending_count
            FROM sync_changes
            WHERE device_id = ? AND synced = 0
        `, [deviceId]);

        // Nombre total de changements
        const totalCount = await query(`
            SELECT COUNT(*) as total FROM sync_changes WHERE device_id = ?
        `, [deviceId]);

        res.json({
            success: true,
            deviceId: deviceId,
            lastSync: lastChange[0]?.last_timestamp || null,
            pendingChanges: lastChange[0]?.pending_count || 0,
            totalChanges: totalCount[0]?.total || 0
        });

    } catch (error) {
        console.error('❌ [SYNC] Erreur status:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================
// 5. PUSH SUBSCRIPTION - NOTIFICATIONS
// ========================================

/**
 * POST /api/push/subscribe
 * Enregistrer une subscription pour les notifications push
 */
router.post('/push/subscribe', async (req, res) => {
    const { userId, deviceId, platform, subscription } = req.body;

    console.log(`🔔 [PUSH] Subscription - User: ${userId}, Device: ${deviceId}, Platform: ${platform}`);

    if (!userId || !deviceId || !subscription) {
        return res.status(400).json({
            success: false,
            error: 'userId, deviceId et subscription requis'
        });
    }

    try {
        // Extraire les clés de subscription
        const endpoint = subscription.endpoint || '';
        const p256dh = subscription.keys?.p256dh || '';
        const auth = subscription.keys?.auth || '';

        // Upsert: mettre à jour ou insérer (syntaxe MySQL)
        await query(`
            INSERT INTO push_subscriptions
            (user_id, device_id, platform, endpoint, p256dh_key, auth_key, subscription_data, active, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE
                p256dh_key = VALUES(p256dh_key),
                auth_key = VALUES(auth_key),
                subscription_data = VALUES(subscription_data),
                active = 1,
                updated_at = CURRENT_TIMESTAMP
        `, [
            userId,
            deviceId,
            platform || 'web',
            endpoint,
            p256dh,
            auth,
            JSON.stringify(subscription)
        ]);

        console.log(`✓ [PUSH] Subscription enregistrée`);

        res.json({
            success: true,
            message: 'Subscription enregistrée avec succès'
        });

    } catch (error) {
        console.error('❌ [PUSH] Erreur subscription:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/push/unsubscribe
 * Se désabonner des notifications push
 */
router.post('/push/unsubscribe', async (req, res) => {
    const { endpoint, deviceId } = req.body;

    if (!endpoint && !deviceId) {
        return res.status(400).json({
            success: false,
            error: 'endpoint ou deviceId requis'
        });
    }

    try {
        if (endpoint) {
            await query(`
                UPDATE push_subscriptions 
                SET active = 0, updated_at = CURRENT_TIMESTAMP 
                WHERE endpoint = ?
            `, [endpoint]);
        }

        if (deviceId) {
            await query(`
                UPDATE push_subscriptions 
                SET active = 0, updated_at = CURRENT_TIMESTAMP 
                WHERE device_id = ?
            `, [deviceId]);
        }

        console.log(`✓ [PUSH] Désabonnement réussi`);

        res.json({
            success: true,
            message: 'Désabonnement réussi'
        });

    } catch (error) {
        console.error('❌ [PUSH] Erreur unsubscribe:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/push/subscriptions/:userId
 * Obtenir toutes les subscriptions d'un utilisateur
 */
router.get('/push/subscriptions/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const subscriptions = await query(`
            SELECT id, device_id, platform, endpoint, active, created_at
            FROM push_subscriptions
            WHERE user_id = ? AND active = 1
        `, [userId]);

        res.json({
            success: true,
            count: subscriptions.length,
            subscriptions: subscriptions
        });

    } catch (error) {
        console.error('❌ [PUSH] Erreur get subscriptions:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========================================
// 6. TRAITEMENT DES CHANGEMENTS
// ========================================

/**
 * Traiter un changement entrant
 * Met à jour les tables appropriées selon le type de changement
 */
async function processChange(change) {
    const { collection, action, data } = change;

    try {
        switch (collection) {
            case 'students':
                await processStudentChange(action, data);
                break;
            case 'payments':
                await processPaymentChange(action, data);
                break;
            case 'compositions':
            case 'grades':
                await processGradeChange(action, data);
                break;
            case 'attendance':
                await processAttendanceChange(action, data);
                break;
            case 'messages':
                await processMessageChange(action, data);
                break;
            default:
                console.log(`⚠️ Collection non traitée: ${collection}`);
        }
    } catch (error) {
        console.error(`❌ Erreur traitement ${collection}:`, error.message);
    }
}

// Traiter un changement étudiant
async function processStudentChange(action, data) {
    if (action === 'created' || action === 'updated') {
        // Upsert student (syntaxe MySQL)
        await query(`
            INSERT INTO students
            (id, matricule, last_name, first_name, gender, birth_date, class_id, parent_user_id, photo_path, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE
                last_name = VALUES(last_name),
                first_name = VALUES(first_name),
                gender = VALUES(gender),
                birth_date = VALUES(birth_date),
                class_id = VALUES(class_id),
                parent_user_id = VALUES(parent_user_id),
                photo_path = VALUES(photo_path),
                updated_at = CURRENT_TIMESTAMP
        `, [
            data.id || data.matricule,
            data.matricule,
            data.lastName || data.last_name,
            data.firstName || data.first_name,
            data.gender,
            data.birthDate || data.birth_date,
            data.classId || data.class_id,
            data.parentUserId || data.parent_user_id,
            data.photoPath || data.photo_path
        ]);
    } else if (action === 'deleted') {
        await query('DELETE FROM students WHERE matricule = ?', [data.matricule]);
    }
}

// Traiter un changement paiement
async function processPaymentChange(action, data) {
    if (action === 'created') {
        await query(`
            INSERT INTO payments
            (student_matricule, type, amount, mode, date, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            data.studentMatricule || data.student_matricule,
            data.type,
            data.amount,
            data.mode,
            data.date,
            data.description
        ]);
    } else if (action === 'deleted') {
        await query('DELETE FROM payments WHERE id = ?', [data.id]);
    }
}

// Traiter un changement note
async function processGradeChange(action, data) {
    if (action === 'created' || action === 'updated') {
        await query(`
            INSERT INTO compositions
            (id, name, class_id, subject, coefficient, duration, date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                class_id = VALUES(class_id),
                subject = VALUES(subject),
                coefficient = VALUES(coefficient),
                duration = VALUES(duration),
                date = VALUES(date),
                created_at = CURRENT_TIMESTAMP
        `, [
            data.id,
            data.name,
            data.classId || data.class_id,
            data.subject,
            data.coefficient,
            data.duration,
            data.date
        ]);
    }
}

// Traiter un changement présence
async function processAttendanceChange(action, data) {
    if (action === 'created') {
        await query(`
            INSERT INTO student_attendance
            (student_matricule, date, status, reason, recorded_by, recorded_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            data.studentMatricule || data.student_matricule,
            data.date,
            data.status,
            data.reason,
            data.recordedBy || data.recorded_by
        ]);
    }
}

// Traiter un changement message
async function processMessageChange(action, data) {
    if (action === 'created') {
        await query(`
            INSERT INTO messages
            (sender_id, receiver_id, subject, body, is_read, sent_at)
            VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
        `, [
            data.senderId || data.sender_id,
            data.receiverId || data.receiver_id,
            data.subject,
            data.body
        ]);
    }
}

// ========================================
// 7. NOTIFICATIONS PUSH
// ========================================

/**
 * POST /api/push/send
 * Envoyer une notification push à un utilisateur ou topic
 */
router.post('/push/send', async (req, res) => {
    const { userId, title, body, data, devices, tokens, notification, topic } = req.body;

    const notifTitle = title || notification?.title || 'Notification';
    const notifBody = body || notification?.body || '';
    const targetTokens = tokens || [];
    const targetTopic = topic || '';
    const pushData = data || {};

    console.log(`📤 [PUSH] Envoi notification - Title: ${notifTitle}, Topic: ${targetTopic}`);

    try {
        let sentCount = 0;
        let failedCount = 0;

        // Importer le service Firebase
        const firebaseService = require('../services/firebaseService');

        if (targetTokens.length > 0) {
            // Envoyer à des tokens spécifiques
            // Utiliser sendHomeworkNotificationToTokens comme modèle pour l'envoi direct
            const firebaseAdmin = firebaseService.getAdmin();
            if (firebaseAdmin) {
                const message = {
                    tokens: targetTokens,
                    notification: {
                        title: notifTitle,
                        body: notifBody
                    },
                    data: pushData
                };
                const response = await firebaseAdmin.messaging().sendEachForMulticast(message);
                sentCount = response.successCount || 0;
                failedCount = response.failureCount || 0;
                console.log(`✅ [PUSH] Envoyé à ${sentCount}/${targetTokens.length} tokens`);
            }
        } else if (targetTopic) {
            // Envoyer à un topic FCM
            const response = await firebaseService.sendToTopic(
                targetTopic,
                {
                    title: notifTitle,
                    body: notifBody,
                    data: pushData
                }
            );
            sentCount = response.success ? 1 : 0;
            failedCount = response.success ? 0 : 1;
            console.log(`✅ [PUSH] Topic ${targetTopic}: ${response.success ? 'OK' : 'Échec'}`);
        } else if (userId) {
            // Envoyer aux appareils de l'utilisateur
            const response = await firebaseService.sendToUser(
                userId,
                {
                    title: notifTitle,
                    body: notifBody,
                    data: pushData
                }
            );
            // sendToUser returns { success, messageId } or { success, sent: 0 }
            sentCount = response.messageId ? 1 : (response.sent || 0);
            failedCount = response.success ? 0 : 1;
            console.log(`✅ [PUSH] User ${userId}: ${sentCount} envoyé(s)`);
        }

        res.json({
            success: true,
            sent: sentCount,
            failed: failedCount,
            message: `${sentCount} notification(s) envoyée(s)`
        });

    } catch (error) {
        console.error('❌ [PUSH] Erreur send:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Erreur lors de l\'envoi des notifications'
        });
    }
});

/**
 * Envoyer une notification via Firebase Cloud Messaging
 */
async function sendFCMNotification(subscription, notification) {
    try {
        const firebaseService = require('../services/firebaseService');
        const token = subscription.token || subscription.endpoint;

        if (token) {
            await firebaseService.sendToSingle(
                token,
                notification.title,
                notification.body,
                notification.data || {}
            );
        }
    } catch (error) {
        console.error('❌ [FCM] Erreur:', error.message);
    }
}

// ========================================
// EXPORT
// ========================================
module.exports = router;
