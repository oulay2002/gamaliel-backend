/**
 * CONFIGURATION DE LA BASE DE DONNÉES
 * École Gamaliel - Système de Gestion Scolaire
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Pool de connexions pour meilleures performances
const pool = mysql.createPool({
  // Support Railway + Local + Autres providers
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || process.env.DB_NAME || 'railway',  port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
  
  // Configuration avancée
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  
  // SSL pour les connexions cloud (Railway, PlanetScale, etc.)
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});
// Tester la connexion
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connexion à la base de données réussie');
    console.log(`📊 Base de données: ${process.env.DB_NAME}`);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Échec de connexion à la base de données:', error.message);
    return false;
  }
}

// Exécuter une requête
async function query(sql, params) {
  try {
    // Utiliser query() au lieu de execute() pour éviter les problèmes avec LIMIT/OFFSET
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error('Erreur SQL:', error);
    throw error;
  }
}

// Obtenir une connexion transactionnelle
async function getConnection() {
  return await pool.getConnection();
}

module.exports = {
  pool,
  query,
  getConnection,
  testConnection
};
