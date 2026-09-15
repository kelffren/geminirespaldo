import { chromium } from '@playwright/test';
import fs from 'node:fs';
const url=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:chrome});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const consoleErrors=[],failedRequests=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
page.on('pageerror',e=>consoleErrors.push(String(e.stack||e)));
page.on('requestfailed',r=>failedRequests.push(r.url()));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()});});
function assert(v,msg){if(!v)throw new Error(msg);}
let ready=false;
for(let i=0;i<36;i++){
  await page.goto(url+'?inventoryV2Audit='+Date.now(),{waitUntil:'networkidle',timeout:30000});
  ready=await page.evaluate(()=>document.title==='Kelo World — V6.21'&&window.KELO_BACKPACK_UI_AUDIT?.version==='backpack-ui-v2.0.0'&&window.KELO_EQUIPMENT_AUDIT?.version==='equipment-v1.1.2'&&window.KELO_CONTAINER_AUDIT?.version==='container-v1.1.0'&&window.KELO_MARKET_ESCROW_AUDIT?.version==='market-escrow-v1.0.0'&&window.KELO_MODAL_INPUT_AUDIT?.version==='modal-input-lock-v1.0.0');
  if(ready)break;
  await page.waitForTimeout(10000);
}
if(!ready)throw new Error('LIVE_DEPLOYMENT_NOT_READY');
const saved=await page.evaluate(()=>localStorage.getItem('kelo_world_state_v2_1'));
const versions=await page.evaluate(()=>({title:document.title,backpackUI:window.KELO_BACKPACK_UI_AUDIT,equipment:window.KELO_EQUIPMENT_AUDIT?.version,backpack:window.KELO_BACKPACK_AUDIT?.version,container:window.KELO_CONTAINER_AUDIT?.version,marketEscrow:window.KELO_MARKET_ESCROW_AUDIT?.version,inputLock:window.KELO_MODAL_INPUT_AUDIT}));
assert(versions.backpackUI.noSkillBar===true&&versions.backpackUI.visibleEquipmentSlots===8&&versions.backpackUI.inventoryFilters===5,'UI_CONTRACT');
await page.evaluate(()=>window.openInventory());
await page.waitForSelector('#kelo-bag',{state:'visible'});
let interaction=await page.evaluate(()=>({overlayCount:document.querySelectorAll('#kelo-bag').length,tabs:[...document.querySelectorAll('#kelo-bag .kb-main-tab')].map(x=>x.textContent.trim()),equipmentSlots:document.querySelectorAll('#kelo-bag .kb-equip-slot').length,filters:document.querySelectorAll('#kelo-bag .kb-category').length,skillBarInside:document.querySelectorAll('#kelo-bag .stone-slot').length,lock:window.KELO_MODAL_INPUT_LOCK,open:window.KeloBackpackUI.isOpen()}));
assert(interaction.overlayCount===1&&interaction.tabs.length===2&&interaction.equipmentSlots===8&&interaction.filters===5&&interaction.skillBarInside===0&&interaction.lock==='inventory'&&interaction.open,'OPEN_CONTRACT');
const beforeMove=await page.evaluate(()=>({x:localPlayer.x,y:localPlayer.y}));
await page.keyboard.down('ArrowRight');await page.waitForTimeout(220);await page.keyboard.up('ArrowRight');
const lockedMove=await page.evaluate(()=>({x:localPlayer.x,y:localPlayer.y}));
assert(Math.abs(lockedMove.x-beforeMove.x)<0.01&&Math.abs(lockedMove.y-beforeMove.y)<0.01,'MOVEMENT_NOT_LOCKED');
await page.locator('#kelo-bag .kb-main-tab[data-top="appearance"]').click();
assert(await page.locator('#kelo-bag .kb-appearance').isVisible(),'APPEARANCE_NOT_VISIBLE');
const appearance=await page.evaluate(()=>({options:document.querySelectorAll('#kelo-bag .kb-look-option').length,enabled:[...document.querySelectorAll('#kelo-bag .kb-look-option')].some(x=>!x.disabled),statsVisible:!!document.querySelector('#kelo-bag .kb-stats-card')}));
assert(appearance.options===6&&!appearance.enabled&&!appearance.statsVisible,'APPEARANCE_BOUNDARY');
await page.locator('#kelo-bag .kb-main-tab[data-top="equipment"]').click();
await page.locator('#kelo-bag .kb-category[data-filter="materials"]').click();
assert(await page.locator('#kelo-bag .kb-category[data-filter="materials"]').evaluate(x=>x.classList.contains('active')),'FILTER_FAILED');
await page.locator('#kelo-bag .kb-category[data-filter="all"]').click();
const weaponWasEquipped=await page.evaluate(()=>window.KeloEquipment.isEquipped('eq_weapon'));
if(weaponWasEquipped){
  await page.locator('#kelo-bag .kb-equip-slot[data-equip-key="weapon"]').click();
  await page.locator('#kelo-bag .kb-unequip-selected').click();
  assert(!(await page.evaluate(()=>window.KeloEquipment.isEquipped('eq_weapon'))),'UNEQUIP_FAILED');
  const weaponSlot=await page.evaluate(()=>window.KeloBackpack.getSlots().find(s=>s.item?.id==='eq_weapon')?.index??-1);
  assert(weaponSlot>=0,'WEAPON_NOT_IN_BACKPACK');
  await page.locator(`#kelo-bag .kb-slot[data-slot="${weaponSlot}"]`).click();
  const equipButton=page.locator('#kelo-bag .kb-detail .kb-action.primary').filter({hasText:'EQUIPAR'}).first();
  await equipButton.click();
  assert(await page.evaluate(()=>window.KeloEquipment.isEquipped('eq_weapon')),'REEQUIP_FAILED');
}
const marketCompatible=await page.evaluate(()=>!!document.querySelector('#kelo-bag .kb-detail .kb-actions'));
assert(marketCompatible,'MARKET_DECORATOR_TARGET_MISSING');
const viewportResults=[];
for(const vp of [{w:375,h:667},{w:390,h:844},{w:393,h:852},{w:430,h:932}]){
  await page.setViewportSize({width:vp.w,height:vp.h});
  await page.evaluate(()=>{window.openInventory();const s=document.querySelector('#kelo-bag .kb-scroll');if(s)s.scrollTop=0;});
  await page.waitForTimeout(80);
  const check=await page.evaluate(({w,h})=>{const shell=document.querySelector('#kelo-bag .kb-shell'),close=document.querySelector('#kelo-bag .kb-close'),slot=document.querySelector('#kelo-bag .kb-slot'),grid=document.querySelector('#kelo-bag .kb-grid'),scroll=document.querySelector('#kelo-bag .kb-scroll');const sr=shell.getBoundingClientRect(),cr=close.getBoundingClientRect(),br=slot?.getBoundingClientRect(),cols=getComputedStyle(grid).gridTemplateColumns.split(' ').length;const before=scroll.scrollTop;scroll.scrollTop=Math.min(160,Math.max(0,scroll.scrollHeight-scroll.clientHeight));return {viewport:{w,h},shell:{left:sr.left,right:sr.right,top:sr.top,bottom:sr.bottom},close:{w:cr.width,h:cr.height,top:cr.top,right:cr.right},slot:br?{w:br.width,h:br.height}:null,cols,scrollable:scroll.scrollHeight>scroll.clientHeight,scrollTop:scroll.scrollTop,before};},{w:vp.w,h:vp.h});
  assert(check.shell.left>=-1&&check.shell.right<=vp.w+1&&check.shell.top>=-1&&check.shell.bottom<=vp.h+1,'SHELL_OVERFLOW_'+vp.w);
  assert(check.close.w>=44&&check.close.h>=44&&check.close.top>=0&&check.close.right<=vp.w+1,'CLOSE_TARGET_'+vp.w);
  assert(check.slot&&check.slot.w>=44&&check.slot.h>=44,'SLOT_TARGET_'+vp.w);
  assert(check.cols===(vp.w<379?4:5),'GRID_COLUMNS_'+vp.w+'_'+check.cols);
  assert(check.scrollable&&check.scrollTop>check.before,'SCROLL_FAILED_'+vp.w);
  viewportResults.push(check);
  await page.evaluate(()=>window.closeInventory());
}
await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.openInventory());await page.waitForTimeout(120);await page.screenshot({path:'artifacts/inventory-ui-v2-mobile.png',fullPage:true});
const visual=await page.evaluate(()=>({panelText:document.querySelector('#kelo-bag')?.innerText.slice(0,1200),shell:document.querySelector('#kelo-bag .kb-shell')?.getBoundingClientRect().toJSON(),gridSlots:document.querySelectorAll('#kelo-bag .kb-slot').length,capacity:window.KeloBackpack.getStats(),currencies:window.KeloInventoryViewModel.getCurrencies(),stats:window.KeloInventoryViewModel.getPlayerStats()}));
for(let i=0;i<3;i++){await page.evaluate(()=>window.closeInventory());await page.evaluate(()=>window.openInventory());}
const repeat=await page.evaluate(()=>({overlayCount:document.querySelectorAll('#kelo-bag').length,styleLinks:[...document.styleSheets].filter(s=>String(s.href||'').includes('backpack-fantasy-v1.css')).length,escBound:window.__KELO_INVENTORY_ESC_BOUND===true}));
assert(repeat.overlayCount===1&&repeat.styleLinks===1&&repeat.escBound,'DUPLICATE_OPEN_BINDINGS');
await page.evaluate(()=>window.closeInventory());
const afterClose=await page.evaluate(()=>({lock:window.KELO_MODAL_INPUT_LOCK,open:window.KeloBackpackUI.isOpen(),x:localPlayer.x}));
assert(!afterClose.lock&&!afterClose.open,'CLOSE_LOCK_FAILED');
await page.keyboard.down('ArrowRight');await page.waitForTimeout(260);await page.keyboard.up('ArrowRight');await page.waitForTimeout(40);
const movedAfterClose=await page.evaluate(()=>localPlayer.x);
assert(movedAfterClose>afterClose.x+1,'MOVEMENT_NOT_RESTORED');
await page.evaluate(saved=>{if(saved===null)localStorage.removeItem('kelo_world_state_v2_1');else localStorage.setItem('kelo_world_state_v2_1',saved);},saved);
if(consoleErrors.length||failedRequests.length||httpErrors.length)throw new Error('LIVE_ERRORS '+JSON.stringify({consoleErrors,failedRequests,httpErrors}));
const report={ok:true,versions,interaction,appearance,weaponWasEquipped,viewportResults,visual,repeat,movement:{beforeMove,lockedMove,afterClose,movedAfterClose},consoleErrors,failedRequests,httpErrors};
fs.writeFileSync('artifacts/inventory-ui-v2-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
await browser.close();