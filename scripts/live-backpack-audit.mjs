import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const expectedTitle=process.env.EXPECTED_TITLE||'Kelo World — V6.19';
const expectedBridge='stone-backpack-bridge-v1.0.0';
fs.mkdirSync('artifacts',{recursive:true});

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>consoleErrors.push(`PAGEERROR: ${e.stack||e.message}`));
page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()})});

async function runtimeReady(){
  return page.evaluate(({expectedTitle,expectedBridge})=>document.title===expectedTitle&&window.KELO_STONE_BACKPACK_BRIDGE_AUDIT?.version===expectedBridge&&window.KELO_BACKPACK_AUDIT?.version==='backpack-v1.0.0'&&window.KELO_BACKPACK_UI_AUDIT?.version==='backpack-ui-v1.0.0'&&!!window.KeloBackpack&&!!window.KeloBackpackUI&&!!window.KeloEquipment&&!!document.getElementById('lx-side-menu'),{expectedTitle,expectedBridge});
}

let ready=false;
for(let attempt=1;attempt<=30;attempt++){
  try{
    await page.goto(`${base}?backpack-audit=${Date.now()}-${attempt}`,{waitUntil:'networkidle',timeout:45000});
    ready=await runtimeReady();
    if(ready)break;
  }catch(e){console.log(`attempt ${attempt}: ${e.message}`)}
  await page.waitForTimeout(8000);
}
if(!ready)throw new Error(`LIVE never reached ${expectedTitle} + ${expectedBridge}`);

await page.evaluate(()=>localStorage.removeItem('kelo_world_state_v2_1'));
consoleErrors.length=0;failedRequests.length=0;httpErrors.length=0;
await page.goto(`${base}?backpack-audit=clean-${Date.now()}`,{waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(1200);
if(!(await runtimeReady()))throw new Error('Clean backpack runtime not ready');

await page.locator('#lx-side-menu').click();
await page.getByRole('button',{name:/Mochila/i}).click();
await page.waitForTimeout(250);

const initial=await page.evaluate(()=>{
  const root=document.getElementById('kelo-bag');
  const slots=window.KeloBackpack.getSlots();
  const stats=window.KeloBackpack.getStats();
  const occupied=slots.find(s=>!!s.item);
  const empty=slots.find(s=>!s.item);
  const inventoryOrder=STATE.inventory.map((item,i)=>item.id||item.uid||item._backpackId||`index:${i}`);
  const slotEl=root?.querySelector('.kb-slot');
  return{
    title:document.title,
    visible:!!root&&getComputedStyle(root).display!=='none',
    touchAction:root?getComputedStyle(root).touchAction:null,
    viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio,canvasW:document.getElementById('game-canvas')?.width,canvasH:document.getElementById('game-canvas')?.height},
    modelAudit:window.KELO_BACKPACK_AUDIT,
    uiAudit:window.KELO_BACKPACK_UI_AUDIT,
    bridgeAudit:window.KELO_STONE_BACKPACK_BRIDGE_AUDIT,
    stats,
    slotCount:slots.length,
    firstSlotTarget:slotEl?{w:slotEl.getBoundingClientRect().width,h:slotEl.getBoundingClientRect().height}:null,
    occupiedIndex:occupied?.index??null,
    emptyIndex:empty?.index??null,
    occupiedKey:occupied?.key??null,
    equipmentCount:STATE.inventory.filter(item=>item?.kind==='equipment').length,
    inventoryOrder
  };
});
if(initial.occupiedIndex==null||initial.emptyIndex==null)throw new Error(`Need occupied and empty slot: ${JSON.stringify(initial.stats)}`);
if(initial.equipmentCount<1)throw new Error(`Equipment missing before move: ${JSON.stringify(initial)}`);

await page.locator(`.kb-slot[data-slot="${initial.occupiedIndex}"]`).click();
await page.getByRole('button',{name:'Mover'}).click();
await page.locator(`.kb-slot[data-slot="${initial.emptyIndex}"]`).click();
await page.waitForTimeout(180);

const moved=await page.evaluate(({source,destination,key,beforeOrder})=>{
  const slots=window.KeloBackpack.getSlots();
  const afterOrder=STATE.inventory.map((item,i)=>item.id||item.uid||item._backpackId||`index:${i}`);
  return{
    sourceEmpty:!slots[source].item,
    destinationKey:slots[destination].key,
    expectedKey:key,
    inventoryOrderUnchanged:JSON.stringify(beforeOrder)===JSON.stringify(afterOrder),
    stateSlotKey:STATE.backpack?.slots?.[destination]||null
  };
},{source:initial.occupiedIndex,destination:initial.emptyIndex,key:initial.occupiedKey,beforeOrder:initial.inventoryOrder});

await page.reload({waitUntil:'networkidle',timeout:45000});
await page.waitForTimeout(600);
if(!(await runtimeReady()))throw new Error('Backpack runtime revision changed after reload');
const persisted=await page.evaluate(({destination,key})=>({
  ready:!!window.KeloBackpack,
  persistedKey:window.KeloBackpack.getSlots()[destination]?.key||null,
  expectedKey:key,
  equipmentCount:STATE.inventory.filter(item=>item?.kind==='equipment').length,
  inventoryKinds:STATE.inventory.map(item=>item?.kind||'stone')
}),{destination:initial.emptyIndex,key:initial.occupiedKey});

await page.evaluate(()=>window.KeloSocialUI.openBag());
const equipmentIndex=await page.evaluate(()=>window.KeloBackpack.getSlots().find(s=>s.item?.kind==='equipment')?.index??null);
if(equipmentIndex==null){
  const debug=await page.evaluate(()=>({
    inventory:STATE.inventory.map(item=>({id:item?.id,uid:item?.uid,kind:item?.kind,name:item?.name})),
    slots:window.KeloBackpack.getSlots().map(s=>({index:s.index,key:s.key,kind:s.item?.kind||null,name:s.item?.name||null})),
    bridge:window.KELO_STONE_BACKPACK_BRIDGE_AUDIT
  }));
  fs.writeFileSync('artifacts/backpack-failure-state.json',JSON.stringify(debug,null,2));
  await page.screenshot({path:'artifacts/live-backpack-failure.png',fullPage:true});
  throw new Error(`No equipment item surfaced through backpack: ${JSON.stringify(debug)}`);
}
await page.locator(`.kb-slot[data-slot="${equipmentIndex}"]`).click();
const actionBefore=(await page.locator('.kb-actions .kb-action').allTextContents()).find(x=>x==='Equipar'||x==='Desequipar');
if(!actionBefore)throw new Error('Equipment action missing from backpack detail');
await page.getByRole('button',{name:actionBefore,exact:true}).click();
await page.waitForTimeout(150);
const actionAfter=(await page.locator('.kb-actions .kb-action').allTextContents()).find(x=>x==='Equipar'||x==='Desequipar');
if(!actionAfter||actionAfter===actionBefore)throw new Error(`Equipment toggle did not change state: ${actionBefore} -> ${actionAfter}`);
await page.getByRole('button',{name:actionAfter,exact:true}).click();
await page.waitForTimeout(150);
const actionRestored=(await page.locator('.kb-actions .kb-action').allTextContents()).find(x=>x==='Equipar'||x==='Desequipar');

const final=await page.evaluate(()=>{
  const root=document.getElementById('kelo-bag');
  const selected=root?.querySelector('.kb-slot.selected');
  const detail=root?.querySelector('.kb-detail');
  return{
    visible:!!root&&getComputedStyle(root).display!=='none',
    selectedSlot:selected?.dataset.slot||null,
    detailText:(detail?.textContent||'').trim(),
    stats:window.KeloBackpack.getStats(),
    slotCount:window.KeloBackpack.getSlots().length,
    legacyInventoryLength:STATE.inventory.length,
    equipmentCount:window.KeloEquipment.getEquipment().length
  };
});

await page.screenshot({path:'artifacts/live-backpack-mobile.png',fullPage:true});
const report={ready,initial,moved,persisted,equipmentToggle:{before:actionBefore,after:actionAfter,restored:actionRestored},final,consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/backpack-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();

if(initial.title!==expectedTitle)throw new Error(`Title mismatch ${initial.title} !== ${expectedTitle}`);
if(initial.bridgeAudit?.version!==expectedBridge)throw new Error(`Bridge mismatch: ${JSON.stringify(initial.bridgeAudit)}`);
if(!initial.visible)throw new Error('Backpack did not open from social menu');
if(initial.touchAction!=='pan-y')throw new Error(`Backpack touch-action invalid: ${initial.touchAction}`);
if(initial.viewport.w!==390||initial.viewport.h!==844)throw new Error(`Mobile viewport mismatch: ${JSON.stringify(initial.viewport)}`);
if(initial.stats.capacity<20||initial.slotCount!==initial.stats.capacity)throw new Error(`Capacity contract invalid: ${JSON.stringify(initial.stats)}`);
if(initial.firstSlotTarget?.w<48||initial.firstSlotTarget?.h<48)throw new Error(`Touch target too small: ${JSON.stringify(initial.firstSlotTarget)}`);
if(initial.modelAudit?.mutatesLegacyInventoryOrder!==false)throw new Error('Backpack model must not own/reorder legacy inventory');
if(!moved.sourceEmpty||moved.destinationKey!==moved.expectedKey||!moved.inventoryOrderUnchanged)throw new Error(`Move/swap contract failed: ${JSON.stringify(moved)}`);
if(persisted.persistedKey!==persisted.expectedKey||persisted.equipmentCount<1)throw new Error(`Slot/equipment persistence failed: ${JSON.stringify(persisted)}`);
if(actionRestored!==actionBefore)throw new Error(`Equipment action did not restore state: ${JSON.stringify({actionBefore,actionAfter,actionRestored})}`);
if(consoleErrors.length)throw new Error(`Console/page errors: ${JSON.stringify(consoleErrors)}`);
if(failedRequests.length)throw new Error(`Failed requests: ${JSON.stringify(failedRequests)}`);
if(httpErrors.length)throw new Error(`HTTP errors: ${JSON.stringify(httpErrors)}`);
