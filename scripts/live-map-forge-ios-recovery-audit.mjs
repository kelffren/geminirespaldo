import { webkit, devices } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const browser=await webkit.launch({headless:true});
const device=devices['iPhone 13'];
const context=await browser.newContext({...device});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(String(error?.stack||error)));
try{
  const url=new URL(base);
  url.searchParams.set('mapEditor','1');
  url.searchParams.set('iosRecoveryAudit',Date.now().toString());
  const response=await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:45000});
  if(!response||response.status()>=400)throw new Error(`LIVE_HTTP_${response?.status?.()}`);

  await page.waitForFunction(()=>!!(
    window.KELO_INPUT_LOCKS||window.KeloInputLocks
  ),null,{timeout:15000}).catch(()=>{});
  await page.waitForFunction(()=>!!(
    window.KELO_ADMIN_KEYS?.can?.('world.edit',window.KELO_ADMIN_KEYS?.playerId?.())
  ),null,{timeout:20000});
  await page.waitForFunction(()=>String(window.KELO_MAP_FORGE_LAUNCH_RECOVERY?.version||'').includes('20260912'),null,{timeout:15000});

  const menu=page.locator('#lx-side-menu');
  await menu.waitFor({state:'visible',timeout:15000});
  await menu.tap();
  const creators=page.locator('#lx-create-studio');
  await creators.waitFor({state:'visible',timeout:15000});
  await creators.tap();

  const hub=page.locator('#kelo-creators-hub');
  await hub.waitFor({state:'visible',timeout:20000});
  const card=hub.locator('[data-workspace="map-forge"]');
  await card.waitFor({state:'visible',timeout:10000});
  if(await card.isDisabled())throw new Error('MAP_FORGE_CARD_DISABLED');

  // Deliberately disable the normal Creator card handler. If the recovery layer is real,
  // the physical iPhone-style tap must still mount Map Forge after its short fallback delay.
  await card.evaluate(node=>{node.onclick=null;});
  await card.tap();
  await page.locator('#kelo-map-forge').waitFor({state:'visible',timeout:15000});
  if(await hub.count())throw new Error('CREATOR_HUB_STILL_MOUNTED_AFTER_RECOVERY');
  if(errors.length)throw new Error(`PAGE_ERRORS:${errors.join(' | ')}`);
  console.log('PASS live iPhone WebKit Map Forge recovery tap');
} finally {
  await context.close();
  await browser.close();
}
