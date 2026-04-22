-- Migration homeworks pour classes et types de devoirs
-- Exécuter dans phpMyAdmin ou CLI MySQL

USE ecole_gamaliel_db;

-- Ajouter les colonnes manquantes à la table homeworks
ALTER TABLE homeworks 
ADD COLUMN IF NOT EXISTS class_id INT NULL AFTER id,
ADD COLUMN IF NOT EXISTS teacher_id INT NULL AFTER class_id,
ADD COLUMN IF NOT EXISTS type ENUM('file', 'book') DEFAULT 'file' AFTER teacher_id,
ADD COLUMN IF NOT EXISTS book_name VARCHAR(255) NULL AFTER type,
ADD COLUMN IF NOT EXISTS page_numbers VARCHAR(50) NULL AFTER book_name,
ADD COLUMN IF NOT EXISTS instructions TEXT NULL AFTER description;

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_homeworks_class ON homeworks(class_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_teacher ON homeworks(teacher_id);

-- Mettre à jour les devoirs existants (assigner à la classe CM1 = ID 5 par défaut)
UPDATE homeworks SET class_id = 5, type = 'book' WHERE class_id IS NULL;

SELECT 'Migration homeworks terminée!' as status;
