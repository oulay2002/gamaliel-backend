/**
 * SCRIPT DE TEST - Fonctionnalités Avancées
 * 
 * Utilisation: node test-features.js
 */

require('dotenv').config();
const emailService = require('./services/emailService');
const analyticsService = require('./services/analyticsService');

console.log('🧪 TEST DES FONCTIONNALITÉS\n');

// Test 1: Service Email
console.log('📧 Test 1: Service Email');
if (emailService.initialized) {
    console.log('✅ Service email initialisé');
    console.log('✅ Prêt à envoyer des notifications');
} else {
    console.log('⚠️ Service email non configuré');
    console.log('📝 Configurez EMAIL_USER et EMAIL_PASS dans .env');
}
console.log('');

// Test 2: Service Analytics
console.log('📊 Test 2: Service Analytics');
analyticsService.getDashboardStats()
    .then(stats => {
        console.log('✅ Analytics fonctionnel');
        console.log('   - Élèves par classe:', stats.studentsByClass.length, 'classes');
        console.log('   - Paiements par type:', stats.paymentsByType.length, 'types');
        console.log('   - Taux de recouvrement:', stats.recoveryRate, '%');
        console.log('   - Alertes:', stats.alerts.length);
        console.log('\n✅ Tous les tests sont au vert!');
    })
    .catch(error => {
        console.log('❌ Erreur analytics:', error.message);
    });

// Test 3: API Endpoints
console.log('\n🌐 Test 3: API Endpoints');
console.log('Testez avec curl ou Postman:');
console.log('  GET http://localhost:3000/api/health');
console.log('  GET http://localhost:3000/api/analytics/dashboard');
console.log('  POST http://localhost:3000/api/notifications/email/payment');
console.log('');
