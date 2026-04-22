# 🎓 API ÉCOLE GAMALIEL v2.0
## Backend Multi-Utilisateurs pour Système de Gestion Scolaire

---

## 📖 DESCRIPTION

API REST complète pour la gestion d'un établissement scolaire, permettant :

- ✅ **Multi-Utilisateurs** : Directeur, Secrétaire, Comptable, Enseignants
- ✅ **Multi-Appareils** : Synchronisation en temps réel
- ✅ **Sécurisée** : JWT, hachage des mots de passe, rôles et permissions
- ✅ **Évolutive** : Architecture modulaire et extensible

---

## 🚀 INSTALLATION RAPIDE

### 1. Prérequis

- Node.js 16+ : https://nodejs.org/
- MySQL 5.7+ ou MariaDB 10.3+

### 2. Installation automatique

```bash
cd backend
npm install
```

### 3. Configuration

Modifier `backend/.env` :

```env
DB_PASSWORD=votre_mot_de_passe_mysql
JWT_SECRET=votre_secret_unique_2024
```

### 4. Base de données

Exécuter `backend/database/schema.sql` dans MySQL Workbench.

### 5. Démarrage

```bash
npm run dev
```

---

## 📡 ENDPOINTS API

### Authentification

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/login` | Connexion utilisateur |
| POST | `/api/auth/logout` | Déconnexion |
| GET | `/api/auth/me` | Utilisateur actuel |
| PUT | `/api/auth/password` | Changer mot de passe |
| POST | `/api/auth/register` | Créer utilisateur (Directeur uniquement) |

### Élèves

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/students` | Liste des élèves |
| GET | `/api/students/:id` | Détails élève |
| POST | `/api/students` | Créer élève |
| PUT | `/api/students/:id` | Modifier élève |
| DELETE | `/api/students/:id` | Supprimer élève |
| GET | `/api/students/:id/payments` | Historique paiements |
| GET | `/api/students/:id/attendance` | Présences |
| GET | `/api/students/:id/grades` | Notes |

### Paiements

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/payments` | Liste paiements |
| POST | `/api/payments` | Créer paiement |
| DELETE | `/api/payments/:id` | Supprimer paiement |
| GET | `/api/payments/stats/summary` | Statistiques |

### Compositions & Notes

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/compositions` | Liste compositions |
| POST | `/api/compositions` | Créer composition |
| POST | `/api/compositions/:id/grades` | Enregistrer notes |
| DELETE | `/api/compositions/:id` | Supprimer composition |

### Présences

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/attendance/students` | Présences élèves |
| POST | `/api/attendance/students` | Marquer présence élève |
| GET | `/api/attendance/teachers` | Présences enseignants |
| POST | `/api/attendance/teachers` | Marquer présence enseignant |
| GET | `/api/attendance/stats/summary` | Statistiques |

### Classes

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/classes` | Liste des classes |
| POST | `/api/classes` | Créer classe |

### Dashboard

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/dashboard/stats` | Statistiques générales |
| GET | `/api/dashboard/chart/students` | Graphique élèves |
| GET | `/api/dashboard/chart/payments` | Graphique paiements |

### Autres

| Endpoint | Description |
|----------|-------------|
| `/api/teachers` | Enseignants |
| `/api/subjects` | Matières |
| `/api/report-cards` | Relevés de notes |
| `/api/settings` | Paramètres école |
| `/api/documents` | Documents |
| `/api/users` | Utilisateurs (Directeur uniquement) |

---

## 🔐 AUTHENTIFICATION

### Obtenir un token

```bash
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Réponse :**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@ecole-gamaliel.ci",
      "role": "directeur",
      "full_name": "Administrateur"
    }
  }
}
```

### Utiliser le token

Inclure dans l'en-tête des requêtes :

```
Authorization: Bearer VOTRE_TOKEN
```

---

## 👥 RÔLES ET PERMISSIONS

| Rôle | Permissions |
|------|-------------|
| **directeur** | Accès complet (lecture/écriture sur tout) |
| **secretaire** | Élèves, Documents, Présences |
| **comptable** | Paiements, Rapports financiers |
| **enseignant** | Notes, Présences (ses classes uniquement) |

---

## 🗄️ BASE DE DONNÉES

### Tables principales

- `users` - Utilisateurs du système
- `students` - Élèves
- `teachers` - Enseignants
- `classes` - Classes
- `subjects` - Matières
- `compositions` - Évaluations
- `grades` - Notes
- `payments` - Paiements
- `student_attendance` - Présences élèves
- `teacher_attendance` - Présences enseignants
- `report_cards` - Relevés de notes
- `school_settings` - Paramètres
- `audit_logs` - Journal d'audit

---

## 🛠️ DÉVELOPPEMENT

### Structure des dossiers

```
backend/
├── config/
│   └── database.js       # Connexion MySQL
├── middleware/
│   └── auth.middleware.js # Authentification JWT
├── routes/
│   ├── auth.routes.js     # Authentification
│   ├── student.routes.js  # Élèves
│   ├── payment.routes.js  # Paiements
│   ├── composition.routes.js # Compositions
│   ├── attendance.routes.js  # Présences
│   ├── class.routes.js    # Classes
│   ├── dashboard.routes.js # Dashboard
│   └── generic.routes.js  # Autres entités
├── database/
│   └── schema.sql         # Structure BDD
├── scripts/
│   └── install.js         # Installation auto
├── .env                   # Configuration
├── server.js              # Point d'entrée
└── package.json           # Dépendances
```

### Ajouter une nouvelle route

1. Créer `backend/routes/maRoute.routes.js`
2. Importer dans `server.js`
3. Ajouter `app.use('/api/maRoute', maRouteRoutes)`

---

## 📦 COMMANDES DISPONIBLES

```bash
# Développement (avec redémarrage automatique)
npm run dev

# Production
npm start

# Installation automatique
npm run install

# Initialiser la base de données
npm run init-db

# Données de test
npm run seed
```

---

## 🔒 SÉCURITÉ

### Bonnes pratiques

- ✅ HTTPS obligatoire en production
- ✅ JWT_SECRET unique et sécurisé
- ✅ Mots de passe hashés avec bcrypt
- ✅ Rate limiting sur l'authentification
- ✅ Validation des données avec express-validator
- ✅ Journalisation des actions (audit_logs)

---

## 🧪 TESTER L'API

### Avec cURL

```bash
# Health check
curl http://localhost:3000/api/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Récupérer les élèves (avec token)
curl http://localhost:3000/api/students \
  -H "Authorization: Bearer VOTRE_TOKEN"
```

### Avec Postman

Importer la collection : `backend/api-collection.json` (à créer)

---

## 📚 DOCUMENTATION COMPLÈTE

- `INSTALLATION.md` - Guide d'installation complet
- `QUICKSTART.md` - Démarrage rapide
- `FRONTEND-MIGRATION.md` - Intégration frontend

---

## 🆘 SUPPORT

### Problèmes courants

| Erreur | Solution |
|--------|----------|
| "Cannot connect to database" | Vérifier `.env` et MySQL |
| "Port 3000 already in use" | Changer `PORT` dans `.env` |
| "Token expired" | Se reconnecter |
| "401 Unauthorized" | Vérifier le token |

### Logs

- Serveur : Terminal où `npm run dev` tourne
- Base de données : MySQL Workbench
- Navigateur : Console (F12)

---

## 📝 LICENSE

MIT © 2025 École Gamaliel

---

**Développé avec ❤️ pour l'éducation en Côte d'Ivoire**
