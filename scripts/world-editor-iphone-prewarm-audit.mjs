import fs from 'node:fs';

const src=fs.readFileSync('src/studio/integration/world-studio-bridge.mjs','utf8');
const controller=fs.readFileSync('src/studio/integration/live-studio-controller.mjs','utf8');
const pace=fs.readFileSync('src/studio/integration/studio-boot-pace.mjs','utf8');
const runtimeRoots=[
  '../render/studio-overlay-canvas.mjs',
  '../render/creator-grid-overlay.mjs',
  '../input/pointer-input-adapter.mjs',
  '../input/studio-camera-controller.mjs',
  './authority-command-mirror.mjs',
  '../ui/creator-productivity-panel.mjs',
  '../tools/creator-actions.mjs',
  '../prefabs/creator-prefab-library.mjs',
  '../validation/creator-world-analyzer.mjs',
  '../document/document-commands.mjs'
];

if(src.includes('prewarmIphoneStudioRuntime'))throw new Error('World bridge must not gate controller mount behind an eager iPhone runtime prewarm');
if(src.includes('iphonePrewarmed'))throw new Error('obsolete iPhone prewarm state must not return');
for(const mod of runtimeRoots){
  if(src.includes(`'${mod}'`))throw new Error(`runtime root leaked back into World bridge critical path: ${mod}`);
}
const status=src.indexOf("setWorldLaunchStatus(root,'Cargando editor…')");
const firstYield=src.indexOf('await yieldStudioBoot(root)',status);
const controllerStart=src.indexOf('controllerMod=await import(CONTROLLER)',firstYield);
if(status<0||firstYield<0||controllerStart<0)throw new Error('paced direct controller handoff missing');
if(!(status<firstYield&&firstYield<controllerStart))throw new Error('controller handoff order must be status -> paint yield -> controller import');
const beforeController=src.slice(firstYield,controllerStart);
if((beforeController.match(/await import\(/g)||[]).length!==0)throw new Error('no Studio runtime import may block between the paint yield and controller import');
const controllerReturn=src.indexOf('return controllerMod;',controllerStart);
if(controllerReturn<0)throw new Error('controller return missing');
const afterControllerImport=src.slice(controllerStart,controllerReturn);
if(afterControllerImport.includes('await yieldStudioBoot(root)'))throw new Error('do not insert a second paint/timer barrier between controller evaluation and World mount');
if(!afterControllerImport.includes("setWorldLaunchStatus(root,'Montando editor…')"))throw new Error('post-import mount status missing');
if(!src.includes("if(root?.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT')"))throw new Error('abort guard missing from direct controller handoff');

if(!src.includes('const bridgeUrl=new URL(import.meta.url)'))throw new Error('bridge must inspect its own versioned URL');
if(!src.includes("const incomingBuild=bridgeUrl.searchParams.get('v')||''"))throw new Error('bridge must separate incoming workspace token from its current build');
if(!src.includes("incomingBuild.startsWith('world-ios-')?incomingBuild:WORLD_STUDIO_BRIDGE_BUILD"))throw new Error('only a fresh world-ios retry nonce may override the current bridge build');
if(!src.includes('encodeURIComponent(controllerBuild)'))throw new Error('controller URL must carry the selected current/retry token');
if(src.includes("const controllerBuild=bridgeUrl.searchParams.get('v')||WORLD_STUDIO_BRIDGE_BUILD"))throw new Error('stale static Workspace build must not downgrade controller/shell/studio-entry');
if(/const CONTROLLER=`\.\/live-studio-controller\.mjs\?v=\$\{WORLD_STUDIO_BRIDGE_BUILD\}`/.test(src))throw new Error('fixed controller URL makes fresh World retry reuse the previous Safari module instance');

if(!controller.includes('const controllerUrl=new URL(import.meta.url)'))throw new Error('live controller must inspect its versioned module URL');
if(!controller.includes("controllerUrl.searchParams.get('v')||'world-bridge-20260914-15'"))throw new Error('live controller must inherit the bridge/retry token instead of pinning a stale build');
if(/const BUILD='world-bridge-20260914-\d+'/.test(controller))throw new Error('fixed controller BUILD breaks fresh Safari retries for shell/studio-entry');
if(!controller.includes('studio-live-shell.mjs?v=${BUILD}'))throw new Error('live shell import must receive inherited World retry token');
if(!controller.includes('studio-entry.mjs?v=${BUILD}'))throw new Error('studio-entry import must receive inherited World retry token');

const fallback=pace.match(/const DEFAULT_RAF_FALLBACK_MS=(\d+);/);
if(!fallback)throw new Error('Studio boot rAF fallback missing');
if(Number(fallback[1])>50)throw new Error(`Studio boot rAF fallback ${fallback[1]}ms is too long for phased iPhone World boot`);
if(!pace.includes('timer=wait(finish,fallbackMs)'))throw new Error('Studio boot yield must retain a timer escape hatch when Safari rAF stalls');

console.log('world-editor-iphone-prewarm-audit: PASS (controller-first, stale static build rejected, fresh retry cascades, bounded Safari paint fallback)');
