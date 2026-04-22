const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Chemin de la base de données
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');

// Connexion à la base de données
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Erreur connexion base de données:', err.message);
    } else {
        console.log('✅ Connecté à la base de données SQLite');
        initializeDatabase();
    }
});

// Initialisation des tables
function initializeDatabase() {
    db.serialize(() => {
        // Table Utilisateurs
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('directeur', 'secretaire', 'comptable')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Table Classes
        db.run(`
            CREATE TABLE IF NOT EXISTS classes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                fee INTEGER DEFAULT 0,
                canteen INTEGER DEFAULT 0,
                transport INTEGER DEFAULT 0,
                annexes INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Table Élèves
        db.run(`
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                matricule TEXT UNIQUE NOT NULL,
                class_id INTEGER,
                gender TEXT CHECK(gender IN ('Garçon', 'Fille')),
                lastName TEXT NOT NULL,
                firstName TEXT NOT NULL,
                birthDate TEXT,
                birthPlace TEXT,
                nationality TEXT DEFAULT 'Ivoirienne',
                religion TEXT,
                photo TEXT,
                fatherName TEXT,
                fatherJob TEXT,
                fatherPhone TEXT,
                fatherEmail TEXT,
                motherName TEXT,
                motherJob TEXT,
                motherPhone TEXT,
                motherEmail TEXT,
                parentPhone TEXT NOT NULL,
                phone2 TEXT,
                email TEXT,
                address TEXT,
                city TEXT DEFAULT 'Abidjan',
                district TEXT,
                bloodType TEXT,
                medicalInfo TEXT,
                siblingCount INTEGER DEFAULT 1,
                enrollmentType TEXT DEFAULT 'Nouveau',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (class_id) REFERENCES classes(id)
            )
        `);

        // Table Enseignants
        db.run(`
            CREATE TABLE IF NOT EXISTS teachers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                class_id INTEGER,
                lastName TEXT NOT NULL,
                firstName TEXT NOT NULL,
                birthDate TEXT,
                birthPlace TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                qualification TEXT,
                specialty TEXT,
                hireDate TEXT,
                role TEXT DEFAULT 'Enseignant',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (class_id) REFERENCES classes(id)
            )
        `);

        // Table Paiements
        db.run(`
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                type TEXT CHECK(type IN ('Scolarité', 'Cantine', 'Transport', 'Frais Annexes')),
                amount INTEGER NOT NULL,
                mode TEXT CHECK(mode IN ('Espèce', 'Wave', 'Orange Money', 'Virement')),
                date TEXT NOT NULL,
                receipt_number TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students(id)
            )
        `);

        // Table Emplois du temps
        db.run(`
            CREATE TABLE IF NOT EXISTS schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                class_id INTEGER NOT NULL,
                teacher_id INTEGER,
                subject TEXT NOT NULL,
                day TEXT CHECK(day IN ('Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi')),
                timeStart TEXT NOT NULL,
                timeEnd TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (class_id) REFERENCES classes(id),
                FOREIGN KEY (teacher_id) REFERENCES teachers(id)
            )
        `);

        // Table Présences Élèves
        db.run(`
            CREATE TABLE IF NOT EXISTS student_attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                timeIn TEXT,
                status TEXT CHECK(status IN ('present', 'absent', 'late', 'excused')),
                justification TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students(id)
            )
        `);

        // Table Présences Enseignants
        db.run(`
            CREATE TABLE IF NOT EXISTS teacher_attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                teacher_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                status TEXT CHECK(status IN ('present', 'absent', 'mission', 'conge', 'maladie')),
                reason TEXT,
                justification TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (teacher_id) REFERENCES teachers(id)
            )
        `);

        // Table PV Conseils de classe
        db.run(`
            CREATE TABLE IF NOT EXISTS pv_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                class_id INTEGER NOT NULL,
                trimester TEXT NOT NULL,
                date TEXT NOT NULL,
                classComment TEXT,
                data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (class_id) REFERENCES classes(id)
            )
        `);

        // Table Documents
        db.run(`
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT,
                url TEXT,
                size INTEGER,
                uploaded_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (uploaded_by) REFERENCES users(id)
            )
        `);

        // Table Paramètres
        db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insertion des utilisateurs par défaut
        const defaultUsers = [
            { username: 'admin', password: 'admin123', name: 'Administrateur', role: 'directeur' },
            { username: 'secret', password: 'secret123', name: 'Secrétaire', role: 'secretaire' },
            { username: 'compta', password: 'compta123', name: 'Comptable', role: 'comptable' }
        ];

        defaultUsers.forEach(user => {
            const hashedPassword = bcrypt.hashSync(user.password, 10);
            db.run(
                `INSERT OR IGNORE INTO users (username, password, name, role) VALUES (?, ?, ?, ?)`,
                [user.username, hashedPassword, user.name, user.role]
            );
        });

        // Insertion des paramètres par défaut
        const defaultSettings = [
            { key: 'schoolName', value: 'ÉCOLE GAMALIEL' },
            { key: 'schoolYear', value: '2025-2026' },
            { key: 'maxStudents', value: '300' },
            { key: 'schoolAddress', value: '' },
            { key: 'schoolCity', value: 'Abidjan' },
            { key: 'schoolPhone', value: '' },
            { key: 'schoolEmail', value: '' },
            { key: 'schoolWebsite', value: '' }
        ];

        defaultSettings.forEach(setting => {
            db.run(
                `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
                [setting.key, setting.value]
            );
        });

        console.log('✅ Base de données initialisée');
    });
}

module.exports = db;
