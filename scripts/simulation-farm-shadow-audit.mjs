/* KELO-INDEX
 * area: QA / LEGACY MODERNIZATION
 * owner: Simulation Farm Shadow Audit
 * owns: safety + behavioral contract for the first read-only SHADOW slice
 * does-not-own: gameplay state, runtime activation, legacy farm behavior
 * purpose: prove shadow observation cannot become a second authority
 * public-api: CLI `node scripts/simulation-farm-shadow-audit.mjs`
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const shadowPath=path.join(ROOT,'src','core','simulation-farm-shadow.js');
const manifestPath=path.join(ROOT,'config','legacy-migration-manifest.json');
const indexPath=path.join(ROOT,'index.html');
const source=fs.readFileSync(shadowPath,'utf8');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const index=fs.readFileSync(indexPath,'utf8');
const failures=[];
function assert(ok,msg){if(!ok)failures.push(msg);}

assert(manifest.domains?.simulationFarmTick?.mode==='SHADOW','simulationFarmTick must stay SHADOW');
assert(manifest.domains?.simulationFarmTick?.owner==='SimulationFarmShadow','simulationFarmTick owner mismatch');
assert(manifest.domains?.simulation?.mode==='LEGACY','full simulation must remain LEGACY during farm shadow');
assert(index.includes('src/core/simulation-farm-shadow.js'),'shadow script missing from runtime boot');
assert(index.indexOf('src/core/simulation-extension-system.js')<index.indexOf('src/core/simulation-farm-shadow.js'),'shadow must load after KeloSimulation bridge');
assert(!/\b(?:setTimeout|setInterval|requestAnimationFrame|addEventListener)\s*\(/.test(source),'shadow must not create timers, loops or listeners');
assert(!/\b(?:saveState|showToast)\s*\(/.test(source),'shadow must not invoke legacy gameplay side effects');
assert(!/(?:ctx\.state|state)\.[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*(?:=|\+=|-=|\+\+|--)/.test(source),'shadow must not write gameplay state');

let beforeHook=null,afterHook=null;
class FakeDate extends Date{static now(){return 2500;}}
const sandbox={
  Date:FakeDate,
  console:{warn(){}},
  KeloSimulation:{
    before(owner,fn){assert(owner==='SimulationFarmShadow','unexpected before owner');beforeHook=fn;return 'before-1';},
    after(owner,fn){assert(owner==='SimulationFarmShadow','unexpected after owner');afterHook=fn;return 'after-1';}
  }
};
vm.createContext(sandbox);
try{new vm.Script(source,{filename:'simulation-farm-shadow.js'}).runInContext(sandbox);}catch(error){failures.push('shadow runtime parse/install failed: '+error.message);}
assert(typeof beforeHook==='function'&&typeof afterHook==='function','shadow hooks were not registered');

if(beforeHook&&afterHook){
  const state={farm:{coop:{ready:false,fedAt:1000,duration:1},pen:{ready:false,fedAt:0,duration:1}},silo:{eggs:3,pork:2}};
  const ctx={state};
  beforeHook(ctx);
  // Simulate the authoritative legacy result between KeloSimulation before/after hooks.
  state.farm.coop.ready=true;state.farm.coop.fedAt=0;state.silo.eggs=5;
  afterHook(ctx);
  let snap=sandbox.KELO_SIMULATION_FARM_SHADOW.snapshot();
  assert(snap.comparisons===1&&snap.divergences===0,'matching legacy farm tick must pass parity');

  state.farm.pen={ready:false,fedAt:1000,duration:1};
  beforeHook(ctx);
  // Intentionally omit the legacy mutation: the shadow must detect divergence without fixing it.
  afterHook(ctx);
  snap=sandbox.KELO_SIMULATION_FARM_SHADOW.snapshot();
  assert(snap.comparisons===2&&snap.divergences===1,'shadow must detect a mismatching legacy result');
  assert(state.farm.pen.ready===false&&state.silo.pork===2,'shadow audit changed authoritative gameplay state');
}

if(failures.length){
  for(const failure of failures)console.error('SIMULATION_FARM_SHADOW_FAIL:',failure);
  process.exit(1);
}
console.log('SIMULATION_FARM_SHADOW_OK: read-only SHADOW contract verified');
