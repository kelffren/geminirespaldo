/* KELO-INDEX
 * area: BUILD / TURBO UPDATE
 * owner: Turbo build evidence audit
 * keys: ESBUILD OUTPUT MINIFY TREE-SHAKE SPLIT HASH CHUNKS
 * purpose: reject TU-04 unless the production build emitted real hashed split objects
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outdir = path.join(root, 'dist/turbo');
const reportPath = path.join(outdir, 'build-report.json');
const metaPath = path.join(outdir, 'meta.json');

function fail(message) {
  console.error('TURBO BUILD AUDIT FAIL:', message);
  process.exit(1);
}

if (!fs.existsSync(reportPath) || !fs.existsSync(metaPath)) fail('production build evidence missing');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
if (report.compiler !== 'esbuild' || report.mode !== 'production') fail('compiler/mode evidence invalid');
if (report.minify !== true || report.treeShaking !== true || report.codeSplitting !== true) fail('minify/tree-shaking/code-splitting flags not proven');
if (report.contentHashedNames !== true) fail('content-hashed naming not proven');

const outputs = Object.entries(meta.outputs || {});
if (outputs.length < 3) fail(`expected split build with >=3 outputs, got ${outputs.length}`);
const hashName = /-[A-Z0-9]{6,}\.(?:js|css)$/i;
if (!outputs.every(([file]) => file.endsWith('.json') || hashName.test(file.replaceAll('\\','/')))) {
  fail('one or more emitted JS/CSS objects lack content hash in filename');
}
const entryOutputs = outputs.filter(([, info]) => info.entryPoint);
const lazyImports = outputs.flatMap(([, info]) => info.imports || []).filter((item) => item.kind === 'dynamic-import');
if (entryOutputs.length < 2) fail('expected at least two real entry outputs');
if (lazyImports.length < 1) fail('Visual Lab dynamic import did not survive as code-split lazy edge');

for (const [file, info] of outputs) {
  if (!file.endsWith('.js')) continue;
  const full = path.join(root, file);
  if (!fs.existsSync(full)) fail(`metafile output missing on disk: ${file}`);
  const source = fs.readFileSync(full, 'utf8');
  if (source.length > 0 && source.split('\n').length > 20) fail(`output does not look minified: ${file}`);
  if (Number(info.bytes) <= 0) fail(`invalid output byte count: ${file}`);
}

console.log(`TURBO BUILD AUDIT PASS — ${outputs.length} hashed output objects; ${lazyImports.length} lazy split edge(s)`);
