/* KELO-INDEX
 * area: QA / SIMULATION
 * owner: FOUNDATION CI
 * keys: SIMULATION HOOK BEFORE AFTER WRAPPER CONTRACT SLEEP WAKE
 * purpose: valida KeloSimulation como bridge único, sleep/wake y módulos legacy ya migrados
 * public-api: CLI
 * consumes: simulation extension owner, engines migrados, index.html
 * state-owned: ninguno
 * extension-points: invariantes del contrato de simulación
 * reuse: Foundation CI
 * legacy: simula updateSimulation post-engine-c
 * do-not: no sustituir smoke browser de gameplay
 */
'use strict';
const fs=require('fs');
const vm=require('vm');
const source=fs.readFileSync('src/core/simulation-extension-system.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const migrated=['engine-m.js','engine-o.js','engine-p.js','engine-q.js','engine-s.js','engine-net.js','src/systems/pvp-world.js','src/abilities/kelo-ability-boot.js','src/abilities/sword-swap-runtime.js','src/visuals/sword-swap-pvp-visuals.js','src/ui/pvp-social-touch-guard.js'];
const trace=[];
const context={console,localPlayer:{x:0,y:0},STATE:{},updateSimulation:function(dt){trace.push('base:'+dt);return 9;}};
context.window=context;context.globalThis=context;
vm.createContext(context);vm.runInContext(source,context,{filename:'simulation-extension-system.js'});
function ok(cond,msg){if(!cond)throw new Error(msg);}
function directSimulationAssignment(text){return /\b(?:window\.|globalThis\.|root\.)updateSimulation\s*=/.test(text)||/(?:^|[;{}]|\))\s*updateSimulation\s*=/m.test(text);}
ok(context.KeloSimulation&&context.KELO_SIMULATION_EXTENSION_AUDIT.installed,'OWNER_NOT_INSTALLED');
context.KeloSimulation.before('late',()=>trace.push('before-late'),20);
const early=context.KeloSimulation.before('early',()=>trace.push('before-early'),10);
context.KeloSimulation.after('after-1',()=>trace.push('after-1'),10);
context.KeloSimulation.after('after-2',()=>trace.push('after-2'),20);
const sleeping=context.KeloSimulation.after('sleeping',()=>trace.push('sleeping'),30);
ok(context.KeloSimulation.setEnabled(sleeping,false),'SLEEP_HOOK');
const out=context.updateSimulation(.25);
ok(out===9,'BASE_RETURN');
ok(trace.join('|')==='before-early|before-late|base:0.25|after-1|after-2','HOOK_ORDER_AND_SLEEP');
ok(context.KeloSimulation.setEnabled(sleeping,true),'WAKE_HOOK');
trace.length=0;context.updateSimulation(.3);
ok(trace.join('|')==='before-early|before-late|base:0.3|after-1|after-2|sleeping','WAKE_EFFECT');
ok(context.KeloSimulation.unregister(sleeping),'SLEEPING_UNREGISTER');
ok(context.KeloSimulation.unregister(early),'UNREGISTER');
trace.length=0;context.updateSimulation(.5);
ok(trace.join('|')==='before-late|base:0.5|after-1|after-2','UNREGISTER_EFFECT');
migrated.forEach(file=>{const text=fs.readFileSync(file,'utf8');ok(!directSimulationAssignment(text),file+'_MUST_NOT_ASSIGN_UPDATE_SIMULATION');});
ok(fs.readFileSync('engine-m.js','utf8').includes("KeloSimulation.after('engine-m:skill-shots'"),'ENGINE_M_HOOK');
ok(fs.readFileSync('engine-o.js','utf8').includes("KeloSimulation.after('engine-o:training-dummy'"),'ENGINE_O_HOOK');
ok(fs.readFileSync('engine-p.js','utf8').includes("KeloSimulation.after('engine-p:plaza-npcs'"),'ENGINE_P_HOOK');
ok(fs.readFileSync('engine-q.js','utf8').includes("KeloSimulation.after('engine-q:maestro-trial'"),'ENGINE_Q_HOOK');
ok(fs.readFileSync('engine-s.js','utf8').includes("KeloSimulation.before('engine-s:social-bot-snapshot'")&&fs.readFileSync('engine-s.js','utf8').includes("KeloSimulation.after('engine-s:social-world'"),'ENGINE_S_HOOKS');
ok(fs.readFileSync('engine-net.js','utf8').includes("KeloSimulation.after('engine-net:network'"),'NETWORK_SIM_HOOK');
ok(fs.readFileSync('src/systems/pvp-world.js','utf8').includes("KeloSimulation.after('pvp-world:tick'"),'PVP_SIM_HOOK');
const abilities=fs.readFileSync('src/abilities/kelo-ability-boot.js','utf8');
ok(abilities.includes("simulationHookId=window.KeloSimulation.after('kelo-ability-boot:runtime'")&&abilities.includes("renderHookId=window.KeloRender.afterFrame('kelo-ability-boot:legacy-fx'"),'ABILITY_SIM_HOOK');
ok(fs.readFileSync('src/abilities/sword-swap-runtime.js','utf8').includes("KeloSimulation.after('sword-swap-runtime:tick'"),'SWORD_SWAP_RUNTIME_SIM_HOOK');
ok(fs.readFileSync('src/visuals/sword-swap-pvp-visuals.js','utf8').includes("KeloSimulation.after('sword-swap-pvp-visuals:blocker'"),'SWORD_SWAP_VISUAL_BLOCKER_SIM_HOOK');
ok(fs.readFileSync('src/ui/pvp-social-touch-guard.js','utf8').includes("KeloSimulation.after('pvp-social-touch-guard:training-dummy'")||fs.readFileSync('src/ui/pvp-social-touch-guard.js','utf8').includes("sim.after('pvp-social-touch-guard:training-dummy'"),'PVP_SOCIAL_TRAINING_SIM_HOOK');
const iC=html.indexOf('engine-c.js');const iS=html.indexOf('src/core/simulation-extension-system.js');const iD=html.indexOf('engine-d.js');
ok(iC>=0&&iS>iC&&iD>iS,'LOAD_ORDER');
console.log('SIMULATION_EXTENSION_OK: single bridge + deterministic hooks + sleep/wake + complete migrated simulation chain passed');
