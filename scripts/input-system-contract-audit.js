/* KELO-INDEX
 * area: QA / INPUT
 * owner: FOUNDATION CI
 * keys: INPUT OWNER LOCK HOOK PROCESSINPUT CONTRACT
 * purpose: valida KeloInput como único pipeline sobre processInput legacy
 * public-api: CLI
 * consumes: input-lock-system, input-system, engine-f, retired input-gate, index.html
 * state-owned: ninguno
 * extension-points: invariantes del pipeline de input
 * reuse: Foundation CI
 * legacy: simula processInput de engine-a
 * do-not: no sustituir smoke browser de touch/teclado
 */
'use strict';
const fs=require('fs');
const vm=require('vm');
const lockSource=fs.readFileSync('src/core/input-lock-system.js','utf8');
const inputSource=fs.readFileSync('src/core/input-system.js','utf8');
const legacyGate=fs.readFileSync('src/core/input-gate.js','utf8');
const engineF=fs.readFileSync('engine-f.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const trace=[];
let calls=0;
const context={
  console,Date,
  input:{normX:1,normY:0,touchActive:true,touchId:4,keys:{w:true}},
  localPlayer:{vx:20,vy:10},
  processInput:function(){calls+=1;trace.push('base');context.input.normX=.5;context.input.normY=.25;}
};
context.window=context;context.globalThis=context;
vm.createContext(context);
vm.runInContext(lockSource,context,{filename:'input-lock-system.js'});
vm.runInContext(inputSource,context,{filename:'input-system.js'});
function ok(cond,msg){if(!cond)throw new Error(msg);}
ok(context.KeloInput&&context.KELO_INPUT_SYSTEM_AUDIT.installed,'OWNER_NOT_INSTALLED');
context.KeloInput.before('before',()=>trace.push('before'),10);
const after=context.KeloInput.after('after',()=>trace.push('after'),10);
context.processInput();
ok(trace.join('|')==='before|base|after','PIPELINE_ORDER');
ok(calls===1,'BASE_ONCE');
const token=context.KeloInputLocks.acquire('inventory');
trace.length=0;context.input.normX=1;context.input.normY=-1;context.input.touchActive=true;context.input.touchId=9;context.input.keys.w=true;context.localPlayer.vx=100;context.localPlayer.vy=50;
context.processInput();
ok(calls===1,'LOCKED_MUST_SKIP_BASE');
ok(trace.length===0,'LOCKED_MUST_SKIP_HOOKS');
ok(context.input.normX===0&&context.input.normY===0&&context.input.touchActive===false&&context.input.touchId===null,'LOCKED_INTENT_CLEARED');
ok(context.input.keys.w===false&&context.localPlayer.vx===0&&context.localPlayer.vy===0,'LOCKED_KEYS_VELOCITY_CLEARED');
context.KeloInputLocks.release(token);context.KeloInput.unregister(after);
trace.length=0;context.processInput();
ok(calls===2&&trace.join('|')==='before|base','RELEASE_AND_UNREGISTER');
ok(!/\bprocessInput\s*=\s*function\b/.test(engineF),'ENGINE_F_MUST_NOT_WRAP');
ok(engineF.includes("KeloInput.after('engine-f:legacy-aim'"),'ENGINE_F_MUST_USE_HOOK');
ok(!/\bprocessInput\s*=\s*function\b/.test(legacyGate),'RETIRED_GATE_MUST_NOT_WRAP');
ok(!html.includes('src/core/input-gate.js'),'RETIRED_GATE_MUST_NOT_LOAD');
const iA=html.indexOf('engine-a.js'),iI=html.indexOf('src/core/input-system.js'),iF=html.indexOf('engine-f.js');
ok(iA>=0&&iI>iA&&iF>iI,'LOAD_ORDER');
console.log('INPUT_SYSTEM_OK: single pipeline + locks + deterministic hooks + engine-f migration passed');
