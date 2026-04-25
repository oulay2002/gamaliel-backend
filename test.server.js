const http = require('http');

const server = http.createServer((req, res) => {
  console.log(`📩 Requête reçue: ${req.method} ${req.url}`);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', message: 'Serveur HTTP pur fonctionne' }));
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur HTTP pur démarré sur 0.0.0.0:${PORT}`);
  console.log(`🌐 Test: http://localhost:${PORT}/`);
});

// Garder actif
setInterval(() => {}, 30000).unref();