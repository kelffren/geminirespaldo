import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedTitle=process.env.EXPECTED_TITLE||'Kelo World — V6.23';
const chromeBin=process.env.CHROME_BIN||'/usr/bin/google-chrome';
const artifacts=path.resolve('artifacts');
fs.mkdirSync(artifacts,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'kelo-self-emotes-'));
const chrome=spawn(chromeBin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--remote-debugging-pipe',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check'],{stdio:['ignore','ignore','inherit','pipe','pipe']});
let nextId=1,buffer='';const pending=new Map(),listeners=new Map();
function on(method,fn){if(!listeners.has(method))listeners.set(method,[]);listeners.get(method).push(fn);}
chrome.stdio[4].setEncoding('utf8');
chrome.stdio[4].on('data',chunk=>{buffer+=chunk;let i;while((i=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,i);buffer=buffer.slice(i+1);if(!raw)continue;let msg;try{msg=JSON.parse(raw);}catch{continue;}if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message||'CDP error')):p.resolve(msg.result||{});}else if(msg.method){for(const fn of listeners.get(msg.method)||[])try{fn(msg.params||{},msg.sessionId);}catch{}}}});
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=nextId++;pending.set(id,{resolve,reject});const msg={id,method,params};if(sessionId)msg.sessionId=sessionId;chrome.stdio[3].write(JSON.stringify(msg)+'\0');setTimeout(()=>{if(pending.has(id)){pending.delete(id);reject(new Error(`CDP timeout: ${method}`));}},30000).unref();});}
async function evalJs(expression,sid){const out=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true},sid);if(out.exceptionDetails)throw new Error(`Runtime exception: ${out.exceptionDetails.text||'unknown'}`);return out.result?.value;}
async function waitFor(expression,sid,label,timeout=90000){const start=Date.now();while(Date.now()-start<timeout){try{if(await evalJs(expression,sid))return;}catch{}await sleep(900);}throw new Error(`Timeout waiting for ${label}`);}
async function navigate(url,sid){await send('Page.navigate',{url},sid);await waitFor(`document.readyState==='complete'`,sid,'document complete',60000);}
async function screenshot(name,sid){const shot=await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false},sid);fs.writeFileSync(path.join(artifacts,name),Buffer.from(shot.data,'base64'));}

const target=await send('Target.createTarget',{url:'about:blank'});const attached=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});const sid=attached.sessionId;
await send('Page.enable',{},sid);await send('Runtime.enable',{},sid);await send('Network.enable',{},sid);
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true,screenWidth:390,screenHeight:844},sid);await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5},sid);
const consoleErrors=[],failedRequests=[],httpErrors=[];
on('Runtime.consoleAPICalled',p=>{if(p.type==='error')consoleErrors.push((p.args||[]).map(a=>a.value??a.description??'').join(' '));});
on('Runtime.exceptionThrown',p=>consoleErrors.push(`EXCEPTION: ${p.exceptionDetails?.text||'unknown'}`));
on('Network.loadingFailed',p=>{if(!p.canceled)failedRequests.push({requestId:p.requestId,error:p.errorText||'failed'});});
on('Network.responseReceived',p=>{const s=Number(p.response?.status)||0;if(s>=400)httpErrors.push({status:s,url:p.response?.url||''});});

const ready=`document.title===${JSON.stringify(expectedTitle)}&&window.KeloContainers?.version==='container-v1.2.0'&&window.KeloEmotes?.version==='emote-loadout-v1.0.0'&&window.KeloSelfInteractionUI?.version==='self-interaction-ui-v1.0.0'&&window.KeloBackpackUI?.version==='backpack-ui-v2.0.0'&&window.KELO_SELF_INTERACTION_AUDIT?.selfTapMenu===true&&window.KELO_EMOTE_AUDIT?.noDuplicateInBackpackWhileEquipped===true`;
let liveReady=false;
for(let attempt=1;attempt<=36;attempt++){
  await navigate(`${base}?self-emotes-cert=${Date.now()}-${attempt}`,sid);
  try{liveReady=!!(await evalJs(ready,sid));}catch{}
  if(liveReady)break;
  await sleep(5000);
}
if(!liveReady)throw new Error('LIVE never reached exact self/emote runtime');
await evalJs(`localStorage.clear();true`,sid);
await navigate(`${base}?self-emotes-cert=clean-${Date.now()}`,sid);await sleep(700);
if(!(await evalJs(ready,sid)))throw new Error('Exact clean self/emote runtime missing');
consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;

const selfTap=await evalJs(`(()=>{const z=CONFIG.zoom||1;const sx=screenW/2+(localPlayer.x-camera.x)*z;const sy=screenH/2+(localPlayer.y-camera.y)*z;checkSocialTouch(sx,sy);const root=document.getElementById('kelo-self-actions');const close=root?.querySelector('.ksi-close')?.getBoundingClientRect();return {sx,sy,visible:!!root&&getComputedStyle(root).display!=='none',labels:[...root.querySelectorAll('.ksi-action')].map(b=>b.textContent.trim()),close:close?{w:close.width,h:close.height}:null,viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio}};})()`,sid);
if(!selfTap.visible||JSON.stringify(selfTap.labels)!==JSON.stringify(['MY PROFILE','BURLAS'])||selfTap.close?.w<48||selfTap.close?.h<48||selfTap.viewport.w!==390||selfTap.viewport.h!==844)throw new Error(`Self tap menu failed ${JSON.stringify(selfTap)}`);
await screenshot('self-actions-mobile.png',sid);

await evalJs(`document.querySelector('#kelo-self-actions .ksi-profile')?.click();true`,sid);await sleep(150);
const profileView=await evalJs(`(()=>{const root=document.getElementById('kelo-bag');return {open:!!window.KeloBackpackUI?.isOpen?.(),visible:!!root&&getComputedStyle(root).display!=='none',equipmentTab:(root?.querySelector('.kb-main-tab.active')?.textContent||'').trim(),hasAttributes:/ATRIBUTOS/.test(root?.textContent||'')};})()`,sid);
if(!profileView.open||!profileView.visible||!/EQUIPO/.test(profileView.equipmentTab)||!profileView.hasAttributes)throw new Error(`MY PROFILE did not open Backpack profile UI ${JSON.stringify(profileView)}`);
await evalJs(`KeloBackpackUI.close();true`,sid);

const setup=await evalJs(`(()=>{const id='audit_emote_dance';STATE.inventory=STATE.inventory.filter(x=>String(x?.id||'')!==id);KeloContainers.ensure();STATE.emoteLoadout.items=STATE.emoteLoadout.items.filter(x=>String(x?.id||'')!==id);KeloContainers.ensure();STATE.inventory.push({id,templateId:id,name:'Dance',kind:'emote',category:'emote',icon:'♪',rarity:'Rare',quantity:1,maxStack:1,bound:true,description:'Burla de auditoría LIVE'});KeloBackpack.ensure();if(typeof saveState==='function')saveState();const slot=KeloBackpack.getSlots().find(s=>s.item?.id===id);return {slot:slot?.index??null,bag:STATE.inventory.filter(x=>x?.id===id).length,equipped:STATE.emoteLoadout.items.filter(x=>x?.id===id).length,total:STATE.inventory.concat(STATE.emoteLoadout.items).filter(x=>x?.id===id).length};})()`,sid);
if(setup.slot==null||setup.bag!==1||setup.equipped!==0||setup.total!==1)throw new Error(`Synthetic emote setup failed ${JSON.stringify(setup)}`);

await evalJs(`(()=>{KeloBackpackUI.open();KeloBackpackUI.render();document.querySelector('.kb-slot[data-slot="${setup.slot}"]')?.click();return true;})()`,sid);await sleep(220);
const equipAction=await evalJs(`(()=>{const b=document.querySelector('.kelo-emote-equip-action');return {exists:!!b,label:(b?.textContent||'').trim(),detail:(document.querySelector('#kelo-bag .kb-detail')?.textContent||'').trim()};})()`,sid);
if(!equipAction.exists||equipAction.label!=='EQUIPAR BURLA'||!/Dance/.test(equipAction.detail))throw new Error(`Backpack emote equip action missing ${JSON.stringify(equipAction)}`);
await evalJs(`document.querySelector('.kelo-emote-equip-action')?.click();true`,sid);await sleep(180);
const equipped=await evalJs(`(()=>({bag:STATE.inventory.filter(x=>x?.id==='audit_emote_dance').length,loadout:STATE.emoteLoadout.items.filter(x=>x?.id==='audit_emote_dance').length,slots:KeloEmotes.getSlots().map(s=>s.item?.id||null),total:STATE.inventory.concat(STATE.emoteLoadout.items).filter(x=>x?.id==='audit_emote_dance').length}))()`,sid);
if(equipped.bag!==0||equipped.loadout!==1||equipped.total!==1||!equipped.slots.includes('audit_emote_dance'))throw new Error(`Equip transfer invariant failed ${JSON.stringify(equipped)}`);
await evalJs(`KeloBackpackUI.close();KeloSelfInteractionUI.open(195,360);document.querySelector('#kelo-self-actions .ksi-emotes')?.click();true`,sid);await sleep(160);
const emotePanel=await evalJs(`(()=>{const root=document.getElementById('kelo-emotes-panel'),close=root?.querySelector('.ke-close')?.getBoundingClientRect();return {visible:!!root&&getComputedStyle(root).display!=='none',slotCount:root?.querySelectorAll('.ke-slot').length||0,text:(root?.textContent||'').trim(),close:close?{w:close.width,h:close.height}:null,unequip:!!root?.querySelector('.ke-unequip')};})()`,sid);
if(!emotePanel.visible||emotePanel.slotCount!==4||!/Dance/.test(emotePanel.text)||!emotePanel.unequip||emotePanel.close?.w<48||emotePanel.close?.h<48)throw new Error(`Burlas panel failed ${JSON.stringify(emotePanel)}`);
await screenshot('emotes-equipped-mobile.png',sid);
await evalJs(`document.querySelector('#kelo-emotes-panel .ke-unequip')?.click();true`,sid);await sleep(160);
const unequipped=await evalJs(`(()=>({bag:STATE.inventory.filter(x=>x?.id==='audit_emote_dance').length,loadout:STATE.emoteLoadout.items.filter(x=>x?.id==='audit_emote_dance').length,total:STATE.inventory.concat(STATE.emoteLoadout.items).filter(x=>x?.id==='audit_emote_dance').length}))()`,sid);
if(unequipped.bag!==1||unequipped.loadout!==0||unequipped.total!==1)throw new Error(`Unequip return invariant failed ${JSON.stringify(unequipped)}`);

const persistedSetup=await evalJs(`(()=>{const out=KeloEmotes.equip('audit_emote_dance');if(typeof saveState==='function')saveState();return {ok:!!out?.ok,bag:STATE.inventory.filter(x=>x?.id==='audit_emote_dance').length,loadout:STATE.emoteLoadout.items.filter(x=>x?.id==='audit_emote_dance').length};})()`,sid);
if(!persistedSetup.ok||persistedSetup.bag!==0||persistedSetup.loadout!==1)throw new Error(`Persistence setup failed ${JSON.stringify(persistedSetup)}`);
await send('Page.reload',{ignoreCache:true},sid);await waitFor(`document.readyState==='complete'`,sid,'reload');await sleep(650);if(!(await evalJs(ready,sid)))throw new Error('Exact runtime missing after reload');
const persisted=await evalJs(`(()=>({bag:STATE.inventory.filter(x=>x?.id==='audit_emote_dance').length,loadout:STATE.emoteLoadout.items.filter(x=>x?.id==='audit_emote_dance').length,slot:KeloEmotes.getSlots().find(s=>s.item?.id==='audit_emote_dance')?.index??null}))()`,sid);
if(persisted.bag!==0||persisted.loadout!==1||persisted.slot==null)throw new Error(`Equipped emote did not persist reload ${JSON.stringify(persisted)}`);

await evalJs(`(()=>{STATE.inventory=STATE.inventory.filter(x=>x?.id!=='audit_emote_dance');STATE.emoteLoadout.items=STATE.emoteLoadout.items.filter(x=>x?.id!=='audit_emote_dance');KeloContainers.ensure();KeloBackpack.ensure();if(typeof saveState==='function')saveState();return true;})()`,sid);
await send('Page.reload',{ignoreCache:true},sid);await waitFor(`document.readyState==='complete'`,sid,'cleanup reload');await sleep(600);
const cleanup=await evalJs(`(()=>({bag:STATE.inventory.filter(x=>x?.id==='audit_emote_dance').length,loadout:STATE.emoteLoadout.items.filter(x=>x?.id==='audit_emote_dance').length}))()`,sid);
if(cleanup.bag||cleanup.loadout)throw new Error(`Audit cleanup failed ${JSON.stringify(cleanup)}`);

const report={liveReady,selfTap,profileView,setup,equipAction,equipped,emotePanel,unequipped,persistedSetup,persisted,cleanup,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync(path.join(artifacts,'self-emotes-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(consoleErrors.length||failedRequests.length||httpErrors.length)throw new Error(`LIVE errors ${JSON.stringify({consoleErrors,failedRequests,httpErrors})}`);
try{await send('Browser.close');}catch{}finally{setTimeout(()=>chrome.kill('SIGKILL'),1000).unref();}
