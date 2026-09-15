/* KELO-INDEX
 * area: TEST / MAP FORGE / ORIENTATION VISUAL
 * owner: Map Forge visual convergence CI
 * purpose: prove directional street props face the nearest road without moving generated geometry
 */
const {test,expect}=require('@playwright/test');
const fs=require('fs');

const MAIN_SEED=81746291;
const VALIDATION_SEEDS=[81746291,12345,424242,29011987];
const STAGE=process.env.KELO_ORIENTATION_STAGE==='after'?'after':'before';
const DIRECTIONAL_FAMILIES=new Set(['bench','market_prop']);

test.use({viewport:{width:1440,height:900}});
test.setTimeout(60000);

function nearestRoadFrame(p,roads){
  let best=null;
  for(const road of roads||[]){
    const points=road.polyline||[];
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
      const t=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0;
      const point={x:a.x+dx*t,y:a.y+dy*t},vx=point.x-p.x,vy=point.y-p.y,distance=Math.hypot(vx,vy);
      if(!best||distance<best.distance)best={distance,point,vx,vy};
    }
  }
  return best;
}
function roadFacingScore(row,roads){
  const frame=nearestRoadFrame(row,roads);if(!frame||frame.distance<1e-6)return 1;
  const radians=(Number(row.rotation)||0)*Math.PI/180;
  const fx=-Math.sin(radians),fy=Math.cos(radians),len=Math.hypot(frame.vx,frame.vy)||1;
  return (fx*frame.vx+fy*frame.vy)/len;
}
function mapMetrics(map){
  const directional=(map.decorations||[]).filter(row=>DIRECTIONAL_FAMILIES.has(row.family));
  const scores=directional.map(row=>roadFacingScore(row,map.roads));
  const roadFacingCount=scores.filter(score=>score>=Math.SQRT1_2-.001).length;
  const rotationCounts={};for(const row of directional){const key=String(row.rotation);rotationCounts[key]=(rotationCounts[key]||0)+1;}
  const geometryChecksum=(map.decorations||[]).reduce((sum,row)=>sum+Math.round(row.x*10)*17+Math.round(row.y*10)*31+Math.round(row.scale*100)*13,0);
  return{
    seed:map.metadata?.seed,
    layoutHash:map.metadata?.layoutHash,
    valid:!!map.validation?.valid,
    errors:map.validation?.errors||[],
    qualityTotal:Number(map.quality?.total||0),
    roadCount:(map.roads||[]).length,
    blockCount:(map.blocks||[]).length,
    decorationCount:(map.decorations||[]).length,
    directionalDecorationCount:directional.length,
    roadFacingCount,
    roadFacingRatio:directional.length?Number((roadFacingCount/directional.length).toFixed(4)):1,
    rotationCounts,
    geometryChecksum
  };
}
async function bootForge(page){
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(String(error)));
  const response=await page.goto('/?mapEditor=1&offline=1',{waitUntil:'domcontentloaded',timeout:30000});
  expect(response.status()).toBeLessThan(400);
  await page.waitForFunction(()=>!!(window.KELO_WORLD_BUILDER?.renderSnapshotPreview&&window.KELO_PROPERTY_SYSTEM?.drawPlacements&&window.KELO_PROPERTY_CATALOG&&window.KeloCamera?.focus&&window.KELO_ADMIN_KEYS?.can?.('world.edit')),null,{timeout:15000});
  await page.evaluate(async()=>{const {bootKeloCreators}=await import('./src/creators/creator-entry.mjs');const platform=await bootKeloCreators({root:window});window.__KELO_TEST_MAP_FORGE_WORKSPACE__=await platform.openWorkspace('map-forge');});
  const forge=page.locator('#kelo-map-forge');await expect(forge).toBeVisible();return{forge,pageErrors};
}
async function generateSelected(page,forge,seed){
  await page.getByRole('spinbutton',{name:/Seed/}).fill(String(seed));
  await page.getByRole('combobox',{name:'Candidatos'}).selectOption({label:'Best of 4'});
  await page.getByRole('button',{name:'GENERAR'}).click();
  await expect(forge.getByText(/4\/4 válidos/)).toBeVisible({timeout:15000});
  await forge.getByRole('button').filter({hasText:`Seed ${seed}`}).first().click();
  await page.waitForFunction(expected=>window.__KELO_TEST_MAP_FORGE_WORKSPACE__?.selected?.metadata?.seed===expected,seed,{timeout:5000});
  return page.evaluate(()=>JSON.parse(JSON.stringify(window.__KELO_TEST_MAP_FORGE_WORKSPACE__.selected)));
}

test(`Map Forge directional props ${STAGE}`,async({page})=>{
  fs.mkdirSync('test-results/orientation',{recursive:true});
  const {forge,pageErrors}=await bootForge(page);
  const mainMap=await generateSelected(page,forge,MAIN_SEED),main=mapMetrics(mainMap);
  expect(main.valid).toBe(true);expect(main.errors).toEqual([]);expect(main.directionalDecorationCount).toBeGreaterThan(0);
  if(STAGE==='after'){expect(main.roadFacingRatio).toBe(1);expect(main.decorationCount).toBeGreaterThanOrEqual(200);}
  await page.screenshot({path:`test-results/orientation/screenshot_preview_${STAGE}.png`,fullPage:true});

  await page.getByRole('button',{name:'VER EN MAPA EXTERIOR'}).click();
  await expect(forge).toHaveCount(0,{timeout:1000});
  await expect(page.getByRole('button',{name:'VOLVER A MAP FORGE'})).toBeVisible({timeout:15000});
  const runtime=await page.evaluate(()=>{const snapshot=window.KELO_WORLD_BUILDER.snapshot(),placements=window.KELO_PROPERTY_SYSTEM.getPlacements('parcel:world:editor')||[];return{viewKind:snapshot?.view?.kind||null,cellCount:Object.keys(snapshot?.cells||{}).length,placementCount:placements.length};});
  expect(runtime.viewKind).toBe('preview');expect(runtime.cellCount).toBeGreaterThan(5000);expect(runtime.placementCount).toBeGreaterThan(0);
  await page.screenshot({path:`test-results/orientation/screenshot_runtime_${STAGE}.png`,fullPage:true});

  await page.getByRole('button',{name:'VOLVER A MAP FORGE'}).click();await expect(page.locator('#kelo-map-forge')).toBeVisible({timeout:15000});
  const validation=[];
  for(const seed of VALIDATION_SEEDS){const map=await generateSelected(page,page.locator('#kelo-map-forge'),seed),metrics=mapMetrics(map);expect(metrics.valid).toBe(true);expect(metrics.errors).toEqual([]);if(STAGE==='after')expect(metrics.roadFacingRatio).toBe(1);validation.push(metrics);}
  fs.writeFileSync(`test-results/orientation/map-forge-orientation-metrics-${STAGE}.json`,JSON.stringify({stage:STAGE,mainSeed:MAIN_SEED,validationSeeds:VALIDATION_SEEDS,main,runtime,validation,pageErrors},null,2));
  expect(pageErrors).toEqual([]);
});
