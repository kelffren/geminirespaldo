/* KELO-INDEX
 * area: QA / PVP TEMP TRACE
 * owner: one-shot knockback diagnostic
 * keys: PVP KNOCKBACK TRACE CHROMIUM WRITE STACK
 * purpose: rastrear temporalmente cada escritura de x del dummy durante un hit LIVE para localizar el owner que cancela knockback
 * do-not: NO gameplay, NO runtime ownership, eliminar tras diagnóstico
 */
import { chromium } from 'playwright';
const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
try{
  await page.goto(base+'?offline=1&kb-trace='+Date.now(),{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>!!window.KeloRuntimeBootstrap?.ensure,null,{timeout:15000});
  await page.evaluate(async()=>{await window.KeloRuntimeBootstrap.ensure();});
  await page.waitForFunction(()=>!!(window.KeloPvPWorld&&window.KeloMeleeProfiles&&window.KeloSimulation),null,{timeout:30000});
  await page.evaluate(()=>window.enterPvPWorld());
  await page.waitForFunction(()=>window.KeloPvPWorld?.state?.combatEnabled===true,null,{timeout:8000});
  await page.waitForTimeout(120);
  const setup=await page.evaluate(()=>{
    const p=localPlayer,d=simulatedPlayers[0];
    p.x=2860;p.y=700;p.vx=p.vy=0;
    d.x=2965;d.y=700;d.targetX=d.x;d.targetY=d.y;d.maxHp=d.hp=500;
    window.KeloPvPWorld.setAimWorld({x:p.x+200,y:p.y},'kb-trace',1);
    const profile=window.KeloMeleeProfiles.get('sword_light_basic');
    const from={x:d.x,y:d.y},to={x:d.x+profile.knockback,y:d.y};
    const collisionRows=(typeof obstacles!=='undefined'&&window.KELO_COLLISION)?obstacles.map((b,i)=>({i,b,q:window.KELO_COLLISION.segmentAabbHitT(from.x,from.y,to.x,to.y,b,d.radius||20)})):[];
    return {combat:window.KELO_COMBAT_ENABLED,profile:{id:profile.id,knockback:profile.knockback},from,to,collisionRows,sim:window.KeloSimulation.snapshot()};
  });
  console.log('SETUP '+JSON.stringify(setup));
  const manual=await page.evaluate(async()=>{
    const d=simulatedPlayers[0],x0=d.x;d.x=x0+15;await new Promise(r=>setTimeout(r,80));return{x0,x1:d.x,delta:d.x-x0};
  });
  console.log('MANUAL '+JSON.stringify(manual));
  const result=await page.evaluate(async()=>{
    const p=localPlayer,d=simulatedPlayers[0];
    d.x=2965;d.y=700;d.targetX=d.x;d.targetY=d.y;d.maxHp=d.hp=500;
    const writes=[];let current=d.x;
    Object.defineProperty(d,'x',{configurable:true,enumerable:true,get(){return current;},set(v){const prev=current;current=v;writes.push({t:performance.now(),prev,v,delta:v-prev,stack:(new Error()).stack?.split('\n').slice(1,5).join(' | ')||''});if(writes.length>120)writes.shift();}});
    const start=performance.now();
    window.KeloPvPWorld.startBasicAttack('kb-trace');
    await new Promise(r=>setTimeout(r,360));
    return {start,finalX:d.x,hp:d.hp,writes:writes.filter(w=>Math.abs(w.delta)>1e-6)};
  });
  console.log('RESULT '+JSON.stringify(result));
}finally{await browser.close();}
