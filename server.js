/**
 * Mafhal Sub — Live Static File Server
 * Uses ONLY Node.js built-in modules (no npm install needed)
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT = 8080;
const ROOT = __dirname;

const MIME = {
  '.html' : 'text/html; charset=utf-8',
  '.css'  : 'text/css',
  '.js'   : 'application/javascript',
  '.json' : 'application/json',
  '.png'  : 'image/png',
  '.jpg'  : 'image/jpeg',
  '.jpeg' : 'image/jpeg',
  '.gif'  : 'image/gif',
  '.svg'  : 'image/svg+xml',
  '.ico'  : 'image/x-icon',
  '.webp' : 'image/webp',
  '.woff' : 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf'  : 'font/ttf',
  '.mp4'  : 'video/mp4',
  '.txt'  : 'text/plain',
};

const server = http.createServer((req, res) => {
  // Parse pathname and decode URI
  let pathname = decodeURIComponent(url.parse(req.url).pathname);

  // Default to landing.html for root
  if (pathname === '/' || pathname === '') {
    pathname = '/landing.html';
  }

  const filePath = path.join(ROOT, pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // Try adding .html
      const htmlPath = filePath + '.html';
      fs.stat(htmlPath, (err2, stat2) => {
        if (err2 || !stat2.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('<h2 style="font-family:sans-serif;color:#0d1b3e">404 — Page not found</h2>');
        } else {
          serve(res, htmlPath);
        }
      });
    } else {
      serve(res, filePath);
    }
  });
});

function serve(res, filePath) {
  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    res.writeHead(500);
    res.end('Server Error');
  });

  res.writeHead(200, {
    'Content-Type'  : mime,
    'Cache-Control' : 'no-cache',
    'Access-Control-Allow-Origin': '*',
  });
  stream.pipe(res);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║       MAFHAL SUB — Live Server Running       ║');
  console.log('  ╠══════════════════════════════════════════════╣');
  console.log(`  ║  🌐  http://localhost:${PORT}/landing.html     ║`);
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
  console.log('  Press Ctrl+C to stop the server.');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ❌  Port ${PORT} is already in use. Try a different port.\n`);
  } else {
    console.error('\n  ❌  Server error:', err.message, '\n');
  }
  process.exit(1);
});
