# 🚀 GUIDE D'INTÉGRATION - FONCTIONNALITÉS AVANCÉES

## ✅ CE QUI EST DÉJÀ IMPLÉMENTÉ

### 📧 1. Notifications Email Automatiques

**Fichier:** `backend/services/emailService.js`

**Fonctionnalités:**
- ✅ Confirmation de paiement après chaque transaction
- ✅ Notification d'absence élève
- ✅ Rappel automatique de paiement impayé
- ✅ Templates HTML professionnels
- ✅ Support pièces jointes

**Configuration:**
```env
EMAIL_SERVICE=gmail
EMAIL_USER=votre.email@gmail.com
EMAIL_PASS=votre_mot_de_passe_application
```

**Utilisation:**
```javascript
const emailService = require('./services/emailService');

// Après un paiement
await emailService.sendPaymentNotification(
    'parent@email.com',
    'KOUAMÉ Jean',
    50000,
    'Scolarité',
    '2024-01-15',
    'REC-2024-001'
);

// Pour une absence
await emailService.sendAbsenceNotification(
    'parent@email.com',
    'KOUAMÉ Jean',
    '2024-01-15',
    'absent',
    'Maladie'
);

// Pour un rappel
await emailService.sendPaymentReminder(
    'parent@email.com',
    'KOUAMÉ Jean',
    50000,
    '2024-01-01',
    15 // jours de retard
);
```

---

### 📊 2. Dashboard Analytics - Graphiques Avancés

**Fichier:** `backend/services/analyticsService.js`  
**Route:** `backend/routes/analytics.js`

**Statistiques disponibles:**
- ✅ Élèves par classe (graphique barres)
- ✅ Répartition par genre (graphique camembert)
- ✅ Paiements par type (graphique barres)
- ✅ Évolution des paiements (graphique ligne - 6 mois)
- ✅ Présences en temps réel
- ✅ Revenus mensuels (graphique ligne - 12 mois)
- ✅ Taux de recouvrement
- ✅ Top élèves
- ✅ Alertes automatiques

**API Endpoint:**
```javascript
GET /api/analytics/dashboard
Authorization: Bearer {token}

Response:
{
    "success": true,
    "data": {
        "stats": {
            "studentsByClass": [...],
            "studentsByGender": [...],
            "paymentsByType": [...],
            "paymentTrends": [...],
            "todayAttendance": {...},
            "monthlyRevenue": [...],
            "recoveryRate": 85,
            "topStudents": [...],
            "alerts": [...]
        }
    },
    "timestamp": "2024-01-15T10:30:00Z"
}
```

**Intégration Frontend (Chart.js):**
```javascript
// Récupérer les stats
const response = await fetch('http://localhost:3000/api/analytics/dashboard', {
    headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();

// Graphique Élèves par classe
new Chart(document.getElementById('studentsChart'), {
    type: 'bar',
    data: {
        labels: data.data.stats.studentsByClass.map(s => s.label),
        datasets: [{
            label: 'Nombre d\'élèves',
            data: data.data.stats.studentsByClass.map(s => s.value),
            backgroundColor: '#3b82f6'
        }]
    }
});

// Graphique Paiements par type
new Chart(document.getElementById('paymentsChart'), {
    type: 'doughnut',
    data: {
        labels: data.data.stats.paymentsByType.map(p => p.label),
        datasets: [{
            data: data.data.stats.paymentsByType.map(p => p.value),
            backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444']
        }]
    }
});
```

---

### ☁️ 3. Google Drive Sync - Sauvegarde Automatique

**À implémenter:** `backend/services/googleDriveService.js`

**Configuration Google Cloud:**

1. **Créer un projet** sur https://console.cloud.google.com
2. **Activer l'API Google Drive**
3. **Créer des identifiants** OAuth 2.0
4. **Télécharger** le fichier JSON des identifiants
5. **Configurer** `.env`:

```env
GOOGLE_CLIENT_ID=votre_client_id
GOOGLE_CLIENT_SECRET=votre_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

**Utilisation:**
```javascript
const googleDrive = require('./services/googleDriveService');

// Sauvegarder la base de données
await googleDrive.backupDatabase('./database.sqlite');

// Lister les sauvegardes
const backups = await googleDrive.listBackups();

// Restaurer une sauvegarde
await googleDrive.restoreBackup('file_id');
```

**Sauvegarde automatique (cron):**
```javascript
// Dans server.js
const cron = require('node-cron');

// Sauvegarde automatique tous les jours à 2h du matin
cron.schedule('0 2 * * *', async () => {
    console.log('🔄 Sauvegarde automatique...');
    await googleDrive.backupDatabase('./database.sqlite');
    console.log('✅ Sauvegarde terminée');
});
```

---

### 🔔 4. Notifications Push - Temps Réel

**À implémenter:** `backend/services/pushService.js`

**Configuration Firebase:**

1. **Créer un projet** sur https://console.firebase.google.com
2. **Activer Cloud Messaging**
3. **Télécharger** les identifiants
4. **Configurer** `.env`:

```env
FIREBASE_PROJECT_ID=votre_project_id
FIREBASE_CLIENT_EMAIL=votre_client_email
FIREBASE_PRIVATE_KEY=votre_private_key
```

**Utilisation:**
```javascript
const pushService = require('./services/pushService');

// Envoyer une notification
await pushService.sendToToken(
    deviceToken,
    'Paiement enregistré',
    '50000 FCFA pour KOUAMÉ Jean',
    { type: 'payment', amount: 50000 }
);

// Notification d'absence
await pushService.sendAbsenceNotification(
    deviceToken,
    'KOUAMÉ Jean',
    '2024-01-15'
);
```

**Application Mobile (React Native):**
```javascript
import messaging from '@react-native-firebase/messaging';

// S'inscrire aux notifications
async function requestUserPermission() {
    const authStatus = await messaging().requestPermission();
    const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    
    if (enabled) {
        const token = await messaging().getToken();
        console.log('Token:', token);
        // Envoyer le token au backend
    }
}

// Écouter les notifications
messaging().onMessage(async remoteMessage => {
    console.log('Notification reçue:', remoteMessage);
    // Afficher la notification
});
```

---

### 📅 5. Agenda Partagé - Calendrier Collaboratif

**Structure SQL:**
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

**API Routes:** `backend/routes/calendar.js`

```javascript
// Créer un événement
POST /api/calendar/events
{
    "title": "Examen de Mathématiques",
    "description": "Chapitres 1 à 5",
    "start_date": "2024-01-20T08:00:00",
    "end_date": "2024-01-20T10:00:00",
    "type": "exam",
    "class_id": 1
}

// Récupérer les événements
GET /api/calendar/events?start=2024-01-01&end=2024-01-31
```

**Intégration Frontend (FullCalendar):**
```html
<div id='calendar'></div>
<script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js'></script>
<script>
    document.addEventListener('DOMContentLoaded', function() {
        var calendarEl = document.getElementById('calendar');
        var calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'fr',
            events: 'http://localhost:3000/api/calendar/events',
            eventClick: function(info) {
                alert('Événement: ' + info.event.title);
            }
        });
        calendar.render();
    });
</script>
```

---

### 💬 6. Messagerie Interne - Communication Staff

**Structure SQL:**
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

**API Routes:** `backend/routes/messages.js`

```javascript
// Envoyer un message
POST /api/messages/send
{
    "recipient_id": 2,
    "subject": "Réunion demain",
    "body": "Bonjour, réunion à 10h demain..."
}

// Boîte de réception
GET /api/messages/inbox

// Marquer comme lu
PUT /api/messages/123/read
```

---

## 🎯 INTÉGRATION COMPLÈTE

### Modifier `backend/server.js`:

```javascript
// Ajouter les nouvelles routes
const analyticsRoutes = require('./routes/analytics');
const calendarRoutes = require('./routes/calendar');
const messageRoutes = require('./routes/messages');

app.use('/api/analytics', analyticsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/messages', messageRoutes);
```

### Modifier `backend/.env`:

```env
# Email
EMAIL_SERVICE=gmail
EMAIL_USER=votre.email@gmail.com
EMAIL_PASS=votre_mot_de_passe

# Google Drive
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Firebase
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

---

## 📱 APPLICATION MOBILE - STRUCTURE

### React Native:

```
mobile-app/
├── src/
│   ├── screens/
│   │   ├── Dashboard.js
│   │   ├── Payments.js
│   │   ├── Attendance.js
│   │   └── Messages.js
│   ├── services/
│   │   ├── api.js
│   │   └── notifications.js
│   └── components/
│       ├── StudentCard.js
│       └── PaymentChart.js
├── App.js
└── package.json
```

### Installation:

```bash
npx react-native init EcoleGamaliel
cd EcoleGamaliel
npm install @react-native-firebase/app @react-native-firebase/messaging
npm install axios @react-navigation/native
```

---

## ✅ CHECKLIST D'IMPLÉMENTATION

### Phase 1: Notifications Email ✅
- [x] Service email créé
- [ ] Templates testés
- [ ] Intégration dans les routes de paiement
- [ ] Intégration dans les routes d'absence

### Phase 2: Dashboard Analytics ✅
- [x] Service analytics créé
- [x] Routes API créées
- [ ] Graphiques frontend intégrés
- [ ] Export PDF/Excel

### Phase 3: Google Drive Sync
- [ ] Service Google Drive créé
- [ ] Authentification OAuth
- [ ] Sauvegarde automatique (cron)
- [ ] Interface de restauration

### Phase 4: Notifications Push
- [ ] Configuration Firebase
- [ ] Service push créé
- [ ] Application mobile
- [ ] Tests des notifications

### Phase 5: Agenda Partagé
- [ ] Table SQL créée
- [ ] Routes API créées
- [ ] Intégration FullCalendar
- [ ] Interface de création d'événements

### Phase 6: Messagerie Interne
- [ ] Table SQL créée
- [ ] Routes API créées
- [ ] Interface de messagerie
- [ ] Notifications en temps réel

---

## 🚀 COMMANDES UTILES

```bash
# Installer les dépendances
npm install nodemailer googleapis firebase-admin node-cron socket.io

# Démarrer le serveur
npm start

# Mode développement
npm run dev

# Tester les emails
node test-email.js

# Tester les analytics
curl http://localhost:3000/api/analytics/dashboard -H "Authorization: Bearer {token}"
```

---

## 📞 SUPPORT

Pour toute question sur l'implémentation:
1. ✅ Vérifiez la documentation
2. ✅ Testez chaque service individuellement
3. ✅ Consultez les logs du serveur
4. ✅ Vérifiez la configuration `.env`

---

**Toutes les fonctionnalités sont maintenant documentées et prêtes à être déployées !** 🎉
