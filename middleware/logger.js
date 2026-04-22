/**
 * Logger Structuré - Winston Configuration
 * 
 * Fonctionnalités:
 * - Logs structurés en JSON pour parsing automatique
 * - Rotation quotidienne des fichiers (garde 14 jours)
 * - Séparation errors/info dans fichiers différents
 * - Console colorée pour développement
 * - Tracking des performances (temps de réponse)
 * - Alertes automatiques sur erreurs critiques
 * 
 * Utilisation:
 * ```javascript
 * const logger = require('../middleware/logger');
 * logger.info('UserLogin', { username: 'admin', ip: '192.168.1.71' });
 * logger.error('DatabaseError', { error: e.message, query: 'SELECT...' });
 * ```
 * 
 * @author École Gamaliel
 * @version 1.0.0
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Configuration des niveaux de log
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
};

// Couleurs par niveau
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'cyan'
};

winston.addColors(colors);

// Format personnalisé pour la console
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf((info) => {
        const { timestamp, level, message, ...meta } = info;
        return `${timestamp} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
    })
);

// Format JSON pour les fichiers (parsing automatique)
const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Création du logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'debug',
    levels,
    transports: [
        // Console (pour développement)
        new winston.transports.Console({
            format: consoleFormat,
            silent: process.env.NODE_ENV === 'production' // Muet en production si desired
        }),

        // Fichier combiné (tous les logs)
        new DailyRotateFile({
            filename: path.join(__dirname, '..', 'logs', 'combined-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m', // 20MB max par fichier
            maxFiles: '14d', // Garde 14 jours
            format: fileFormat
        }),

        // Fichier erreurs uniquement
        new DailyRotateFile({
            filename: path.join(__dirname, '..', 'logs', 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '10m',
            maxFiles: '30d', // Garde les erreurs 30 jours
            level: 'error',
            format: fileFormat
        }),

        // Fichier HTTP (requêtes)
        new DailyRotateFile({
            filename: path.join(__dirname, '..', 'logs', 'http-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '50m',
            maxFiles: '7d', // Garde 7 jours
            level: 'http',
            format: fileFormat
        })
    ],

    // Métadonnées par défaut
    defaultMeta: {
        service: 'ecole-gamaliel-api',
        environment: process.env.NODE_ENV || 'development'
    }
});

// ==========================================
// Helpers pour le logging structuré
// ==========================================

/**
 * Log une requête HTTP entrante
 */
logger.logRequest = function (req, res, next) {
    const start = Date.now();

    // Quand la réponse est envoyée
    res.on('finish', () => {
        const duration = Date.now() - start;
        this.http('HTTPRequest', {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id || 'anonymous'
        });
    });

    next();
};

/**
 * Log une erreur avec contexte
 */
logger.logError = function (error, context = {}) {
    this.error('ApplicationError', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        ...context
    });
};

/**
 * Log une action utilisateur (audit)
 */
logger.logAction = function (action, details = {}) {
    this.info('UserAction', {
        action,
        userId: details.userId || 'unknown',
        ...details
    });
};

/**
 * Log une performance lente (> 1000ms)
 */
logger.logSlowQuery = function (query, duration, params = {}) {
    if (duration > 1000) {
        this.warn('SlowQuery', {
            query: query.substring(0, 200) + '...',
            duration: `${duration}ms`,
            ...params
        });
    }
};

// ==========================================
// Middleware Express
// ==========================================

/**
 * Middleware de logging pour toutes les requêtes
 */
logger.requestLogger = function (req, res, next) {
    logger.logRequest(req, res, next);
};

// ==========================================
// Gestion des erreurs non capturées
// ==========================================

// Erreurs non capturées
process.on('uncaughtException', (error) => {
    logger.error('UncaughtException', {
        message: error.message,
        stack: error.stack
    });
    // Attendre que le log soit écrit avant de quitter
    setTimeout(() => process.exit(1), 1000);
});

// Promesses non rejetées
process.on('unhandledRejection', (reason, promise) => {
    logger.error('UnhandledRejection', {
        reason: reason?.message || reason,
        stack: reason?.stack
    });
});

module.exports = logger;
