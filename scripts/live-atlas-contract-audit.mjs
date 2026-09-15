import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const urls={
  atlas:new URL('src/environment/atlas-contract.js',base).toString(),
  world:new URL('src/environment/world-map.js',base).toString(),
  props:new URL('src/environment/generic-props.js',base).toString(),
  prefabs:new URL('src/environment/generic-prefabs.js',base).toString()
};
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],pageErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>pageErrors.push(e.stack||e.message));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});

async function bodyHas(url,tokens,attempt){
  const u=new URL(url);u.searchParams.set('audit-bust',`${Date.now()}-${attempt}`);
  const res=await page.request.get(u.toString());
  if(!res.ok())return false;
  const body=await res.text();
  return tokens.every(t=>body.includes(t));
}
let converged=false;
for(let attempt=1;attempt<=18;attempt++){
  try{
    const [atlasOk,worldOk,propsOk,prefabsOk]=await Promise.all([
      bodyHas(urls.atlas,["id:'kelo-atlas-contract-v1'","version:'1.2.0'","imageCreation:'atlas-contract-only'"],attempt),
      bodyHas(urls.world,["version:'world-v1.24'","atlasConsumerMode:'atlas-contract-managed-v1'","worldOwnsImageLoader:false"],attempt),
      bodyHas(urls.props,["generic-props-v1.5","atlas-contract-managed-v1"],attempt),
      bodyHas(urls.prefabs,["generic-prefabs-v1.3","atlas-contract-managed-v1"],attempt)
    ]);
    if(atlasOk&&worldOk&&propsOk&&prefabsOk){
      consoleErrors.length=0;pageErrors.length=0;failedRequests.length=0;httpErrors.length=0;
      await page.goto(`${base}?atlas-contract-audit=${Date.now()}-${attempt}`,{waitUntil:'domcontentloaded',timeout:45000});
      await page.waitForFunction(()=>window.KELO_ATLAS_AUDIT?.policyId==='kelo-atlas-contract-v1'&&window.KELO_ATLAS_AUDIT?.version==='1.2.0',{timeout:15000});
      await page.waitForFunction(()=>window.KELO_WORLD_AUDIT?.ready===true&&window.KELO_GENERIC_PROP_AUDIT?.ready===true&&window.KELO_PREFAB_AUDIT?.ready===true,{timeout:30000});
      converged=true;break;
    }
  }catch(e){console.log(`deployment attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(10000);
}
if(!converged)throw new Error('LIVE Pages never converged to Atlas Contract v1.2 + managed world/prop/prefab consumers');
await page.waitForTimeout(1500);
const state=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas'),a=window.KELO_ATLAS_AUDIT,p=window.KELO_ATLAS_CONTRACT?.policy,w=window.KELO_WORLD_AUDIT;
  return{
    canvas:c?{width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}:null,
    registry:window.KELO_TILE_REGISTRY?.version||null,
    world:w?{version:w.version,ready:w.ready,atlasConsumerMode:w.atlasConsumerMode,worldOwnsImageLoader:w.worldOwnsImageLoader,atlasContractVersion:w.atlasContractVersion,terrainAtlasesReady:w.terrainAtlasesReady,gardensAssetLoaded:w.gardensAssetLoaded,gardensJoinAssetLoaded:w.gardensJoinAssetLoaded}:null,
    atlas:a||null,
    policy:p?{id:p.id,version:p.version,maxDimension:p.maxDimension,preferredDimensions:p.preferredDimensions,loading:p.loading,unloading:p.unloading,ownership:p.ownership}:null,
    props:{version:window.KELO_GENERIC_PROP_AUDIT?.version||null,ready:window.KELO_GENERIC_PROP_AUDIT?.ready===true,resourceMode:window.KELO_GENERIC_PROP_AUDIT?.resourceMode||null},
    prefabs:{version:window.KELO_PREFAB_AUDIT?.version||null,ready:window.KELO_PREFAB_AUDIT?.ready===true,resourceMode:window.KELO_PREFAB_AUDIT?.resourceMode||null}
  };
});
await page.screenshot({path:'artifacts/live-atlas-contract-mobile.png',fullPage:false});
const gardens=await page.evaluate(()=>{
  const c=document.getElementById('game-canvas');if(!c||typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof render!=='function')return null;
  localPlayer.x=1450;localPlayer.y=2470;camera.x=1450;camera.y=2470;camera.targetX=1450;camera.targetY=2470;render();
  return{dataUrl:c.toDataURL('image/png'),world:window.KELO_WORLD_AUDIT||null,atlas:window.KELO_ATLAS_AUDIT||null};
});
if(gardens?.dataUrl?.startsWith('data:image/png;base64,'))fs.writeFileSync('artifacts/live-atlas-gardens.png',Buffer.from(gardens.dataUrl.split(',')[1],'base64'));
const report={state,gardens:gardens?{world:gardens.world,atlas:gardens.atlas}:null,consoleErrors,pageErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/atlas-contract-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
if(state.canvas?.cssWidth!==390||state.canvas?.cssHeight!==844)throw new Error(`Unexpected CSS canvas ${JSON.stringify(state.canvas)}`);
if(state.canvas?.width!==780||state.canvas?.height!==1688)throw new Error(`Unexpected backing canvas ${JSON.stringify(state.canvas)}`);
if(state.world?.version!=='world-v1.24'||state.world?.atlasConsumerMode!=='atlas-contract-managed-v1'||state.world?.worldOwnsImageLoader!==false||state.world?.atlasContractVersion!=='1.2.0'||!state.world?.terrainAtlasesReady||!state.world?.gardensAssetLoaded||!state.world?.gardensJoinAssetLoaded)throw new Error(`World atlas ownership invalid: ${JSON.stringify(state.world)}`);
if(state.policy?.version!=='1.2.0'||state.policy?.ownership?.imageCreation!=='atlas-contract-only'||state.policy?.ownership?.consumerRule!=='acquire-by-key-never-rewrite-src')throw new Error(`Atlas ownership policy invalid: ${JSON.stringify(state.policy)}`);
if(state.atlas?.violations?.length)throw new Error(`Atlas violations: ${JSON.stringify(state.atlas.violations)}`);
if((state.atlas?.atlasCount||0)<17)throw new Error(`Unexpected atlas count ${state.atlas?.atlasCount}`);
for(const key of ['plaza','transitions','grassVariation','marbleVariation','gardensBase','gardensJoins','plazaNature','ruralProps','plazaFountainBack','plazaFountainFront','luxeBoutique'])if(!state.atlas?.loaded?.includes(key))throw new Error(`Managed asset not loaded through atlas contract: ${key}`);
if(state.props.resourceMode!=='atlas-contract-managed-v1')throw new Error(`Props are not atlas-contract managed: ${JSON.stringify(state.props)}`);
if(state.prefabs.resourceMode!=='atlas-contract-managed-v1')throw new Error(`Prefabs are not atlas-contract managed: ${JSON.stringify(state.prefabs)}`);
if(consoleErrors.length||pageErrors.length)throw new Error(`Console/page errors: ${JSON.stringify({consoleErrors,pageErrors})}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
