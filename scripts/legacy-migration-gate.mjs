/* KELO-INDEX
 * area: QA / LEGACY MODERNIZATION
 * owner: Legacy Migration Gate
 * owns: validation of migration modes against static runtime ownership evidence
 * does-not-own: runtime activation or gameplay behavior
 * purpose: block unsafe NEW activation while legacy runtime conflicts remain
 * public-api: CLI `node scripts/legacy-migration-gate.mjs`
 * extension-points: domain-specific parity evidence
 * reuse: CI + migration PRs
 */
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifestPath=path.join(ROOT,'config','legacy-migration-manifest.json');
const reportPath=path.join(ROOT,'artifacts','legacy-observatory','report.json');

function runObservatory(){
  const r=cp.spawnSync(process.execPath,[path.join(ROOT,'scripts','legacy-observatory.mjs')],{cwd:ROOT,encoding:'utf8'});
  process.stdout.write(r.stdout||'');
  process.stderr.write(r.stderr||'');
  if(r.status!==0) process.exit(r.status??1);
}
function fail(msg){ console.error('MIGRATION_GATE_FAIL:',msg); failures++; }
function ok(msg){ console.log('MIGRATION_GATE_OK:',msg); }
let failures=0;

if(!fs.existsSync(manifestPath)) fail('missing config/legacy-migration-manifest.json');
if(failures) process.exit(1);
runObservatory();

const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
const allowed=new Set(manifest.allowedModes||['LEGACY','SHADOW','NEW']);
const runtimeConflicts=Array.isArray(report.runtimeConflicts)?report.runtimeConflicts:(report.conflicts||[]).map(c=>({key:c.key,writers:(c.writers||[]).filter(w=>w.scope!=='qa')})).filter(c=>c.writers.length>1);
const conflicts=new Map(runtimeConflicts.map(c=>[c.key,c.writers]));

for(const [domain,cfg] of Object.entries(manifest.domains||{})){
  if(!allowed.has(cfg.mode)) { fail(`${domain}: invalid mode ${cfg.mode}`); continue; }
  if(!cfg.owner) fail(`${domain}: missing owner`);
  if(!Array.isArray(cfg.contracts)||!cfg.contracts.length) fail(`${domain}: missing contracts`);
  if(cfg.mode==='NEW'){
    for(const key of cfg.contracts||[]){
      const writers=conflicts.get(key)||[];
      const legacyWriters=writers.filter(w=>w.legacy);
      if(legacyWriters.length){
        fail(`${domain}: NEW blocked; legacy runtime still writes ${key}: ${legacyWriters.map(w=>w.file).join(', ')}`);
      }
      if(writers.length>1){
        fail(`${domain}: NEW blocked; ${key} still has ${writers.length} detected runtime writers`);
      }
    }
  }
  if(cfg.mode==='SHADOW'){
    if(cfg.authority&&cfg.authority!=='legacy-only')fail(`${domain}: SHADOW authority must remain legacy-only`);
    ok(`${domain}: SHADOW allowed; legacy retains authority while parity is measured`);
  }
  if(cfg.mode==='LEGACY') ok(`${domain}: LEGACY retained`);
  if(cfg.mode==='NEW') ok(`${domain}: NEW runtime ownership gate passed`);
}

if(failures){
  console.error(`Legacy migration gate failed with ${failures} violation(s).`);
  process.exit(1);
}
ok('manifest is safe for current runtime ownership evidence');
