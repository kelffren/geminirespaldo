import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const chromeBin=process.env.CHROME_BIN||'/usr/bin/google-chrome';
const expectedBridge='sword-swap-pvp-visuals-v1.4.1';
const expectedTitle='Kelo World — V6.38';
const artifacts=path.resolve('artifacts');
fs.mkdirSync(artifacts,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'kelo-sword-swap-vfx-'));
const chrome=spawn(chromeBin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--remote-debugging-pipe',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check'],{stdio:['ignore','ignore','inherit','pipe','pipe']});
let nextId=1,buffer='';const pending=new Map(),listeners=new Map();
function on(method,fn){if(!listeners.has(method))listeners.set(method,[]);listeners.get(method).push(fn);}
chrome.stdio[4].setEncoding('utf8');
chrome.stdio[4].on('data',chunk=>{buffer+=chunk;let i;while((i=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,i);buffer=buffer.slice(i+1);if(!raw)continue;let msg;try{msg=JSON.parse(raw);}catch{continue;}if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message||'CDP error')):p.resolve(msg.result||{});}else if(msg.method){for(const fn of listeners.get(msg.method)||[])try{fn(msg.params||{},msg.sessionId);}catch{}}}});
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=nextId++;pending.set(id,{resolve,reject});const msg={id,method,params};if(sessionId)msg.sessionId=sessionId;chrome.stdio[3].write(JSON.stringify(msg)+'\0');setTimeout(()=>{if(pending.has(id)){pending.delete(id);reject(new Error(`CDP timeout: ${method}`));}},30000).unref();});}
async function evalJs(expression,sid){const out=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true},sid);if(out.exceptionDetails)throw new Error(`Runtime exception: ${out.exceptionDetails.text||'unknown'}`);return out.result?.value;}
async function waitFor(expression,sid,label,timeout=90000){const start=Date.now();while(Date.now()-start<timeout){try{if(await evalJs(expression,sid))return;}catch{}await sleep(500);}throw new Error(`Timeout waiting for ${label}`);}
async function navigate(url,sid){await send('Page.navigate',{url},sid);await waitFor(`document.readyState==='complete'`,sid,'document complete',60000);}
async function screenshot(name,sid){const shot=await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false},sid);fs.writeFileSync(path.join(artifacts,name),Buffer.from(shot.data,'base64'));}

const target=await send('Target.createTarget',{url:'about:blank'});const attached=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});const sid=attached.sessionId;
await send('Page.enable',{},sid);await send('Runtime.enable',{},sid);await send('Network.enable',{},sid);
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true,screenWidth:390,screenHeight:844},sid);
await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5},sid);

const requests=new Map(),assetHttpErrors=[],assetLoadFailures=[],consoleErrors=[];
on('Network.requestWillBeSent',p=>requests.set(p.requestId,p.request?.url||''));
on('Network.responseReceived',p=>{const url=p.response?.url||'';const status=Number(p.response?.status)||0;if(url.includes('/assets/fx/sword-swap/')&&status>=400)assetHttpErrors.push({status,url});});
on('Network.loadingFailed',p=>{const url=requests.get(p.requestId)||'';if(url.includes('/assets/fx/sword-swap/')&&!p.canceled)assetLoadFailures.push({url,error:p.errorText||'failed'});});
on('Runtime.consoleAPICalled',p=>{if(p.type!=='error')return;const text=(p.args||[]).map(a=>a.value??a.description??'').join(' ');if(/SwordSwap|sword[_ -]?swap/i.test(text))consoleErrors.push(text);});
on('Runtime.exceptionThrown',p=>{const text=`EXCEPTION: ${p.exceptionDetails?.text||'unknown'}`;consoleErrors.push(text);});

const ready=`document.title===${JSON.stringify(expectedTitle)}&&window.KELO_SWORD_SWAP_PVP_VISUAL_AUDIT?.version===${JSON.stringify(expectedBridge)}&&window.KeloPvPWorld&&window.KeloAbilities&&window.KeloAssetRegistry&&window.KeloProjectileVisuals`;
let liveReady=false;
for(let attempt=1;attempt<=45;attempt++){
  await navigate(`${base}?sword-swap-vfx-cert=${Date.now()}-${attempt}`,sid);
  try{liveReady=!!(await evalJs(ready,sid));}catch{}
  if(liveReady)break;
  await sleep(5000);
}
if(!liveReady)throw new Error('LIVE never reached exact Sword Swap PvP visual bridge and cache-busted game version');

await waitFor(`window.KELO_SWORD_SWAP_PVP_VISUAL_AUDIT?.assetsReady===true`,sid,'Sword Swap PNG assets ready',30000);

const setup=await evalJs(`(()=>{
  const stone=KeloStones.createAbilityStone('swap_sword','Rare',{source:'live-vfx-audit'});
  STATE.equipped=[stone];
  STATE.inventory=(STATE.inventory||[]).filter(x=>x?.uid!==stone.uid);
  KeloAbilities.syncFromWorldState(true);
  localPlayer.mana=100;
  const slot=KeloAbilities.hotbar.slots.findIndex(s=>s?.definition?.key==='swap_sword');
  return {slot,title:document.title,bridge:KELO_SWORD_SWAP_PVP_VISUAL_AUDIT.version,assetsReady:KELO_SWORD_SWAP_PVP_VISUAL_AUDIT.assetsReady,blockerInstalled:KELO_SWORD_SWAP_PVP_VISUAL_AUDIT.blockerInstalled};
})()`,sid);
if(setup.slot<0||setup.title!==expectedTitle||setup.bridge!==expectedBridge||!setup.assetsReady||!setup.blockerInstalled)throw new Error(`Swap Sword setup failed ${JSON.stringify(setup)}`);

await evalJs(`KeloPvPWorld.enter();true`,sid);
await waitFor(`KeloPvPWorld.state.mode==='pvp'&&KeloPvPWorld.state.combatEnabled===true`,sid,'PvP entered',10000);

const thrown=await evalJs(`(()=>{
  const slot=${setup.slot};
  const p={x:localPlayer.x+245,y:localPlayer.y};
  const r=KeloPvPWorld.authority.execute(KeloPvPWorld.command('THROW_SWAP_SWORD',{slot,position:p}));
  return {ok:r.ok,result:r.result||null,player:{x:localPlayer.x,y:localPlayer.y},target:p};
})()`,sid);
if(!thrown.ok)throw new Error(`Sword throw failed ${JSON.stringify(thrown)}`);
await waitFor(`KeloPvPWorld.state.swapSword?.phase==='planted'`,sid,'Sword planted',5000);
await waitFor(`KELO_SWORD_SWAP_PVP_VISUAL_AUDIT.impactPlayed>=1&&KELO_SWORD_SWAP_PVP_VISUAL_AUDIT.loopPlayed>=1`,sid,'impact and planted loop visible',5000);

const blockerCheck=await evalJs(`(()=>{
  const sword=KeloPvPWorld.state.swapSword;
  const beforeHits=KELO_SWORD_SWAP_PVP_VISUAL_AUDIT.blockerHits;
  const restore={x:localPlayer.x,y:localPlayer.y};
  localPlayer.x=sword.x;localPlayer.y=sword.y;
  if(typeof updateSimulation==='function')updateSimulation(1/60);
  const after={x:localPlayer.x,y:localPlayer.y};
  const moved=Math.hypot(after.x-sword.x,after.y-sword.y);
  const out={active:KELO_SWORD_SWAP_PVP_VISUAL_AUDIT.blockerActive,hits:KELO_SWORD_SWAP_PVP_VISUAL_AUDIT.blockerHits-beforeHits,moved,box:KELO_SWORD_SWAP_PVP_VISUAL_AUDIT.blockerBox};
  localPlayer.x=restore.x;localPlayer.y=restore.y;localPlayer.vx=0;localPlayer.vy=0;
  return out;
})()`,sid);
if(!blockerCheck.active||blockerCheck.hits<1||blockerCheck.moved<1)throw new Error(`Planted sword blocker failed ${JSON.stringify(blockerCheck)}`);
await screenshot('01-sword-planted.png',sid);

const beforeSwap=await evalJs(`(()=>{const d=simulatedPlayers[0];return {player:{x:localPlayer.x,y:localPlayer.y},dummy:d?{x:d.x,y:d.y,id:d.id||null}:null,audit:{...KELO_SWORD_SWAP_PVP_VISUAL_AUDIT},projectiles:KeloProjectileVisuals.metrics()};})()`,sid);
const swapped=await evalJs(`(()=>{
  const d=simulatedPlayers[0];
  const r=KeloPvPWorld.authority.execute(KeloPvPWorld.command('RESOLVE_SWAP_SWORD',{position:{x:d.x,y:d.y},target:d}));
  return {ok:r.ok,result:r.result||null,player:{x:localPlayer.x,y:localPlayer.y},dummy:{x:d.x,y:d.y,id:d.id||null}};
})()`,sid);
if(!swapped.ok)throw new Error(`Character swap failed ${JSON.stringify(swapped)}`);
await waitFor(`KELO_SWORD_SWAP_PVP_VISUAL_AUDIT.teleportPlayed>=1&&KELO_SWORD_SWAP_PVP_VISUAL_AUDIT.returnPlayed>=1`,sid,'teleport and sword return VFX spawned',3000);
await sleep(120);
const teleportMoment=await evalJs(`(()=>({audit:{...KELO_SWORD_SWAP_PVP_VISUAL_AUDIT},projectiles:KeloProjectileVisuals.metrics(),assets:{teleport:KeloAssetRegistry.isReady('sword_swap_pvp_teleport_asset_v41'),return:KeloAssetRegistry.isReady('sword_swap_pvp_return_asset_v41')}}))()`,sid);
if(!teleportMoment.assets.teleport||!teleportMoment.assets.return||teleportMoment.projectiles.active<2)throw new Error(`Teleport visual not actually active ${JSON.stringify(teleportMoment)}`);
await screenshot('02-character-swap-teleport.png',sid);

await sleep(650);
const returnMoment=await evalJs(`(()=>({audit:{...KELO_SWORD_SWAP_PVP_VISUAL_AUDIT},projectiles:KeloProjectileVisuals.metrics(),phase:KeloPvPWorld.state.swapSword?.phase||null}))()`,sid);
if(returnMoment.audit.returnPlayed<1||returnMoment.phase!=='returning'||returnMoment.projectiles.active<1)throw new Error(`Sword return visual not active ${JSON.stringify(returnMoment)}`);
await screenshot('03-sword-returning.png',sid);

await waitFor(`!KeloPvPWorld.state.swapSword`,sid,'first sword return completed',7000);
await evalJs(`(()=>{const slot=${setup.slot};const h=KeloAbilities.hotbar.slots[slot];if(h)h.cooldown=0;localPlayer.mana=100;const p={x:localPlayer.x+180,y:localPlayer.y+40};return KeloPvPWorld.authority.execute(KeloPvPWorld.command('THROW_SWAP_SWORD',{slot,position:p})).ok;})()`,sid);
await waitFor(`KeloPvPWorld.state.swapSword?.phase==='planted'`,sid,'second sword planted',5000);
const teleportsBefore=await evalJs(`KELO_SWORD_SWAP_PVP_VISUAL_AUDIT.teleportPlayed`,sid);
const recalled=await evalJs(`(()=>{const slot=${setup.slot};const r=KeloPvPWorld.authority.execute(KeloPvPWorld.command('RECALL_SWAP_SWORD',{slot,swordEntityId:KeloPvPWorld.state.swapSword?.id}));return {ok:r.ok,result:r.result||null};})()`,sid);
if(!recalled.ok)throw new Error(`Recall-to-sword failed ${JSON.stringify(recalled)}`);
await waitFor(`KELO_SWORD_SWAP_PVP_VISUAL_AUDIT.teleportPlayed>${teleportsBefore}`,sid,'recall teleport VFX spawned',2000);
await sleep(100);
const recallMoment=await evalJs(`(()=>({audit:{...KELO_SWORD_SWAP_PVP_VISUAL_AUDIT},projectiles:KeloProjectileVisuals.metrics()}))()`,sid);
if(recallMoment.projectiles.active<2)throw new Error(`Recall teleport not visible ${JSON.stringify(recallMoment)}`);
await screenshot('04-recall-to-sword-teleport.png',sid);

const finalState=await evalJs(`(()=>({title:document.title,bridge:{...KELO_SWORD_SWAP_PVP_VISUAL_AUDIT},assetMetrics:KeloAssetRegistry.metrics(),projectileMetrics:KeloProjectileVisuals.metrics(),pvp:KeloPvPWorld.state}))()`,sid);
const report={liveReady,setup,thrown,blockerCheck,beforeSwap,swapped,teleportMoment,returnMoment,recalled,recallMoment,finalState,assetHttpErrors,assetLoadFailures,consoleErrors};
fs.writeFileSync(path.join(artifacts,'sword-swap-vfx-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(assetHttpErrors.length||assetLoadFailures.length||consoleErrors.length)throw new Error(`Sword Swap LIVE errors ${JSON.stringify({assetHttpErrors,assetLoadFailures,consoleErrors})}`);
if(finalState.title!==expectedTitle||finalState.bridge.teleportPlayed<2||finalState.bridge.returnPlayed<1||finalState.bridge.impactPlayed<2||finalState.bridge.loopPlayed<1||finalState.bridge.blockerHits<1)throw new Error(`Incomplete VFX/blocker coverage ${JSON.stringify(finalState)}`);

try{await send('Browser.close');}catch{}finally{setTimeout(()=>chrome.kill('SIGKILL'),1000).unref();}
