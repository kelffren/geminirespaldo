/* KELO-INDEX
 * area: QA / MOVEMENT
 * owner: FOUNDATION CI
 * keys: MOVEMENT HOOK BEFORE INTERCEPT AFTER ORDER WRAPPER CONTRACT
 * purpose: valida el owner único de extensiones de movimiento sin ejecutar el juego completo
 * public-api: CLI
 * consumes: src/core/movement-system.js, engine-g/ac/ah/ai.js, index.html
 * state-owned: ninguno
 * extension-points: invariantes del contrato KeloMovement
 * reuse: Foundation CI
 * legacy: simula updateMovement de engine-a
 * do-not: no sustituir smoke browser de movimiento real
 */
'use strict';
const fs=require('fs');
const vm=require('vm');
const movementSource=fs.readFileSync('src/core/movement-system.js','utf8');
const g=fs.readFileSync('engine-g.js','utf8');
const ac=fs.readFileSync('engine-ac.js','utf8');
const ah=fs.readFileSync('engine-ah.js','utf8');
const ai=fs.readFileSync('engine-ai.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const trace=[];
const context={
  console,
  localPlayer:{x:0,y:0,vx:0,vy:0},
  input:{normX:0,normY:0},
  CONFIG:{},
  updateMovement:function(dt){trace.push('base:'+dt);context.localPlayer.x+=1;}
};
context.window=context;context.globalThis=context;
vm.createContext(context);
vm.runInContext(movementSource,context,{filename:'movement-system.js'});
function ok(cond,msg){if(!cond)throw new Error(msg);}
ok(context.KeloMovement&&context.KELO_MOVEMENT_SYSTEM_AUDIT.installed,'OWNER_NOT_INSTALLED');
const late=context.KeloMovement.before('late',()=>trace.push('before-late'),20);
context.KeloMovement.before('early',()=>trace.push('before-early'),10);
context.KeloMovement.after('after',()=>trace.push('after'),5);
context.updateMovement(.5);
ok(trace.join('|')==='before-early|before-late|base:0.5|after','HOOK_ORDER');
ok(context.localPlayer.x===1,'BASE_EXACTLY_ONCE');
ok(context.KeloMovement.unregister(late),'UNREGISTER');
trace.length=0;context.updateMovement(.25);
ok(trace.join('|')==='before-early|base:0.25|after','UNREGISTER_EFFECT');
const intercept=context.KeloMovement.intercept('exclusive',()=>{trace.push('intercept');return true;},1);
trace.length=0;context.updateMovement(.1);
ok(trace.join('|')==='before-early|intercept|after','INTERCEPT_SKIPS_BASE_BUT_PRESERVES_PHASES');
ok(context.localPlayer.x===2,'INTERCEPT_BASE_NOT_CALLED');
context.KeloMovement.unregister(intercept);
[g,ac,ah,ai].forEach((source,i)=>ok(!/\bupdateMovement\s*=\s*function\b/.test(source),'LEGACY_MOVEMENT_WRAPPER_'+i));
ok(g.includes("KeloMovement.intercept('engine-g:legacy-dash'"),'ENGINE_G_INTERCEPT');
ok(ac.includes("KeloMovement.before('engine-ac:gait-speed'")&&ac.includes("KeloMovement.after('engine-ac:visual-motion'"),'ENGINE_AC_HOOKS');
ok(ah.includes("KeloMovement.after('engine-ah:release-brake'"),'ENGINE_AH_HOOK');
ok(ai.includes("KeloMovement.after('engine-ai:cafe-room-clamp'"),'ENGINE_AI_HOOK');
const iA=html.indexOf('engine-a.js'),iM=html.indexOf('src/core/movement-system.js'),iG=html.indexOf('engine-g.js'),iAc=html.indexOf('engine-ac.js');
ok(iA>=0&&iM>iA&&iG>iM&&iAc>iM,'LOAD_ORDER');
console.log('MOVEMENT_SYSTEM_OK: single wrapper + hooks + exclusive interceptors + legacy movement migration passed');
