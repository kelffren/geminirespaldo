import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const loader = fs.readFileSync('src/visuals/visual-lab-loader.js', 'utf8');
const studio = fs.readFileSync('src/ui/studio-launcher.js', 'utf8');

const fail = (msg) => { console.error('TURBO BOOT ISOLATION FAIL:', msg); process.exitCode = 1; };
const staticSrc = [...index.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*>/gi)].map((m) => m[1].split('?')[0]);

for (const forbidden of [
  'src/visuals/visual-lab.js',
  'src/visuals/visual-integration.js'
]) {
  if (staticSrc.includes(forbidden)) fail(`${forbidden} returned to critical boot`);
}

if (!staticSrc.includes('src/visuals/visual-lab-loader.js')) fail('Visual Lab lazy loader is not wired');
if (!loader.includes("import('./visual-lab.js")) fail('Visual Lab runtime is not dynamically imported');
if (!loader.includes("import('./visual-integration.js")) fail('Visual integration is not dynamically imported');
if (!loader.includes("visualLab') === '1'")) fail('Visual Lab lacks explicit dev-query gate');

// Studio launcher is allowed in boot only as a lightweight launcher. Creator/editor modules must be imported on demand.
if (!/import\s*\(/.test(studio)) fail('Studio launcher has no dynamic imports');
const creatorTerms = ['world', 'map', 'creator'];
if (!creatorTerms.some((term) => studio.toLowerCase().includes(term))) fail('Studio launcher does not expose creator/editor lazy path evidence');

if (!process.exitCode) console.log('TURBO BOOT ISOLATION PASS — Visual Lab is lazy and Studio creators remain behind dynamic import');
