import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base=process.env.LIVE_URL||'https://kelffren.github.io/gemini/';
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3});
const page=await ctx.newPage();
const pageErrors=[];
const consoleErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});

async function loadCurrentLive(){
  let last='';
  for(let attempt=1;attempt<=24;attempt++){
    try{
      await page.goto(base+`?commerceSmoke=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:20000});
      await page.waitForFunction(()=>window.KeloCommerceAuthority?.version==='commerce-authority-v1.0.0'&&window.KeloMarketWorld?.version==='market-instance-v1.0.1'&&window.KeloCommerceUI?.version==='commerce-ui-v1.0.0'&&window.KeloContainers?.version==='container-v1.3.0',{timeout:9000});
      return attempt;
    }catch(err){last=String(err?.message||err);await new Promise(r=>setTimeout(r,5000));}
  }
  throw new Error(`LIVE_COMMERCE_NOT_READY: ${last}`);
}

const attempts=await loadCurrentLive();
const boot=await page.evaluate(()=>({
  commerce:window.KELO_COMMERCE_AUDIT,
  containers:window.KELO_CONTAINER_AUDIT,
  market:window.KELO_MARKET_WORLD_AUDIT,
  ui:window.KELO_COMMERCE_UI_AUDIT,
  scene:window.KELO_SCENE_CONTEXT.current(),
  gold:STATE.gold
}));
assert.equal(boot.commerce.noOnlineLocalFallback,true);
assert.equal(boot.commerce.tradeDoubleConfirmation,true);
assert.equal(boot.containers.tradeEscrowImplemented,true);
assert.equal(boot.containers.checkpointTransactions,true);
assert.equal(boot.market.dprSafeCanvasTransform,true);
assert.equal(boot.ui.authorityOnly,true);
assert.equal(boot.scene.zoneType,'world');

await page.evaluate(()=>window.KeloCommerceUI.enterMarket());
await page.waitForFunction(()=>window.KELO_SCENE_CONTEXT.current().zoneType==='instance'&&window.KELO_SCENE_CONTEXT.current().instanceType==='market',{timeout:15000});
await page.waitForFunction(()=>document.getElementById('kelo-commerce-dock')?.classList.contains('show'));
const entered=await page.evaluate(()=>({
  scene:window.KELO_SCENE_CONTEXT.current(),
  current:window.KELO_INSTANCES.current(),
  body:document.body.className,
  player:{x:localPlayer.x,y:localPlayer.y},
  dock:getComputedStyle(document.getElementById('kelo-commerce-dock')).display
}));
assert.equal(entered.current.type,'market');
assert.notEqual(entered.dock,'none');
await page.screenshot({path:'artifacts/commerce-market-mobile.png',fullPage:true});

// Buy one demo item through the actual stall UI.
await page.evaluate(()=>window.KeloCommerceUI.openStall('stall_02'));
await page.waitForSelector('#kelo-commerce-modal.open');
const fireRow=page.locator('.kc-row').filter({hasText:'Fragmento de Fuego'}).first();
await fireRow.getByRole('button',{name:'COMPRAR'}).click();
await page.waitForFunction(()=>STATE.inventory.some(x=>x&&x.templateId==='fire_shard_demo'));
const afterBuy=await page.evaluate(()=>({gold:STATE.gold,fire:STATE.inventory.find(x=>x&&x.templateId==='fire_shard_demo'),tx:window.KeloCommerceAuthority.snapshot().transactionHistory.filter(x=>x.type==='market_purchase').slice(-1)[0]}));
assert(afterBuy.fire,'bought item must enter backpack');
assert(afterBuy.gold<boot.gold,'market purchase must debit gold');
assert.equal(afterBuy.tx?.status,'committed');

// Claiming "RECLAMAR Y VENDER" intentionally enters vendor mode immediately.
await page.evaluate(()=>window.KeloCommerceUI.openStall('stall_01'));
await page.getByRole('button',{name:'RECLAMAR Y VENDER'}).click();
await page.waitForFunction(()=>window.KeloCommerceAuthority.snapshot().stalls.some(x=>x.stallId==='stall_01'&&!x.demo));
await page.waitForFunction(()=>window.KeloMarketWorld.getSellingStall()==='stall_01'&&window.KeloInputLocks.has('commerce-stall'));
const selling=await page.evaluate(()=>({stall:window.KeloMarketWorld.getSellingStall(),locks:window.KeloInputLocks.snapshot(),player:{x:localPlayer.x,y:localPlayer.y}}));
assert.equal(selling.stall,'stall_01');
assert(selling.locks.owners.includes('commerce-stall'));
await page.getByRole('button',{name:'DEJAR DE VENDER'}).click();
await page.waitForFunction(()=>!window.KeloInputLocks.has('commerce-stall'));
// Re-enter once to prove the explicit toggle also works after claiming.
await page.getByRole('button',{name:'PONERME A VENDER'}).click();
await page.waitForFunction(()=>window.KeloMarketWorld.getSellingStall()==='stall_01'&&window.KeloInputLocks.has('commerce-stall'));
await page.getByRole('button',{name:'DEJAR DE VENDER'}).click();
await page.waitForFunction(()=>!window.KeloInputLocks.has('commerce-stall'));

// Trade the bought material. Changing the offer must reset both ready flags.
await page.evaluate(()=>window.KeloCommerceUI.openTrade());
await page.waitForFunction(()=>window.KeloCommerceAuthority.snapshot().activeTrade?.mode==='offline-demo');
const tradeFireRow=page.locator('.kc-row').filter({hasText:'Fragmento de Fuego'}).first();
await tradeFireRow.getByRole('button',{name:'AÑADIR'}).click();
await page.waitForFunction(()=>window.KeloCommerceAuthority.snapshot().activeTrade?.offers.local.items.length===1);
await page.locator('[data-trade-gold]').fill('10');
await page.locator('[data-set-gold]').click();
await page.locator('[data-local-ready]').click();
await page.locator('[data-peer-ready]').click();
await page.waitForFunction(()=>window.KeloCommerceAuthority.snapshot().activeTrade?.status==='FINAL_REVIEW');
const firstReady=await page.evaluate(()=>window.KeloCommerceAuthority.snapshot().activeTrade);
assert.equal(firstReady.offers.local.ready,true);assert.equal(firstReady.offers.peer.ready,true);

await page.locator('[data-trade-gold]').fill('11');
await page.locator('[data-set-gold]').click();
const reset=await page.evaluate(()=>window.KeloCommerceAuthority.snapshot().activeTrade);
assert.equal(reset.offers.local.ready,false);assert.equal(reset.offers.peer.ready,false);assert.equal(reset.offers.local.finalAccepted,false);assert.equal(reset.offers.peer.finalAccepted,false);

await page.locator('[data-local-ready]').click();
await page.locator('[data-peer-ready]').click();
await page.waitForSelector('[data-final-local]');
await page.screenshot({path:'artifacts/commerce-trade-final-review-mobile.png',fullPage:true});
await page.locator('[data-final-local]').click();
const oneFinal=await page.evaluate(()=>window.KeloCommerceAuthority.snapshot().activeTrade);
assert(oneFinal,'one final acceptance must not commit');assert.equal(oneFinal.offers.local.finalAccepted,true);assert.equal(oneFinal.offers.peer.finalAccepted,false);
await page.locator('[data-final-peer]').click();
await page.waitForFunction(()=>!window.KeloCommerceAuthority.snapshot().activeTrade&&window.KeloCommerceAuthority.snapshot().transactionHistory.some(x=>x.type==='player_trade'&&x.status==='committed'));
const completed=await page.evaluate(()=>({
  snapshot:window.KeloCommerceAuthority.snapshot(),
  identities:window.KeloContainers.auditIdentities(),
  tradeEscrow:window.KeloContainers.getStats('trade_escrow'),
  hasIncoming:STATE.inventory.some(x=>x&&x.templateId==='trade_crystal_demo'),
  hasOutgoing:STATE.inventory.some(x=>x&&x.templateId==='fire_shard_demo')
}));
assert.equal(completed.identities.ok,true);
assert.equal(completed.tradeEscrow.used,0);
assert.equal(completed.hasIncoming,true);
assert.equal(completed.hasOutgoing,false);
assert.equal(completed.snapshot.transactionHistory.filter(x=>x.type==='player_trade').slice(-1)[0]?.status,'committed');

await page.evaluate(()=>window.KeloCommerceUI.close());
await page.evaluate(()=>window.KeloCommerceUI.leaveMarket());
await page.waitForFunction(()=>window.KELO_SCENE_CONTEXT.current().zoneType==='world',{timeout:15000});
const left=await page.evaluate(()=>({scene:window.KELO_SCENE_CONTEXT.current(),current:window.KELO_INSTANCES.current(),locks:window.KeloInputLocks.snapshot()}));
assert.equal(left.current,null);assert.equal(left.scene.zoneType,'world');assert(!left.locks.owners.includes('commerce-stall'));assert(!left.locks.owners.includes('commerce-ui'));
assert.deepEqual(pageErrors,[]);

const report={ok:true,url:base,attempts,boot,entered,afterBuy,selling,reset:{status:reset.status,revision:reset.revision,localReady:reset.offers.local.ready,peerReady:reset.offers.peer.ready},completed:{tradeEscrow:completed.tradeEscrow,identities:completed.identities,hasIncoming:completed.hasIncoming},left,pageErrors,consoleErrors};
fs.writeFileSync('artifacts/commerce-live-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await ctx.close();
await browser.close();