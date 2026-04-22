const express = require('express');
const analyticsService = require('../services/analyticsService');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/analytics/dashboard
 * Récupérer toutes les stats du dashboard
 */
router.get('/dashboard', verifyToken, async (req, res) => {
    try {
        const stats = await analyticsService.getDashboardStats();
        res.json({ 
            success: true, 
            data: { stats },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Erreur analytics:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la récupération des statistiques',
            details: error.message 
        });
    }
});

/**
 * GET /api/analytics/students
 * Statistiques des élèves
 */
router.get('/students', verifyToken, async (req, res) => {
    try {
        const stats = {
            byClass: await analyticsService.getStudentsByClass(),
            byGender: await analyticsService.getStudentsByGender(),
            total: await new Promise(resolve => {
                require('../database').get('SELECT COUNT(*) as count FROM students', [], (err, row) => {
                    resolve(err ? 0 : row.count);
                });
            })
        };
        
        res.json({ success: true, data: { stats } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/analytics/payments
 * Statistiques des paiements
 */
router.get('/payments', verifyToken, async (req, res) => {
    try {
        const stats = {
            byType: await analyticsService.getPaymentsByType(),
            trends: await analyticsService.getPaymentTrends(),
            monthly: await analyticsService.getMonthlyRevenue()
        };
        
        res.json({ success: true, data: { stats } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/analytics/attendance
 * Statistiques des présences
 */
router.get('/attendance', verifyToken, async (req, res) => {
    try {
        const stats = {
            today: await analyticsService.getTodayAttendance()
        };
        
        res.json({ success: true, data: { stats } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/analytics/export
 * Exporter les statistiques
 */
router.get('/export', verifyToken, async (req, res) => {
    try {
        const { format = 'json' } = req.query;
        const data = await analyticsService.exportStats(format);
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="stats_${new Date().toISOString().split('T')[0]}.json"`);
        
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/analytics/alerts
 * Récupérer les alertes en cours
 */
router.get('/alerts', verifyToken, async (req, res) => {
    try {
        const alerts = await analyticsService.getAlerts();
        res.json({ success: true, data: { alerts } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
