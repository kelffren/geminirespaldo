/* KELO-INDEX
 * area: QA / FOUNDATION
 * owner: FOUNDATION CI
 * purpose: impide que cambios nuevos reintroduzcan deuda arquitectónica prohibida
 * public-api: CLI `node scripts/foundation-architecture-audit.js`
 * consumes: git diff, AGENTS.md, docs/KELO_FOUNDATION.md, ENGINE_MAP.md, index.html
 * state-owned: ninguno
 * extension-points: añadir reglas pequeñas y deterministas; no convertir en linter general
 * reuse: ejecutar en PR y localmente antes de merge
 * legacy: N/A
 * do-not: no usar este audit para justificar reescrituras masivas
 */
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;

function fail(message) { failures += 1; console.error('FOUNDATION_FAIL:', message); }
function ok(message) { console.log('FOUNDATION_OK:', message); }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function requireText(rel, needles) {
  if (!exists(rel)) { fail(rel + ' missing'); return; }
  const text = read(rel);
  needles.forEach((needle) => { if (!text.includes(needle)) fail(rel + ' missing required marker: ' + needle); });
}

requireText('docs/KELO_FOUNDATION.md', [
  'OWNER único por responsabilidad',
  '¿QUÉ OWNER EXISTENTE DEBERÍA HACER ESTO?',
  'CONTENIDO',
  'CAPACIDAD',
  'IDENTIFICAR → MIGRAR CONSUMIDORES → TEST → LIVE → MARCAR DEAD → RETIRAR'
]);
requireText('AGENTS.md', ['docs/KELO_FOUNDATION.md', '1 RESPONSABILIDAD = 1 OWNER']);
requireText('ENGINE_MAP.md', ['docs/KELO_FOUNDATION.md', 'OWNER LIVE']);
requireText('src/ui/force-unlock-move.js', ['NO REUTILIZAR']);
if (exists('src/ui/force-unlock-move.js')) {
  const hotfix = read('src/ui/force-unlock-move.js');
  if (!hotfix.includes('HOTFIX TEMPORAL') && !hotfix.includes('RETIRED HOTFIX')) {
    fail('src/ui/force-unlock-move.js must be marked HOTFIX TEMPORAL or RETIRED HOTFIX');
  }
}

if (exists('index.html')) {
  const html = read('index.html');
  const scriptRe = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = scriptRe.exec(html))) {
    const src = match[1].split('?')[0];
    if (/^(https?:)?\/\//.test(src)) continue;
    if (!exists(src)) fail('index.html references missing script: ' + src);
  }
}

function git(args) {
  try { return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch (_) { return ''; }
}
function resolveBase() {
  const envBase = process.env.KELO_FOUNDATION_BASE;
  if (envBase && git(['rev-parse', '--verify', envBase])) return envBase;
  const ghBase = process.env.GITHUB_BASE_REF;
  if (ghBase && git(['rev-parse', '--verify', 'origin/' + ghBase])) return 'origin/' + ghBase;
  if (git(['rev-parse', '--verify', 'HEAD^'])) return 'HEAD^';
  return null;
}
function isContractFixture(file){return /^scripts\/.*(?:contract|audit|test).*\.js$/i.test(file);}
function isAuthorizedCoreWrapper(entry, ruleName){
  if (ruleName !== 'new direct core wrapper') return false;
  const authorized={
    'src/core/input-system.js':'owner: KeloInput',
    'src/core/movement-system.js':'owner: KeloMovement',
    'src/core/render-extension-system.js':'owner: KeloRender',
    'src/core/simulation-extension-system.js':'owner: KeloSimulation',
    'src/core/avatar-render-system.js':'owner: KeloAvatar'
  };
  const ownerMarker=authorized[entry.file];
  if(!ownerMarker||!exists(entry.file))return false;
  const source=read(entry.file);
  return source.includes('FOUNDATION-ALLOW')&&source.includes(ownerMarker);
}
function codeOnlyLine(line){
  const trimmed=line.trim();
  if(trimmed.startsWith('//')||trimmed.startsWith('/*')||trimmed.startsWith('*'))return '';
  let out='',quote='',escaped=false;
  for(let i=0;i<line.length;i++){
    const c=line[i],n=line[i+1];
    if(quote){
      if(escaped){escaped=false;out+=' ';continue;}
      if(c==='\\'){escaped=true;out+=' ';continue;}
      if(c===quote){quote='';out+=' ';continue;}
      out+=' ';continue;
    }
    if(c==='/'&&n==='/')break;
    if(c==='/'&&n==='*')break;
    if(c==='"'||c==="'"||c==='`'){quote=c;out+=' ';continue;}
    out+=c;
  }
  return out;
}
function hasGlobalAssignment(line,name){
  const code=codeOnlyLine(line);
  if(!code)return false;
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const explicit=new RegExp('\\b(?:window|globalThis|root)\\.'+escaped+'\\s*=');
  const bare=new RegExp('(?:^|[;{}]|\\))\\s*'+escaped+'\\s*=');
  return explicit.test(code)||bare.test(code);
}
function hasCoreGlobalAssignment(line){
  return ['render','renderAvatar','updateSimulation','processInput','updateMovement'].some((name)=>hasGlobalAssignment(line,name));
}

const base = resolveBase();
if (!base) {
  console.warn('FOUNDATION_WARN: no git base found; static checks only');
} else {
  const diff = git(['diff', '--unified=0', base + '...HEAD', '--', '*.js', '*.html']);
  const nameStatus = git(['diff', '--name-status', base + '...HEAD']);
  let currentFile = '';
  const added = [];
  diff.split('\n').forEach((line) => {
    if (line.startsWith('+++ b/')) { currentFile = line.slice(6); return; }
    if (!line.startsWith('+') || line.startsWith('+++')) return;
    added.push({ file: currentFile, line: line.slice(1) });
  });

  const forbidden = [
    { name: 'new direct core wrapper', test: (x) => hasCoreGlobalAssignment(x.line) },
    { name: 'new watchdog/timer used as state repair', test: (x) => /setInterval\s*\(/.test(codeOnlyLine(x.line)) && /unlock|lock|restore|repair|force|fix/i.test(codeOnlyLine(x.line)) },
    { name: 'UI directly mutates player position/HP', test: (x) => /^src\/ui\//.test(x.file) && /\blocalPlayer\.(x|y|hp|maxHp)\s*=/.test(codeOnlyLine(x.line)) },
    { name: 'UI directly pushes physical obstacle', test: (x) => /^src\/ui\//.test(x.file) && /\bobstacles\.push\s*\(/.test(codeOnlyLine(x.line)) },
    { name: 'new engine-v2 style parallel core file', test: (x) => /(^|\/)engine[-_]?v?2/i.test(x.file) },
    { name: 'new direct legacy modal-lock write', test: (x) => !isContractFixture(x.file) && x.file !== 'src/core/input-lock-system.js' && hasGlobalAssignment(x.line,'KELO_MODAL_INPUT_LOCK') }
  ];

  added.forEach((entry) => {
    forbidden.forEach((rule) => {
      if (isAuthorizedCoreWrapper(entry, rule.name)) return;
      if (rule.test(entry)) fail(rule.name + ' in ' + entry.file + ': ' + entry.line.trim());
    });
  });

  nameStatus.split('\n').filter(Boolean).forEach((row) => {
    const parts = row.split('\t');
    const status = parts[0];
    const file = parts[parts.length - 1];
    if (status === 'A' && /\.(js|html)$/.test(file) && exists(file) && !read(file).includes('KELO-INDEX')) {
      fail('new code file missing KELO-INDEX: ' + file);
    }
  });

  ok('diff guard inspected changes against ' + base);
}

if (failures) {
  console.error('\nKelo Foundation architecture audit failed with ' + failures + ' violation(s).');
  process.exit(1);
}

ok('Kelo Foundation architecture contract passed');