/* KELO-INDEX
 * area: QA / LEGACY MODERNIZATION / SIMULATION
 * owner: Simulation Owner Migration Audit
 * owns: certification of single updateSimulation writer + legacy bridge ordering
 * does-not-own: gameplay simulation semantics
 * purpose: prove KeloSimulation is the only runtime wrapper while engine-c augments through a bridge
 * public-api: CLI `node scripts/simulation-owner-migration-audit.mjs`
 * reuse: Legacy Observatory CI
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let failures=0;
function fail(message){console.error('SIMULATION_OWNER_AUDIT_FAIL:',message);failures++;}
function ok(message){console.log('SIMULATION_OWNER_AUDIT_OK:',message);}
function expect(condition,message){if(condition)ok(message);else fail(message);}
function read(rel){return fs.readFileSync(path.join(ROOT,rel),'utf8');}

const engineC=read('engine-c.js');
const system=read('src/core/simulation-extension-system.js');

expect(!/\bupdateSimulation\s*=/.test(engineC),'engine-c no longer reassigns updateSimulation');
expect(engineC.includes('KELO_LEGACY_SIMULATION_BRIDGE'),'engine-c exposes the legacy simulation augment bridge');
expect(engineC.includes("version:'engine-c-simulation-bridge-v1'"),'engine-c bridge is explicitly versioned');
expect(engineC.includes('simulationWrapperRetired:true'),'engine-c records wrapper retirement');
expect(system.includes('const legacyBridge=root.KELO_LEGACY_SIMULATION_BRIDGE||null'),'KeloSimulation consumes the legacy bridge');
expect((system.match(/\bupdateSimulation\s*=/g)||[]).length===1,'KeloSimulation contains exactly one updateSimulation assignment');
expect(system.includes('singleGlobalWriter:true'),'KeloSimulation audit advertises single global writer ownership');

const events=[];
const sandbox={
  console,
  localPlayer:{id:'p'},
  STATE:{id:'state'},
  updateSimulation:function(){events.push('base');},
  KELO_LEGACY_SIMULATION_BRIDGE:{
    before:function(){events.push('legacy-before');},
    after:function(){events.push('legacy-after');}
  }
};
sandbox.window=sandbox;
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(system,sandbox,{filename:'simulation-extension-system.js'});
expect(!!sandbox.KeloSimulation,'KeloSimulation installs in the executable harness');
sandbox.KeloSimulation.before('audit-before',function(){events.push('hook-before');},0);
sandbox.KeloSimulation.after('audit-after',function(){events.push('hook-after');},0);
sandbox.updateSimulation(0.016);
expect(events.join('>')==='hook-before>legacy-before>base>legacy-after>hook-after','simulation execution order preserves hooks and legacy augmentation around the base');
expect(sandbox.KeloSimulation.snapshot().legacyBridge===true,'simulation snapshot exposes legacy bridge presence');

if(failures){console.error(`Simulation owner migration audit failed with ${failures} violation(s).`);process.exit(1);}
console.log('SIMULATION_OWNER_MIGRATION_OK');
