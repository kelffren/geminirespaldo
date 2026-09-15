/* KELO-INDEX
 * area: QA / RENDER
 * owner: FOUNDATION CI
 * keys: RENDER HOOK BEFORE AFTER INTERCEPT WRAPPER CONTRACT
 * purpose: valida KeloRender como bridge único, su intercept exclusivo y wrappers legacy migrados
 * public-api: CLI
 * consumes: render extension owner, engines migrados, index.html
 * state-owned: ninguno
 * extension-points: invariantes del contrato de render
 * reuse: Foundation CI
 * legacy: simula el render de engine-c
 * do-not: no sustituir smoke browser visual
 */
'use strict';
const fs=require('fs');
const vm=require('vm');
const source=fs.readFileSync('src/core/render-extension-system.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const migrated=['engine-d.js','engine-g.js','engine-h.js','engine-l.js','engine-m.js','engine-o.js','engine-p.js','engine-s.js','engine-y.js','engine-aa.js','engine-ae.js','engine-ai.js','engine-net.js','src/systems/pvp-world.js','src/abilities/kelo-ability-boot.js'];
const trace=[];
const context={console,ctx:{},screenW:390,screenH:844,camera:{x:1,y:2},CONFIG:{zoom:1},render:function(){trace.push('base');return 7;}};
context.window=context;context.globalThis=context;
vm.createContext(context);vm.runInContext(source,context,{filename:'render-extension-system.js'});
function ok(cond,msg){if(!cond)throw new Error(msg);}
function directRenderAssignment(text){return /\b(?:window\.|globalThis\.|root\.)render\s*=/.test(text)||/(?:^|[;{}]|\))\s*render\s*=/m.test(text);}
ok(context.KeloRender&&context.KELO_RENDER_EXTENSION_AUDIT.installed,'OWNER_NOT_INSTALLED');
context.KeloRender.beforeFrame('late',()=>trace.push('before-late'),20);
const early=context.KeloRender.beforeFrame('early',()=>trace.push('before-early'),10);
context.KeloRender.afterFrame('after-1',()=>trace.push('after-1'),10);
context.KeloRender.afterFrame('after-2',()=>trace.push('after-2'),20);
const sleeping=context.KeloRender.afterFrame('sleeping',()=>trace.push('sleeping'),30);
ok(context.KeloRender.setEnabled(sleeping,false),'SLEEP_HOOK');
const out=context.render();
ok(out===7,'BASE_RETURN');
ok(trace.join('|')==='before-early|before-late|base|after-1|after-2','HOOK_ORDER_AND_SLEEP');
ok(context.KeloRender.setEnabled(sleeping,true),'WAKE_HOOK');
trace.length=0;context.render();
ok(trace.join('|')==='before-early|before-late|base|after-1|after-2|sleeping','WAKE_EFFECT');
ok(context.KeloRender.unregister(sleeping),'SLEEPING_UNREGISTER');
ok(context.KeloRender.unregister(early),'UNREGISTER');
trace.length=0;context.render();
ok(trace.join('|')==='before-late|base|after-1|after-2','UNREGISTER_EFFECT');
const exclusive=context.KeloRender.intercept('exclusive',()=>{trace.push('exclusive');return true;},1);
trace.length=0;context.render();
ok(trace.join('|')==='exclusive','EXCLUSIVE_MUST_SKIP_BASE_AND_NORMAL_HOOKS');
ok(context.KeloRender.unregister(exclusive),'INTERCEPT_UNREGISTER');
migrated.forEach(file=>{const text=fs.readFileSync(file,'utf8');ok(!directRenderAssignment(text),file+'_MUST_NOT_WRAP_RENDER');});
ok(fs.readFileSync('engine-d.js','utf8').includes("KeloRender.afterFrame('engine-d:minimap'"),'MINIMAP_HOOK');
ok(fs.readFileSync('engine-g.js','utf8').includes("KeloRender.afterFrame('engine-g:skill-indicator'"),'SKILL_HOOK');
const hd=fs.readFileSync('engine-h.js','utf8');
ok(!hd.includes("engine-h:legacy-plaza-fillrect"),'HD_LEGACY_PLAZA_HOOK_MUST_STAY_REMOVED');
ok(!/ctx\.fillRect\s*=/.test(hd)&&!hd.includes('ctx.fillRect.bind(ctx)'),'HD_CANVAS_MONKEY_PATCH_MUST_STAY_REMOVED');
ok(hd.includes("legacyPlazaMonkeyPatch:false")&&hd.includes("legacy-plaza-intercept-removed-v1"),'HD_REMOVAL_AUDIT_MARKER');
const plaza=fs.readFileSync('engine-l.js','utf8');
ok(!plaza.includes("KeloRender.beforeFrame('engine-l:hidpi'")&&plaza.includes("KeloRender.afterFrame('engine-l:landing-marker'"),'PLAZA_HOOKS');
ok(!/\bcanvas\.(?:width|height)\s*=/.test(plaza),'PLAZA_VIEWPORT_MUST_BE_CAMERA_OWNED');
ok(fs.readFileSync('engine-ae.js','utf8').includes("KeloRender.beforeFrame('engine-ae:frame-counter'"),'FRAME_COUNTER_HOOK');
ok(fs.readFileSync('engine-ai.js','utf8').includes("KeloRender.afterFrame('engine-ai:cafe-overlay'"),'CAFE_HOOK');
ok(fs.readFileSync('engine-net.js','utf8').includes("KeloRender.afterFrame('engine-net:peers'"),'NETWORK_PEER_HOOK');
const pvp=fs.readFileSync('src/systems/pvp-world.js','utf8');
ok(pvp.includes("KeloRender.intercept('pvp-world:arena-exclusive'"),'PVP_RENDER_OWNER_HOOK');
const abilities=fs.readFileSync('src/abilities/kelo-ability-boot.js','utf8');
ok(abilities.includes("renderHookId=window.KeloRender.afterFrame('kelo-ability-boot:legacy-fx'")&&abilities.includes("simulationHookId=window.KeloSimulation.after('kelo-ability-boot:runtime'"),'ABILITY_RENDER_OWNER_HOOK');
const iC=html.indexOf('engine-c.js');const iR=html.indexOf('src/core/render-extension-system.js');const iD=html.indexOf('engine-d.js');
ok(iC>=0&&iR>iC&&iD>iR,'LOAD_ORDER');
console.log('RENDER_EXTENSION_OK: single bridge + exclusive intercept + deterministic hooks + sleep/wake + current PvP/Ability owners passed');
