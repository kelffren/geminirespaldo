/* KELO-INDEX
 * area: QA / PVP KNOCKBACK LIVE
 * owner: cross-viewport PvP knockback judge
 * keys: PVP KNOCKBACK MOBILE DESKTOP CHROMIUM HIT RECOIL
 * purpose: valida en runtime real que un hit confirmado conserve el knockback físico y la reacción visual en mobile y desktop
 * do-not: NO gameplay, NO autoridad, NO tuning
 */
import { chromium } from 'playwright';
const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const cases=[
  {name:'mobile',viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true},
  {name:'desktop',viewport:{width:1440,height:900},deviceScaleFactor:1,isMobile:false,hasTouch:false}
];
const results=[];
try{
  for(const cfg of cases){
    const context=await browser.newContext(cfg);
    const page=await context.newPage();
    const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e.message||e)));
    await page.goto(base+(base.includes('?')?'&':'?')+'offline=1&kb-judge='+Date.now(),{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(()=>!!window.KeloRuntimeBootstrap?.ensure,null,{timeout:15000});
    await page.evaluate(async()=>{await window.KeloRuntimeBootstrap.ensure();});
    await page.waitForFunction(()=>!!(window.KeloPvPWorld&&window.KeloAnimation&&window.KeloMeleeProfiles),null,{timeout:30000});
    await page.evaluate(()=>window.enterPvPWorld());
    await page.waitForFunction(()=>window.KeloPvPWorld?.state?.combatEnabled===true,null,{timeout:8000});
    await page.waitForTimeout(120);
    const setup=await page.evaluate(()=>{
      const p=localPlayer,d=simulatedPlayers[0],profile=window.KeloMeleeProfiles.get('sword_light_basic');
      p.x=2860;p.y=700;p.vx=p.vy=0;
      d.x=2965;d.y=700;d.targetX=d.x;d.targetY=d.y;d.maxHp=d.hp=500;
      window.KeloPvPWorld.setAimWorld({x:p.x+200,y:p.y},'kb-live-judge',1);
      return {x:d.x,y:d.y,hp:d.hp,expectedKnockback:profile.knockback};
    });
    await page.evaluate(()=>window.KeloPvPWorld.startBasicAttack('kb-live-judge'));
    await page.waitForFunction(()=>!!window.KeloPvPWorld?.state?.basicAttack,null,{timeout:700,polling:'raf'});
    const samples=[];const until=Date.now()+260;
    while(Date.now()<until){
      samples.push(await page.evaluate(()=>{
        const d=simulatedPlayers[0],t=window.KeloAnimation.sampleTransform(d);
        return {x:d.x,y:d.y,hp:d.hp,recoil:Math.hypot(Number(t?.offsetX)||0,Number(t?.offsetY)||0),channel:t?.channel||null};
      }));
      await page.waitForTimeout(8);
    }
    const maxKnockback=Math.max(...samples.map(s=>Math.hypot(s.x-setup.x,s.y-setup.y)));
    const maxRecoil=Math.max(...samples.map(s=>s.recoil));
    const minHp=Math.min(...samples.map(s=>Number(s.hp)));
    const final=samples.at(-1);
    const row={name:cfg.name,damage:setup.hp-minHp,expectedKnockback:setup.expectedKnockback,maxKnockback,finalKnockback:Math.hypot(final.x-setup.x,final.y-setup.y),maxRecoil,anyReaction:samples.some(s=>s.channel==='reaction'),pageErrors};
    results.push(row);
    if(row.damage<18)throw new Error(`${cfg.name}:DAMAGE_MISSING:${row.damage}`);
    if(row.maxKnockback<setup.expectedKnockback-.5)throw new Error(`${cfg.name}:KNOCKBACK_NOT_RETAINED:${row.maxKnockback}`);
    if(row.finalKnockback<setup.expectedKnockback-.5)throw new Error(`${cfg.name}:KNOCKBACK_SNAPPED_BACK:${row.finalKnockback}`);
    if(row.maxRecoil<5||!row.anyReaction)throw new Error(`${cfg.name}:REACTION_WEAK:${row.maxRecoil}`);
    if(pageErrors.length)throw new Error(`${cfg.name}:PAGE_ERRORS:${pageErrors.join('|')}`);
    await context.close();
  }
  console.log(JSON.stringify({ok:true,results},null,2));
}finally{await browser.close();}
