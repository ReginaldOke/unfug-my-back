// Local development server: serves web/ (and three.js from node_modules) on this Mac only.
// It listens on 127.0.0.1, so other devices on the network can't reach it; set HOST=0.0.0.0 to test
// from a phone on the same Wi-Fi, and only on a network you trust.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./web/', import.meta.url));
const threeRoot = fileURLToPath(new URL('./node_modules/three/', import.meta.url));
const port = Number(process.env.PORT) || 4321;
const host = process.env.HOST || '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
  '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.obj': 'text/plain', '.bin': 'application/octet-stream',
};

function sendJSON(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJSON(res, 405, { error: 'Not allowed' });

  // three.js is served straight from node_modules (see the import map in index.html)
  const base = path.startsWith('/vendor/three/') ? threeRoot : root;
  const rel = base === threeRoot ? path.slice('/vendor/three/'.length) : path;
  const file = normalize(join(base, rel.endsWith('/') || rel === '' ? `${rel}index.html` : rel));
  if (!file.startsWith(base)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).on('error', e => {
  if (e.code !== 'EADDRINUSE') throw e;
  console.error(`Port ${port} is already in use — is the app already running? Stop it, or start on another port: PORT=4322 npm start`);
  process.exit(1);
}).listen(port, host, () => {
  console.log(`Unfug My Back running at http://${host === '127.0.0.1' ? 'localhost' : host}:${port}`);
});
