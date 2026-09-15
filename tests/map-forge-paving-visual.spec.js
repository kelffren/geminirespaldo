/* KELO-INDEX
 * area: TEST / MAP FORGE / PAVING VISUAL
 * owner: Map Forge visual convergence CI
 * purpose: capture fixed-seed semantic paving in real preview/exterior at required mobile and desktop viewports
 */
const {test,expect}=require('@playwright/test');
const fs=require('fs');

function versionAtLeast(actual,minimum){
  const a=String(actual||'').split('.').map(Number),b=minimum.split('.').map(Number);
  for(let i=0;i<Math.max(a.length,b.length);i++){const delta=(a[i]||0)-(b[i]||0);if(delta)return delta>0;}
  return true;
}

async function openSeed68(page){
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(String(error)));
  const response=await page.goto('/?mapEditor=1&offline=1',{waitUntil:'domcontentloaded',timeout:30000});
  expect(response.status()).toBeLessThan(400);
  await page.waitForFunction(()=>!!(window.KELO_WORLD_BUILDER?.renderSnapshotPreview&&window.KELO_PROPERTY_SYSTEM?.drawPlacements&&window.KELO_PROPERTY_CATALOG&&window.KeloCamera?.focus&&window.KELO_ADMIN_KEYS?.can?.('world.edit')),null,{timeout:15000});
  await page.evaluate(async()=>{const {bootKeloCreators}=await import('./src/creators/creator-entry.mjs');const platform=await bootKeloCreators({root:window});window.__KELO_TEST_MAP_FORGE_WORKSPACE__=await platform.openWorkspace('map-forge');});
  const forge=page.locator('#kelo-map-forge');await expect(forge).toBeVisible();
  await page.getByRole('spinbutton',{name:/Seed/}).fill('68');
  await page.getByRole('combobox',{name:'Candidatos'}).selectOption({label:'Best of 4'});
  await page.getByRole('button',{name:'GENERAR'}).click();
  await expect(forge.getByText(/4\/4 válidos/)).toBeVisible({timeout:15000});
  await forge.getByRole('button').filter({hasText:'Seed 68'}).click();
  await page.waitForFunction(()=>window.__KELO_TEST_MAP_FORGE_WORKSPACE__?.selected?.metadata?.seed===68,null,{timeout:5000});
  const selected=await page.evaluate(()=>{const map=window.__KELO_TEST_MAP_FORGE_WORKSPACE__.selected,paving=map.validation.paving;return{seed:map.metadata.seed,layoutHash:map.metadata.layoutHash,generatorVersion:map.metadata.generatorVersion,valid:map.validation.valid,errors:map.validation.errors,largestComponentRatio:paving.largestComponentRatio,largestComponentCells:paving.largestComponentCells,stoneWithoutIntent:map.terrain.cells.filter(c=>c.material==='stone'&&!c.pavingIntent?.planId).length};});
  expect(selected).toMatchObject({seed:68,valid:true,errors:[],stoneWithoutIntent:0});
  expect(versionAtLeast(selected.generatorVersion,'1.1.0')).toBe(true);
  expect(selected.largestComponentRatio).toBeLessThanOrEqual(.10);
  expect(pageErrors).toEqual([]);
  return{forge,selected,pageErrors};
}

async function verifyViewport(page,label,expectedViewport){
  expect(page.viewportSize()).toEqual(expectedViewport);fs.mkdirSync('test-results',{recursive:true});
  const {forge,selected,pageErrors}=await openSeed68(page);
  await page.screenshot({path:`test-results/map-forge-paving-after-seed-68-${label}.png`,fullPage:true});
  await page.getByRole('button',{name:'VER EN MAPA EXTERIOR'}).click();
  await expect(forge).toHaveCount(0,{timeout:1000});
  await expect(page.getByRole('button',{name:'VOLVER A MAP FORGE'})).toBeVisible({timeout:15000});
  const exterior=await page.evaluate(()=>{const map=window.__KELO_TEST_MAP_FORGE_WORKSPACE__.selected,runtime=window.KELO_WORLD_BUILDER.snapshot(),placements=window.KELO_PROPERTY_SYSTEM.getPlacements('parcel:world:editor')||[];return{seed:map.metadata.seed,layoutHash:map.metadata.layoutHash,viewKind:runtime?.view?.kind||null,cellCount:Object.keys(runtime?.cells||{}).length,placementCount:placements.length};});
  expect(exterior).toMatchObject({seed:68,layoutHash:selected.layoutHash,viewKind:'preview'});
  expect(exterior.cellCount).toBeGreaterThan(5000);expect(exterior.placementCount).toBeGreaterThan(0);
  await page.screenshot({path:`test-results/map-forge-paving-exterior-seed-68-${label}.png`,fullPage:true});
  expect(pageErrors).toEqual([]);
}

test.describe('mobile 390x844',()=>{
  test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  test('semantic paving seed 68 survives real preview and exterior',async({page})=>verifyViewport(page,'390x844',{width:390,height:844}));
});

test.describe('desktop 1440x900',()=>{
  test.use({viewport:{width:1440,height:900},isMobile:false,hasTouch:false});
  test('semantic paving seed 68 survives real preview and exterior',async({page})=>verifyViewport(page,'1440x900',{width:1440,height:900}));
});
