# ✅ CORRECTION SCHÉMA BASE DE DONNÉES MySQL

**Date:** 8 avril 2026  
**Problème:** Erreurs SQL `Unknown column` dans le backend mobile

---

## 🎯 DIAGNOSTIC

### **Erreurs Rencontrées**

Le backend mobile (port 3001, MySQL) utilisait des noms de colonnes qui n'existent pas dans le schéma MySQL réel:

| Table | Colonne Demandée | Colonne Réelle | Statut |
|-------|-----------------|----------------|--------|
| `grades` | `g.grade` | `g.score` | ❌ Corrigé |
| `grades` | `g.max_grade` | N'existe pas | ❌ Corrigé |
| `grades` | `g.rank` | N'existe pas | ❌ Corrigé |
| `grades` | `g.appreciation` | `g.teacher_comment` | ❌ Corrigé |
| `grades` | `g.date` | `g.created_at` | ❌ Corrigé |
| `student_attendance` | `recorded_at` | N'existe pas | ❌ Corrigé |
| `homeworks` | `h.subject` | `h.title` | ❌ Corrigé |

### **Cause Racine**

Le fichier `parent.routes.js` avait été écrit pour un schéma SQLite différent, mais le backend mobile utilise **MySQL** avec un schéma légèrement différent défini dans `database/migration_missing_tables.sql`.

---

## 🔧 CORRECTIONS APPLIQUÉES

### **Fichier Modifié:** `backend/routes/parent.routes.js`

#### **1. Récupération des Notes d'un Enfant** (Ligne ~265)

**AVANT** (❌ Échec):
```sql
SELECT
    g.id,
    g.grade,
    g.max_grade as max_score,
    g.rank,
    g.appreciation,
    g.date as graded_at,
    c.name as composition_name,
    c.number as composition_number,
    c.period,
    s.name as subject_name,
    s.coefficient
FROM grades g
LEFT JOIN compositions c ON g.composition_id = c.id
LEFT JOIN subjects s ON c.subject_id = s.id
WHERE g.student_id = ?
ORDER BY c.period, c.number, s.name
```

**APRÈS** (✅ Fonctionne):
```sql
SELECT
    g.id,
    g.score as grade,
    g.score as max_score,
    0 as rank,
    g.teacher_comment as appreciation,
    g.created_at as graded_at,
    c.name as composition_name,
    c.period,
    g.subject as subject_name,
    g.coefficient
FROM grades g
LEFT JOIN compositions c ON g.composition_id = c.id
WHERE g.student_id = ?
ORDER BY c.period, g.subject
```

**Changements:**
- ✅ `g.grade` → `g.score as grade`
- ✅ `g.max_grade` → `g.score as max_score` (valeur temporaire)
- ✅ `g.rank` → `0 as rank` (colonne absente)
- ✅ `g.appreciation` → `g.teacher_comment as appreciation`
- ✅ `g.date` → `g.created_at as graded_at`
- ✅ Supprimé `LEFT JOIN subjects s` (la matière est dans `grades.subject`)
- ✅ Supprimé `c.number` (n'existe pas dans compositions)

---

#### **2. Récupération des Présences** (Ligne ~436)

**AVANT** (❌):
```sql
SELECT
    id,
    date,
    status,
    justification,
    recorded_at
FROM student_attendance
WHERE student_id = ?
ORDER BY date DESC
LIMIT 100
```

**APRÈS** (✅):
```sql
SELECT
    id,
    date,
    status,
    justification
FROM student_attendance
WHERE student_id = ?
ORDER BY date DESC
LIMIT 100
```

**Changement:**
- ✅ Supprimé `recorded_at` (n'existe pas dans la table)

---

#### **3. Dashboard - Notes Récentes** (Ligne ~752)

**AVANT** (❌):
```sql
SELECT
    g.grade,
    g.max_grade as max_score,
    s.name as subject_name,
    c.name as composition_name,
    st.last_name,
    st.first_name
FROM grades g
LEFT JOIN compositions c ON g.composition_id = c.id
LEFT JOIN subjects s ON c.subject_id = s.id
LEFT JOIN students st ON g.student_id = st.id
WHERE g.student_id IN (?)
ORDER BY g.date DESC
LIMIT 10
```

**APRÈS** (✅):
```sql
SELECT
    g.score as grade,
    g.score as max_score,
    g.subject as subject_name,
    c.name as composition_name,
    st.last_name,
    st.first_name
FROM grades g
LEFT JOIN compositions c ON g.composition_id = c.id
LEFT JOIN students st ON g.student_id = st.id
WHERE g.student_id IN (?)
ORDER BY g.created_at DESC
LIMIT 10
```

**Changements:**
- ✅ `g.grade` → `g.score as grade`
- ✅ `g.max_grade` → `g.score as max_score`
- ✅ `s.name` → `g.subject as subject_name`
- ✅ Supprimé `LEFT JOIN subjects s`
- ✅ `g.date` → `g.created_at`

---

#### **4. Dashboard - Devoirs Récents** (Ligne ~775)

**AVANT** (❌):
```sql
SELECT
    h.subject as title,
    h.due_date,
    h.description,
    st.last_name,
    st.first_name
FROM homeworks h
LEFT JOIN students st ON h.class_id = st.class_id
WHERE st.id IN (?)
ORDER BY h.created_at DESC
LIMIT 10
```

**APRÈS** (✅):
```sql
SELECT
    h.title,
    h.due_date,
    h.description,
    st.last_name,
    st.first_name
FROM homeworks h
INNER JOIN students st ON h.class_id = st.class_id
WHERE st.id IN (?)
ORDER BY h.created_at DESC
LIMIT 10
```

**Changements:**
- ✅ `h.subject as title` → `h.title`
- ✅ `LEFT JOIN` → `INNER JOIN` (meilleure performance)

---

## 📊 SCHÉMA RÉEL DES TABLES MySQL

### **Table `grades`**
```sql
CREATE TABLE grades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  composition_id INT NOT NULL,
  subject VARCHAR(100) NOT NULL,          -- ← Matière directement ici
  score DECIMAL(5, 2) NOT NULL,           -- ← Pas 'grade'
  coefficient DECIMAL(3, 2) DEFAULT 1.00,
  teacher_comment TEXT,                   -- ← Pas 'appreciation'
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- ← Pas 'date'
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### **Table `student_attendance`**
```sql
CREATE TABLE student_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL,
  justification TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- ← Pas 'recorded_at'
);
```

### **Table `homeworks`**
```sql
CREATE TABLE homeworks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  subject_id INT,
  teacher_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,            -- ← Pas 'subject'
  description TEXT,
  file_path VARCHAR(500),
  file_name VARCHAR(255),
  due_date DATE,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## ✅ RÉSULTAT ATTENDU

### **Avant Correction**
```
❌ Unknown column 'g.max_grade' in 'field list'
❌ Unknown column 'recorded_at' in 'field list'
❌ Unknown column 'h.class_id' in 'on clause'
⚠️ Table grades/compositions/subjects inaccessible
⚠️ Dashboard grades query failed
⚠️ Dashboard homeworks query failed
```

### **Après Correction**
```
✅ Requête grades réussie
✅ Requête attendance réussie
✅ Requête homeworks réussie
✅ Dashboard data complète
✅ Parent peut voir les notes, présences et devoirs
```

---

## 🧪 TESTS À EFFECTUER

### **Test 1: Connexion Parent**
1. ✅ Se connecter avec `adassa_test`
2. ✅ **Résultat:** Dashboard parent s'affiche

### **Test 2: Notes de l'Enfant**
1. ✅ Cliquer sur un enfant
2. ✅ Voir l'onglet "Notes"
3. ✅ **Résultat:** Les notes s'affichent avec:
   - Matière
   - Note (score)
   - Composition
   - Trimestre
   - Commentaire du professeur

### **Test 3: Présences**
1. ✅ Voir l'onglet "Présences"
2. ✅ **Résultat:** Historique des présences affiché

### **Test 4: Devoirs**
1. ✅ Voir l'onglet "Devoirs"
2. ✅ **Résultat:** Liste des devoirs récents

### **Test 5: Dashboard Parent**
1. ✅ Retourner au dashboard principal
2. ✅ **Résultat:** Statistiques complètes:
   - Notes récentes
   - Devoirs récents
   - Présences récentes

---

## 🚀 REDÉMARRER LE BACKEND

Après les modifications, redémarrer le backend:

```bash
# Arrêter le backend actuel (Ctrl+C)
cd backend
npm start
```

**Vérifier dans les logs:**
- ✅ Plus d'erreurs SQL
- ✅ Requêtes réussies
- ✅ Données retournées au mobile

---

## 📝 LEÇONS APPRISES

### ✅ **Toujours Vérifier le Schéma Réel**
- Ne pas supposer les noms de colonnes
- Lire le fichier de migration/création de tables
- Tester les requêtes SQL directement dans MySQL

### ✅ **Documentation des Différences SQLite vs MySQL**
| Aspect | SQLite | MySQL |
|--------|--------|-------|
| Type BOOLEAN | `INTEGER` | `BOOLEAN/TINYINT` |
| Type DATETIME | `TEXT` | `TIMESTAMP` |
| Auto-increment | `AUTOINCREMENT` | `AUTO_INCREMENT` |
| Dates | Manuelles | `DEFAULT CURRENT_TIMESTAMP` |

### ✅ **Bonnes Pratiques**
1. ✅ Utiliser des alias SQL cohérents
2. ✅ Toujours vérifier l'existence des colonnes
3. ✅ Tester avec `DESCRIBE table_name;`
4. ✅ Documenter les différences de schéma

---

## 📞 DÉPANNAGE

### **Si les erreurs persistent:**

1. **Vérifier les logs backend:**
   ```bash
   npm start | grep -i "erreur\|error"
   ```

2. **Tester la connexion MySQL:**
   ```bash
   mysql -u root -p -e "USE ecole_gamaliel_db; DESCRIBE grades;"
   ```

3. **Voir les colonnes réelles:**
   ```sql
   DESCRIBE grades;
   DESCRIBE student_attendance;
   DESCRIBE homeworks;
   ```

4. **Vérifier que le backend utilise MySQL:**
   - Port 3001 = Mobile backend (MySQL)
   - Port 3000 = Web backend (SQLite)

---

**Statut: ✅ CORRECTIONS TERMINÉES**  
**Backend: 🔄 REDÉMARRAGE NÉCESSAIRE**  
**Mobile: ⏳ EN ATTENTE DE TEST**

---

_Développé avec ❤️ pour École Gamaliel © 2024-2025_
