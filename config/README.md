# 🔔 CONFIGURATION FIREBASE - Instructions

## Fichiers à placer dans ce dossier

### 1. firebase-service-account.json
Clé de service Firebase Admin SDK pour le backend.

**Comment l'obtenir:**
1. Allez sur https://console.firebase.google.com
2. Sélectionnez votre projet `gamaliel-ecole`
3. Cliquez sur ⚙️ Paramètres → Comptes de service
4. Cliquez sur "Générer une nouvelle clé privée"
5. Téléchargez le fichier JSON
6. Renommez-le en `firebase-service-account.json`
7. Placez-le dans ce dossier

**⚠️ IMPORTANT:**
- NE JAMAIS commit ce fichier dans Git
- Il est déjà dans .gitignore
- Gardez-le en lieu sûr (contient des credentials sensibles)

---

## Vérification

Après avoir placé le fichier, démarrez le backend:

```bash
cd backend
npm run dev
```

Vous devriez voir:
```
✅ Firebase Admin SDK initialized successfully
```

Si vous voyez:
```
❌ Firebase initialization error: File not found
```

C'est que le fichier `firebase-service-account.json` n'est pas au bon endroit.

---

## Structure attendue

```
backend/
├── config/
│   ├── firebase-service-account.json  ← Votre fichier ici
│   └── ... (autres configs)
├── services/
│   └── firebaseService.js
└── server.js
```

---

## Pour la production

Utilisez des variables d'environnement au lieu d'un fichier:

```env
FIREBASE_PROJECT_ID=gamaliel-ecole
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
```

Puis modifiez `firebaseService.js` pour utiliser ces variables.

---

**Développé avec ❤️ pour École Gamaliel**
