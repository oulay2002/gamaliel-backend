-- ========================================
-- SCHÉMA DE BASE DE DONNÉES
-- ÉCOLE GAMALIEL - Version Multi-Utilisateurs
-- ========================================

-- Créer la base de données
CREATE DATABASE IF NOT EXISTS ecole_gamaliel_db
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE ecole_gamaliel_db;

-- ========================================
-- 1. UTILISATEURS & AUTHENTIFICATION
-- ========================================

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('directeur', 'secretaire', 'comptable', 'enseignant') NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 2. CLASSES & NIVEAUX
-- ========================================

CREATE TABLE classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(20) UNIQUE NOT NULL,
    level ENUM('prescolaire', 'primaire') NOT NULL,
    fee DECIMAL(10,2) DEFAULT 0,
    canteen_fee DECIMAL(10,2) DEFAULT 0,
    transport_fee DECIMAL(10,2) DEFAULT 0,
    annexes_fee DECIMAL(10,2) DEFAULT 0,
    teacher_id INT,
    max_students INT DEFAULT 40,
    academic_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_name (name),
    INDEX idx_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 3. ÉLÈVES
-- ========================================

CREATE TABLE students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    matricule VARCHAR(30) UNIQUE NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    gender ENUM('M', 'F') NOT NULL,
    birth_date DATE NOT NULL,
    birth_place VARCHAR(100),
    nationality VARCHAR(50) DEFAULT 'Ivoirienne',
    class_id INT,
    photo_path VARCHAR(255),
    -- Informations parents
    father_name VARCHAR(100),
    father_phone VARCHAR(20),
    father_job VARCHAR(100),
    father_email VARCHAR(100),
    mother_name VARCHAR(100),
    mother_phone VARCHAR(20),
    mother_job VARCHAR(100),
    mother_email VARCHAR(100),
    guardian_name VARCHAR(100),
    guardian_phone VARCHAR(20),
    guardian_relationship VARCHAR(50),
    -- Adresse
    address TEXT,
    city VARCHAR(50),
    -- Statut
    is_active BOOLEAN DEFAULT TRUE,
    enrollment_year VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
    INDEX idx_matricule (matricule),
    INDEX idx_class (class_id),
    INDEX idx_last_name (last_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 4. ENSEIGNANTS
-- ========================================

CREATE TABLE teachers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE,
    code VARCHAR(20) UNIQUE NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    qualification VARCHAR(100),
    hire_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 5. MATIÈRES
-- ========================================

CREATE TABLE subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    category ENUM('fondamentale', 'specialisee', 'artistique', 'sport', 'autre') NOT NULL,
    coefficient_base INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 6. COEFFICIENTS PAR CLASSE ET MATIÈRE
-- ========================================

CREATE TABLE subject_coefficients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    subject_id INT NOT NULL,
    coefficient INT NOT NULL DEFAULT 1,
    academic_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    UNIQUE KEY unique_class_subject (class_id, subject_id, academic_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 7. COMPOSITIONS & NOTES
-- ========================================

CREATE TABLE compositions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    subject_id INT NOT NULL,
    composition_number INT NOT NULL,
    composition_name VARCHAR(100),
    date DATE NOT NULL,
    coefficient INT DEFAULT 1,
    max_grade DECIMAL(4,2) DEFAULT 20.00,
    academic_year VARCHAR(20) NOT NULL,
    `rank` INT DEFAULT NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_class (class_id),
    INDEX idx_subject (subject_id),
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE grades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    composition_id INT NOT NULL,
    student_id INT NOT NULL,
    grade DECIMAL(4,2),
    `rank` INT,
    is_present BOOLEAN DEFAULT TRUE,
    appreciation TEXT,
    graded_by INT,
    graded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (composition_id) REFERENCES compositions(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_composition_student (composition_id, student_id),
    INDEX idx_student (student_id),
    INDEX idx_grade (grade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 8. RELEVÉS DE NOTES (PÉRIODE)
-- ========================================

CREATE TABLE report_cards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    class_id INT NOT NULL,
    period INT NOT NULL,
    period_name VARCHAR(50),
    average DECIMAL(4,2),
    `rank` INT,
    total_students INT,
    appreciation TEXT,
    mention VARCHAR(50),
    conduct VARCHAR(20),
    work_comment TEXT,
    academic_year VARCHAR(20) NOT NULL,
    generated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_student_period (student_id, period, academic_year),
    INDEX idx_student (student_id),
    INDEX idx_class (class_id),
    INDEX idx_period (period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 9. PAIEMENTS
-- ========================================

CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    type ENUM('Scolarité', 'Cantine', 'Transport', 'Frais Annexes') NOT NULL,
    payment_mode ENUM('Especes', 'Mobile Money', 'Cheque', 'Virement', 'Carte') DEFAULT 'Especes',
    reference VARCHAR(50),
    payment_date DATE NOT NULL,
    receipt_number VARCHAR(50) UNIQUE,
    notes TEXT,
    paid_by VARCHAR(100),
    paid_by_phone VARCHAR(20),
    recorded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_student (student_id),
    INDEX idx_type (type),
    INDEX idx_date (payment_date),
    INDEX idx_receipt (receipt_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 10. PRÉSENCES ÉLÈVES
-- ========================================

CREATE TABLE student_attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    date DATE NOT NULL,
    status ENUM('present', 'absent', 'late', 'excused') NOT NULL,
    time_in TIME,
    time_out TIME,
    justification TEXT,
    recorded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_student_date (student_id, date),
    INDEX idx_student (student_id),
    INDEX idx_date (date),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 11. PRÉSENCES ENSEIGNANTS
-- ========================================

CREATE TABLE teacher_attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL,
    date DATE NOT NULL,
    status ENUM('present', 'absent', 'mission', 'conge', 'maladie') NOT NULL,
    time_in TIME,
    time_out TIME,
    reason VARCHAR(200),
    justification TEXT,
    recorded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_teacher_date (teacher_id, date),
    INDEX idx_teacher (teacher_id),
    INDEX idx_date (date),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 12. EMPLOIS DU TEMPS
-- ========================================

CREATE TABLE schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    subject_id INT NOT NULL,
    teacher_id INT,
    day_of_week ENUM('Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi') NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room VARCHAR(50),
    academic_year VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
    INDEX idx_class (class_id),
    INDEX idx_day (day_of_week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 13. DOCUMENTS
-- ========================================

CREATE TABLE documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category ENUM('administratif', 'pedagogique', 'financier', 'autre') NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_type VARCHAR(10),
    file_size INT,
    uploaded_by INT,
    is_public BOOLEAN DEFAULT FALSE,
    download_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_category (category),
    INDEX idx_uploaded_by (uploaded_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 14. PARAMÈTRES DE L'ÉCOLE
-- ========================================

CREATE TABLE school_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(50) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(20) DEFAULT 'string',
    description VARCHAR(200),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 15. JOURNAL D'AUDIT (LOGS)
-- ========================================

CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- DONNÉES INITIALES
-- ========================================

-- Utilisateur administrateur par défaut
-- Mot de passe: admin123 (à changer immédiatement !)
INSERT INTO users (username, email, password_hash, role, full_name, phone) 
VALUES (
    'admin', 
    'admin@ecole-gamaliel.ci', 
    '$2a$10$rQZ9vXJXL5K5Z5Z5Z5Z5ZeYhQGYhQGYhQGYhQGYhQGYhQGYhQGYhQ', 
    'directeur', 
    'Administrateur', 
    '0707070707'
);

-- Paramètres de l'école
INSERT INTO school_settings (setting_key, setting_value, setting_type, description) VALUES
('school_name', 'ÉCOLE GAMALIEL', 'string', 'Nom de l''école'),
('school_ministry', 'MINISTÈRE DE L''ÉDUCATION NATIONALE ET DE L''ALPHABÉTISATION', 'string', 'Ministère de tutelle'),
('school_dren', 'DREN Abidjan', 'string', 'Direction Régionale'),
('school_iep', 'IEP Cocody', 'string', 'Inspection'),
('school_address', 'Abidjan, Côte d''Ivoire', 'string', 'Adresse postale'),
('school_phone', '0707070707', 'string', 'Téléphone principal'),
('school_email', 'contact@ecole-gamaliel.ci', 'string', 'Email officiel'),
('school_year', '2025-2026', 'string', 'Année scolaire en cours'),
('logo_path', '/uploads/logo.png', 'string', 'Chemin du logo');

-- ========================================
-- VUES UTILES
-- ========================================

-- Vue: Statistiques des paiements par élève
CREATE OR REPLACE VIEW v_student_payment_summary AS
SELECT 
    s.id,
    s.matricule,
    s.last_name,
    s.first_name,
    s.class_id,
    COALESCE(SUM(CASE WHEN p.type = 'Scolarité' THEN p.amount ELSE 0 END), 0) as paid_scolarite,
    COALESCE(SUM(CASE WHEN p.type = 'Cantine' THEN p.amount ELSE 0 END), 0) as paid_cantine,
    COALESCE(SUM(CASE WHEN p.type = 'Transport' THEN p.amount ELSE 0 END), 0) as paid_transport,
    COALESCE(SUM(CASE WHEN p.type = 'Frais Annexes' THEN p.amount ELSE 0 END), 0) as paid_annexes,
    COALESCE(SUM(p.amount), 0) as total_paid
FROM students s
LEFT JOIN payments p ON s.id = p.student_id
WHERE s.is_active = TRUE
GROUP BY s.id, s.matricule, s.last_name, s.first_name, s.class_id;

-- Vue: Moyennes par élève et matière
CREATE OR REPLACE VIEW v_student_averages AS
SELECT 
    s.id as student_id,
    s.matricule,
    s.last_name,
    s.first_name,
    sub.id as subject_id,
    sub.name as subject_name,
    COUNT(g.id) as grade_count,
    AVG(g.grade) as average,
    MAX(g.grade) as max_grade,
    MIN(g.grade) as min_grade
FROM students s
JOIN grades g ON s.id = g.student_id
JOIN compositions c ON g.composition_id = c.id
JOIN subjects sub ON c.subject_id = sub.id
WHERE g.is_present = TRUE AND g.grade IS NOT NULL
GROUP BY s.id, s.matricule, s.last_name, s.first_name, sub.id, sub.name;

-- ========================================
-- TRIGGERS
-- ========================================

-- Trigger: Mettre à jour updated_at automatiquement
DELIMITER $$
CREATE TRIGGER before_update_users 
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END$$
DELIMITER ;

-- ========================================
-- INDEXES ADDITIONNELS POUR PERFORMANCE
-- ========================================

CREATE INDEX idx_payments_student_date ON payments(student_id, payment_date);
CREATE INDEX idx_attendance_student_date ON student_attendance(student_id, date);
CREATE INDEX idx_grades_composition ON grades(composition_id, grade);
CREATE INDEX idx_report_cards_student_year ON report_cards(student_id, academic_year);
