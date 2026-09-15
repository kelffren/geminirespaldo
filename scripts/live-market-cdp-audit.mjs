import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const chromeBin=process.env.CHROME_BIN||'/usr/bin/google-chrome';
const artifacts=path.resolve('artifacts');
fs.mkdirSync(artifacts,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'kelo-market-cdp-'));
const chrome=spawn(chromeBin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--remote-debugging-pipe',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check'],{stdio:['ignore','ignore','inherit','pipe','pipe']});

let nextId=1,buffer='';const pending=new Map(),listeners=new Map();
function on(m,f){if(!listeners.has(m))listeners.set(m,[]);listeners.get(m).push(f);}
chrome.stdio[4].setEncoding('utf8');
chrome.stdio[4].on('data',chunk=>{buffer+=chunk;let i;while((i=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,i);buffer=buffer.slice(i+1);if(!raw)continue;let msg;try{msg=JSON.parse(raw);}catch{continue;}if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message||'CDP error')):p.resolve(msg.result||{});}else if(msg.method){for(const fn of listeners.get(msg.method)||[])try{fn(msg.params||{},msg.sessionId);}catch{}}}});
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=nextId++;pending.set(id,{resolve,reject});const msg={id,method,params};if(sessionId)msg.sessionId=sessionId;chrome.stdio[3].write(JSON.stringify(msg)+'\0');setTimeout(()=>{if(pending.has(id)){pending.delete(id);reject(new Error('CDP timeout '+method));}},30000).unref();});}
async function ev(expression,sid){const out=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true},sid);if(out.exceptionDetails)throw new Error(out.exceptionDetails.text||'runtime exception');return out.result?.value;}
async function waitFor(expr,sid,label,timeout=90000){const start=Date.now();while(Date.now()-start<timeout){try{if(await ev(expr,sid))return;}catch{}await sleep(1200);}throw new Error('Timeout '+label);}
async function nav(url,sid){await send('Page.navigate',{url},sid);await waitFor(`document.readyState==='complete'`,sid,'document');}

const target=await send('Target.createTarget',{url:'about:blank'}),attached=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true}),sid=attached.sessionId;
await send('Page.enable',{},sid);await send('Runtime.enable',{},sid);await send('Network.enable',{},sid);
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true,screenWidth:390,screenHeight:844},sid);await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5},sid);
const consoleErrors=[],failedRequests=[],httpErrors=[];
on('Runtime.consoleAPICalled',p=>{if(p.type==='error')consoleErrors.push((p.args||[]).map(a=>a.value??a.description??'').join(' '));});
on('Runtime.exceptionThrown',p=>consoleErrors.push('EXCEPTION: '+(p.exceptionDetails?.text||'unknown')));
on('Network.loadingFailed',p=>{if(!p.canceled)failedRequests.push({requestId:p.requestId,error:p.errorText||'failed'});});
on('Network.responseReceived',p=>{const s=Number(p.response?.status)||0;if(s>=400)httpErrors.push({status:s,url:p.response?.url||''});});

const ready=`document.title==='Kelo World — V6.20'&&window.KELO_EQUIPMENT_AUDIT?.version==='equipment-v1.1.2'&&window.KELO_BACKPACK_AUDIT?.version==='backpack-v1.1.0'&&window.KELO_CONTAINER_AUDIT?.version==='container-v1.1.0'&&window.KELO_CONTAINER_AUDIT?.marketEscrowImplemented===true&&window.KELO_MARKET_ESCROW_AUDIT?.version==='market-escrow-v1.0.0'&&window.KELO_MARKET_UI_AUDIT?.version==='market-ui-v1.0.0'&&window.KELO_MARKET_UI_AUDIT?.backpackPublishAction===true&&!!window.KeloMarketEscrow&&!!window.KeloMarketUI&&!!window.KeloContainers&&!!window.KeloBackpackUI`;
let liveReady=false;
for(let attempt=1;attempt<=36;attempt++){await nav(`${base}?market-cert=${Date.now()}-${attempt}`,sid);try{liveReady=!!(await ev(ready,sid));}catch{}if(liveReady)break;await sleep(5000);}
if(!liveReady)throw new Error('LIVE never reached exact Market Escrow revisions');

await ev(`localStorage.removeItem('kelo_world_state_v2_1');true`,sid);consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await nav(`${base}?market-cert=clean-${Date.now()}`,sid);await sleep(800);if(!(await ev(ready,sid)))throw new Error('Exact clean runtime missing');
const initial=await ev(`(()=>({viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio},backpack:KeloContainers.getStats('backpack'),escrow:KeloContainers.getStats('market_escrow'),invariants:KeloMarketEscrow.auditInvariants(),model:KELO_MARKET_ESCROW_AUDIT,ui:KELO_MARKET_UI_AUDIT,container:KELO_CONTAINER_AUDIT,equipment:KELO_EQUIPMENT_AUDIT}))()`,sid);
if(initial.viewport.w!==390||initial.viewport.h!==844||!initial.invariants.ok)throw new Error('Initial Market contract failed '+JSON.stringify(initial));

const setupFull=await ev(`(()=>{STATE.inventory=STATE.inventory.filter(x=>!String(x?.id||'').startsWith('mkt_live_'));STATE.marketEscrowListings=[];STATE.marketEscrow.items=[];STATE.marketEscrow.slots=new Array(STATE.marketEscrow.capacity).fill(null);STATE.inventory.push({id:'mkt_live_full',templateId:'mkt_full',name:'Reliquia de Mercado',icon:'◆',kind:'material',quantity:4,maxStack:10,bound:true,rarity:'Epic',metadata:{seal:'keep'}});KeloBackpack.ensure();KeloContainers.ensure();KeloBackpackUI.open();const s=KeloBackpack.getSlots().find(x=>x.item?.id==='mkt_live_full');document.querySelector('.kb-slot[data-slot="'+s.index+'"]')?.click();KeloMarketUI.decorateBackpack();return {slot:s?.index??null,publish:!!document.querySelector('.kb-market-publish'),before:STATE.inventory.concat(STATE.warehouse.items,STATE.marketEscrow.items).reduce((n,x)=>n+(Number(x.quantity)||1),0),slotTarget:document.querySelector('.kb-slot')?.getBoundingClientRect().width||0};})()`,sid);
if(setupFull.slot==null||!setupFull.publish||setupFull.slotTarget<48)throw new Error('Backpack publish entry missing '+JSON.stringify(setupFull));
await ev(`document.querySelector('.kb-market-publish')?.click();true`,sid);await sleep(80);
const publishUi=await ev(`(()=>({box:!!document.querySelector('.kb-market-box'),value:document.querySelector('.kb-market-value')?.textContent||'',go:!!document.querySelector('.kb-market-go')}))()`,sid);
if(!publishUi.box||publishUi.value!=='4'||!publishUi.go)throw new Error('Publish UI contract failed '+JSON.stringify(publishUi));
await ev(`document.querySelector('.kb-market-go')?.click();true`,sid);await sleep(160);

const fullListed=await ev(`(()=>{const l=KeloMarketEscrow.getActiveListings().find(x=>x.escrowItemInstanceId==='mkt_live_full'),e=STATE.marketEscrow.items.find(x=>x.id==='mkt_live_full');return {listing:l||null,inBag:STATE.inventory.some(x=>x.id==='mkt_live_full'),inEscrow:!!e,q:e?.quantity,bound:e?.bound,rarity:e?.rarity,seal:e?.metadata?.seal,total:STATE.inventory.concat(STATE.warehouse.items,STATE.marketEscrow.items).reduce((n,x)=>n+(Number(x.quantity)||1),0),marketVisible:getComputedStyle(document.getElementById('kelo-market-v1')).display!=='none',card:!!document.querySelector('.km-card[data-listing="'+(l?.listingId||'')+'"]'),audit:KeloMarketEscrow.auditInvariants()};})()`,sid);
if(!fullListed.listing||fullListed.inBag||!fullListed.inEscrow||fullListed.q!==4||fullListed.bound!==true||fullListed.rarity!=='Epic'||fullListed.seal!=='keep'||fullListed.total!==setupFull.before||!fullListed.marketVisible||!fullListed.card||!fullListed.audit.ok)throw new Error('Full listing failed '+JSON.stringify(fullListed));

await send('Page.reload',{ignoreCache:true},sid);await waitFor(`document.readyState==='complete'`,sid,'reload');await sleep(800);
if(!(await ev(ready,sid)))throw new Error('Exact runtime missing after listing reload');
const persisted=await ev(`(()=>{const l=KeloMarketEscrow.getActiveListings().find(x=>x.escrowItemInstanceId==='mkt_live_full');return {listing:!!l,escrow:STATE.marketEscrow.items.some(x=>x.id==='mkt_live_full'),bag:STATE.inventory.some(x=>x.id==='mkt_live_full'),audit:KeloMarketEscrow.auditInvariants()};})()`,sid);
if(!persisted.listing||!persisted.escrow||persisted.bag||!persisted.audit.ok)throw new Error('Listing persistence failed '+JSON.stringify(persisted));

await ev(`window.openSocialTool('market');true`,sid);await sleep(100);
await ev(`(()=>{const l=KeloMarketEscrow.getActiveListings().find(x=>x.escrowItemInstanceId==='mkt_live_full');document.querySelector('.km-card[data-listing="'+l.listingId+'"]')?.click();document.querySelector('.km-cancel')?.click();return true;})()`,sid);await sleep(150);
const cancelled=await ev(`(()=>{const l=STATE.marketEscrowListings.find(x=>x.escrowItemInstanceId==='mkt_live_full');return {status:l?.status,returned:l?.returnedItemInstanceId,inBag:STATE.inventory.some(x=>x.id==='mkt_live_full'),inEscrow:STATE.marketEscrow.items.some(x=>x.id==='mkt_live_full'),audit:KeloMarketEscrow.auditInvariants()};})()`,sid);
if(cancelled.status!=='cancelled'||cancelled.returned!=='mkt_live_full'||!cancelled.inBag||cancelled.inEscrow||!cancelled.audit.ok)throw new Error('Cancel failed '+JSON.stringify(cancelled));

const partialSetup=await ev(`(()=>{STATE.inventory.push({id:'mkt_live_stack',templateId:'mkt_potion',name:'Poción de Mercado',icon:'✦',kind:'consumable',quantity:8,maxStack:10,bound:false,rarity:'Rare',metadata:{batch:'live'}});KeloBackpack.ensure();KeloBackpackUI.open();const s=KeloBackpack.getSlots().find(x=>x.item?.id==='mkt_live_stack');document.querySelector('.kb-slot[data-slot="'+s.index+'"]')?.click();KeloMarketUI.decorateBackpack();document.querySelector('.kb-market-publish')?.click();return {value:document.querySelector('.kb-market-value')?.textContent||'',slot:s.index};})()`,sid);
if(partialSetup.value!=='8')throw new Error('Partial publish default must be full stack');
for(let i=0;i<5;i++)await ev(`document.querySelector('.kb-market-minus')?.click();true`,sid);
const partialValue=await ev(`document.querySelector('.kb-market-value')?.textContent||''`,sid);if(partialValue!=='3')throw new Error('Partial quantity stepper failed '+partialValue);
await ev(`document.querySelector('.kb-market-go')?.click();true`,sid);await sleep(160);
const partial=await ev(`(()=>{const l=KeloMarketEscrow.getActiveListings().find(x=>x.templateId==='mkt_potion');const e=STATE.marketEscrow.items.find(x=>KeloMarketEscrow.itemIdentity(x)===l?.escrowItemInstanceId),src=STATE.inventory.find(x=>x.id==='mkt_live_stack');return {listing:l||null,escrowId:l?.escrowItemInstanceId,sourceQty:src?.quantity,escrowQty:e?.quantity,splitFrom:e?.splitFrom,batch:e?.metadata?.batch,sameId:l?.escrowItemInstanceId==='mkt_live_stack',audit:KeloMarketEscrow.auditInvariants()};})()`,sid);
if(!partial.listing||partial.sourceQty!==5||partial.escrowQty!==3||partial.splitFrom!=='mkt_live_stack'||partial.batch!=='live'||partial.sameId||!partial.audit.ok)throw new Error('Partial listing failed '+JSON.stringify(partial));

await ev(`(()=>{KeloMarketUI.open();const l=KeloMarketEscrow.getActiveListings().find(x=>x.templateId==='mkt_potion');document.querySelector('.km-card[data-listing="'+l.listingId+'"]')?.click();return true;})()`,sid);await sleep(100);
const shot=await send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false},sid);fs.writeFileSync(path.join(artifacts,'live-market-mobile.png'),Buffer.from(shot.data,'base64'));

const fullBlocked=await ev(`(()=>{STATE.inventory.push({id:'mkt_live_block',templateId:'mkt_block',name:'Bloqueado',kind:'item',quantity:1,maxStack:1});KeloBackpack.ensure();let out=KeloMarketEscrow.createMarketListing('mkt_live_block',1,{price:150});if(!out.ok)return {setupError:out};const listing=out.listing;while(KeloContainers.getStats('backpack').free>0){const i=STATE.inventory.length,x={id:'mkt_live_fill_'+i,templateId:'mkt_live_fill_'+i,name:'Fill',kind:'item',quantity:1,maxStack:1};STATE.inventory.push(x);KeloBackpack.ensure();}const before=JSON.stringify({inventory:STATE.inventory,backpack:STATE.backpack,escrow:STATE.marketEscrow,listings:STATE.marketEscrowListings});out=KeloMarketEscrow.cancelMarketListing(listing.listingId);const after=JSON.stringify({inventory:STATE.inventory,backpack:STATE.backpack,escrow:STATE.marketEscrow,listings:STATE.marketEscrowListings});const active=STATE.marketEscrowListings.find(x=>x.listingId===listing.listingId);return {error:out.error,unchanged:before===after,stillEscrow:STATE.marketEscrow.items.some(x=>x.id==='mkt_live_block'),status:active?.status,free:KeloContainers.getStats('backpack').free};})()`,sid);
if(fullBlocked.error!=='DESTINATION_FULL'||!fullBlocked.unchanged||!fullBlocked.stillEscrow||fullBlocked.status!=='active'||fullBlocked.free!==0)throw new Error('Full Backpack safe cancel failed '+JSON.stringify(fullBlocked));

const finalAudit=await ev(`KeloMarketEscrow.auditInvariants()`,sid);if(!finalAudit.ok)throw new Error('Final invariant failure '+JSON.stringify(finalAudit));

await ev(`(()=>{STATE.inventory=STATE.inventory.filter(x=>!String(x?.id||'').startsWith('mkt_live_')&&!String(x?.splitFrom||'').startsWith('mkt_live_'));STATE.marketEscrowListings=[];STATE.marketEscrow.items=[];STATE.marketEscrow.slots=new Array(STATE.marketEscrow.capacity).fill(null);KeloBackpack.ensure();KeloContainers.ensure();if(typeof saveState==='function')saveState();return true;})()`,sid);

const report={liveReady,initial,setupFull,publishUi,fullListed,persisted,cancelled,partialSetup,partial,fullBlocked,finalAudit,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync(path.join(artifacts,'market-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(consoleErrors.length||failedRequests.length||httpErrors.length)throw new Error('LIVE errors '+JSON.stringify({consoleErrors,failedRequests,httpErrors}));
try{await send('Browser.close');}catch{}finally{setTimeout(()=>chrome.kill('SIGKILL'),1000).unref();}
