/* KELO-INDEX
 * area: QA / LEGACY MODERNIZATION
 * owner: Kelo Legacy Observatory
 * owns: static census of legacy dependencies, globals, writers, timers and risk signals
 * does-not-own: runtime behavior, migration activation, gameplay semantics
 * purpose: make legacy ownership measurable before migration
 * public-api: CLI `node scripts/legacy-observatory.mjs`
 * extension-points: add narrow detectors and authority keys
 * reuse: CI + migration planning
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'legacy-observatory');
const SOURCE_EXT = /\.(?:js|mjs|cjs|html)$/i;
const LEGACY_NAME = /(^|\/)engine-[^/]+\.js$/i;
const CRITICAL_KEYS = [
  'localPlayer.x','localPlayer.y','localPlayer.hp','localPlayer.maxHp',
  'cameraX','cameraY','velocityX','velocityY','obstacles','worldMap',
  'render','renderAvatar','updateSimulation','processInput','updateMovement'
];
const CRITICAL_AUTHORITY_KEYS = new Set(['localPlayer.x','localPlayer.y','localPlayer.hp','localPlayer.maxHp','obstacles','render','updateSimulation','processInput','updateMovement']);
const ACCESSOR_ROUTED_AUTHORITY = Object.freeze({
  'localPlayer.hp':Object.freeze({owner:'KeloPlayerState',file:'src/core/player-state-system.js',evidence:'KELO_PLAYER_STATE_AUDIT'}),
  'localPlayer.maxHp':Object.freeze({owner:'KeloPlayerState',file:'src/core/player-state-system.js',evidence:'KELO_PLAYER_STATE_AUDIT'})
});
const MUTATING_COLLECTION_METHODS='push|pop|shift|unshift|splice|sort|reverse|copyWithin|fill';

function walk(dir, out=[]){
  if(!fs.existsSync(dir)) return out;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(['.git','node_modules','dist','coverage','artifacts'].includes(entry.name)) continue;
    const abs=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(abs,out);
    else if(SOURCE_EXT.test(entry.name)) out.push(abs);
  }
  return out;
}
function rel(abs){ return path.relative(ROOT,abs).replaceAll('\\','/'); }
function scopeFor(file){ return /^(?:scripts|tests|\.github)\//.test(rel(file))?'qa':'runtime'; }
function count(re,text){ return [...text.matchAll(re)].length; }
function uniq(values){ return [...new Set(values)].sort(); }
function esc(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function countAuthorityWrites(key,text){
  const tail=key.includes('.') ? key.split('.').map(esc).join('\\.') : esc(key);
  if(key.includes('.')){
    return count(new RegExp('(?:\\b'+tail+'\\s*=(?!=)|\\b'+tail+'\\s*(?:\\+\\+|--|\\+=|-=|\\*=|/=))','g'),text);
  }
  // Simple identifiers are global contracts only when assigned as a statement or explicitly through a global object.
  // This intentionally ignores local declarations (`const render =`), destructuring/default params (`{render=true}`),
  // object fields and other lexical variables that merely share the authority contract name.
  const statement=new RegExp('^[\\t ]*'+tail+'\\s*(?:=(?!=)|\\+\\+|--|\\+=|-=|\\*=|/=)','gm');
  const explicitGlobal=new RegExp('\\b(?:window|globalThis|root)\\.'+tail+'\\s*(?:=(?!=)|\\+\\+|--|\\+=|-=|\\*=|/=)','g');
  return count(statement,text)+count(explicitGlobal,text);
}
function detect(file){
  const text=fs.readFileSync(file,'utf8');
  const fileName=rel(file);
  const imports=uniq([
    ...[...text.matchAll(/\bimport\s+(?:[^'\"]+?\s+from\s+)?['\"]([^'\"]+)['\"]/g)].map(m=>m[1]),
    ...[...text.matchAll(/\bimport\s*\(\s*['\"]([^'\"]+)['\"]\s*\)/g)].map(m=>m[1])
  ]);
  const globalReads=uniq([...text.matchAll(/\b(?:window|globalThis|root)\.([A-Za-z_$][\w$]*)/g)].map(m=>m[1]));
  const globalWrites=uniq([...text.matchAll(/\b(?:window|globalThis|root)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)].map(m=>m[1]));
  const writers=[];
  for(const key of CRITICAL_KEYS){
    let n=countAuthorityWrites(key,text);
    if(key==='obstacles'){
      n+=count(new RegExp('\\bobstacles\\s*\\.\\s*(?:'+MUTATING_COLLECTION_METHODS+')\\s*\\(','g'),text);
      n+=count(/\bobstacles\s*\[[^\]]+\]\s*=(?!=)/g,text);
      n+=count(/\bobstacles\s*\.\s*length\s*=(?!=)/g,text);
    }
    if(n) writers.push({key,count:n});
  }
  const listeners=uniq([...text.matchAll(/addEventListener\s*\(\s*['\"]([^'\"]+)['\"]/g)].map(m=>m[1]));
  const timers={timeout:count(/\bsetTimeout\s*\(/g,text), interval:count(/\bsetInterval\s*\(/g,text), raf:count(/\brequestAnimationFrame\s*\(/g,text)};
  const legacyRefs=uniq([...text.matchAll(/engine-[a-z0-9_-]+\.js/gi)].map(m=>m[0]));
  const score = globalWrites.length*4 + writers.reduce((a,b)=>a+b.count*5,0) + timers.interval*3 + timers.timeout + legacyRefs.length*2 + (LEGACY_NAME.test(fileName)?8:0);
  const risk=score>=40?'critical':score>=20?'high':score>=8?'medium':'low';
  return {file:fileName,scope:scopeFor(file),legacy:LEGACY_NAME.test(fileName),imports,legacyRefs,globalReads,globalWrites,writers,listeners,timers,score,risk};
}

const rows=walk(ROOT).map(detect);
const rowFiles=new Set(rows.map(r=>r.file));
const legacy=rows.filter(r=>r.legacy);
const authority={};
for(const row of rows){
  for(const w of row.writers){
    authority[w.key] ??=[];
    authority[w.key].push({file:row.file,count:w.count,legacy:row.legacy,scope:row.scope});
  }
}
const routedAuthority={};
for(const [key,boundary] of Object.entries(ACCESSOR_ROUTED_AUTHORITY)){
  const rawWriters=(authority[key]||[]).filter(w=>w.scope==='runtime');
  routedAuthority[key]={...boundary,installed:rowFiles.has(boundary.file),rawWriters};
}
const conflicts=Object.entries(authority).filter(([,writers])=>writers.length>1).map(([key,writers])=>({key,writers}));
const runtimeConflicts=conflicts.map(function(conflict){
  return {key:conflict.key,writers:conflict.writers.filter(w=>w.scope==='runtime')};
}).filter(function(conflict){
  if(conflict.writers.length<=1)return false;
  const routed=routedAuthority[conflict.key];
  return !(routed&&routed.installed);
});
const summary={
  generatedAt:new Date().toISOString(),
  filesScanned:rows.length,
  legacyFiles:legacy.length,
  criticalLegacy:legacy.filter(r=>r.risk==='critical').map(r=>r.file),
  highLegacy:legacy.filter(r=>r.risk==='high').map(r=>r.file),
  authorityConflicts:conflicts.length,
  runtimeAuthorityConflicts:runtimeConflicts.length,
  accessorRoutedAuthorityKeys:Object.keys(routedAuthority).filter(k=>routedAuthority[k].installed),
  criticalAuthorityConflicts:conflicts.filter(c=>CRITICAL_AUTHORITY_KEYS.has(c.key)).length,
  criticalRuntimeAuthorityConflicts:runtimeConflicts.filter(c=>CRITICAL_AUTHORITY_KEYS.has(c.key)).length
};

fs.mkdirSync(OUT_DIR,{recursive:true});
fs.writeFileSync(path.join(OUT_DIR,'report.json'),JSON.stringify({summary,authority,routedAuthority,conflicts,runtimeConflicts,legacy,files:rows},null,2));
const md=[];
md.push('# Kelo Legacy Observatory','',`Generated: ${summary.generatedAt}`,'',`- Files scanned: ${summary.filesScanned}`,`- Legacy engine files: ${summary.legacyFiles}`,`- Static authority conflicts: ${summary.authorityConflicts}`,`- Runtime authority conflicts: ${summary.runtimeAuthorityConflicts}`,`- Accessor-routed authority keys: ${summary.accessorRoutedAuthorityKeys.length}`,`- Critical runtime authority conflicts: ${summary.criticalRuntimeAuthorityConflicts}`,'','## Legacy risk');
for(const row of [...legacy].sort((a,b)=>b.score-a.score)) md.push(`- **${row.risk.toUpperCase()}** ${row.file} — score ${row.score}; globals writes ${row.globalWrites.length}; critical writes ${row.writers.reduce((a,b)=>a+b.count,0)}; timers ${row.timers.timeout+row.timers.interval}`);
md.push('','## Runtime authority conflicts');
if(!runtimeConflicts.length) md.push('- None detected by static scanner.');
for(const c of runtimeConflicts) md.push(`- **${c.key}**: ${c.writers.map(w=>`${w.file} (${w.count})`).join(', ')}`);
md.push('','## Accessor-routed authority');
for(const [key,routed] of Object.entries(routedAuthority)){
  md.push(`- **${key}** → ${routed.owner} (${routed.installed?'installed':'MISSING'}); raw compatibility writers: ${routed.rawWriters.map(w=>`${w.file} (${w.count})`).join(', ')||'none'}`);
}
md.push('','## QA/static-only conflicts');
const runtimeKeys=new Set(runtimeConflicts.map(c=>c.key));
const routedKeys=new Set(Object.entries(routedAuthority).filter(([,v])=>v.installed).map(([k])=>k));
const qaOnly=conflicts.filter(c=>!runtimeKeys.has(c.key)&&!routedKeys.has(c.key));
if(!qaOnly.length) md.push('- None.');
for(const c of qaOnly) md.push(`- **${c.key}**: ${c.writers.map(w=>`${w.file} (${w.count}, ${w.scope})`).join(', ')}`);
md.push('','## Rule','A migration must not activate NEW authority while unresolved duplicate runtime writers remain for the same state key. QA/test writers are reported but do not count as runtime authority. Accessor-routed keys are removed from runtime conflict counts only when their boundary source exists; dedicated behavioral CI must certify boot order and routing semantics. Simple identifier contracts count only statement/global-object assignments, not lexical variables with the same name.');
fs.writeFileSync(path.join(OUT_DIR,'report.md'),md.join('\n')+'\n');

console.log(JSON.stringify(summary,null,2));
if(summary.criticalRuntimeAuthorityConflicts>0) console.warn('LEGACY_OBSERVATORY_WARN: critical duplicate runtime writers detected; affected domains must remain LEGACY/SHADOW until reconciled.');
