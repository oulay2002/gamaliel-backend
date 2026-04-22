-- ========================================
-- MIGRATION BDD - Tables Manquantes
-- École Gamaliel v7.2.7+
-- Date: 5 avril 2026
-- ========================================
-- Activer la base
USE ecole_gamaliel_db;
-- ========================================
-- TABLE: audit_logs (Journal d'audit)
-- ========================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NOT NULL,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
-- ========================================
-- TABLE: grades (Notes des élèves)
-- ========================================
CREATE TABLE IF NOT EXISTS grades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  composition_id INT NOT NULL,
  subject VARCHAR(100) NOT NULL,
  score DECIMAL(5, 2) NOT NULL,
  coefficient DECIMAL(3, 2) DEFAULT 1.00,
  teacher_comment TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_student (student_id),
  INDEX idx_composition (composition_id),
  INDEX idx_subject (subject),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (composition_id) REFERENCES compositions(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE
  SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
-- ========================================
-- TABLE: compositions (Examens/Compositions)
-- ========================================
CREATE TABLE IF NOT EXISTS compositions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  period VARCHAR(50) NOT NULL COMMENT 'Trimestre 1, Trimestre 2, etc.',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  is_published BOOLEAN DEFAULT FALSE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_class (class_id),
  INDEX idx_period (period),
  INDEX idx_academic_year (academic_year),
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE
  SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
-- ========================================
-- TABLE: subjects (Matières) - CORRIGÉ
-- ========================================
CREATE TABLE IF NOT EXISTS subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  code VARCHAR(20),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
-- Ajouter la colonne 'code' si elle n'existe pas
-- (Gère le cas où la table existe déjà sans cette colonne)
SET @dbname = DATABASE();
SET @tablename = 'subjects';
SET @columnname = 'code';
SET @preparedStatement = (
    SELECT IF(
        (
          SELECT COUNT(*)
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE (table_name = @tablename)
            AND (table_schema = @dbname)
            AND (column_name = @columnname)
        ) > 0,
        'SELECT 1',
        CONCAT(
          'ALTER TABLE ',
          @tablename,
          ' ADD COLUMN ',
          @columnname,
          ' VARCHAR(20) AFTER name'
        )
      )
  );
PREPARE alterIfNotExists
FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
-- Insérer les matières par défaut (ignore si déjà existantes)
INSERT IGNORE INTO subjects (name, code)
VALUES ('Mathématiques', 'MATH'),
  ('Français', 'FR'),
  ('Sciences', 'SCI'),
  ('Histoire-Géographie', 'HG'),
  ('Éducation Civique', 'EC'),
  ('Arts Plastiques', 'ART'),
  ('Musique', 'MUS'),
  ('Éducation Physique', 'EPS'),
  ('Anglais', 'ANG'),
  ('Informatique', 'INFO');
-- ========================================
-- TABLE: report_cards (Bulletins scolaires)
-- ========================================
CREATE TABLE IF NOT EXISTS report_cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  composition_id INT NOT NULL,
  overall_average DECIMAL(5, 2),
  class_rank INT,
  total_students INT,
  teacher_comments TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_student_composition (student_id, composition_id),
  INDEX idx_student (student_id),
  INDEX idx_composition (composition_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (composition_id) REFERENCES compositions(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
-- ========================================
-- TABLE: parents (Comptes parents)
-- ========================================
CREATE TABLE IF NOT EXISTS parents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  notification_preferences JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
-- Mettre à jour les préférences par défaut pour les parents existants
UPDATE parents
SET notification_preferences = '{"push": true, "email": true, "sms": false}'
WHERE notification_preferences IS NULL;
-- Ajouter la colonne parent_user_id à students si elle n'existe pas
SET @dbname = DATABASE();
SET @tablename = 'students';
SET @columnname = 'parent_user_id';
SET @preparedStatement = (
    SELECT IF(
        (
          SELECT COUNT(*)
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE (table_name = @tablename)
            AND (table_schema = @dbname)
            AND (column_name = @columnname)
        ) > 0,
        'SELECT 1',
        CONCAT(
          'ALTER TABLE ',
          @tablename,
          ' ADD COLUMN ',
          @columnname,
          ' INT NULL, ADD INDEX idx_parent_user (',
          @columnname,
          ')'
        )
      )
  );
PREPARE alterIfNotExists
FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
-- Ajouter la colonne class_id à homeworks si elle n'existe pas
SET @dbname = DATABASE();
SET @tablename = 'homeworks';
SET @columnname = 'class_id';
SET @preparedStatement = (
    SELECT IF(
        (
          SELECT COUNT(*)
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE (table_name = @tablename)
            AND (table_schema = @dbname)
            AND (column_name = @columnname)
        ) > 0,
        'SELECT 1',
        CONCAT(
          'ALTER TABLE ',
          @tablename,
          ' ADD COLUMN ',
          @columnname,
          ' INT NULL, ADD INDEX idx_class (',
          @columnname,
          ')'
        )
      )
  );
PREPARE alterIfNotExists
FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
-- Ajouter la colonne created_by à homeworks si elle n'existe pas
SET @tablename = 'homeworks';
SET @columnname = 'created_by';
SET @preparedStatement = (
    SELECT IF(
        (
          SELECT COUNT(*)
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE (table_name = @tablename)
            AND (table_schema = @dbname)
            AND (column_name = @columnname)
        ) > 0,
        'SELECT 1',
        CONCAT(
          'ALTER TABLE ',
          @tablename,
          ' ADD COLUMN ',
          @columnname,
          ' INT NULL'
        )
      )
  );
PREPARE alterIfNotExists
FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
-- ========================================
-- TABLE: homeworks (Devoirs)
-- ========================================
CREATE TABLE IF NOT EXISTS homeworks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  subject_id INT,
  teacher_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_path VARCHAR(500),
  file_name VARCHAR(255),
  due_date DATE,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_class (class_id),
  INDEX idx_subject (subject_id),
  INDEX idx_teacher (teacher_id),
  INDEX idx_due_date (due_date),
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE
  SET NULL,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
-- ========================================
-- TABLE: messages (Messagerie)
-- ========================================
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  recipient_type ENUM('parent', 'teacher', 'all', 'class') NOT NULL,
  recipient_ids JSON COMMENT 'Tableau des IDs des destinataires',
  class_id INT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  attachments JSON COMMENT 'Tableau de chemins de fichiers',
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sender (sender_id),
  INDEX idx_recipient_type (recipient_type),
  INDEX idx_class (class_id),
  INDEX idx_created (created_at),
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE
  SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
-- ========================================
-- TABLE: message_recipients (Destinataires de messages)
-- ========================================
CREATE TABLE IF NOT EXISTS message_recipients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  UNIQUE KEY uk_message_user (message_id, user_id),
  INDEX idx_user (user_id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
-- ========================================
-- TABLE: notifications (Notifications push)
-- ========================================
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL COMMENT 'payment, grade, absence, homework, message',
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSON COMMENT 'Données contextuelles',
  priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_type (type),
  INDEX idx_read (is_read),
  INDEX idx_created (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
-- ========================================
-- TABLE: device_tokens (Tokens FCM pour push notifications)
-- ========================================
CREATE TABLE IF NOT EXISTS device_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  device_token VARCHAR(500) NOT NULL,
  device_type ENUM('android', 'ios', 'web') DEFAULT 'android',
  device_name VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_token (user_id, device_token),
  INDEX idx_user (user_id),
  INDEX idx_active (is_active),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
-- ========================================
-- TABLE: sync_changes (Synchronisation Web/Mobile)
-- ========================================
CREATE TABLE IF NOT EXISTS sync_changes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(100) NOT NULL,
  user_id INT NOT NULL,
  change_type VARCHAR(50) NOT NULL COMMENT 'student, payment, grade, etc.',
  collection VARCHAR(50) NOT NULL,
  action ENUM('create', 'update', 'delete') NOT NULL,
  entity_id INT NOT NULL,
  data JSON NOT NULL,
  timestamp DATETIME NOT NULL,
  synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_device (device_id),
  INDEX idx_user (user_id),
  INDEX idx_synced (synced),
  INDEX idx_timestamp (timestamp),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
-- ========================================
-- TABLE: push_subscriptions (Abonnements Push Web)
-- ========================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  endpoint VARCHAR(500) NOT NULL UNIQUE,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
-- ========================================
-- INDEX SUPPLÉMENTAIRES POUR PERFORMANCE
-- ========================================
-- Index sur les clés étrangères manquantes
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_parent ON students(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON student_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON student_attendance(date);
CREATE INDEX IF NOT EXISTS idx_homeworks_class ON homeworks(class_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_teacher ON homeworks(teacher_id);
-- ========================================
-- VÉRIFICATION
-- ========================================
SELECT 'Migration terminée avec succès!' AS status;
SELECT COUNT(*) AS total_tables
FROM information_schema.tables
WHERE table_schema = 'ecole_gamaliel_db';