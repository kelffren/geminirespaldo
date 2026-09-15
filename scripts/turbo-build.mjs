/* KELO-INDEX
 * area: BUILD / TURBO UPDATE
 * owner: Turbo production compiler
 * keys: ESBUILD MINIFY TREE-SHAKE CODE-SPLIT HASH CHUNKS METAFILE
 * purpose: compile the modern Turbo/lazy surface with production minification, tree-shaking and content-hashed code splitting
 */
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const root = process.cwd();
const outdir = path.join(root, 'dist/turbo');
fs.rmSync(outdir, { recursive: true, force: true });
fs.mkdirSync(outdir, { recursive: true });

const result = await build({
  entryPoints: {
    'visual-lab-loader': 'src/visuals/visual-lab-loader.js',
    'update-delta-core': 'src/core/update-delta-core.js'
  },
  outdir,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['safari16.4', 'ios16.4', 'chrome110'],
  minify: true,
  treeShaking: true,
  splitting: true,
  sourcemap: false,
  metafile: true,
  legalComments: 'none',
  entryNames: 'entry/[name]-[hash]',
  chunkNames: 'chunks/[name]-[hash]',
  assetNames: 'assets/[name]-[hash]',
  logLevel: 'info'
});

const metaPath = path.join(outdir, 'meta.json');
fs.writeFileSync(metaPath, JSON.stringify(result.metafile, null, 2));

const outputs = Object.entries(result.metafile.outputs).map(([file, info]) => ({
  file: file.replaceAll('\\', '/'),
  bytes: info.bytes,
  entryPoint: info.entryPoint || null,
  imports: info.imports.map((item) => ({ path: item.path, kind: item.kind }))
}));

const report = {
  compiler: 'esbuild',
  mode: 'production',
  minify: true,
  treeShaking: true,
  codeSplitting: true,
  contentHashedNames: true,
  generatedAt: new Date().toISOString(),
  outputs
};
fs.writeFileSync(path.join(outdir, 'build-report.json'), JSON.stringify(report, null, 2));
console.log(`TURBO PRODUCTION BUILD PASS — ${outputs.length} output object(s)`);
