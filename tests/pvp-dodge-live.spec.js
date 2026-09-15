/* KELO-INDEX
 * area: TEST / PVP
 * owner: Playwright validation only
 * keys: PVP DODGE DASH COLLISION MOBILE DESKTOP LIVE WINNER
 * purpose: bloquea el dodge PvP funcional: 112 px reales, arranque responsivo y runtime de abilities despierto
 * online: N/A; valida el runtime local exacto de main sin alterar autoridad
 * do-not: NO gameplay mutation fuera de setup reproducible de prueba
 */
const {test,expect}=require('@playwright/test');

async function runDodge(page,label){
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.KeloPvPWorld&&window.KeloInput&&typeof window.enterPvPWorld==='function',{timeout:20000});
  await page.evaluate(async()=>{await window.enterPvPWorld();});
  await page.waitForFunction(()=>window.KeloPvPWorld&&window.KeloAbilities&&window.KeloPvPWorld.state.mode==='pvp'&&window.KeloPvPWorld.state.combatEnabled,{timeout:15000});
  const result=await page.evaluate(async()=>{
    localPlayer.x=2790;localPlayer.y=720;localPlayer.vx=localPlayer.vy=0;
    window.KeloPvPWorld.setAimWorld({x:2910,y:720},'audit',1);
    const start={x:localPlayer.x,y:localPlayer.y},expected={x:localPlayer.x+112,y:localPlayer.y};
    const hits=[];
    if(window.KELO_COLLISION&&typeof obstacles!=='undefined'){
      for(const box of obstacles){
        if(!box||box.blocksMovement===false)continue;
        const t=window.KELO_COLLISION.segmentAabbHitT(start.x,start.y,expected.x,expected.y,box,localPlayer.radius||20);
        if(t!=null)hits.push({t,x:box.x,y:box.y,w:box.w,h:box.h,owner:box._keloCollisionOwner||box.owner||null,id:box.id||null});
      }
      hits.sort((a,b)=>a.t-b.t);
    }
    const perfBefore=window.KeloAbilities.performanceSnapshot();
    window.KeloInput.combat.push('DODGE_PRESS',{source:'audit'});
    const samples=[];
    const t0=performance.now();
    while(performance.now()-t0<260){samples.push({ms:performance.now()-t0,x:localPlayer.x,y:localPlayer.y,dash:localPlayer._dash?{sx:localPlayer._dash.sx,sy:localPlayer._dash.sy,tx:localPlayer._dash.tx,ty:localPlayer._dash.ty,time:localPlayer._dash.time,max:localPlayer._dash.max,abilityKey:localPlayer._dash.abilityKey}:null,dodgeActive:window.KeloPvPWorld.state.dodgeActive});await new Promise(r=>setTimeout(r,8));}
    const end={x:localPlayer.x,y:localPlayer.y};
    const firstMove=samples.find(s=>Math.hypot(s.x-start.x,s.y-start.y)>.5)||null;
    const completed=samples.find(s=>!s.dash&&Math.hypot(s.x-expected.x,s.y-expected.y)<.5&&s.ms>10)||null;
    return{start,expected,end,distance:Math.hypot(end.x-start.x,end.y-start.y),firstMoveMs:firstMove&&firstMove.ms,completedMs:completed&&completed.ms,hits:hits.slice(0,8),samples,perfBefore,loaderAudit:window.KELO_PVP_COMBAT_LOADER_AUDIT?{version:window.KELO_PVP_COMBAT_LOADER_AUDIT.version,abilityRuntimeWakeOnPvpEnter:window.KELO_PVP_COMBAT_LOADER_AUDIT.abilityRuntimeWakeOnPvpEnter,wakeCount:window.KELO_PVP_COMBAT_LOADER_AUDIT.wakeCount}:null,collisionOwners:window.KELO_COLLISION&&window.KELO_COLLISION.ownerSnapshot?window.KELO_COLLISION.ownerSnapshot():null,audit:window.KELO_PVP_AUDIT||null};
  });
  console.log('PVP_DODGE_WINNER',JSON.stringify({label,result,errors},null,2));
  expect(errors).toEqual([]);
  expect(result.hits).toEqual([]);
  expect(result.perfBefore.simulationAwake).toBe(true);
  expect(result.loaderAudit&&result.loaderAudit.abilityRuntimeWakeOnPvpEnter).toBe(true);
  expect(result.samples.some(s=>s.dodgeActive)).toBeTruthy();
  expect(result.samples.some(s=>s.dash&&s.dash.time<s.dash.max)).toBeTruthy();
  expect(result.firstMoveMs).not.toBeNull();
  expect(result.firstMoveMs).toBeLessThanOrEqual(40);
  expect(result.completedMs).not.toBeNull();
  expect(result.completedMs).toBeLessThanOrEqual(190);
  expect(result.distance).toBeGreaterThanOrEqual(111.5);
  expect(result.distance).toBeLessThanOrEqual(112.5);
  return result;
}

test('PvP dodge winner mobile',async({browser})=>{const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});await runDodge(p,'mobile');await p.close();});
test('PvP dodge winner desktop',async({browser})=>{const p=await browser.newPage({viewport:{width:1440,height:900}});await runDodge(p,'desktop');await p.close();});
