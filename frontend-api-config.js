/**
 * CONFIGURATION FRONTEND - ÉCOLE GAMALIEL
 */

const API_CONFIG = {
  // Mode de fonctionnement
  USE_BACKEND: true,

  // URL de l'API
  API_BASE_URL: 'http://localhost:3001/api',

  // Timeout des requêtes
  TIMEOUT: 30000,

  // Clés de stockage
  STORAGE_KEYS: {
    DATA: 'gamaliel_data_v2',
    TOKEN: 'gamaliel_token',
    USER: 'gamaliel_user',
    SETTINGS: 'gamaliel_settings'
  },

  // Version
  VERSION: '2.0.0',

  // Mode debug
  DEBUG: true
};

// Gestionnaire d'API
class APIManager {
  constructor(config) {
    this.config = config;
    this.token = null;
    this.user = null;
  }

  init() {
    const storedToken = localStorage.getItem(this.config.STORAGE_KEYS.TOKEN);
    const storedUser = localStorage.getItem(this.config.STORAGE_KEYS.USER);

    if (storedToken) {
      this.token = storedToken;
    }

    if (storedUser) {
      try {
        this.user = JSON.parse(storedUser);
      } catch (e) {
        console.error('Erreur parsing user:', e);
      }
    }

    if (this.config.DEBUG) {
      console.log('📡 API Manager initialisé');
      console.log('   Mode:', this.config.USE_BACKEND ? 'Backend API' : 'LocalStorage');
      console.log('   URL:', this.config.API_BASE_URL);
    }
  }

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem(this.config.STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(this.config.STORAGE_KEYS.USER, JSON.stringify(user));
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem(this.config.STORAGE_KEYS.TOKEN);
    localStorage.removeItem(this.config.STORAGE_KEYS.USER);
  }

  isAuthenticated() {
    return this.config.USE_BACKEND ? !!this.token : true;
  }

  getUser() {
    return this.user;
  }

  async request(endpoint, options = {}) {
    if (!this.config.USE_BACKEND) {
      return null;
    }

    const url = this.config.API_BASE_URL + endpoint;

    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { 'Authorization': 'Bearer ' + this.token } : {}),
        ...options.headers
      }
    };

    if (this.config.DEBUG) {
      console.log('🌐 ' + (options.method || 'GET') + ' ' + url);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.TIMEOUT);

      const response = await fetch(url, {
        ...config,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur HTTP');
      }

      return data;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Délai dépassé');
      }

      console.error('❌ Erreur API:', error);
      throw error;
    }
  }

  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  async login(username, password) {
    const response = await this.post('/auth/login', { username, password });
    if (response.success) {
      this.setAuth(response.data.token, response.data.user);
    }
    return response;
  }

  async logout() {
    try {
      await this.post('/auth/logout');
    } catch (error) {
      console.error('Erreur logout:', error);
    } finally {
      this.logout();
    }
  }

  async getStudents(params) {
    const queryString = new URLSearchParams(params || {}).toString();
    return this.get('/students' + (queryString ? '?' + queryString : ''));
  }

  async getPayments(params) {
    const queryString = new URLSearchParams(params || {}).toString();
    return this.get('/payments' + (queryString ? '?' + queryString : ''));
  }

  async getDashboardStats() {
    return this.get('/dashboard/stats');
  }

  async getClasses() {
    return this.get('/classes');
  }

  async getTeachers() {
    return this.get('/teachers');
  }

  async getCompositions(params) {
    const queryString = new URLSearchParams(params || {}).toString();
    return this.get('/compositions' + (queryString ? '?' + queryString : ''));
  }

  async getAttendance(params) {
    const queryString = new URLSearchParams(params || {}).toString();
    return this.get('/attendance' + (queryString ? '?' + queryString : ''));
  }
}

// Créer une instance globale
window.apiManager = new APIManager(API_CONFIG);

// Vérifier le mode stocké
const storedMode = localStorage.getItem('gamaliel_use_backend');
if (storedMode !== null) {
  API_CONFIG.USE_BACKEND = storedMode === 'true';
}

// Initialiser
window.apiManager.init();