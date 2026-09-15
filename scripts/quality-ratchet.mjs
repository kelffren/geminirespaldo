/* KELO-INDEX
 * area: QA / CODE QUALITY
 * owner: Kelo Quality Ratchet
 * owns: changed-code syntax gate and incremental architecture hygiene
 * does-not-own: runtime behavior, gameplay, formatting, full static typing
 * purpose: prevent new debt while legacy is migrated gradually
 * public-api: CLI `node scripts/quality-ratchet.mjs`
 * extension-points: add deterministic rules with narrow scope and explicit allow markers
 * reuse: CI + local pre-commit/pre-merge verification
 */
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODE_EXT = /\.(?:js|mjs|cjs)$/i;
const CRITICAL_SOURCE = /^src\/(?:core|studio|creators|environment|ui)\//;
let failures = 0;
let warnings = 0;

function fail(message){ failures += 1; console.error('QUALITY_FAIL:', message); }
function warn(message){ warnings += 1; console.warn('QUALITY_WARN:', message); }
function ok(message){ console.log('QUALITY_OK:', message); }
function exists(rel){ return fs.existsSync(path.join(ROOT, rel)); }
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function git(args){
  try {
    return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim();
  } catch {
    return '';
  }
}
function resolveBase(){
  const envBase = process.env.KELO_QUALITY_BASE;
  if(envBase && git(['rev-parse','--verify',envBase])) return envBase;
  const foundationBase = process.env.KELO_FOUNDATION_BASE;
  if(foundationBase && git(['rev-parse','--verify',foundationBase])) return foundationBase;
  const ghBase = process.env.GITHUB_BASE_REF;
  if(ghBase && git(['rev-parse','--verify','origin/' + ghBase])) return 'origin/' + ghBase;
  if(git(['rev-parse','--verify','HEAD^'])) return 'HEAD^';
  return null;
}
function codeOnlyLine(line){
  const trimmed = line.trim();
  if(trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return '';
  let out = '', quote = '', escaped = false;
  for(let i=0;i<line.length;i++){
    const c=line[i], n=line[i+1];
    if(quote){
      if(escaped){ escaped=false; out+=' '; continue; }
      if(c==='\\'){ escaped=true; out+=' '; continue; }
      if(c===quote){ quote=''; out+=' '; continue; }
      out+=' '; continue;
    }
    if(c==='/' && n==='/') break;
    if(c==='/' && n==='*') break;
    if(c==='"' || c==="'" || c==='`'){ quote=c; out+=' '; continue; }
    out+=c;
  }
  return out;
}
function hasGlobalAssignment(line,name){
  const code=codeOnlyLine(line);
  if(!code) return false;
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('\\b(?:window|globalThis|root)\\.'+escaped+'\\s*=').test(code);
}
function changedFiles(base){
  const raw=git(['diff','--name-status',base+'...HEAD']);
  return raw.split('\n').filter(Boolean).map(row=>{
    const parts=row.split('\t');
    return { status:parts[0], file:parts[parts.length-1] };
  });
}
function addedLines(base){
  const raw=git(['diff','--unified=0',base+'...HEAD','--','*.js','*.mjs','*.cjs','*.html']);
  let currentFile='';
  const out=[];
  for(const line of raw.split('\n')){
    if(line.startsWith('+++ b/')){ currentFile=line.slice(6); continue; }
    if(!line.startsWith('+') || line.startsWith('+++')) continue;
    out.push({file:currentFile,line:line.slice(1)});
  }
  return out;
}
function syntaxCheck(file){
  const abs=path.join(ROOT,file);
  const result=cp.spawnSync(process.execPath,['--check',abs],{cwd:ROOT,encoding:'utf8'});
  if(result.status!==0){
    fail('syntax error in '+file+'\n'+String(result.stderr||result.stdout||'').trim());
    return;
  }
  ok('syntax '+file);
}

const base=resolveBase();
if(!base){
  warn('no git base found; incremental diff checks skipped. CI must checkout with fetch-depth: 0');
} else {
  const files=changedFiles(base);
  const lines=addedLines(base);

  for(const entry of files){
    if(!/^[AMRC]/.test(entry.status) || !exists(entry.file)) continue;
    if(CODE_EXT.test(entry.file)) syntaxCheck(entry.file);

    if(entry.status.startsWith('A') && /^src\//.test(entry.file) && CODE_EXT.test(entry.file)){
      const head=read(entry.file).split(/\r?\n/).slice(0,40).join('\n');
      if(!head.includes('KELO-INDEX')) fail('new source file missing KELO-INDEX contract: '+entry.file);
    }

    if(/^src\//.test(entry.file) && CODE_EXT.test(entry.file)){
      const loc=read(entry.file).split(/\r?\n/).length;
      if(loc>900) warn('changed source file is '+loc+' lines; prefer extraction over adding more responsibilities: '+entry.file);
    }
  }

  for(const entry of lines){
    const code=codeOnlyLine(entry.line);
    if(!code || code.includes('QUALITY-ALLOW')) continue;

    if(CRITICAL_SOURCE.test(entry.file) && /catch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(code)){
      fail('new silent catch in critical code; report, handle, or annotate intentional suppression: '+entry.file+' :: '+entry.line.trim());
    }
    if(CRITICAL_SOURCE.test(entry.file) && /setTimeout\s*\(/.test(code) && /ready|mount|open|load|boot|retry|repair|recover|fix|force/i.test(code)){
      fail('new timer-based readiness/repair logic; use explicit lifecycle state, promise, or event: '+entry.file+' :: '+entry.line.trim());
    }
    if(/^src\/(?:studio|creators)\//.test(entry.file) && /import\s*\(/.test(code) && /Date\.now\s*\(|Math\.random\s*\(/.test(code)){
      fail('new cache-busting fresh import in Studio/Creator code; fix lifecycle ownership instead: '+entry.file+' :: '+entry.line.trim());
    }
    if(/^src\/(?:ui|studio|creators)\//.test(entry.file) && /\blocalPlayer\.(?:x|y|hp|maxHp)\s*=/.test(code)){
      fail('presentation/creator code directly mutates player authority state: '+entry.file+' :: '+entry.line.trim());
    }
    if(/^src\/(?:ui|studio|creators)\//.test(entry.file) && /\bobstacles\.push\s*\(/.test(code)){
      fail('presentation/creator code directly mutates legacy obstacles: '+entry.file+' :: '+entry.line.trim());
    }
    if(['render','renderAvatar','updateSimulation','processInput','updateMovement'].some(name=>hasGlobalAssignment(entry.line,name))){
      fail('new direct assignment to a core global owner: '+entry.file+' :: '+entry.line.trim());
    }
    if(entry.file!=='src/core/input-lock-system.js' && hasGlobalAssignment(entry.line,'KELO_MODAL_INPUT_LOCK')){
      fail('new direct legacy modal-lock assignment outside owner: '+entry.file+' :: '+entry.line.trim());
    }
    if(/(^|\/)engine[-_]?v?2/i.test(entry.file)){
      fail('parallel engine-v2 style architecture is forbidden: '+entry.file);
    }
  }

  ok('quality ratchet inspected changes against '+base);
}

if(failures){
  console.error(`\nKelo Quality Ratchet failed with ${failures} violation(s) and ${warnings} warning(s).`);
  process.exit(1);
}
ok(`Kelo Quality Ratchet passed${warnings ? ` with ${warnings} warning(s)` : ''}`);
