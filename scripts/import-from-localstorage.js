/**
 * SCRIPT: Importer les données depuis LocalStorage vers MySQL
 * Compatible avec le schéma MySQL réel d'École Gamaliel
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

const EXPORT_FILE = path.join(__dirname, '..', 'data-export.json');

async function importData() {
    console.log('📥 Import des données depuis LocalStorage vers MySQL...');

    if (!fs.existsSync(EXPORT_FILE)) {
        console.log(`⚠️ Fichier non trouvé: ${EXPORT_FILE}`);
        console.log('\n📋 Instructions:');
        console.log('1. Ouvrez l\'app web → Console F12');
        console.log('2. Collez: copy(localStorage.getItem("gamalielData"))');
        console.log('3. Créez backend/data-export.json et collez');
        console.log('4. Réexécutez ce script');
        return;
    }

    const rawData = fs.readFileSync(EXPORT_FILE, 'utf8');
    if (!rawData || rawData.trim() === '' || rawData.trim() === 'null') {
        console.log('❌ Fichier vide ou null!');
        return;
    }

    const data = JSON.parse(rawData);
    if (!data || typeof data !== 'object') {
        console.log('❌ Données invalides!');
        return;
    }

    console.log(`📦 Données chargées:`);
    console.log(`   - Élèves: ${data.students?.length || 0}`);
    console.log(`   - Classes: ${data.classes?.length || 0}`);
    console.log(`   - Enseignants: ${data.teachers?.length || 0}`);
    console.log(`   - Paiements: ${data.payments?.length || 0}`);
    console.log(`   - Users: ${data.users?.length || 0}`);

    let imported = { classes: 0, students: 0, teachers: 0, users: 0, payments: 0 };

    try {
        // 1. Importer les classes
        if (data.classes && data.classes.length > 0) {
            console.log('\n📚 Import des classes...');
            for (const cls of data.classes) {
                const existing = await query('SELECT id FROM classes WHERE name = ?', [cls.name]);
                if (!existing || existing.length === 0) {
                    const fee = cls.feeStructure?.scolarite || cls.fee || 0;
                    const canteen = cls.feeStructure?.canteen || cls.canteen || 0;
                    const transport = cls.feeStructure?.transport || cls.transport || 0;
                    const annexes = cls.feeStructure?.annexes || 0;

                    await query(`
                        INSERT INTO classes (name, level, fee, canteen_fee, transport_fee, annexes_fee, academic_year)
                        VALUES (?, 'primaire', ?, ?, ?, 0, '2025-2026')
                    `, [cls.name, fee, canteen, transport]);
                    imported.classes++;
                }
            }
            console.log(`   ✓ ${imported.classes} classes importées`);
        }

        // 2. Importer les enseignants
        if (data.teachers && data.teachers.length > 0) {
            console.log('\n👨‍🏫 Import des enseignants...');
            for (const teacher of data.teachers) {
                const existing = await query('SELECT id FROM teachers WHERE last_name = ? AND first_name = ?', [teacher.lastName, teacher.firstName]);
                if (!existing || existing.length === 0) {
                    const code = teacher.code || `ENS${Date.now()}`;
                    await query(`
                        INSERT INTO teachers (code, last_name, first_name, phone, email, qualification, hire_date, is_active)
                        VALUES (?, ?, ?, ?, ?, ?, CURDATE(), 1)
                    `, [code, teacher.lastName, teacher.firstName, teacher.phone || '', teacher.email || '', teacher.qualification || '']);
                    imported.teachers++;
                }
            }
            console.log(`   ✓ ${imported.teachers} enseignants importés`);
        }

        // 3. Importer les utilisateurs
        if (data.users && data.users.length > 0) {
            console.log('\n👥 Import des utilisateurs...');
            for (const user of data.users) {
                // Adapter le format: id -> username, name -> fullName
                const username = user.username || user.id;
                const fullName = user.fullName || user.full_name || user.name || username;

                if (!username || username.trim() === '') {
                    console.log(`   ⚠️ User ignoré:`, user);
                    continue;
                }

                const existing = await query('SELECT id FROM users WHERE username = ?', [username]);
                if (!existing || existing.length === 0) {
                    const password = user.password || 'password123';
                    const passwordHash = await bcrypt.hash(password, 10);

                    const validRoles = ['directeur', 'secretaire', 'comptable', 'enseignant'];
                    const role = validRoles.includes(user.role) ? user.role : 'secretaire';
                    // Générer un email unique si vide (MySQL UNIQUE constraint)
                    const email = user.email && user.email.trim() !== '' ? user.email : `${username}@gamaliel.local`;

                    await query(`
                        INSERT INTO users (username, email, password_hash, role, full_name, phone, is_active)
                        VALUES (?, ?, ?, ?, ?, ?, 1)
                    `, [username, email, passwordHash, role, fullName, user.phone || '']);

                    imported.users++;
                    console.log(`   ✓ ${username} (${role})`);
                }
            }
            console.log(`   ✓ ${imported.users} utilisateurs importés`);
        }

        // 4. Importer les élèves
        if (data.students && data.students.length > 0) {
            console.log('\n🎓 Import des élèves...');

            const classes = await query('SELECT id, name FROM classes');
            const classMap = {};
            classes.forEach(c => { classMap[c.name] = c.id; });

            for (const student of data.students) {
                const existing = await query('SELECT id FROM students WHERE matricule = ?', [student.matricule]);
                if (!existing || existing.length === 0) {
                    const classId = classMap[student.class] || null;
                    const gender = student.gender === 'Garçon' ? 'M' : (student.gender === 'Fille' ? 'F' : 'M');

                    await query(`
                        INSERT INTO students
                        (matricule, last_name, first_name, gender, birth_date, birth_place,
                         class_id, photo_path, father_name, father_phone, father_job,
                         mother_name, mother_phone, mother_job, guardian_name, guardian_phone,
                         medical_info, address, city, is_active, enrollment_year)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Abidjan', 1, '2025-2026')
                    `, [
                        student.matricule,
                        student.lastName || '',
                        student.firstName || '',
                        gender,
                        student.birthDate || '2015-01-01',
                        student.birthPlace || 'Abidjan',
                        classId,
                        student.photo || '',
                        student.fatherName || '',
                        student.fatherPhone || '',
                        student.fatherJob || '',
                        student.motherName || '',
                        student.motherPhone || '',
                        student.motherJob || '',
                        student.guardian || '',
                        student.phone || '',
                        student.medicalInfo || '',
                        student.address || ''
                    ]);

                    imported.students++;
                    console.log(`   ✓ ${student.matricule} - ${student.lastName} ${student.firstName}`);
                }
            }
            console.log(`   ✓ ${imported.students} élèves importés`);
        }

        // 5. Importer les paiements
        if (data.payments && data.payments.length > 0) {
            console.log('\n💰 Import des paiements...');
            for (const payment of data.payments) {
                const matricule = payment.studentMatricule || payment.matricule;
                if (!matricule) continue;

                const existing = await query('SELECT id FROM payments WHERE receipt_number = ?', [payment.receiptNumber]);
                if (!existing || existing.length === 0) {
                    await query(`
                        INSERT INTO payments
                        (student_id, amount, type, payment_mode, payment_date, receipt_number, notes)
                        VALUES ((SELECT id FROM students WHERE matricule = ?), ?, ?, ?, ?, ?, ?)
                    `, [
                        matricule,
                        payment.amount || 0,
                        payment.type || 'Scolarité',
                        payment.method || 'Especes',
                        payment.date || new Date().toISOString().split('T')[0],
                        payment.receiptNumber || '',
                        payment.notes || ''
                    ]);
                    imported.payments++;
                }
            }
            console.log(`   ✓ ${imported.payments} paiements importés`);
        }

        // Résumé
        console.log('\n' + '='.repeat(50));
        console.log('🎉 IMPORT TERMINÉ!');
        console.log('='.repeat(50));
        console.log(`   Classes:       ${imported.classes}`);
        console.log(`   Enseignants:   ${imported.teachers}`);
        console.log(`   Utilisateurs:  ${imported.users}`);
        console.log(`   Élèves:        ${imported.students}`);
        console.log(`   Paiements:     ${imported.payments}`);
        console.log('='.repeat(50));

    } catch (error) {
        console.error('❌ Erreur pendant l\'import:', error.message);
    }
}

if (require.main === module) {
    importData().then(() => process.exit(0));
}

module.exports = importData;
