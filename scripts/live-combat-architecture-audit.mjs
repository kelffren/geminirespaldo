import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const url=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const outDir=path.resolve('artifacts/combat-architecture-live');
await fs.mkdir(outDir,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const pageErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e.message||e)));

try{
  await page.goto(url+'?combat-architecture-audit='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>
    window.KELO_RUNTIME_BOOTSTRAP_AUDIT?.ready===true&&
    window.KeloEvents?.version==='kelo-event-bus-v1.0.0'&&
    window.KeloCombatSchema?.version==='combat-schema-v1.0.0'&&
    window.KeloCombatEngine?.version==='combat-engine-v1.0.0'&&
    window.KeloMeleeEngine?.version==='melee-engine-v1.0.0'&&
    window.KeloMeleeProfiles?.version==='melee-weapon-profiles-v1.0.0'&&
    window.KeloCombatPresentationBridge?.version==='combat-presentation-bridge-v1.0.0'&&
    window.KeloCombatPresentationBridge.bound===true&&
    window.KeloPvPWorld?.version==='pvp-world-v1.8',
    null,{timeout:45000});

  const foundation=await page.evaluate(()=>({
    bootstrap:window.KELO_RUNTIME_BOOTSTRAP_AUDIT,
    eventBus:window.KeloEvents.version,
    combatSchema:window.KeloCombatSchema.version,
    combatEngine:window.KeloCombatEngine.version,
    meleeEngine:window.KeloMeleeEngine.version,
    profile:window.KeloMeleeProfiles.get('sword_light_basic'),
    bridge:window.KELO_COMBAT_PRESENTATION_BRIDGE_AUDIT,
    pvp:window.KeloPvPWorld.version
  }));
  if(foundation.profile.damage!==18||foundation.profile.range!==150||foundation.profile.cooldown!==0.7)throw new Error('LIVE_BASIC_PROFILE_CHANGED');

  await page.evaluate(()=>window.enterPvPWorld());
  await page.waitForFunction(()=>window.KeloPvPWorld?.state?.mode==='pvp'&&window.KeloPvPWorld.state.combatEnabled===true,null,{timeout:10000});

  const beforeVisual=await page.evaluate(()=>({
    attacks:window.KELO_MELEE_VISUAL_AUDIT?.attacksStarted||0,
    hits:window.KELO_MELEE_VISUAL_AUDIT?.hitsPresented||0,
    misses:window.KELO_MELEE_VISUAL_AUDIT?.missesPresented||0
  }));

  const hit=await page.evaluate(()=>{
    const P=window.KeloPvPWorld,A=window.KeloCombatSchema.events,events=[];
    const stops=[A.ATTACK_STARTED,A.HIT_CONFIRMED,A.DAMAGE_APPLIED,A.ENTITY_KILLED,A.ATTACK_RESOLVED].map(name=>window.KeloEvents.on(name,p=>events.push({name,attackId:p.attackId,confirmedHit:p.confirmedHit,amount:p.amount??null})));
    const target=window.__KELO_COMBAT_ARCH_AUDIT_TARGET={
      id:'__combat_arch_audit_target',
      playerKey:'__combat_arch_audit_target',
      x:localPlayer.x+100,
      y:localPlayer.y,
      vx:0,vy:0,radius:20,hp:100,maxHp:100,keloShield:0,_face:'left'
    };
    const cmd=P.command('BASIC_ATTACK',{target});
    const result=P.authority.execute(cmd);
    stops.forEach(stop=>stop());
    return{result,hp:target.hp,events};
  });
  if(!hit.result.ok||hit.result.amount!==18||hit.hp!==82)throw new Error('LIVE_HIT_NOT_18_'+JSON.stringify(hit));
  const hitNames=hit.events.map(e=>e.name);
  const ce=await page.evaluate(()=>window.KeloCombatSchema.events);
  if(hitNames.join('|')!==[ce.ATTACK_STARTED,ce.HIT_CONFIRMED,ce.DAMAGE_APPLIED,ce.ATTACK_RESOLVED].join('|'))throw new Error('LIVE_HIT_EVENT_ORDER_'+hitNames.join('|'));

  const cooldown=await page.evaluate(()=>{
    const P=window.KeloPvPWorld,target=window.__KELO_COMBAT_ARCH_AUDIT_TARGET,before=target.hp;
    const result=P.authority.execute(P.command('BASIC_ATTACK',{target}));
    return{result,before,after:target.hp};
  });
  if(cooldown.result.ok||cooldown.result.reason!=='COOLDOWN'||cooldown.before!==cooldown.after)throw new Error('LIVE_COOLDOWN_FAILED_'+JSON.stringify(cooldown));

  await page.waitForTimeout(850);
  const miss=await page.evaluate(()=>{
    const P=window.KeloPvPWorld,A=window.KeloCombatSchema.events,events=[];
    const stops=[A.ATTACK_STARTED,A.HIT_CONFIRMED,A.DAMAGE_APPLIED,A.ATTACK_RESOLVED].map(name=>window.KeloEvents.on(name,p=>events.push({name,confirmedHit:p.confirmedHit})));
    const target=window.__KELO_COMBAT_ARCH_AUDIT_TARGET;
    const before=target.hp;target.x=localPlayer.x+200;target.y=localPlayer.y;
    const result=P.authority.execute(P.command('BASIC_ATTACK',{target}));
    stops.forEach(stop=>stop());
    return{result,before,after:target.hp,events};
  });
  if(miss.result.ok||miss.result.reason!=='OUT_OF_RANGE'||miss.before!==miss.after)throw new Error('LIVE_MISS_MUTATED_HP_'+JSON.stringify(miss));
  if(miss.events.map(e=>e.name).join('|')!==[ce.ATTACK_STARTED,ce.ATTACK_RESOLVED].join('|'))throw new Error('LIVE_MISS_EVENT_ORDER');
  if(miss.events[0]?.confirmedHit!==false)throw new Error('LIVE_MISS_NOT_EXPLICIT');

  await page.waitForTimeout(250);
  const afterVisual=await page.evaluate(()=>({
    attacks:window.KELO_MELEE_VISUAL_AUDIT?.attacksStarted||0,
    hits:window.KELO_MELEE_VISUAL_AUDIT?.hitsPresented||0,
    misses:window.KELO_MELEE_VISUAL_AUDIT?.missesPresented||0,
    bridge:window.KELO_COMBAT_PRESENTATION_BRIDGE_AUDIT,
    pvpAudit:window.KELO_PVP_AUDIT
  }));
  if(afterVisual.attacks<beforeVisual.attacks+2)throw new Error('LIVE_PRESENTATION_BRIDGE_ATTACKS_MISSING');
  if(afterVisual.hits<beforeVisual.hits+1)throw new Error('LIVE_PRESENTATION_BRIDGE_HIT_MISSING');
  if(afterVisual.misses<beforeVisual.misses+1)throw new Error('LIVE_PRESENTATION_BRIDGE_MISS_MISSING');
  if(afterVisual.bridge.attackEvents<2||afterVisual.bridge.hitEvents<1)throw new Error('LIVE_BRIDGE_AUDIT_MISSING');
  if(afterVisual.pvpAudit?.combatEngineDelegated!==true||afterVisual.pvpAudit?.directBasicDamage!==false)throw new Error('LIVE_PVP_DELEGATION_AUDIT_FAILED');

  await page.screenshot({path:path.join(outDir,'combat-architecture-mobile.png'),fullPage:true});
  await page.evaluate(()=>{delete window.__KELO_COMBAT_ARCH_AUDIT_TARGET;window.leavePvPWorld();});
  if(pageErrors.length)throw new Error('PAGE_ERRORS_'+pageErrors.join(' | '));

  const report={ok:true,url,viewport:{width:390,height:844},foundation,hit,cooldown,miss,beforeVisual,afterVisual,pageErrors};
  await fs.writeFile(path.join(outDir,'report.json'),JSON.stringify(report,null,2));
  console.log('COMBAT_ARCHITECTURE_LIVE_OK',JSON.stringify({damage:hit.result.amount,hitHp:hit.hp,missHp:miss.after,attackVisuals:afterVisual.attacks-beforeVisual.attacks,hitVisuals:afterVisual.hits-beforeVisual.hits,missVisuals:afterVisual.misses-beforeVisual.misses,errors:pageErrors.length}));
}catch(error){
  await page.screenshot({path:path.join(outDir,'combat-architecture-failure.png'),fullPage:true}).catch(()=>{});
  await fs.writeFile(path.join(outDir,'report.json'),JSON.stringify({ok:false,url,error:String(error?.stack||error),pageErrors},null,2));
  throw error;
}finally{await browser.close();}
