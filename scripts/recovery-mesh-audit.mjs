/* KELO-INDEX
 * area: QA / BUG RECOVERY
 * owner: /bugs Bug Intelligence support tooling
 * keys: RECOVERY AUDIT FOUNDATION DIAGNOSTIC-ONLY QUARANTINE BISECT CHECKPOINT
 * purpose: impide que Recovery Mesh se convierta en otro engine, un auto-healer o diagnóstico pesado always-on
 * public-api: CLI npm run audit:recovery
 * consumes: recovery runtime/tooling/docs/workflows
 * state-owned: none
 * online: N/A
 * do-not: no writes, no network, no lifecycle mutation
 */

import fs from 'node:fs';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

const required=[
  'src/core/bug-observability.mjs',
  'src/core/module-loader.js',
  'scripts/recovery-profile-runner.mjs',
  'scripts/recovery-bisect.mjs',
  'docs/systems/BUG_RECOVERY_MESH.md',
  'bugs/RECOVERY_MESH.md',
  '.github/workflows/recovery-lab.yml',
  '.github/workflows/recovery-checkpoints.yml'
];
let failures=0;
const fail=msg=>{failures++;console.error('FAIL',msg);};
const pass=msg=>console.log('PASS',msg);
for(const file of required){if(!fs.existsSync(file))fail(`missing ${file}`);else pass(`exists ${file}`);}

function text(file){return fs.readFileSync(file,'utf8');}
if(fs.existsSync('src/core/bug-observability.mjs')){
  const src=text('src/core/bug-observability.mjs');
  if(!src.includes('export function installRecoveryMesh'))fail('installRecoveryMesh public capability missing');
  else pass('Recovery Mesh extends existing bug-observability owner');
  if(!src.includes('do-not: never mutate gameplay/editor authority'))fail('diagnostic-only ownership guard missing');
  else pass('diagnostic-only guard documented');
  if(/localPlayer\s*\.[xyhp]|STATE\.|obstacles\.(push|splice)/.test(src))fail('recovery diagnostics appears to mutate gameplay state');
  else pass('no obvious gameplay state mutation in diagnostics');
}
if(fs.existsSync('src/core/module-loader.js')){
  const src=text('src/core/module-loader.js');
  if(!src.includes("if(!recoveryEnabled())return false"))fail('module quarantine is not hard-gated by recoveryLab');
  else pass('module quarantine gated by explicit recovery mode');
  if(!src.includes('kelo:module-load-error'))fail('module load errors are not emitted to recorder');
  else pass('module load error telemetry present');
}
if(fs.existsSync('index.html')){
  const src=text('index.html');
  if(!src.includes('var recovery=')||!src.includes("import('./src/core/bug-observability.mjs"))fail('opt-in recovery boot missing');
  else pass('recovery runtime loads only through explicit diagnostic branch');
}
if(fs.existsSync('scripts/recovery-bisect.mjs')){
  const src=text('scripts/recovery-bisect.mjs');
  if(src.includes('exec(')||src.includes('eval(')||src.includes('shell:true'))fail('bisect accepts unsafe arbitrary shell execution');
  else pass('bisect runner uses allowlisted profile and execFile');
  if(!src.includes("new Set(['boot','movement','world','full'])"))fail('bisect profile allowlist missing');
  else pass('bisect profiles allowlisted');
}
for(const file of ['src/core/bug-observability.mjs','scripts/recovery-profile-runner.mjs','scripts/recovery-bisect.mjs']){
  if(!fs.existsSync(file))continue;
  try{execFileSync(process.execPath,['--check',file],{stdio:'pipe'});pass(`syntax ${file}`);}catch(error){fail(`syntax ${file}: ${String(error?.stderr||error?.message||error).slice(0,500)}`);}
}
if(fs.existsSync('docs/system-catalog.json')){
  try{
    const catalog=JSON.parse(text('docs/system-catalog.json'));
    if(!catalog.systems?.some(s=>s.id==='bug-recovery-mesh'))fail('system catalog missing bug-recovery-mesh');
    else pass('system catalog registers Recovery Mesh');
  }catch(error){fail(`system catalog JSON invalid: ${error.message}`);}
}
if(failures){console.error(`Recovery Mesh audit failed: ${failures}`);process.exit(1);}
console.log('Recovery Mesh audit PASS');
