import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const root = process.cwd();
const port = 18777;
const env = { ...process.env, PORT: String(port), RENDER_GIT_COMMIT: '0123456789abcdef0123456789abcdef01234567' };
const child = spawn(process.execPath, ['scripts/turbo-host-server.mjs'], { cwd: root, env, stdio: ['ignore','pipe','pipe'] });
let log = '';
child.stdout.on('data', (d) => { log += d.toString(); });
child.stderr.on('data', (d) => { log += d.toString(); });

function request(pathname, acceptEncoding) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname:'127.0.0.1', port, path:pathname, method:'GET', headers: acceptEncoding ? {'Accept-Encoding':acceptEncoding} : {} }, (res) => {
      const chunks=[]; res.on('data',(c)=>chunks.push(c)); res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
    });
    req.on('error', reject); req.end();
  });
}
async function waitReady() {
  for (let i=0;i<50;i++) { try { const r=await request('/__turbo_host_evidence.json'); if(r.status===200)return; } catch {} await new Promise(r=>setTimeout(r,100)); }
  throw new Error('host did not become ready: '+log);
}
function assert(cond,msg){ if(!cond) throw new Error('TURBO HOST INTEGRATION FAIL: '+msg); }

function findHashedProductionJs(baseDir) {
  if (!fs.existsSync(baseDir)) return null;
  const stack = [baseDir];
  const matches = [];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (entry.isFile() && /-[A-Z0-9]{6,}\.js$/i.test(entry.name)) {
        matches.push(absolute);
      }
    }
  }
  if (!matches.length) return null;
  // Prefer a non-trivial asset so compression negotiation is actually exercised.
  matches.sort((a,b) => fs.statSync(b).size - fs.statSync(a).size);
  return matches[0];
}

try {
  await waitReady();
  const index = await request('/index.html','br,gzip');
  assert(index.status===200,'index not served');
  assert(index.headers['cache-control']==='no-cache, max-age=0, must-revalidate','index revalidation header wrong');
  assert(index.headers['content-encoding']==='br','index did not negotiate Brotli');

  const version = await request('/version.json','gzip');
  assert(version.status===200,'version not served');
  assert(version.headers['cache-control']==='no-cache, max-age=0, must-revalidate','version revalidation header wrong');
  // version.json is intentionally tiny and may stay uncompressed. Compression is
  // proven below against a production asset large enough to exercise negotiation.

  const dist = path.join(root,'dist','turbo');
  const hashedAbsolute = findHashedProductionJs(dist);
  assert(hashedAbsolute,'no hashed production JS asset found recursively under dist/turbo; run npm run build first');
  const hashedRelative = path.relative(dist, hashedAbsolute).split(path.sep).join('/');
  const hashedUrl = '/dist/turbo/' + hashedRelative;

  const assetBr = await request(hashedUrl,'br,gzip');
  assert(assetBr.status===200,'hashed asset not served');
  assert(assetBr.headers['cache-control']==='public, max-age=31536000, immutable','hashed asset is not immutable');
  assert(assetBr.headers['content-encoding']==='br','hashed asset did not negotiate Brotli');

  const assetGzip = await request(hashedUrl,'gzip');
  assert(assetGzip.status===200,'hashed asset not served for gzip negotiation');
  assert(assetGzip.headers['cache-control']==='public, max-age=31536000, immutable','gzip hashed asset is not immutable');
  assert(assetGzip.headers['content-encoding']==='gzip','hashed asset did not negotiate gzip fallback');

  const denied = await request('/scripts/turbo-host-server.mjs');
  assert(denied.status===404,'server source is publicly exposed');

  console.log(`TURBO HOST INTEGRATION PASS — revalidation, immutable hashed assets, Brotli, gzip and source denylist proven; asset=${hashedRelative}`);
} finally {
  child.kill('SIGTERM');
}
