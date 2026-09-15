import fs from 'node:fs';

const workspace=fs.readFileSync('src/creators/workspaces/world-workspace.mjs','utf8');
const bridge=fs.readFileSync('src/studio/integration/world-studio-bridge.mjs','utf8');

const openStart=workspace.indexOf('async open({root=globalThis');
const openEnd=workspace.indexOf('\n    }\n  });',openStart);
if(openStart<0||openEnd<0)throw new Error('World workspace open path not found');
const openPath=workspace.slice(openStart,openEnd);
if(openPath.includes('preloadPhoneStudioRuntime(root)'))throw new Error('World open path must not run the legacy broad Studio prewarm');
if(!workspace.includes("const WORLD_BUILD='world-bridge-20260915-22'"))throw new Error('World workspace cache-bust contract changed unexpectedly');
if(bridge.includes('prewarmIphoneStudioRuntime'))throw new Error('World bridge must not own an eager iPhone prewarm gate');
if(bridge.includes('for(let i=0;i<roots.length;i++)'))throw new Error('serialized runtime prewarm loop must not return to the bridge');
if(!bridge.includes('controllerMod=await import(CONTROLLER)'))throw new Error('World bridge must hand off directly to the zero-static-import controller');

console.log('world-editor-single-prewarm-owner-audit: PASS (no eager prewarm owner)');