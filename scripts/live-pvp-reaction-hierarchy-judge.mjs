/* KELO-INDEX
 * area: QA / PVP FEEL
 * owner: live-pvp-reaction-hierarchy-judge
 * keys: PVP MELEE REACTION RECOIL COMBO MOBILE DESKTOP CHROMIUM
 * purpose: valida en navegador real que opener/follow/finisher escalen el recoil corporal del defensor sin mutar gameplay
 */
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'http://127.0.0.1:4173/';
const profiles=['sword_light_basic','sword_light_follow','sword_light_finisher'];
const viewports=[
  {name:'mobile',viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true},
  {name:'desktop',viewport:{width:1440,height:900},deviceScaleFactor:1,isMobile:false,hasTouch:false}
];
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
try{
  for(const cfg of viewports){
    const context=await browser.newContext(cfg);
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
    await page.goto(base+(base.includes('?')?'&':'?')+'offline=1&reaction-hierarchy='+Date.now(),{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(()=>!!window.KeloRuntimeBootstrap?.ensure,null,{timeout:15000});
    await page.evaluate(async()=>window.KeloRuntimeBootstrap.ensure());
    await page.waitForFunction(()=>!!(window.KeloPvPWorld&&window.KeloMeleeVisuals&&window.KeloAnimation),null,{timeout:30000});
    await page.evaluate(()=>window.enterPvPWorld());
    await page.waitForFunction(()=>window.KeloPvPWorld?.state?.combatEnabled===true,null,{timeout:8000});
    const rows=[];
    for(const profileId of profiles){
      await page.evaluate(()=>{const p=localPlayer,d=simulatedPlayers[0];p.x=2860;p.y=700;d.x=2965;d.y=700;d.targetX=d.x;d.targetY=d.y;});
      const started=await page.evaluate(profileId=>{const p=localPlayer,d=simulatedPlayers[0];return window.KeloMeleeVisuals.preview(p,d,true,profileId);},profileId);
      if(!started)throw new Error('REACTION_PREVIEW_START_FAILED:'+profileId);
      let max=0,channel=false,clip=null;
      const until=Date.now()+260;
      while(Date.now()<until){
        const s=await page.evaluate(()=>{const t=window.KeloAnimation.sampleTransform(simulatedPlayers[0]);return{px:Math.hypot(Number(t?.offsetX)||0,Number(t?.offsetY)||0),channel:t?.channel||null,clip:t?.clipId||null};});
        max=Math.max(max,s.px);channel=channel||s.channel==='reaction';if(s.clip)clip=s.clip;
        await page.waitForTimeout(5);
      }
      rows.push({profileId,maxRecoilPx:max,reactionChannel:channel,clip});
      await page.waitForTimeout(220);
    }
    const [opener,follow,finisher]=rows.map(r=>r.maxRecoilPx);
    const ok=errors.length===0&&rows.every(r=>r.reactionChannel)&&opener>=7.5&&follow>=opener*1.06&&finisher>=follow*1.15&&finisher<=14;
    results.push({viewport:cfg.name,rows,ratios:{followVsOpener:follow/opener,finisherVsFollow:finisher/follow},errors,ok});
    await context.close();
  }
}finally{await browser.close();}
console.log(JSON.stringify(results,null,2));
if(results.some(r=>!r.ok))throw new Error('PVP_REACTION_HIERARCHY_FAILED');
