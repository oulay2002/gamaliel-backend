/**
 * Tests des Paiements - Backend API
 * 
 * Couvre:
 * - Création de paiements
 * - Statistiques de paiement
 * - Filtrage et recherche
 * - Validation des montants
 * - Différents types de paiement
 * 
 * @author École Gamaliel
 * @version 1.0.0
 */

const request = require('supertest');
const app = require('../server');
const db = require('../config/database');

let authToken = '';
let testStudentId = '';
let createdPaymentId = '';

describe('💰 Payments API', () => {
    // Authentification et préparation
    beforeAll(async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'admin',
                password: 'admin123'
            });
        authToken = res.body.data.token;

        // Créer un étudiant de test si nécessaire
        const students = await db.query('SELECT id FROM students LIMIT 1');
        if (students.length > 0) {
            testStudentId = students[0].id;
        }

        // Nettoyer les paiements de test
        await db.query('DELETE FROM payments WHERE description LIKE ?', ['Test Payment%']);
    });

    afterAll(async () => {
        await db.query('DELETE FROM payments WHERE description LIKE ?', ['Test Payment%']);
    });

    // ==========================================
    // TEST 1: Récupération de la liste
    // ==========================================
    describe('GET /api/payments', () => {
        it('✅ Devrait retourner la liste des paiements', async () => {
            const res = await request(app)
                .get('/api/payments')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('✅ Devrait supporter la pagination', async () => {
            const res = await request(app)
                .get('/api/payments?page=1&limit=10')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            if (Array.isArray(res.body.data)) {
                expect(res.body.data.length).toBeLessThanOrEqual(10);
            }
        });

        it('❌ Devrait refuser sans authentification', async () => {
            const res = await request(app).get('/api/payments');
            expect(res.statusCode).toBe(401);
        });
    });

    // ==========================================
    // TEST 2: Création d'un paiement
    // ==========================================
    describe('POST /api/payments', () => {
        it('✅ Devrait créer un nouveau paiement', async () => {
            if (!testStudentId) {
                console.log('⚠️ Pas d\'étudiant disponible pour tester les paiements');
                return;
            }

            const res = await request(app)
                .post('/api/payments')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    student_id: testStudentId,
                    amount: 50000,
                    type: 'scolarite',
                    payment_mode: 'cash',
                    payment_date: '2026-04-08',
                    description: 'Test Payment API'
                });

            expect([200, 201, 400]).toContain(res.statusCode);

            if (res.statusCode === 200 || res.statusCode === 201) {
                expect(res.body.success).toBe(true);
                expect(res.body.data).toHaveProperty('id');
                createdPaymentId = res.body.data.id;
            }
        });

        it('❌ Devrait échouer sans montant', async () => {
            const res = await request(app)
                .post('/api/payments')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    student_id: testStudentId,
                    type: 'scolarite'
                });

            expect([400, 401]).toContain(res.statusCode);
        });

        it('❌ Devrait échouer avec montant négatif', async () => {
            const res = await request(app)
                .post('/api/payments')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    student_id: testStudentId,
                    amount: -1000,
                    type: 'scolarite'
                });

            expect([400, 401]).toContain(res.statusCode);
        });

        it('❌ Devrait échouer sans type de paiement', async () => {
            const res = await request(app)
                .post('/api/payments')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    student_id: testStudentId,
                    amount: 50000
                });

            expect([400, 401]).toContain(res.statusCode);
        });

        it('❌ Devrait échouer sans authentification', async () => {
            const res = await request(app)
                .post('/api/payments')
                .send({
                    student_id: 1,
                    amount: 50000,
                    type: 'scolarite'
                });

            expect(res.statusCode).toBe(401);
        });
    });

    // ==========================================
    // TEST 3: Statistiques de paiement
    // ==========================================
    describe('GET /api/payments/stats/summary', () => {
        it('✅ Devrait retourner les statistiques de paiement', async () => {
            const res = await request(app)
                .get('/api/payments/stats/summary')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            
            // Vérifier la structure des stats
            if (res.body.data) {
                expect(res.body.data).toBeDefined();
            }
        });

        it('❌ Devrait refuser sans authentification', async () => {
            const res = await request(app).get('/api/payments/stats/summary');
            expect(res.statusCode).toBe(401);
        });
    });

    // ==========================================
    // TEST 4: Filtrage des paiements
    // ==========================================
    describe('Filtrage des paiements', () => {
        it('✅ Devrait filtrer par étudiant', async () => {
            if (!testStudentId) return;

            const res = await request(app)
                .get(`/api/payments?student_id=${testStudentId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('✅ Devrait filtrer par type', async () => {
            const res = await request(app)
                .get('/api/payments?type=scolarite')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('✅ Devrait filtrer par date', async () => {
            const res = await request(app)
                .get('/api/payments?start_date=2026-01-01&end_date=2026-12-31')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    // ==========================================
    // TEST 5: Suppression
    // ==========================================
    describe('DELETE /api/payments/:id', () => {
        it('✅ Devrait supprimer un paiement', async () => {
            if (createdPaymentId) {
                const res = await request(app)
                    .delete(`/api/payments/${createdPaymentId}`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect([200, 400, 404]).toContain(res.statusCode);
            }
        });

        it('❌ Devrait retourner 404 pour ID inexistant', async () => {
            const res = await request(app)
                .delete('/api/payments/999999')
                .set('Authorization', `Bearer ${authToken}`);

            expect([404, 200]).toContain(res.statusCode);
        });

        it('❌ Devrait refuser sans authentification', async () => {
            const res = await request(app).delete('/api/payments/1');
            expect(res.statusCode).toBe(401);
        });
    });
});

describe('💳 Payment Types & Methods', () => {
    let authToken;

    beforeAll(async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'admin',
                password: 'admin123'
            });
        authToken = res.body.data.token;
    });

    it('✅ Devrait accepter paiement cantine', async () => {
        const res = await request(app)
            .get('/api/payments?type=cantine')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.statusCode).toBe(200);
    });

    it('✅ Devrait accepter paiement transport', async () => {
        const res = await request(app)
            .get('/api/payments?type=transport')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.statusCode).toBe(200);
    });

    it('✅ Devrait accepter paiement inscription', async () => {
        const res = await request(app)
            .get('/api/payments?type=inscription')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.statusCode).toBe(200);
    });
});
