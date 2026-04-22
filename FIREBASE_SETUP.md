# 🔥 CONFIGURATION FIREBASE CLOUD MESSAGING
## Guide Complet pour les Notifications Push

---

## 📋 Vue d'ensemble

Firebase Cloud Messaging (FCM) permet d'envoyer des notifications push en temps réel aux applications mobiles et web MyGamaliel.

---

## ÉTAPE 1 : Créer un Projet Firebase

### 1.1 Accéder à Firebase Console

1. Rendez-vous sur [Firebase Console](https://console.firebase.google.com/)
2. Cliquez sur **"Ajouter un projet"**
3. Nom du projet : `mygamaliel` (ou votre choix)
4. Désactiver Google Analytics (optionnel)
5. Cliquez sur **"Créer un projet"**

### 1.2 Activer Cloud Messaging

1. Dans le menu de gauche, cliquez sur **"Build"** → **"Cloud Messaging"**
2. Si ce n'est pas activé, cliquez sur **"Activer"**

---

## ÉTAPE 2 : Créer un Compte de Service

### 2.1 Accéder aux Paramètres du Projet

1. Cliquez sur l'icône **⚙️ (Paramètres)** en haut à gauche
2. Sélectionnez **"Paramètres du projet"**

### 2.2 Onglet "Comptes de service"

1. Allez dans l'onglet **"Comptes de service"**
2. Cliquez sur **"Générer une nouvelle clé privée"**
3. Une fenêtre s'ouvre avec un avertissement de sécurité
4. Cliquez sur **"Générer une clé"**
5. Un fichier JSON est téléchargé (ex: `firebase-adminsdk-xxxxx.json`)

⚠️ **IMPORTANT:** Ce fichier contient des informations sensibles. Ne le partagez jamais !

### 2.3 Placer le Fichier

1. Copiez le fichier JSON téléchargé dans :
   ```
   backend/config/firebase-service-account.json
   ```

2. Le fichier doit être dans `.gitignore` pour ne pas être commité :
   ```
   # .gitignore
   backend/config/firebase-service-account.json
   ```

---

## ÉTAPE 3 : Installer Firebase Admin SDK

### 3.1 Installer le Package

```bash
cd backend
npm install firebase-admin
```

### 3.2 Vérifier l'Installation

Le fichier `backend/services/firebaseService.js` est déjà configuré pour utiliser le SDK.

---

## ÉTAPE 4 : Configuration pour le Web

### 4.1 Enregistrer l'Application Web

1. Dans Firebase Console, cliquez sur l'icône **Web** (`</>`)
2. Enregistrez l'application sous le nom : `MyGamaliel Web`
3. Copiez la configuration Firebase

### 4.2 Configuration VAPID pour les Notifications Push

Les notifications web nécessitent des clés VAPID :

1. Dans Firebase Console → **Project Settings** → **Cloud Messaging**
2. Section **"Web Push certificates"**
3. Générez une paire de clés
4. Copiez la **clé publique** (VAPID public key)

### 4.3 Mettre à Jour la Configuration Web

Dans `js/mygamaliel-push.js`, remplacez :

```javascript
const config = {
    vapidPublicKey: 'YOUR_VAPID_PUBLIC_KEY', // ← Collez votre clé publique ici
    apiBaseUrl: 'http://localhost:3000/api',
    // ...
};
```

---

## ÉTAPE 5 : Configuration pour Android

### 5.1 Enregistrer l'Application Android

1. Dans Firebase Console, cliquez sur l'icône **Android**
2. Nom du package : `com.mygamaliel.app`
3. Téléchargez `google-services.json`

### 5.2 Placer le Fichier Android

Copiez `google-services.json` dans :
```
android/app/google-services.json
```

### 5.3 Ajouter les Dépendances Android

Dans `android/app/build.gradle` :

```gradle
dependencies {
    // ... autres dépendances
    
    // Firebase Cloud Messaging
    implementation 'com.google.firebase:firebase-messaging:23.1.2'
    implementation 'com.google.firebase:firebase-analytics:21.3.0'
}

// À la fin du fichier
apply plugin: 'com.google.gms.google-services'
```

Dans `android/build.gradle` :

```gradle
buildscript {
    dependencies {
        // ... autres dépendances
        
        // Google Services
        classpath 'com.google.gms:google-services:4.3.15'
    }
}
```

---

## ÉTAPE 6 : Tester la Configuration

### 6.1 Démarrer le Backend

```bash
cd backend
npm start
```

Vous devriez voir :
```
✓ Firebase Admin initialisé avec succès
✓ Tables de synchronisation initialisées
```

### 6.2 Tester l'Envoi de Notification

Dans la console du navigateur (F12) :

```javascript
// S'abonner aux notifications
await MyGamalielPush.init();

// Envoyer une notification de test
fetch('http://localhost:3000/api/push/send', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_TOKEN'
    },
    body: JSON.stringify({
        userId: 'admin',
        title: 'Test Notification',
        body: 'Ceci est un test de notification',
        data: { page: 'dashboard' }
    })
})
.then(r => r.json())
.then(console.log);
```

---

## 📊 API de Notification

### Endpoints Disponibles

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/push/subscribe` | Enregistrer un appareil |
| POST | `/api/push/unsubscribe` | Se désabonner |
| GET | `/api/push/subscriptions/:userId` | Voir les subscriptions |
| POST | `/api/push/send` | Envoyer une notification |
| GET | `/api/sync/status` | État de synchronisation |

### Exemple d'Envoi de Notification

```javascript
// Notification à un utilisateur spécifique
POST /api/push/send
Headers: {
    "Authorization": "Bearer YOUR_JWT_TOKEN",
    "Content-Type": "application/json"
}
Body: {
    "userId": "admin",
    "title": "Nouveau Paiement",
    "body": "Un paiement de 15000 FCFA a été enregistré",
    "data": {
        "page": "payments",
        "studentMatricule": "2025-CP1-001",
        "amount": 15000
    }
}
```

---

## 🔧 Dépannage

### Problème: "Firebase non configuré"

**Solution:**
```bash
# Vérifier que le fichier existe
ls backend/config/firebase-service-account.json

# Vérifier les permissions
chmod 600 backend/config/firebase-service-account.json
```

### Problème: "Invalid Credentials"

**Solution:**
1. Vérifiez que le compte de service est actif
2. Dans Firebase Console → IAM & Admin → Service Accounts
3. Vérifiez que le compte a le rôle **"Firebase Admin SDK Administrator Service Agent"**

### Problème: Notifications web ne fonctionnent pas

**Solution:**
1. Vérifiez que VAPID est configuré
2. Les notifications web nécessitent HTTPS (sauf en localhost)
3. Vérifiez la permission dans le navigateur

### Problème: "Missing Registration Token"

**Solution:**
```javascript
// Côté client, régénérer le token
const registration = await navigator.serviceWorker.ready;
const subscription = await registration.pushManager.getSubscription();

if (!subscription) {
    // Créer une nouvelle subscription
    const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    
    // Envoyer au serveur
    await fetch('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({ subscription })
    });
}
```

---

## 📱 Types de Notifications

### 1. Notification de Paiement

```javascript
{
    "userId": "parent123",
    "title": "Paiement Reçu",
    "body": "15000 FCFA - Scolarité Avril 2026",
    "data": {
        "page": "payments",
        "paymentId": "PAY_123456",
        "amount": 15000,
        "type": "scolarite"
    }
}
```

### 2. Notification de Note

```javascript
{
    "userId": "parent123",
    "title": "Nouvelle Note",
    "body": "Mathématiques: 16/20 - Composition 3",
    "data": {
        "page": "reportCards",
        "subject": "Mathématiques",
        "grade": 16,
        "composition": 3
    }
}
```

### 3. Notification d'Absence

```javascript
{
    "userId": "parent123",
    "title": "Absence Non Justifiée",
    "body": "Votre enfant était absent ce matin",
    "data": {
        "page": "attendance",
        "date": "2026-04-02",
        "status": "absent"
    }
}
```

### 4. Notification de Message

```javascript
{
    "userId": "teacher456",
    "title": "Nouveau Message",
    "body": "Le directeur vous a envoyé un message",
    "data": {
        "page": "messages",
        "messageId": "MSG_789",
        "sender": "Directeur"
    }
}
```

---

## 🎯 Bonnes Pratiques

1. **Ne jamais commiter** `firebase-service-account.json`
2. **Utiliser des variables d'environnement** pour les clés sensibles
3. **Limiter la fréquence** des notifications (éviter le spam)
4. **Personnaliser** les notifications par type d'utilisateur
5. **Tester** sur appareil physique (les notifications ne marchent pas toujours en émulateur)

---

## 📖 Ressources Utiles

- [Firebase Console](https://console.firebase.google.com/)
- [Documentation FCM](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Notifications Web Push](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

---

**Développé avec ❤️ pour École Gamaliel © 2024-2026**
