const http = require('http');

const options = {
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/parents/child/7/grades',
    method: 'GET',
    headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksInVzZXJuYW1lIjoicGVyZS5kaXJyYXNzb3ViYW1vaGFtZWQuMDAzIiwicm9sZSI6InBhcmVudCIsImlhdCI6MTc3NTIyNzUxNiwiZXhwIjoxNzc1ODMyMzE2fQ.04zUzXD7iecjmAeZxEndRH46macuPLTDi9EEjMIECxI'
    }
};

console.log('📡 Requête GET /api/parents/child/7/grades...\n');

const req = http.request(options, (res) => {
    let data = '';
    console.log('✅ Status:', res.statusCode);
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('📦 Réponse:', data);
        process.exit(0);
    });
});

req.on('error', (e) => {
    console.error('❌ Erreur:', e.message);
    process.exit(1);
});

req.end();
