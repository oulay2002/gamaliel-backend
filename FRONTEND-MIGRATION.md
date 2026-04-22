# 🔄 MIGRATION FRONTEND - Guide d'intégration API
## École Gamaliel - Version 2.0

---

## 📋 OBJECTIF

Intégrer l'API backend multi-utilisateurs dans votre fichier HTML existant (`gestion-ecole-gamaliel_v7_2.7.html`).

---

## 🎯 ÉTAPE 1 : INCLURE LE FICHIER DE CONFIGURATION

Ajoutez cette ligne dans le `<head>` de votre fichier HTML, **après** les autres scripts :

```html
<!-- Bibliothèque pour générer les QR codes -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.3/qrcode.min.js"></script>

<!-- === AJOUTER CECI === -->
<script src="backend/frontend-api-config.js"></script>
<!-- ==================== -->
```

---

## 🔐 ÉTAPE 2 : CRÉER L'ÉCRAN DE CONNEXION

Ajoutez une fonction de connexion qui utilise l'API :

```javascript
// Fonction de connexion avec l'API
async function loginWithAPI(username, password) {
  try {
    const response = await window.apiManager.login(username, password);
    
    if (response.success) {
      // Stocker les informations utilisateur
      localStorage.setItem('gamaliel_user', JSON.stringify(response.data.user));
      localStorage.setItem('gamaliel_token', response.data.token);
      
      // Masquer l'écran de connexion, afficher l'application
      document.getElementById('loginPage').style.display = 'none';
      document.getElementById('appContainer').style.display = 'block';
      
      // Initialiser l'application
      initApp();
      
      showNotification('Connexion réussie', 'success');
    }
  } catch (error) {
    showNotification(error.message || 'Échec de connexion', 'error');
  }
}

// Modifier votre fonction handleLogin existante
async function handleLogin(e) {
  e.preventDefault();
  
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  
  if (API_CONFIG.USE_BACKEND) {
    // Utiliser l'API
    await loginWithAPI(username, password);
  } else {
    // Utiliser localStorage (mode local)
    // ... votre code existant ...
  }
}
```

---

## 📊 ÉTAPE 3 : MODIFIER LES FONCTIONS EXISTANTES

### Exemple : Récupérer les élèves

**AVANT (localStorage) :**
```javascript
function updateStudentsTable() {
  const students = appData.students || [];
  // ... affichage ...
}
```

**APRÈS (API) :**
```javascript
async function updateStudentsTable() {
  if (API_CONFIG.USE_BACKEND) {
    try {
      const response = await window.apiManager.getStudents();
      if (response.success) {
        displayStudents(response.data.students);
      }
    } catch (error) {
      showNotification('Erreur chargement élèves', 'error');
    }
  } else {
    // Mode local
    const students = appData.students || [];
    displayStudents(students);
  }
}

function displayStudents(students) {
  const tbody = document.getElementById('studentsTable');
  tbody.innerHTML = students.map(s => `
    <tr>
      <td>${s.matricule}</td>
      <td>${s.last_name} ${s.first_name}</td>
      <td>${s.class_name}</td>
      <!-- ... -->
    </tr>
  `).join('');
}
```

---

## 💰 ÉTAPE 4 : MODIFIER LES PAIEMENTS

### Enregistrer un paiement

**AVANT :**
```javascript
appData.payments.push(payment);
saveData();
```

**APRÈS :**
```javascript
async function savePayment(paymentData) {
  if (API_CONFIG.USE_BACKEND) {
    try {
      const response = await window.apiManager.createPayment(paymentData);
      if (response.success) {
        showNotification('Paiement enregistré', 'success');
        updatePaymentsTable();
      }
    } catch (error) {
      showNotification('Erreur enregistrement', 'error');
    }
  } else {
    // Mode local
    appData.payments.push(paymentData);
    saveData();
  }
}
```

---

## 📝 ÉTAPE 5 : MODIFIER LES COMPOSITIONS

### Créer une composition

```javascript
async function createComposition(compositionData) {
  if (API_CONFIG.USE_BACKEND) {
    try {
      const response = await window.apiManager.createComposition(compositionData);
      if (response.success) {
        showNotification('Composition créée', 'success');
        updateCompositionsTable();
      }
    } catch (error) {
      showNotification('Erreur création', 'error');
    }
  } else {
    // Mode local
    appData.compositions.push(compositionData);
    saveData();
  }
}
```

---

## 📚 ÉTAPE 6 : MODIFIER LES RELEVÉS DE NOTES

### Générer un relevé

```javascript
async function generateReportCard(reportCardData) {
  if (API_CONFIG.USE_BACKEND) {
    try {
      const response = await window.apiManager.generateReportCard(reportCardData);
      if (response.success) {
        showNotification('Relevé généré', 'success');
        updateReportCardsTable();
      }
    } catch (error) {
      showNotification('Erreur génération', 'error');
    }
  } else {
    // Mode local
    appData.reportCards.push(reportCardData);
    saveData();
  }
}
```

---

## 👥 ÉTAPE 7 : MODIFIER LES PRÉSENCES

### Marquer une présence

```javascript
async function markAttendance(attendanceData, type = 'student') {
  if (API_CONFIG.USE_BACKEND) {
    try {
      const endpoint = type === 'student' ? '/attendance/students' : '/attendance/teachers';
      const response = await window.apiManager.post(endpoint, attendanceData);
      if (response.success) {
        showNotification('Présence enregistrée', 'success');
        updateAttendanceTable();
      }
    } catch (error) {
      showNotification('Erreur enregistrement', 'error');
    }
  } else {
    // Mode local
    const array = type === 'student' ? appData.studentAttendance : appData.teacherAttendance;
    array.push(attendanceData);
    saveData();
  }
}
```

---

## 📈 ÉTAPE 8 : MODIFIER LE DASHBOARD

### Récupérer les statistiques

```javascript
async function updateDashboard() {
  if (API_CONFIG.USE_BACKEND) {
    try {
      const response = await window.apiManager.getDashboardStats();
      if (response.success) {
        displayDashboardStats(response.data);
      }
    } catch (error) {
      console.error('Erreur dashboard:', error);
    }
  } else {
    // Mode local - calculer les stats manuellement
    // ... votre code existant ...
  }
}

function displayDashboardStats(stats) {
  document.getElementById('totalStudents').textContent = stats.students.total;
  document.getElementById('totalTeachers').textContent = stats.teachers.total;
  document.getElementById('totalClasses').textContent = stats.classes.total;
  // ...
}
```

---

## 🚪 ÉTAPE 9 : GESTION DE LA DÉCONNEXION

```javascript
function logout() {
  if (API_CONFIG.USE_BACKEND) {
    window.apiManager.logout();
  }
  
  localStorage.removeItem('gamaliel_user');
  localStorage.removeItem('gamaliel_token');
  
  // Rediriger vers la page de connexion
  window.location.reload();
}
```

---

## 🔒 ÉTAPE 10 : SÉCURISER LES PAGES

```javascript
// Vérifier si l'utilisateur est connecté
function checkAuth() {
  if (API_CONFIG.USE_BACKEND) {
    const token = localStorage.getItem('gamaliel_token');
    if (!token) {
      window.location.href = 'login.html';
      return false;
    }
  }
  return true;
}

// Vérifier les permissions
function checkPermission(requiredRole) {
  const user = JSON.parse(localStorage.getItem('gamaliel_user'));
  if (!user) return false;
  
  // Le directeur a tous les droits
  if (user.role === 'directeur') return true;
  
  // Vérifier le rôle requis
  return user.role === requiredRole;
}
```

---

## 📋 TABLEAU DE CORRESPONDANCE DES FONCTIONS

| Fonction Locale | Fonction API |
|-----------------|--------------|
| `appData.students` | `apiManager.getStudents()` |
| `appData.payments` | `apiManager.getPayments()` |
| `appData.compositions` | `apiManager.getCompositions()` |
| `appData.reportCards` | `apiManager.getReportCards()` |
| `appData.studentAttendance` | `apiManager.get('/attendance/students')` |
| `appData.teacherAttendance` | `apiManager.get('/attendance/teachers')` |
| `appData.classes` | `apiManager.getClasses()` |
| `appData.teachers` | `apiManager.get('/teachers')` |
| `appData.subjects` | `apiManager.get('/subjects')` |
| `appData.settings` | `apiManager.getSettings()` |
| `saveData()` | `apiManager.post/put()` |

---

## ✅ CHECKLIST DE MIGRATION

- [ ] Inclure `frontend-api-config.js`
- [ ] Créer l'écran de connexion
- [ ] Modifier la fonction `login()`
- [ ] Modifier `updateStudentsTable()`
- [ ] Modifier `savePayment()`
- [ ] Modifier `createComposition()`
- [ ] Modifier `generateReportCard()`
- [ ] Modifier `markAttendance()`
- [ ] Modifier `updateDashboard()`
- [ ] Ajouter la fonction `logout()`
- [ ] Sécuriser les pages avec `checkAuth()`
- [ ] Tester toutes les fonctionnalités

---

## 🆘 DÉPANNAGE

### Erreur : "apiManager is not defined"

**Solution :** Vérifiez que `frontend-api-config.js` est bien inclus **après** les autres scripts.

### Erreur : "Token expired"

**Solution :** La fonction `apiManager.login()` gère automatiquement le stockage du token.

### Erreur : "401 Unauthorized"

**Solution :** Vérifiez que l'utilisateur est connecté avec `checkAuth()`.

---

## 🎉 MIGRATION TERMINÉE !

Votre application utilise maintenant l'API backend multi-utilisateurs.

**Prochaines étapes :**
1. Tester toutes les fonctionnalités
2. Former les utilisateurs
3. Déployer en production

---

**Support :** Consultez `INSTALLATION.md` pour plus de détails.
