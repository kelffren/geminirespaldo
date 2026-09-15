/* KELO-INDEX
 * area: QA / INPUT
 * owner: FOUNDATION CI
 * keys: INPUT GATE LOCK PROCESSINPUT CONTRACT
 * purpose: prueba el bridge único KeloInputLocks → processInput sin navegador
 * public-api: CLI
 * consumes: src/core/input-lock-system.js, src/core/input-gate.js
 * state-owned: ninguno
 * extension-points: invariantes del gate
 * reuse: Foundation CI
 * legacy: simula processInput de engine-a durante transición
 * do-not: no probar UI específica aquí
 */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const lockSource=fs.readFileSync(path.resolve(__dirname,'../src/core/input-lock-system.js'),'utf8');
const gateSource=fs.readFileSync(path.resolve(__dirname,'../src/core/input-gate.js'),'utf8');
let calls=0;
const context={
  console,Date,
  input:{normX:1,normY:1,touchActive:true,touchId:7,keys:{w:true,a:false}},
  localPlayer:{vx:55,vy:-12},
  processInput:function(){calls+=1;context.input.normX=.5;context.input.normY=.25;}
};
vm.createContext(context);
vm.runInContext(lockSource,context,{filename:'input-lock-system.js'});
vm.runInContext(gateSource,context,{filename:'input-gate.js'});
function ok(cond,msg){if(!cond)throw new Error(msg);}
ok(context.KELO_INPUT_GATE_AUDIT&&context.KELO_INPUT_GATE_AUDIT.installed,'GATE_NOT_INSTALLED');
context.processInput();
ok(calls===1,'UNLOCKED_MUST_DELEGATE');
const token=context.KeloInputLocks.acquire('inventory');
context.input.normX=1;context.input.normY=-1;context.input.touchActive=true;context.input.touchId=9;context.input.keys.w=true;context.localPlayer.vx=100;context.localPlayer.vy=50;
context.processInput();
ok(calls===1,'LOCKED_MUST_NOT_DELEGATE');
ok(context.input.normX===0&&context.input.normY===0,'LOCKED_INTENT_ZERO');
ok(context.input.touchActive===false&&context.input.touchId===null,'LOCKED_TOUCH_ZERO');
ok(context.input.keys.w===false,'LOCKED_KEYS_ZERO');
ok(context.localPlayer.vx===0&&context.localPlayer.vy===0,'LOCKED_VELOCITY_ZERO');
context.KeloInputLocks.release(token);
context.processInput();
ok(calls===2,'RELEASE_MUST_RESUME');
console.log('INPUT_GATE_OK: unlocked/locked/release contract passed');
