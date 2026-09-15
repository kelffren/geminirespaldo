/* KELO-INDEX
 * area: QA / LEGACY MODERNIZATION / RENDER
 * owner: Render Owner Migration Audit
 * owns: certification that KeloRender is the sole global frame writer and engine-c/gardens are bridge-hook consumers
 * does-not-own: visual style, gameplay rules, world content or render-loop scheduling
 * purpose: prove render ownership before render domain can remain NEW
 * public-api: CLI `node scripts/render-owner-migration-audit.mjs`
 * reuse: Legacy Observatory CI
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let failures=0;
function fail(message){console.error('RENDER_OWNER_AUDIT_FAIL:',message);failures++;}
function ok(message){console.log('RENDER_OWNER_AUDIT_OK:',message);}
function expect(condition,message){if(condition)ok(message);else fail(message);}
function read(rel){return fs.readFileSync(path.join(ROOT,rel),'utf8');}

const engineC=read('engine-c.js');
const renderSystem=read('src/core/render-extension-system.js');
const gardens=read('src/environment/gardens-landmark.js');
const index=read('index.html');
const manifest=JSON.parse(read('config/legacy-migration-manifest.json'));
const reportPath=path.join(ROOT,'artifacts','legacy-observatory','report.json');
const report=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath,'utf8')):null;

expect(!/^[\t ]*render\s*=(?!=)/m.test(engineC),'engine-c no longer reassigns global render');
expect(engineC.includes('window.KELO_LEGACY_RENDER_BRIDGE=Object.freeze'),'engine-c exposes the legacy render bridge');
expect(engineC.includes("version:'engine-c-render-bridge-v1'"),'engine-c render bridge is explicitly versioned');
expect(engineC.includes('renderWrapperRetired:true'),'engine-c records render wrapper retirement');
expect((renderSystem.match(/^[\t ]*render\s*=(?!=)/gm)||[]).length===1,'KeloRender contains exactly one unqualified render writer');
expect(renderSystem.includes("owner:'KeloRender'"),'KeloRender audit declares frame ownership');
expect(renderSystem.includes("legacyBridge:'KELO_LEGACY_RENDER_BRIDGE'"),'KeloRender declares engine-c bridge compatibility');
expect(!/window\.render\s*=(?!=)/.test(gardens),'gardens landmark no longer wraps window.render');
expect(gardens.includes("KeloRender.afterFrame('gardens-landmark'"),'gardens landmark registers through KeloRender.afterFrame');

const engineCIndex=index.indexOf('engine-c.js');
const renderIndex=index.indexOf('src/core/render-extension-system.js');
expect(engineCIndex>=0&&renderIndex>engineCIndex,'KeloRender boots after engine-c publishes its bridge');
expect(manifest.domains?.render?.mode==='NEW','manifest promotes render frame authority to NEW');
expect(manifest.domains?.render?.owner==='KeloRender','manifest names KeloRender as render owner');
expect(manifest.domains?.render?.scope==='frame-orchestration-only','manifest does not overclaim visual/content ownership');
expect(Array.isArray(manifest.domains?.render?.contracts)&&manifest.domains.render.contracts.length===1&&manifest.domains.render.contracts[0]==='render','render migration contract is scoped to the frame function only');

if(report){
  const renderWriters=(report.authority?.render||[]).filter(w=>w.scope==='runtime');
  expect(renderWriters.length===1&&renderWriters[0].file==='src/core/render-extension-system.js','Observatory sees KeloRender as the only runtime render writer');
  const runtimeKeys=(report.runtimeConflicts||[]).map(c=>c.key).sort();
  expect(runtimeKeys.length===2&&runtimeKeys[0]==='localPlayer.x'&&runtimeKeys[1]==='localPlayer.y','render migration leaves only localPlayer x/y runtime conflicts');
}

const calls=[];
const context={
  console:{warn(){},log(){},error(){}},
  render:function(){calls.push('base');return 'base-result';},
  ctx:{},screenW:390,screenH:844,camera:{x:1,y:2},CONFIG:{zoom:1},
  KELO_LEGACY_RENDER_BRIDGE:{drawFrame:function(){calls.push('bridge');return 'bridge-result';}}
};
context.globalThis=context;context.window=context;
vm.createContext(context);
vm.runInContext(renderSystem,context,{filename:'render-extension-system.js'});
expect(!!context.KeloRender,'KeloRender installs in isolated runtime');
expect(context.KELO_RENDER_EXTENSION_AUDIT?.singleGlobalWriter===true,'runtime audit exposes single global writer ownership');
context.KeloRender.beforeFrame('audit-before',()=>calls.push('before'),10);
context.KeloRender.afterFrame('audit-after',()=>calls.push('after'),10);
const bridgeResult=context.render();
expect(calls.join(',')==='before,bridge,after','frame order is before -> engine-c bridge -> after');
expect(bridgeResult==='bridge-result','KeloRender returns bridge result');
expect(context.KeloRender.snapshot().bridgeFrames===1,'bridge frame is counted by owner');

calls.length=0;
delete context.KELO_LEGACY_RENDER_BRIDGE;
const fallbackResult=context.render();
expect(calls.join(',')==='before,base,after','engine-a fallback preserves before/after ordering when bridge is absent');
expect(fallbackResult==='base-result','KeloRender returns fallback render result');
expect(context.KeloRender.snapshot().fallbackFrames===1,'fallback frame is counted by owner');

calls.length=0;
context.KELO_LEGACY_RENDER_BRIDGE={drawFrame:function(){calls.push('bridge');}};
context.KeloRender.intercept('audit-exclusive',()=>{calls.push('intercept');return true;},-100);
context.render();
expect(calls.join(',')==='intercept','exclusive intercept skips bridge and before/after hooks');
expect(context.KeloRender.snapshot().exclusiveFrames===1,'exclusive frame is counted by owner');

if(failures){console.error(`Render owner migration audit failed with ${failures} violation(s).`);process.exit(1);}
console.log('RENDER_OWNER_MIGRATION_OK');
