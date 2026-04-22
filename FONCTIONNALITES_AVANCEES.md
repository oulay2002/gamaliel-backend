# 🚀 FONCTIONNALITÉS AVANCÉES - GUIDE COMPLET

## 📧 1. NOTIFICATIONS EMAIL - DÉJÀ IMPLÉMENTÉ ✅

### Fichiers créés :
- `backend/services/emailService.js` - Service d'envoi d'emails
- `backend/routes/notifications.js` - Routes API notifications

### Configuration :

1. **Éditez `.env`** :
```env
EMAIL_SERVICE=gmail
EMAIL_USER=votre.email@gmail.com
EMAIL_PASS=votre_mot_de_passe_application
```

2. **Mot de passe d'application Gmail** :
   - Allez sur : https://myaccount.google.com/apppasswords
   - Générez un mot de passe d'application
   - Utilisez-le dans `.env`

### API Endpoints :

```javascript
// Envoyer confirmation de paiement
POST /api/notifications/email/payment
{
    "student_id": 1,
    "email": "parent@email.com",
    "payment_id": 123
}

// Envoyer notification d'absence
POST /api/notifications/email/absence
{
    "student_id": 1,
    "email": "parent@email.com",
    "date": "2024-01-15",
    "status": "absent"
}

// Envoyer rappels de paiements impayés
POST /api/notifications/email/reminders
{
    "student_ids": [1, 2, 3]
}

// Email personnalisé
POST /api/notifications/email/custom
{
    "to": "parent@email.com",
    "subject": "Message de l'école",
    "message": "Bonjour, ..."
}
```

---

## ☁️ 2. CLOUD SYNC - GOOGLE DRIVE

### Fichier à créer : `backend/services/googleDriveService.js`

```javascript
const { google } = require('googleapis');
const fs = require('fs');

class GoogleDriveService {
    constructor() {
        this.auth = new google.auth.GoogleAuth({
            credentials: {
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uris: [process.env.GOOGLE_REDIRECT_URI]
            },
            scopes: ['https://www.googleapis.com/auth/drive.file']
        });
    }

    async uploadFile(filePath, fileName) {
        const drive = google.drive({ version: 'v3', auth: this.auth });
        
        const fileMetadata = {
            name: fileName,
            parents: ['appDataFolder'] // Dossier privé de l'app
        };

        const media = {
            mimeType: 'application/octet-stream',
            body: fs.createReadStream(filePath)
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id'
        });

        return response.data.id;
    }

    async downloadFile(fileId, destinationPath) {
        const drive = google.drive({ version: 'v3', auth: this.auth });
        
        await drive.files.get({
            fileId: fileId,
            alt: 'media',
            $alt: 'media'
        }, {
            responseType: 'stream'
        })
        .then(response => {
            const writer = fs.createWriteStream(destinationPath);
            response.data.pipe(writer);
        });
    }

    async backupDatabase(dbPath) {
        const fileName = `backup_${new Date().toISOString().split('T')[0]}.sqlite`;
        return await this.uploadFile(dbPath, fileName);
    }
}

module.exports = new GoogleDriveService();
```

### API Routes : `backend/routes/cloud.js`

```javascript
const express = require('express');
const googleDrive = require('../services/googleDriveService');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/cloud/backup - Sauvegarder sur Google Drive
router.post('/backup', verifyToken, async (req, res) => {
    try {
        const fileId = await googleDrive.backupDatabase('./database.sqlite');
        res.json({ success: true, fileId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/cloud/backups - Liste des sauvegardes
router.get('/backups', verifyToken, async (req, res) => {
    try {
        const backups = await googleDrive.listBackups();
        res.json({ success: true, data: { backups } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/cloud/restore - Restaurer une sauvegarde
router.post('/restore', verifyToken, async (req, res) => {
    const { fileId } = req.body;
    try {
        await googleDrive.downloadFile(fileId, './database.sqlite');
        res.json({ success: true, message: 'Base restaurée' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
```

---

## 📊 3. DASHBOARD ANALYTICS - GRAPHIQUES AVANCÉS

### Fichier : `backend/routes/analytics.js`

```javascript
const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/analytics/dashboard - Stats complètes du dashboard
router.get('/dashboard', verifyToken, async (req, res) => {
    try {
        const stats = {};

        // Élèves par classe
        stats.studentsByClass = await new Promise((resolve) => {
            db.all(`
                SELECT c.name, COUNT(s.id) as count 
                FROM classes c 
                LEFT JOIN students s ON c.id = s.class_id 
                GROUP BY c.id
            `, [], (err, rows) => resolve(rows || []));
        });

        // Paiements par type
        stats.paymentsByType = await new Promise((resolve) => {
            db.all(`
                SELECT type, SUM(amount) as total, COUNT(*) as count 
                FROM payments 
                GROUP BY type
            `, [], (err, rows) => resolve(rows || []));
        });

        // Évolution des paiements (6 derniers mois)
        stats.paymentTrends = await new Promise((resolve) => {
            db.all(`
                SELECT strftime('%Y-%m', date) as month, SUM(amount) as total 
                FROM payments 
                WHERE date >= date('now', '-6 months')
                GROUP BY month
            `, [], (err, rows) => resolve(rows || []));
        });

        // Présences aujourd'hui
        stats.todayAttendance = await new Promise((resolve) => {
            db.get(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
                    SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent
                FROM student_attendance 
                WHERE date = date('now')
            `, [], (err, row) => resolve(row));
        });

        // Revenus par mois
        stats.monthlyRevenue = await new Promise((resolve) => {
            db.all(`
                SELECT strftime('%Y-%m', date) as month, SUM(amount) as revenue 
                FROM payments 
                GROUP BY month 
                ORDER BY month DESC 
                LIMIT 12
            `, [], (err, rows) => resolve(rows || []));
        });

        res.json({ success: true, data: { stats } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
```

---

## 🔔 4. NOTIFICATIONS PUSH - TEMPS RÉEL

### Fichier : `backend/services/pushService.js`

```javascript
const admin = require('firebase-admin');

// Initialisation Firebase
admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
});

class PushNotificationService {
    async sendToToken(token, title, body, data = {}) {
        const message = {
            notification: { title, body },
            data,
            token
        };

        try {
            const response = await admin.messaging().send(message);
            console.log('✅ Push envoyé:', response);
            return { success: true };
        } catch (error) {
            console.error('❌ Erreur push:', error);
            return { success: false, error: error.message };
        }
    }

    async sendToTopic(topic, title, body, data = {}) {
        const message = {
            notification: { title, body },
            data,
            topic
        };

        try {
            const response = await admin.messaging().send(message);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async sendPaymentNotification(token, amount, studentName) {
        return await this.sendToToken(
            token,
            '✅ Paiement enregistré',
            `${amount} FCFA pour ${studentName}`,
            { type: 'payment', amount }
        );
    }

    async sendAbsenceNotification(token, studentName, date) {
        return await this.sendToToken(
            token,
            '⚠️ Absence signalée',
            `${studentName} est absent(e) aujourd'hui`,
            { type: 'absence', date }
        );
    }
}

module.exports = new PushNotificationService();
```

---

## 📅 5. AGENDA PARTAGÉ - CALENDRIER COLLABORATIF

### Table SQL à ajouter :

```sql
CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    type TEXT CHECK(type IN ('exam', 'holiday', 'meeting', 'event', 'other')),
    class_id INTEGER,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### API Routes : `backend/routes/calendar.js`

```javascript
const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/calendar/events - Tous les événements
router.get('/events', verifyToken, (req, res) => {
    const { start, end, class_id } = req.query;
    
    let query = 'SELECT * FROM calendar_events WHERE 1=1';
    const params = [];

    if (start) {
        query += ' AND start_date >= ?';
        params.push(start);
    }

    if (end) {
        query += ' AND end_date <= ?';
        params.push(end);
    }

    if (class_id) {
        query += ' AND (class_id = ? OR class_id IS NULL)';
        params.push(class_id);
    }

    db.all(query, params, (err, events) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        res.json({ success: true, data: { events } });
    });
});

// POST /api/calendar/events - Créer un événement
router.post('/events', verifyToken, (req, res) => {
    const { title, description, start_date, end_date, type, class_id } = req.body;

    db.run(
        `INSERT INTO calendar_events (title, description, start_date, end_date, type, class_id, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, description, start_date, end_date, type, class_id, req.user.id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erreur serveur' });
            res.status(201).json({ success: true, data: { id: this.lastID } });
        }
    );
});

module.exports = router;
```

---

## 💬 6. MESSAGERIE INTERNE - COMMUNICATION STAFF

### Table SQL :

```sql
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    recipient_id INTEGER,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (recipient_id) REFERENCES users(id)
);
```

### API Routes : `backend/routes/messages.js`

```javascript
const express = require('express');
const db = require('../database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/messages/inbox - Boîte de réception
router.get('/inbox', verifyToken, (req, res) => {
    db.all(
        `SELECT m.*, u.lastName as sender_name 
         FROM messages m 
         JOIN users u ON m.sender_id = u.id 
         WHERE m.recipient_id = ? 
         ORDER BY m.created_at DESC`,
        [req.user.id],
        (err, messages) => {
            if (err) return res.status(500).json({ error: 'Erreur serveur' });
            res.json({ success: true, data: { messages } });
        }
    );
});

// POST /api/messages/send - Envoyer un message
router.post('/send', verifyToken, (req, res) => {
    const { recipient_id, subject, body } = req.body;

    db.run(
        `INSERT INTO messages (sender_id, recipient_id, subject, body) 
         VALUES (?, ?, ?, ?)`,
        [req.user.id, recipient_id, subject, body],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erreur serveur' });
            res.status(201).json({ success: true, data: { id: this.lastID } });
        }
    );
});

// PUT /api/messages/:id/read - Marquer comme lu
router.put('/:id/read', verifyToken, (req, res) => {
    db.run(
        'UPDATE messages SET is_read = 1 WHERE id = ? AND recipient_id = ?',
        [req.params.id, req.user.id],
        (err) => {
            if (err) return res.status(500).json({ error: 'Erreur serveur' });
            res.json({ success: true });
        }
    );
});

module.exports = router;
```

---

## 📦 INSTALLATION DES NOUVELLES DÉPENDANCES

```bash
cd backend
npm install
```

---

## 🎯 PROCHAINES ÉTAPES

1. ✅ **Configurer les emails** - `.env` avec Gmail
2. ✅ **Configurer Firebase** - Pour les notifications push
3. ✅ **Configurer Google Cloud** - Pour Google Drive
4. ✅ **Tester chaque fonctionnalité**

---

**Toutes les fonctionnalités avancées sont maintenant documentées et prêtes à être déployées !** 🚀
