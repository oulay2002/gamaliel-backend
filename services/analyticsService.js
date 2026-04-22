const db = require('../database');

class AnalyticsService {
    /**
     * Statistiques complètes du dashboard
     */
    async getDashboardStats() {
        const stats = {};

        try {
            // 1. Élèves par classe
            stats.studentsByClass = await this.getStudentsByClass();

            // 2. Répartition par genre
            stats.studentsByGender = await this.getStudentsByGender();

            // 3. Paiements par type
            stats.paymentsByType = await this.getPaymentsByType();

            // 4. Évolution des paiements (6 derniers mois)
            stats.paymentTrends = await this.getPaymentTrends();

            // 5. Présences aujourd'hui
            stats.todayAttendance = await this.getTodayAttendance();

            // 6. Revenus mensuels (12 derniers mois)
            stats.monthlyRevenue = await this.getMonthlyRevenue();

            // 7. Taux de recouvrement
            stats.recoveryRate = await this.getRecoveryRate();

            // 8. Top élèves (par paiements)
            stats.topStudents = await this.getTopStudents();

            // 9. Alertes (paiements en retard)
            stats.alerts = await this.getAlerts();

            return stats;
        } catch (error) {
            console.error('❌ Erreur analytics:', error);
            throw error;
        }
    }

    /**
     * Élèves par classe
     */
    async getStudentsByClass() {
        return new Promise((resolve) => {
            db.all(`
                SELECT c.name as label, COUNT(s.id) as value 
                FROM classes c 
                LEFT JOIN students s ON c.id = s.class_id 
                GROUP BY c.id 
                ORDER BY value DESC
            `, [], (err, rows) => {
                resolve(err ? [] : rows);
            });
        });
    }

    /**
     * Élèves par genre
     */
    async getStudentsByGender() {
        return new Promise((resolve) => {
            db.all(`
                SELECT gender as label, COUNT(*) as value 
                FROM students 
                GROUP BY gender
            `, [], (err, rows) => {
                resolve(err ? [] : rows);
            });
        });
    }

    /**
     * Paiements par type
     */
    async getPaymentsByType() {
        return new Promise((resolve) => {
            db.all(`
                SELECT type as label, 
                       SUM(amount) as value,
                       COUNT(*) as count
                FROM payments 
                GROUP BY type
            `, [], (err, rows) => {
                resolve(err ? [] : rows);
            });
        });
    }

    /**
     * Évolution des paiements (6 derniers mois)
     */
    async getPaymentTrends() {
        return new Promise((resolve) => {
            db.all(`
                SELECT strftime('%Y-%m', date) as month, 
                       SUM(amount) as value 
                FROM payments 
                WHERE date >= date('now', '-6 months')
                GROUP BY month
                ORDER BY month
            `, [], (err, rows) => {
                resolve(err ? [] : rows);
            });
        });
    }

    /**
     * Présences aujourd'hui
     */
    async getTodayAttendance() {
        return new Promise((resolve) => {
            db.get(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
                    SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
                    SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late,
                    SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) as excused
                FROM student_attendance 
                WHERE date = date('now')
            `, [], (err, row) => {
                resolve(err ? {} : row);
            });
        });
    }

    /**
     * Revenus mensuels (12 derniers mois)
     */
    async getMonthlyRevenue() {
        return new Promise((resolve) => {
            db.all(`
                SELECT strftime('%Y-%m', date) as month, 
                       SUM(amount) as revenue 
                FROM payments 
                GROUP BY month 
                ORDER BY month DESC 
                LIMIT 12
            `, [], (err, rows) => {
                resolve(err ? [] : rows.reverse());
            });
        });
    }

    /**
     * Taux de recouvrement
     */
    async getRecoveryRate() {
        return new Promise((resolve) => {
            db.get(`
                SELECT 
                    (SELECT SUM(amount) FROM payments WHERE type = 'Scolarité') as paid,
                    (SELECT SUM(fee) FROM classes) * (SELECT COUNT(*) FROM students) as expected
            `, [], (err, row) => {
                if (err || !row || !row.expected) {
                    resolve(0);
                    return;
                }
                const rate = Math.round((row.paid / row.expected) * 100);
                resolve(isNaN(rate) ? 0 : rate);
            });
        });
    }

    /**
     * Top élèves (par paiements)
     */
    async getTopStudents(limit = 10) {
        return new Promise((resolve) => {
            db.all(`
                SELECT s.lastName, s.firstName, s.class_id,
                       SUM(p.amount) as total_paid,
                       COUNT(p.id) as payment_count
                FROM students s
                LEFT JOIN payments p ON s.id = p.student_id
                GROUP BY s.id
                ORDER BY total_paid DESC
                LIMIT ?
            `, [limit], (err, rows) => {
                resolve(err ? [] : rows);
            });
        });
    }

    /**
     * Alertes (paiements en retard)
     */
    async getAlerts() {
        const alerts = [];

        // Paiements impayés
        const unpaidCount = await new Promise((resolve) => {
            db.get(`
                SELECT COUNT(*) as count FROM students 
                WHERE id NOT IN (
                    SELECT DISTINCT student_id FROM payments WHERE type = 'Scolarité'
                )
            `, [], (err, row) => {
                resolve(err ? 0 : row.count);
            });
        });

        if (unpaidCount > 0) {
            alerts.push({
                type: 'unpaid',
                message: `${unpaidCount} élèves ont des frais impayés`,
                severity: 'warning',
                count: unpaidCount
            });
        }

        // Absences non justifiées
        const unjustifiedAbsences = await new Promise((resolve) => {
            db.get(`
                SELECT COUNT(*) as count FROM student_attendance 
                WHERE status = 'absent' 
                AND (justification IS NULL OR justification = '')
                AND date >= date('now', '-7 days')
            `, [], (err, row) => {
                resolve(err ? 0 : row.count);
            });
        });

        if (unjustifiedAbsences > 0) {
            alerts.push({
                type: 'absences',
                message: `${unjustifiedAbsences} absences non justifiées cette semaine`,
                severity: 'info',
                count: unjustifiedAbsences
            });
        }

        return alerts;
    }

    /**
     * Exporter les statistiques (pour rapports)
     */
    async exportStats(format = 'json') {
        const stats = await this.getDashboardStats();
        
        if (format === 'json') {
            return JSON.stringify(stats, null, 2);
        }
        
        // Pour CSV ou autres formats
        return stats;
    }
}

module.exports = new AnalyticsService();
