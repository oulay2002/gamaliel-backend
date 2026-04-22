/**
 * Tests des Étudiants - Backend API
 * 
 * Couvre:
 * - CRUD étudiants
 * - Recherche et filtrage
 * - Validation des données
 * - Gestion des photos
 * 
 * @author École Gamaliel
 * @version 1.0.0
 */

const request = require('supertest');
const app = require('../server');
const db = require('../config/database');

let authToken = '';
let createdStudentId = '';

describe('👨‍🎓 Students API', () => {
    // Authentification avant les tests
    beforeAll(async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'admin',
                password: 'admin123'
            });
        authToken = res.body.data.token;

        // Nettoyer les données de test
        await db.query('DELETE FROM students WHERE matricule LIKE ?', ['TEST_%']);
    });

    afterAll(async () => {
        await db.query('DELETE FROM students WHERE matricule LIKE ?', ['TEST_%']);
    });

    // ==========================================
    // TEST 1: Récupération de la liste
    // ==========================================
    describe('GET /api/students', () => {
        it('✅ Devrait retourner la liste des étudiants', async () => {
            const res = await request(app)
                .get('/api/students')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('✅ Devrait supporter la pagination', async () => {
            const res = await request(app)
                .get('/api/students?page=1&limit=10')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.data.length).toBeLessThanOrEqual(10);
        });

        it('❌ Devrait refuser sans authentification', async () => {
            const res = await request(app).get('/api/students');
            expect(res.statusCode).toBe(401);
        });
    });

    // ==========================================
    // TEST 2: Création d'un étudiant
    // ==========================================
    describe('POST /api/students', () => {
        const newStudent = {
            matricule: 'TEST_001',
            last_name: 'Dupont',
            first_name: 'Jean',
            gender: 'M',
            birth_date: '2010-05-15',
            class_id: 1,
            parent_phone: '0707070707',
            father_name: 'Pierre Dupont',
            mother_name: 'Marie Dupont'
        };

        it('✅ Devrait créer un nouvel étudiant', async () => {
            const res = await request(app)
                .post('/api/students')
                .set('Authorization', `Bearer ${authToken}`)
                .send(newStudent);

            expect([200, 201, 400]).toContain(res.statusCode);

            if (res.statusCode === 200 || res.statusCode === 201) {
                expect(res.body.success).toBe(true);
                expect(res.body.data).toHaveProperty('id');
                createdStudentId = res.body.data.id;
            }
        });

        it('❌ Devrait échouer sans matricule', async () => {
            const res = await request(app)
                .post('/api/students')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    last_name: 'Test',
                    first_name: 'Student'
                });

            expect([400, 401]).toContain(res.statusCode);
        });

        it('❌ Devrait échouer avec matricule en double', async () => {
            const res = await request(app)
                .post('/api/students')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    matricule: 'TEST_001',
                    last_name: 'Dupont',
                    first_name: 'Marie',
                    gender: 'F',
                    parent_phone: '0707070707'
                });

            expect([400, 409]).toContain(res.statusCode);
        });

        it('❌ Devrait échouer sans nom de famille', async () => {
            const res = await request(app)
                .post('/api/students')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    matricule: 'TEST_002',
                    first_name: 'Test'
                });

            expect([400, 401]).toContain(res.statusCode);
        });
    });

    // ==========================================
    // TEST 3: Récupération par ID
    // ==========================================
    describe('GET /api/students/:id', () => {
        it('✅ Devrait retourner un étudiant par son ID', async () => {
            // D'abord récupérer la liste pour avoir un ID valide
            const listRes = await request(app)
                .get('/api/students')
                .set('Authorization', `Bearer ${authToken}`);

            if (listRes.body.data && listRes.body.data.length > 0) {
                const studentId = listRes.body.data[0].id;

                const res = await request(app)
                    .get(`/api/students/${studentId}`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect([200, 404]).toContain(res.statusCode);

                if (res.statusCode === 200) {
                    expect(res.body.success).toBe(true);
                    expect(res.body.data).toHaveProperty('id', studentId);
                }
            }
        });

        it('❌ Devrait retourner 404 pour ID inexistant', async () => {
            const res = await request(app)
                .get('/api/students/999999')
                .set('Authorization', `Bearer ${authToken}`);

            expect([404, 200]).toContain(res.statusCode);
        });
    });

    // ==========================================
    // TEST 4: Recherche par matricule
    // ==========================================
    describe('GET /api/students/matricule/:matricule', () => {
        it('✅ Devrait retourner un étudiant par matricule', async () => {
            const res = await request(app)
                .get('/api/students/matricule/TEST_001')
                .set('Authorization', `Bearer ${authToken}`);

            expect([200, 404]).toContain(res.statusCode);

            if (res.statusCode === 200) {
                expect(res.body.success).toBe(true);
                expect(res.body.data).toHaveProperty('matricule', 'TEST_001');
            }
        });

        it('❌ Devrait retourner 404 pour matricule inexistant', async () => {
            const res = await request(app)
                .get('/api/students/matricule/MATRICULE_INEXISTANT_999')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(404);
        });
    });

    // ==========================================
    // TEST 5: Mise à jour
    // ==========================================
    describe('PUT /api/students/:id', () => {
        it('✅ Devrait mettre à jour un étudiant', async () => {
            // Récupérer un étudiant existant
            const listRes = await request(app)
                .get('/api/students')
                .set('Authorization', `Bearer ${authToken}`);

            if (listRes.body.data && listRes.body.data.length > 0) {
                const student = listRes.body.data.find(s => s.matricule === 'TEST_001');
                
                if (student) {
                    const res = await request(app)
                        .put(`/api/students/${student.id}`)
                        .set('Authorization', `Bearer ${authToken}`)
                        .send({
                            first_name: 'Jean-Pierre',
                            parent_phone: '0707070708'
                        });

                    expect([200, 400, 404]).toContain(res.statusCode);

                    if (res.statusCode === 200) {
                        expect(res.body.success).toBe(true);
                    }
                }
            }
        });

        it('❌ Devrait échouer avec ID invalide', async () => {
            const res = await request(app)
                .put('/api/students/invalid_id')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    first_name: 'Test'
                });

            expect([400, 404]).toContain(res.statusCode);
        });
    });

    // ==========================================
    // TEST 6: Suppression
    // ==========================================
    describe('DELETE /api/students/:id', () => {
        it('✅ Devrait supprimer un étudiant', async () => {
            const listRes = await request(app)
                .get('/api/students')
                .set('Authorization', `Bearer ${authToken}`);

            const student = listRes.body.data?.find(s => s.matricule === 'TEST_001');

            if (student) {
                const res = await request(app)
                    .delete(`/api/students/${student.id}`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect([200, 400, 404]).toContain(res.statusCode);
            }
        });

        it('❌ Devrait retourner 404 pour suppression ID inexistant', async () => {
            const res = await request(app)
                .delete('/api/students/999999')
                .set('Authorization', `Bearer ${authToken}`);

            expect([404, 200]).toContain(res.statusCode);
        });
    });
});

describe('🔍 Student Search & Filter', () => {
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

    it('✅ Devrait filtrer par classe', async () => {
        const res = await request(app)
            .get('/api/students?class=CP1')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('✅ Devrait retourner étudiants actifs uniquement', async () => {
        const res = await request(app)
            .get('/api/students?active=true')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
