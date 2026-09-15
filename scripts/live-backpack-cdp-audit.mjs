import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedTitle=process.env.EXPECTED_TITLE||'Kelo World — V6.20';
const chromeBin=process.env.CHROME_BIN||'/usr/bin/google-chrome';
const artifacts=path.resolve('artifacts');
fs.mkdirSync(artifacts,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'kelo-backpack-cdp-'));
const chrome=spawn(chromeBin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--remote-debugging-pipe',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check'],{stdio:['ignore','ignore','inherit','pipe','pipe']});
let nextId=1,buffer='';const pending=new Map(),listeners=new Map();
function on(method,fn){if(!listeners.has(method))listeners.set(method,[]);listeners.get(method).push(fn);}
chrome.stdio[4].setEncoding('utf8');
chrome.stdio[4].on('data',chunk=>{buffer+=chunk;let i;while((i=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,i);buffer=buffer.slice(i+1);if(!raw)continue;let msg;try{msg=JSON.parse(raw);}catch{continue;}if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message||'CDP error')):p.resolve(msg.result||{});}else if(msg.method){for(const fn of listeners.get(msg.method)||[])try{fn(msg.params||{},msg.sessionId);}catch{}}}});
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=nextId++;pending.set(id,{resolve,reject});const msg={id,method,params};if(sessionId)msg.sessionId=sessionId;chrome.stdio[3].write(JSON.stringify(msg)+'\0');setTimeout(()=>{if(pending.has(id)){pending.delete(id);reject(new Error(`CDP timeout: ${method}`));}},30000).unref();});}
async function evalJs(expression,sid){const out=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true},sid);if(out.exceptionDetails)throw new Error(`Runtime exception: ${out.exceptionDetails.text||'unknown'}`);return out.result?.value;}
async function waitFor(fn,sid,label,timeout=90000){const start=Date.now();while(Date.now()-start<timeout){try{if(await evalJs(`(${fn.toString()})()`,sid))return;}catch{}await sleep(1200);}throw new Error(`Timeout waiting for ${label}`);}
async function navigate(url,sid){await send('Page.navigate',{url},sid);await waitFor(()=>document.readyState==='complete',sid,'document complete',60000);}

const target=await send('Target.createTarget',{url:'about:blank'});const attached=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});const sid=attached.sessionId;
await send('Page.enable',{},sid);await send('Runtime.enable',{},sid);await send('Network.enable',{},sid);
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true,screenWidth:390,screenHeight:844},sid);await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5},sid);
const consoleErrors=[],failedRequests=[],httpErrors=[];
on('Runtime.consoleAPICalled',p=>{if(p.type==='error')consoleErrors.push((p.args||[]).map(a=>a.value??a.description??'').join(' '));});
on('Runtime.exceptionThrown',p=>consoleErrors.push(`EXCEPTION: ${p.exceptionDetails?.text||'unknown'}`));
on('Network.loadingFailed',p=>{if(!p.canceled)failedRequests.push({requestId:p.requestId,error:p.errorText||'failed'});});
on('Network.responseReceived',p=>{const s=Number(p.response?.status)||0;if(s>=400)httpErrors.push({status:s,url:p.response?.url||''});});

const ready=`document.title===${JSON.stringify(expectedTitle)}&&window.KELO_STONE_BACKPACK_BRIDGE_AUDIT?.version==='stone-backpack-bridge-v1.0.0'&&window.KELO_EQUIPMENT_AUDIT?.version==='equipment-v1.1.1'&&window.KELO_EQUIPMENT_AUDIT?.explicitEmptySlots===true&&window.KELO_BACKPACK_AUDIT?.version==='backpack-v1.1.0'&&window.KELO_BACKPACK_AUDIT?.stacksImplemented===true&&window.KELO_BACKPACK_AUDIT?.splitImplemented===true&&window.KELO_BACKPACK_AUDIT?.sortImplemented===true&&window.KELO_BACKPACK_AUDIT?.discardImplemented===true&&window.KELO_BACKPACK_UI_AUDIT?.version==='backpack-ui-v1.2.0'&&window.KELO_BACKPACK_UI_AUDIT?.equipmentAction===true&&window.KELO_BACKPACK_UI_AUDIT?.splitStepper===true&&!!window.KeloBackpack&&!!window.KeloEquipment&&!!document.getElementById('lx-side-menu')`;
let liveReady=false;
for(let attempt=1;attempt<=30;attempt++){await navigate(`${base}?backpack-cert=${Date.now()}-${attempt}`,sid);try{liveReady=!!(await evalJs(ready,sid));}catch{}if(liveReady)break;await sleep(5000);}
if(!liveReady)throw new Error('LIVE never reached exact Backpack/Equipment revisions');

await evalJs(`localStorage.removeItem('kelo_world_state_v2_1');true`,sid);consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await navigate(`${base}?backpack-cert=clean-${Date.now()}`,sid);await sleep(800);if(!(await evalJs(ready,sid)))throw new Error('Exact clean runtime missing');

await evalJs(`(()=>{document.getElementById('lx-side-menu')?.click();const b=[...document.querySelectorAll('button')].find(x=>/Mochila/i.test(x.textContent||''));if(!b)return false;b.click();return true;})()`,sid);await sleep(200);
const initial=await evalJs(`(()=>{const root=document.getElementById('kelo-bag'),el=root?.querySelector('.kb-slot'),slots=KeloBackpack.getSlots(),stats=KeloBackpack.getStats();return {title:document.title,visible:!!root&&getComputedStyle(root).display!=='none',touchAction:root?getComputedStyle(root).touchAction:null,viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio},target:el?{w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height}:null,stats,slotCount:slots.length,model:KELO_BACKPACK_AUDIT,ui:KELO_BACKPACK_UI_AUDIT,equipment:KELO_EQUIPMENT_AUDIT};})()`,sid);
if(!initial.visible||initial.viewport.w!==390||initial.viewport.h!==844||initial.target?.w<48||initial.target?.h<48)throw new Error(`Mobile contract failed ${JSON.stringify(initial)}`);

const equipmentTest=await evalJs(`(()=>{const item=KeloBackpack.getSlots().find(s=>s.item?.kind==='equipment')?.item;if(!item)return {ok:false,error:'NO_EQUIPMENT'};const slot=item.slot;const before=KeloEquipment.isEquipped(item.id);const un=KeloEquipment.unequipItem(slot);KeloEquipment.getEquipped();const afterEnsure=STATE.equipmentSlots[slot];const eq=KeloEquipment.equipItem(item.id);return {ok:un.ok&&eq.ok,before,afterEnsure,afterEquip:STATE.equipmentSlots[slot],itemId:item.id,slot};})()`,sid);
if(!equipmentTest.ok||equipmentTest.afterEnsure!==null||equipmentTest.afterEquip!==equipmentTest.itemId)throw new Error(`Equipment contract failed ${JSON.stringify(equipmentTest)}`);

const stackSetup=await evalJs(`(()=>{STATE.inventory=STATE.inventory.filter(x=>!String(x?.id||'').startsWith('audit_pot_'));STATE.inventory.push({id:'audit_pot_a',templateId:'audit_potion',name:'Poción de auditoría',kind:'consumable',quantity:7,maxStack:10,bound:false,rarity:'Common',icon:'✦'},{id:'audit_pot_b',templateId:'audit_potion',name:'Poción de auditoría',kind:'consumable',quantity:6,maxStack:10,bound:false,rarity:'Common',icon:'✦'});KeloBackpack.ensure();KeloBackpackUI.render();const slots=KeloBackpack.getSlots();return {a:slots.find(s=>s.item?.id==='audit_pot_a')?.index??null,b:slots.find(s=>s.item?.id==='audit_pot_b')?.index??null,free:slots.find(s=>!s.item)?.index??null};})()`,sid);
if(stackSetup.a==null||stackSetup.b==null||stackSetup.free==null)throw new Error(`Stack setup failed ${JSON.stringify(stackSetup)}`);

await evalJs(`(()=>{const a=document.querySelector('.kb-slot[data-slot="${stackSetup.a}"]');a?.click();const m=[...document.querySelectorAll('.kb-action')].find(x=>x.textContent==='Mover');m?.click();document.querySelector('.kb-slot[data-slot="${stackSetup.b}"]')?.click();return true;})()`,sid);await sleep(120);
const merged=await evalJs(`(()=>{const a=STATE.inventory.find(x=>x?.id==='audit_pot_a'),b=STATE.inventory.find(x=>x?.id==='audit_pot_b');return {aQty:a?.quantity??0,bQty:b?.quantity??0};})()`,sid);
if(merged.aQty!==3||merged.bQty!==10)throw new Error(`Stack merge failed ${JSON.stringify(merged)}`);

await evalJs(`(()=>{KeloBackpackUI.render();const slot=KeloBackpack.getSlots().find(s=>s.item?.id==='audit_pot_a');document.querySelector('.kb-slot[data-slot="'+slot.index+'"]')?.click();const b=[...document.querySelectorAll('.kb-action')].find(x=>x.textContent==='Dividir');b?.click();return true;})()`,sid);await sleep(80);
const splitUi=await evalJs(`(()=>({stepper:!!document.querySelector('.kb-stepper'),value:document.querySelector('.kb-step-value')?.textContent||'',sort:!!document.querySelector('.kb-sort')}))()`,sid);
if(!splitUi.stepper||!splitUi.sort)throw new Error(`Split/sort UI missing ${JSON.stringify(splitUi)}`);
await evalJs(`document.querySelector('.kb-split-go')?.click();true`,sid);await sleep(120);
const splitResult=await evalJs(`(()=>{const stacks=STATE.inventory.filter(x=>x?.templateId==='audit_potion').map(x=>({id:x.id,q:x.quantity,splitFrom:x.splitFrom||null}));return {stacks,quantities:stacks.map(x=>x.q).sort((a,b)=>a-b)};})()`,sid);
if(JSON.stringify(splitResult.quantities)!==JSON.stringify([1,2,10]))throw new Error(`Split failed ${JSON.stringify(splitResult)}`);

await evalJs(`document.querySelector('.kb-sort')?.click();true`,sid);await sleep(80);
const protections=await evalJs(`(()=>{const slots=KeloBackpack.getSlots();const eq=slots.find(s=>s.item?.kind==='equipment');STATE.inventory.push({id:'audit_bound',templateId:'audit_bound',name:'Objeto vinculado',kind:'material',quantity:1,maxStack:1,bound:true});KeloBackpack.ensure();const bound=KeloBackpack.getSlots().find(s=>s.item?.id==='audit_bound');return {equipment:KeloBackpack.discardSlot(eq.index).error,bound:KeloBackpack.discardSlot(bound.index).error};})()`,sid);
if(protections.equipment!=='EQUIPMENT_PROTECTED'||protections.bound!=='BOUND_ITEM_PROTECTED')throw new Error(`Discard protections failed ${JSON.stringify(protections)}`);

await evalJs(`(()=>{KeloBackpackUI.open();const s=KeloBackpack.getSlots().find(x=>x.item?.id==='audit_pot_b');document.querySelector('.kb-slot[data-slot="'+s.index+'"]')?.click();const d=[...document.querySelectorAll('.kb-action')].find(x=>x.textContent==='Descartar');d?.click();return true;})()`,sid);await sleep(80);
const discardUi=await evalJs(`(()=>({confirm:!!document.querySelector('.kb-discard-go'),detail:(document.querySelector('.kb-detail')?.textContent||'').trim()}))()`,sid);
if(!discardUi.confirm)throw new Error('Inline discard confirmation missing');

const shot=await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false},sid);fs.writeFileSync(path.join(artifacts,'live-backpack-mobile.png'),Buffer.from(shot.data,'base64'));

await evalJs(`(()=>{STATE.inventory=STATE.inventory.filter(x=>!String(x?.id||'').startsWith('audit_')&&!x?.splitFrom?.startsWith?.('audit_'));KeloBackpack.ensure();if(typeof saveState==='function')saveState();return true;})()`,sid);
await send('Page.reload',{ignoreCache:true},sid);await waitFor(()=>document.readyState==='complete',sid,'reload');await sleep(700);if(!(await evalJs(ready,sid)))throw new Error('Exact runtime missing after reload');
const persisted=await evalJs(`(()=>{const item=KeloEquipment.getItem('eq_weapon');return {weaponSlot:STATE.equipmentSlots.weapon,equipped:KeloEquipment.isEquipped(item.id),stats:KeloBackpack.getStats(),auditItems:STATE.inventory.filter(x=>String(x?.id||'').startsWith('audit_')).length};})()`,sid);
if(persisted.weaponSlot!=='eq_weapon'||!persisted.equipped||persisted.auditItems!==0)throw new Error(`Persistence/cleanup failed ${JSON.stringify(persisted)}`);

const report={liveReady,initial,equipmentTest,stackSetup,merged,splitUi,splitResult,protections,discardUi,persisted,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync(path.join(artifacts,'backpack-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(initial.stats.capacity<20||initial.slotCount!==initial.stats.capacity)throw new Error('Capacity contract failed');
if(initial.model?.mutatesLegacyInventoryOrderOnMove!==false)throw new Error('Legacy inventory order contract failed');
if(consoleErrors.length||failedRequests.length||httpErrors.length)throw new Error(`LIVE errors ${JSON.stringify({consoleErrors,failedRequests,httpErrors})}`);
try{await send('Browser.close');}catch{}finally{setTimeout(()=>chrome.kill('SIGKILL'),1000).unref();}
