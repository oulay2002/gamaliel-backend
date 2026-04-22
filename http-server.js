/**
 * SERVEUR HTTP SIMPLE POUR TESTER LES SERVICE WORKERS
 * Permet de tester les PWA et notifications push en local
 * 
 * Usage: node http-server.js [port]
 * 
 * @version 1.0.0
 * @author École Gamaliel
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = process.argv[2] || 8080;
const ROOT_DIR = path.join(__dirname, '..');

// MIME types
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.webmanifest': 'application/manifest+json'
};

// En-têtes pour Service Worker (requis pour HTTPS/localhost)
const SW_HEADERS = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
};

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let filePath = path.join(ROOT_DIR, url.pathname);

    // Rediriger vers index.html si dossier
    if (url.pathname.endsWith('/')) {
        filePath = path.join(filePath, 'gestion-ecole-gamaliel_v7_2.7.html');
    }

    // Extension du fichier
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Lire et servir le fichier
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // Fichier non trouvé - servir index.html pour SPA
                fs.readFile(path.join(ROOT_DIR, 'gestion-ecole-gamaliel_v7_2.7.html'), (err2, indexData) => {
                    if (err2) {
                        res.writeHead(404, { 'Content-Type': 'text/plain' });
                        res.end('404 - File not found');
                    } else {
                        res.writeHead(200, { 
                            'Content-Type': 'text/html',
                            ...SW_HEADERS
                        });
                        res.end(indexData);
                    }
                });
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`500 - Server error: ${err.code}`);
            }
            return;
        }

        // En-têtes spéciaux pour Service Worker
        const headers = {
            'Content-Type': contentType,
            ...SW_HEADERS
        };

        // Cache pour les assets statiques
        if (['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext)) {
            headers['Cache-Control'] = 'public, max-age=31536000';
        }

        res.writeHead(200, headers);
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║     🚀 SERVEUR HTTP MYGAMALIEL - DÉMARRÉ                ║
╠══════════════════════════════════════════════════════════╣
║ 🌐 URL: http://localhost:${PORT}                         ║
║ 📁 Racine: ${ROOT_DIR}                          ║
║ 🔒 Service Workers: Activés (localhost uniquement)       ║
╚══════════════════════════════════════════════════════════╝

📱 Pour tester les Service Workers:
   1. Ouvrez http://localhost:${PORT} dans Chrome/Edge
   2. Vérifiez la console (F12) → Application → Service Workers
   3. Les notifications push nécessitent HTTPS en production

⚠️  Appuyez sur Ctrl+C pour arrêter le serveur
`);
});

// Gestion des erreurs
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Le port ${PORT} est déjà utilisé`);
        console.error(`💡 Essayez: node http-server.js ${PORT + 1}`);
    } else {
        console.error('❌ Erreur serveur:', err);
    }
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n📴 Arrêt du serveur...');
    server.close(() => {
        console.log('✓ Serveur arrêté');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n📴 Arrêt du serveur (Ctrl+C)...');
    server.close(() => {
        console.log('✓ Serveur arrêté');
        process.exit(0);
    });
});
