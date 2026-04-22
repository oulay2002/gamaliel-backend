/**
 * NOTIFICATION ROUTES - Ecole Gamaliel
 * API endpoints for push notifications
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');

// Try to load Firebase service (optional)
let sendPushNotification = null;
let subscribeToTopic = null;
let formatNotification = null;

try {
    const fb = require('../services/firebaseService');
    const tpl = require('../services/notificationTemplates');
    sendPushNotification = fb.sendPushNotification;
    subscribeToTopic = fb.subscribeToTopic;
    formatNotification = tpl.formatNotification;
    console.log('✅ Firebase notifications loaded');
} catch (e) {
    console.log('⚠️  Firebase notifications not available');
}

/**
 * POST /api/notifications/register
 * Register device token
 */
router.post('/register', authenticateToken, async function(req, res) {
    try {
        const deviceToken = req.body.deviceToken;
        const platform = req.body.platform || 'android';
        
        if (!deviceToken) {
            return res.status(400).json({ success: false, error: 'deviceToken required' });
        }

        const userId = req.user.id;
        const userRole = req.user.role;

        console.log('📱 Register device:', userId, userRole, deviceToken);

        // Subscribe to topics
        if (subscribeToTopic) {
            try {
                await subscribeToTopic([deviceToken], 'role_' + userRole);
                await subscribeToTopic([deviceToken], 'all_users');
            } catch (e) {
                console.log('Subscribe error:', e.message);
            }
        }

        res.json({
            success: true,
            message: 'Device registered',
            data: { deviceToken, platform, topics: ['role_' + userRole, 'all_users'] }
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/notifications/test
 * Send test notification
 */
router.post('/test', authenticateToken, async function(req, res) {
    try {
        const deviceToken = req.body.deviceToken;
        const title = req.body.title || 'Test';
        const body = req.body.body || 'Test notification';

        if (!deviceToken) {
            return res.status(400).json({ success: false, error: 'deviceToken required' });
        }

        if (!sendPushNotification) {
            return res.status(503).json({ 
                success: false, 
                error: 'Firebase not configured. See FIREBASE_SETUP.md' 
            });
        }

        const result = await sendPushNotification(deviceToken, { title, body }, { type: 'test' });
        res.json({ success: true, message: 'Test sent', data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * POST /api/notifications/send-template
 * Send using template
 */
router.post('/send-template', authenticateToken, async function(req, res) {
    try {
        const deviceToken = req.body.deviceToken;
        const templateKey = req.body.templateKey;
        const values = req.body.values || {};

        if (!deviceToken) {
            return res.status(400).json({ success: false, error: 'deviceToken required' });
        }
        if (!templateKey) {
            return res.status(400).json({ success: false, error: 'templateKey required' });
        }
        if (!sendPushNotification || !formatNotification) {
            return res.status(503).json({ success: false, error: 'Firebase not configured' });
        }

        const notification = formatNotification(templateKey, values);
        const result = await sendPushNotification(deviceToken, notification);
        res.json({ success: true, message: 'Notification sent', data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * GET /api/notifications/history
 * Get notification history
 */
router.get('/history', authenticateToken, async function(req, res) {
    res.json({ success: true, data: { notifications: [], total: 0 } });
});

/**
 * PUT /api/notifications/read-all
 * Mark all as read
 */
router.put('/read-all', authenticateToken, async function(req, res) {
    res.json({ success: true, message: 'All marked as read' });
});

module.exports = router;
