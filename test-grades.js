const jwt = require('jsonwebtoken');
const { query } = require('./config/database');

(async () => {
    const token = jwt.sign(
        { id: 19, username: 'pere.dirrassoubamohamed.003', role: 'parent' },
        process.env.JWT_SECRET || 'gamaliel_secret_key_2024',
        { expiresIn: '1d' }
    );

    console.log('🔑 Token:', token.substring(0, 50) + '...\n');

    // Test endpoint grades
    const http = require('http');
    const options = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/parents/child/7/grades',
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log('📡 Status:', res.statusCode);
            console.log('📦 Body:', data);
            process.exit(0);
        });
    });

    req.on('error', (e) => {
        console.error('❌ Erreur:', e.message);
        process.exit(1);
    });

    req.end();
})();
