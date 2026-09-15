import assert from 'node:assert/strict';

const base=String(process.env.AUDIT_URL||'https://kelffren.github.io/gemini/').replace(/\/?$/,'/');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stamp=()=>`${Date.now()}-${Math.random().toString(36).slice(2)}`;
async function text(path){const url=new URL(path,base);url.searchParams.set('kelo_studio_audit',stamp());const res=await fetch(url,{headers:{'cache-control':'no-cache'}});if(!res.ok)throw new Error(`${path} HTTP ${res.status}`);return res.text();}

const checks=[
  ['index.html',s=>s.includes('src/ui/studio-launcher.js?v=2')&&!/src\/studio\/|studio-entry\.mjs/.test(s),'lazy index contract'],
  ['src/ui/studio-launcher.js',s=>s.includes("import('./../studio/integration/live-studio-controller.mjs')")&&s.includes('CREATE'),'lazy CREATE launcher'],
  ['src/studio/input/studio-camera-controller.mjs',s=>s.includes('createStudioCameraController')&&s.includes('navTouchIds')&&s.includes('focusRect')&&s.includes('zoom=clamp'),'Studio camera + touch isolation'],
  ['src/studio/render/studio-asset-preview-service.mjs',s=>s.includes('createStudioAssetPreviewService')&&s.includes('atlasContract.acquire')&&s.includes('renderThumbnail')&&s.includes('drawAsset'),'Atlas-backed visual previews'],
  ['src/studio/render/studio-overlay-renderer.mjs',s=>s.includes('drawPlacement')&&s.includes('assetPreview?.drawAsset')&&s.includes('drawCreatorPrefab'),'real placement/prefab ghosts'],
  ['src/studio/ui/studio-live-shell.mjs',s=>s.includes('ASSETS · VISUAL')&&s.includes("document.createElement('canvas')")&&s.includes('renderAssetPreview')&&s.includes('FOCUS'),'visual Asset Browser'],
  ['src/studio/integration/live-studio-controller.mjs',s=>s.includes('cameraController.toWorld')&&s.includes('renderAssetPreview')&&s.includes('studio.tools.marquee.begin')&&s.includes('studio.tools.marquee.commit')&&s.includes("version:'kelo-studio-creator-v1.3.0'"),'Creator V1 live orchestration']
];

let last=[];
for(let attempt=1;attempt<=36;attempt++){
  last=[];
  for(const [path,test,label] of checks){
    try{const source=await text(path);if(!test(source))last.push(`${label}: content mismatch (${path})`);}catch(error){last.push(`${label}: ${error.message}`);}
  }
  if(!last.length){console.log(JSON.stringify({ok:true,live:true,base,attempt,checks:checks.map(([, ,label])=>label)},null,2));process.exit(0);}
  console.log(`[Kelo Studio LIVE] attempt ${attempt}/36 not ready: ${last.join(' | ')}`);
  if(attempt<36)await wait(5000);
}
assert.fail(`Kelo Studio LIVE publication audit failed: ${last.join(' | ')}`);
