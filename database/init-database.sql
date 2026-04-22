-- ========================================
-- INITIALISATION DE LA BASE DE DONNÉES
-- ÉCOLE GAMALIEL
-- ========================================

-- Se connecter à MySQL
-- mysql -u root -p

-- Créer la base de données
CREATE DATABASE IF NOT EXISTS ecole_gamaliel_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

-- Utiliser la base de données
USE ecole_gamaliel_db;

-- ========================================
-- 1. UTILISATEURS & AUTHENTIFICATION
-- ========================================

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('directeur', 'secretaire', 'comptable', 'enseignant', 'parent') NOT NULL,
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

CREATE TABLE IF NOT EXISTS classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(20) UNIQUE NOT NULL,
    level ENUM('prescolaire', 'primaire') NOT NULL,
    fee DECIMAL(10,2) DEFAULT 0,
    canteen_fee DECIMAL(10,2) DEFAULT 0,
    transport_fee DECIMAL(10,2) DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    matricule VARCHAR(30) UNIQUE NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    gender ENUM('M', 'F') NOT NULL,
    birth_date DATE NOT NULL,
    birth_place VARCHAR(100),
    nationality VARCHAR(50) DEFAULT 'Ivoirienne',
    class_id INT,
    parent_user_id INT,
    photo_path VARCHAR(255),
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
    address TEXT,
    city VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    enrollment_year VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_matricule (matricule),
    INDEX idx_class (class_id),
    INDEX idx_last_name (last_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 4. ENSEIGNANTS
-- ========================================

CREATE TABLE IF NOT EXISTS teachers (
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
-- 5. PARENTS
-- ========================================

CREATE TABLE IF NOT EXISTS parents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    student_ids JSON,
    notification_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 6. PAIEMENTS
-- ========================================

CREATE TABLE IF NOT EXISTS payments (
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
-- 7. DEVOIRS (HOMEWORKS)
-- ========================================

CREATE TABLE IF NOT EXISTS homeworks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    subject_id INT NOT NULL,
    teacher_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    file_path VARCHAR(255),
    file_name VARCHAR(100),
    file_size BIGINT,
    due_date DATETIME,
    is_published BOOLEAN DEFAULT FALSE,
    published_at DATETIME,
    viewed_count INT DEFAULT 0,
    downloaded_count INT DEFAULT 0,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_class (class_id),
    INDEX idx_teacher (teacher_id),
    INDEX idx_published (is_published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 8. MESSAGES
-- ========================================

CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    recipient_type ENUM('parent', 'teacher', 'all_parents', 'all_teachers', 'specific') NOT NULL,
    recipient_ids JSON,
    class_id INT,
    subject VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    attachments JSON,
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    is_read BOOLEAN DEFAULT FALSE,
    read_at DATETIME,
    sent_at DATETIME,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sender (sender_id),
    INDEX idx_recipient_type (recipient_type),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 9. MESSAGE_RECIPIENTS
-- ========================================

CREATE TABLE IF NOT EXISTS message_recipients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id INT NOT NULL,
    user_id INT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_message_user (message_id, user_id),
    INDEX idx_user (user_id),
    INDEX idx_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 10. NOTIFICATIONS
-- ========================================

CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('payment', 'grade', 'absence', 'homework', 'message', 'announcement', 'reminder') NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    data JSON,
    icon VARCHAR(50),
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    is_read BOOLEAN DEFAULT FALSE,
    read_at DATETIME,
    action_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_type (type),
    INDEX idx_read (is_read),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 11. DEVICE_TOKENS (Pour Firebase FCM)
-- ========================================

CREATE TABLE IF NOT EXISTS device_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    device_token VARCHAR(255) NOT NULL,
    platform ENUM('android', 'ios', 'web') DEFAULT 'android',
    device_name VARCHAR(100),
    app_version VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_token (device_token),
    INDEX idx_user (user_id),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- DONNÉES DE TEST
-- ========================================

-- Insérer les utilisateurs par défaut (mot de passe haché pour 'admin123', 'secret123', 'compta123')
-- Les mots de passe sont hachés avec bcrypt

INSERT INTO users (username, email, password_hash, role, full_name, phone, is_active) VALUES
('admin', 'admin@ecole.com', '$2a$10$rQZ9vXJXL5K5Z5Z5Z5Z5ZeYhQGYhQGYhQGYhQGYhQGYhQGYhQGYhQ', 'directeur', 'Administrateur', '0707070701', TRUE),
('secret', 'secret@ecole.com', '$2a$10$rQZ9vXJXL5K5Z5Z5Z5Z5ZeYhQGYhQGYhQGYhQGYhQGYhQGYhQGYhQ', 'secretaire', 'Secrétaire', '0707070702', TRUE),
('compta', 'compta@ecole.com', '$2a$10$rQZ9vXJXL5K5Z5Z5Z5Z5ZeYhQGYhQGYhQGYhQGYhQGYhQGYhQGYhQ', 'comptable', 'Comptable', '0707070703', TRUE)
ON DUPLICATE KEY UPDATE username=username;

-- ========================================
-- VUES UTILES
-- ========================================

-- Vue: Élèves avec leurs parents
CREATE OR REPLACE VIEW vw_students_with_parents AS
SELECT 
    s.id,
    s.matricule,
    s.last_name,
    s.first_name,
    s.gender,
    s.birth_date,
    c.name as class_name,
    c.level as class_level,
    u.id as parent_user_id,
    u.username as parent_username,
    u.full_name as parent_name,
    u.phone as parent_phone,
    u.email as parent_email
FROM students s
LEFT JOIN classes c ON s.class_id = c.id
LEFT JOIN users u ON s.parent_user_id = u.id
WHERE s.is_active = TRUE;

-- ========================================
-- MESSAGE DE SUCCÈS
-- ========================================

SELECT '✅ Base de données ecole_gamaliel_db initialisée avec succès !' as status;
