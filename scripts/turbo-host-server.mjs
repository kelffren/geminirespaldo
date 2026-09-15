import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 10000);
const deploySha = String(process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || '').trim().toLowerCase();
const validDeploySha = /^[0-9a-f]{40,64}$/.test(deploySha) ? deploySha : null;
const deniedTop = new Set(['.git','.github','docs','tests','scripts','node_modules']);
const controlFiles = new Set(['/','/index.html','/version.json','/sw.js','/manifest.webmanifest']);
const mime = new Map([
  ['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.mjs','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],['.json','application/json; charset=utf-8'],['.webmanifest','application/manifest+json; charset=utf-8'],['.svg','image/svg+xml'],['.png','image/png'],['.jpg','image/jpeg'],['.jpeg','image/jpeg'],['.webp','image/webp'],['.avif','image/avif'],['.gif','image/gif'],['.ico','image/x-icon'],['.woff','font/woff'],['.woff2','font/woff2'],['.ttf','font/ttf'],['.mp3','audio/mpeg'],['.mp4','video/mp4'],['.wasm','application/wasm']
]);

function isHashedPath(urlPath) {
  return /(?:^|\/)(?:[^/]+-)?[a-f0-9]{8,64}\.(?:js|mjs|css|png|jpe?g|webp|avif|svg|woff2?|wasm)$/i.test(urlPath)
    || /^\/dist\/turbo\/.*-[A-Z0-9]{6,}\.(?:js|css)$/i.test(urlPath)
    || /^\/__kelo_asset_v3__\/[0-9a-f]{40,64}$/i.test(urlPath);
}
function cacheControl(urlPath) {
  if (isHashedPath(urlPath)) return 'public, max-age=31536000, immutable';
  if (controlFiles.has(urlPath) || /manifest.*\.json$/i.test(urlPath)) return 'no-cache, max-age=0, must-revalidate';
  return 'public, max-age=300, must-revalidate';
}
function compressible(contentType) {
  return /^(text\/|application\/(?:json|javascript|manifest\+json|wasm)|image\/svg\+xml)/i.test(contentType || '');
}
function safeFile(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { return null; }
  if (decoded.includes('\0')) return null;
  const clean = decoded === '/' ? '/index.html' : decoded;
  const parts = clean.split('/').filter(Boolean);
  if (!parts.length || deniedTop.has(parts[0]) || parts.some((p) => p === '..')) return null;
  const resolved = path.resolve(root, '.' + clean);
  if (!resolved.startsWith(root + path.sep)) return null;
  return resolved;
}
function send(res, status, headers, body, method) {
  res.writeHead(status, headers);
  if (method === 'HEAD') res.end(); else res.end(body);
}
function evidencePayload() {
  return JSON.stringify({
    host: process.env.RENDER_EXTERNAL_HOSTNAME || null,
    deploySha: validDeploySha,
    cachePolicy: { hashed: 'public, max-age=31536000, immutable', control: 'no-cache, max-age=0, must-revalidate' },
    compression: ['br','gzip'],
    platform: process.env.RENDER === 'true' ? 'render' : 'local',
    protocolExpectation: 'Render terminates public TLS/HTTP and supports HTTP/2; verify externally.',
    generatedAt: new Date().toISOString()
  });
}

const server = http.createServer((req, res) => {
  const method = String(req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return send(res, 405, {'content-type':'text/plain','cache-control':'no-store'}, 'Method Not Allowed', method);
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/__turbo_host_evidence.json') {
    return send(res, 200, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-kelo-turbo-host':'render-controlled'}, evidencePayload(), method);
  }
  if (url.pathname === '/version.json' && validDeploySha) {
    const body = Buffer.from(JSON.stringify({ sha: validDeploySha, builtAt: new Date().toISOString(), source: 'render-git-commit' }));
    return sendCompressed(req, res, 200, 'application/json; charset=utf-8', 'no-cache, max-age=0, must-revalidate', body, method);
  }
  const file = safeFile(url.pathname);
  if (!file) return send(res, 404, {'content-type':'text/plain','cache-control':'no-store'}, 'Not Found', method);
  let stat;
  try { stat = fs.statSync(file); } catch { return send(res, 404, {'content-type':'text/plain','cache-control':'no-store'}, 'Not Found', method); }
  if (!stat.isFile()) return send(res, 404, {'content-type':'text/plain','cache-control':'no-store'}, 'Not Found', method);
  const ext = path.extname(file).toLowerCase();
  const type = mime.get(ext) || 'application/octet-stream';
  const headers = { 'cache-control': cacheControl(url.pathname), 'content-type': type, 'vary': 'Accept-Encoding', 'x-kelo-turbo-host': 'render-controlled', 'x-content-type-options':'nosniff' };
  if (method === 'HEAD') return send(res, 200, {...headers,'content-length':String(stat.size)}, null, method);
  const body = fs.readFileSync(file);
  return sendCompressed(req, res, 200, type, headers['cache-control'], body, method, headers);
});

function sendCompressed(req, res, status, contentType, cache, body, method, extra = {}) {
  const headers = { ...extra, 'content-type': contentType, 'cache-control': cache, 'vary': 'Accept-Encoding', 'x-kelo-turbo-host':'render-controlled' };
  const accept = String(req.headers['accept-encoding'] || '');
  if (body && body.length >= 256 && compressible(contentType)) {
    if (/\bbr\b/i.test(accept)) {
      const out = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } });
      headers['content-encoding'] = 'br'; headers['content-length'] = String(out.length); return send(res, status, headers, out, method);
    }
    if (/\bgzip\b/i.test(accept)) {
      const out = zlib.gzipSync(body, { level: 6 });
      headers['content-encoding'] = 'gzip'; headers['content-length'] = String(out.length); return send(res, status, headers, out, method);
    }
  }
  if (body) headers['content-length'] = String(body.length);
  return send(res, status, headers, body, method);
}

server.listen(port, '0.0.0.0', () => {
  console.log(`KELO Turbo host listening on ${port}; deploy=${validDeploySha || 'local'}`);
});
