const http = require('http');

const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
  // Logger la requête
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // Répondre IMMÉDIATEMENT
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    status: 'ok',
    message: 'Serveur fonctionnel',
    timestamp: new Date().toISOString()
  }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ SERVEUR DÉMARRÉ SUR 0.0.0.0:${PORT}`);
  console.log(`🌐 Test: curl http://localhost:${PORT}/`);
});

// Garder le processus actif
process.stdin.resume();

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Serveur arrêté');
    process.exit(0);
  });
});