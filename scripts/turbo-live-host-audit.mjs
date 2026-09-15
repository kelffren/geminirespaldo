import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http2 from 'node:http2';

const root = process.cwd();
const origin = (process.env.TURBO_PRODUCTION_HOST || 'https://kelo-world.netlify.app').replace(/\/$/, '');
const u = new URL(origin);

function fail(message) {
  throw new Error(`TURBO LIVE HOST AUDIT FAIL: ${message}`);
}

function request(pathname, acceptEncoding) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || 443,
      path: pathname,
      method: 'GET',
      headers: acceptEncoding ? { 'Accept-Encoding': acceptEncoding } : {}
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks),
        httpVersion: res.httpVersion
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

function proveHttp2(pathname = '/') {
  return new Promise((resolve, reject) => {
    const client = http2.connect(origin);
    let settled = false;
    const done = (err, value) => {
      if (settled) return;
      settled = true;
      try { client.close(); } catch {}
      if (err) reject(err); else resolve(value);
    };
    client.setTimeout(10000, () => done(new Error('HTTP/2 timeout')));
    client.on('error', (err) => done(err));
    const req = client.request({ ':method': 'GET', ':path': pathname });
    req.on('response', (headers) => {
      const status = Number(headers[':status'] || 0);
      req.close();
      done(null, { ok: status >= 200 && status < 400, status, alpn: client.alpnProtocol || 'h2' });
    });
    req.on('error', (err) => done(err));
    req.end();
  });
}

function cacheDirectives(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .sort();
}

function exactCache(headers, expected) {
  const actual = cacheDirectives(headers['cache-control']);
  const wanted = cacheDirectives(expected);
  return actual.length === wanted.length && actual.every((directive, index) => directive === wanted[index]);
}

async function findLiveHashedAsset() {
  const metaResponse = await request('/dist/turbo/meta.json');
  if (metaResponse.status !== 200) fail(`live meta.json status ${metaResponse.status}`);
  let meta;
  try {
    meta = JSON.parse(metaResponse.body.toString('utf8'));
  } catch (error) {
    fail(`live meta.json is invalid JSON: ${error.message}`);
  }
  const candidates = Object.entries(meta.outputs || {})
    .map(([p, info]) => ({
      path: p.replaceAll('\\', '/'),
      bytes: Number(info?.bytes || 0)
    }))
    .filter((item) => /-[A-Z0-9]{6,}\.js$/i.test(item.path))
    .sort((a, b) => b.bytes - a.bytes);
  if (!candidates.length) fail('live deploy exposes no hashed production JS asset in meta.json');
  const chosen = candidates[0].path.replace(/^\.?\//, '');
  return { path: '/' + chosen, bytes: candidates[0].bytes };
}

const hashedAsset = await findLiveHashedAsset();
const hashedPath = hashedAsset.path;
const index = await request('/index.html', 'br,gzip');
if (index.status !== 200) fail(`index status ${index.status}`);
if (!exactCache(index.headers, 'no-cache, max-age=0, must-revalidate')) fail(`index Cache-Control=${index.headers['cache-control'] || '<missing>'}`);

const version = await request('/version.json', 'br,gzip');
if (version.status !== 200) fail(`version status ${version.status}`);
if (!exactCache(version.headers, 'no-cache, max-age=0, must-revalidate')) fail(`version Cache-Control=${version.headers['cache-control'] || '<missing>'}`);

const assetBr = await request(hashedPath, 'br,gzip');
if (assetBr.status !== 200) fail(`hashed asset status ${assetBr.status} path=${hashedPath}`);
if (!exactCache(assetBr.headers, 'public, max-age=31536000, immutable')) fail(`hashed asset Cache-Control=${assetBr.headers['cache-control'] || '<missing>'}`);
const brEncoding = String(assetBr.headers['content-encoding'] || '').toLowerCase();
if (brEncoding !== 'br') fail(`expected Brotli on hashed asset (${hashedAsset.bytes} bytes), got ${brEncoding || '<none>'}`);

const assetGzip = await request(hashedPath, 'gzip');
const gzipEncoding = String(assetGzip.headers['content-encoding'] || '').toLowerCase();
if (gzipEncoding !== 'gzip') fail(`expected gzip fallback on hashed asset (${hashedAsset.bytes} bytes), got ${gzipEncoding || '<none>'}`);

const cdnHeader = String(assetBr.headers.server || assetBr.headers['x-nf-request-id'] || '').toLowerCase();
const netlifyEvidence = Boolean(assetBr.headers['x-nf-request-id']) || cdnHeader.includes('netlify');
if (!netlifyEvidence) fail('Netlify/CDN response evidence header missing');

const h2 = await proveHttp2('/');
if (!h2.ok) fail(`HTTP/2 request failed with status ${h2.status}`);

const evidence = {
  generatedAt: new Date().toISOString(),
  origin,
  hashedAsset: hashedPath,
  hashedAssetBytes: hashedAsset.bytes,
  hostingHeadersVerified: true,
  compressionVerified: true,
  transportVerified: true,
  observations: {
    indexCacheControl: index.headers['cache-control'] || null,
    versionCacheControl: version.headers['cache-control'] || null,
    hashedCacheControl: assetBr.headers['cache-control'] || null,
    brotliContentEncoding: brEncoding,
    gzipContentEncoding: gzipEncoding,
    http2: h2,
    netlifyRequestId: assetBr.headers['x-nf-request-id'] || null,
    server: assetBr.headers.server || null
  }
};

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'turbo-live-host-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(`TURBO LIVE HOST AUDIT PASS — ${origin}; liveAsset=${hashedPath}; bytes=${hashedAsset.bytes}; br=${brEncoding}; gzip=${gzipEncoding}; http2=${h2.alpn}`);
