-- ========================================
-- MIGRATION DE BASE DE DONNÉES
-- MyGamaliel - Parents, Enseignants, Devoirs, Notifications
-- ========================================

USE ecole_gamaliel_db;

-- ========================================
-- 1. TABLE PARENTS (Nouvelle)
-- ========================================
-- Cette table étend la table users pour les comptes parents

CREATE TABLE IF NOT EXISTS parents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    student_ids JSON, -- Liste des IDs des enfants [1, 2, 3]
    notification_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT TRUE,
    preferred_language VARCHAR(5) DEFAULT 'fr',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 2. TABLE HOMEWORKS (Devoirs - Nouvelle)
-- ========================================

CREATE TABLE IF NOT EXISTS homeworks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    subject_id INT NOT NULL,
    teacher_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    file_path VARCHAR(255), -- Chemin du fichier à télécharger
    file_name VARCHAR(100), -- Nom original du fichier
    file_size INT, -- Taille en octets
    due_date DATETIME, -- Date de remise souhaitée
    is_published BOOLEAN DEFAULT FALSE,
    published_at DATETIME,
    viewed_count INT DEFAULT 0, -- Nombre de parents ayant vu
    downloaded_count INT DEFAULT 0, -- Nombre de téléchargements
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_class (class_id),
    INDEX idx_teacher (teacher_id),
    INDEX idx_published (is_published),
    INDEX idx_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 3. TABLE MESSAGES (Nouvelle)
-- ========================================

CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    recipient_type ENUM('parent', 'teacher', 'all_parents', 'all_teachers', 'specific') NOT NULL,
    recipient_ids JSON, -- IDs des destinataires (si specific)
    class_id INT, -- Si message par classe
    subject VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    attachments JSON, -- Liste des fichiers joints [{name, path, size}]
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
    INDEX idx_class (class_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 4. TABLE MESSAGE_RECIPIENTS (Nouvelle)
-- ========================================
-- Table de liaison pour savoir qui a lu quel message

CREATE TABLE IF NOT EXISTS message_recipients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id INT NOT NULL,
    user_id INT NOT NULL, -- Destinataire
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
-- 5. TABLE NOTIFICATIONS (Nouvelle)
-- ========================================

CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('payment', 'grade', 'absence', 'homework', 'message', 'announcement', 'reminder') NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    data JSON, -- Données contextuelles {student_id, payment_id, etc.}
    icon VARCHAR(50), -- Icône à afficher
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    is_read BOOLEAN DEFAULT FALSE,
    read_at DATETIME,
    action_url VARCHAR(255), -- URL à ouvrir au clic (pour web)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_type (type),
    INDEX idx_read (is_read),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- 6. TABLE DEVICE_TOKENS (Nouvelle)
-- ========================================
-- Pour stocker les tokens FCM des appareils mobiles

CREATE TABLE IF NOT EXISTS device_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    device_token VARCHAR(255) NOT NULL,
    platform ENUM('android', 'ios', 'web') DEFAULT 'android',
    device_name VARCHAR(100), -- Nom de l'appareil
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
-- 7. MISE À JOUR TABLE STUDENTS
-- ========================================
-- Ajouter une référence directe au parent

ALTER TABLE students 
ADD COLUMN parent_user_id INT AFTER class_id,
ADD CONSTRAINT fk_student_parent 
FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- ========================================
-- 8. MISE À JOUR TABLE CLASSES
-- ========================================
-- Ajouter les co-enseignants

ALTER TABLE classes
ADD COLUMN co_teacher_ids JSON AFTER teacher_id;

-- ========================================
-- 9. MISE À JOUR TABLE TEACHERS
-- ========================================
-- Ajouter les classes assignées

ALTER TABLE teachers
ADD COLUMN class_ids JSON AFTER user_id,
ADD COLUMN subject_ids JSON AFTER class_ids;

-- ========================================
-- 10. INDEX ET OPTIMISATIONS
-- ========================================

-- Index pour les recherches fréquentes
CREATE INDEX idx_students_parent ON students(parent_user_id);
CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_homeworks_class_published ON homeworks(class_id, is_published);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);

-- ========================================
-- 11. DONNÉES DE TEST (Optionnel)
-- ========================================

-- Insérer un parent de test (à supprimer en production)
-- INSERT INTO users (username, email, password_hash, role, full_name, phone)
-- VALUES ('parent_test', 'parent@test.com', '$2a$10$...', 'parent', 'Parent Test', '0707070707');

-- ========================================
-- 12. VUES UTILES
-- ========================================

-- Vue: Liste des élèves avec leurs parents
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

-- Vue: Devoirs publiés par classe
CREATE OR REPLACE VIEW vw_published_homeworks AS
SELECT 
    h.id,
    h.class_id,
    h.subject_id,
    h.teacher_id,
    h.title,
    h.description,
    h.file_path,
    h.file_name,
    h.due_date,
    h.published_at,
    h.viewed_count,
    h.downloaded_count,
    sub.name as subject_name,
    cl.name as class_name,
    t.last_name as teacher_last_name,
    t.first_name as teacher_first_name
FROM homeworks h
LEFT JOIN subjects sub ON h.subject_id = sub.id
LEFT JOIN classes cl ON h.class_id = cl.id
LEFT JOIN teachers t ON h.teacher_id = t.id
WHERE h.is_published = TRUE
ORDER BY h.published_at DESC;

-- Vue: Notifications non lues par utilisateur
CREATE OR REPLACE VIEW vw_unread_notifications AS
SELECT 
    n.id,
    n.user_id,
    n.type,
    n.title,
    n.body,
    n.data,
    n.priority,
    n.created_at,
    u.username,
    u.full_name
FROM notifications n
LEFT JOIN users u ON n.user_id = u.id
WHERE n.is_read = FALSE
ORDER BY n.created_at DESC;

-- ========================================
-- FIN DE LA MIGRATION
-- ========================================

SELECT '✅ Migration MyGamaliel terminée avec succès!' as status;
