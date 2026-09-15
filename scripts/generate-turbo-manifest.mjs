/* KELO-INDEX
 * area: CORE
 * owner: Turbo Update build evidence
 * keys: TURBO UPDATE MANIFEST SHA256 DELTA CONTENT HASH
 * purpose: generate a deterministic per-file content manifest from the critical web shell for CI integrity verification
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const indexPath = path.join(root, 'index.html');
if (!fs.existsSync(indexPath)) throw new Error('index.html missing');

const html = fs.readFileSync(indexPath, 'utf8');
const discovered = new Set(['index.html', 'sw.js', 'manifest.webmanifest', 'version.json']);
const attrRe = /<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi;
for (const match of html.matchAll(attrRe)) {
  const raw = String(match[1] || '').trim();
  if (!raw || /^(?:https?:|data:|blob:|#)/i.test(raw)) continue;
  const clean = raw.split('#')[0].split('?')[0].replace(/^\.\//, '').replace(/^\//, '');
  if (clean) discovered.add(clean);
}

const files = [];
for (const relative of [...discovered].sort()) {
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(root + path.sep) && absolute !== root) continue;
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
  const bytes = fs.readFileSync(absolute);
  files.push({
    path: relative.replace(/\\/g, '/'),
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length
  });
}

if (!files.length) throw new Error('Turbo manifest has no files');
const payload = {
  schema: 'kelo.turbo-update-manifest.v1',
  hashAlgorithm: 'sha256',
  generatedFrom: 'critical-web-shell',
  files
};
fs.writeFileSync(path.join(root, 'turbo-update-manifest.json'), JSON.stringify(payload, null, 2) + '\n');
console.log(`TURBO MANIFEST GENERATED: ${files.length} files, ${files.reduce((n, f) => n + f.bytes, 0)} bytes`);
