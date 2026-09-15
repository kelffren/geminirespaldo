/* KELO-INDEX
 * area: TEST / PVP / VISUAL
 * keys: PVP VISUAL MOBILE DESKTOP SCREENSHOT SWORD FIREBALL DASH TELEGRAPH BOOTSTRAP
 * hace: abre el juego real, entra a PvP, ejecuta la vertical slice y genera evidencia visual revisable
 * online: N/A; valida presentación local separada de autoridad
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
const URL=process.env.AUDIT_URL||'http://127.0.0.1:8000/';
const OUT=process.env.AUDIT_OUT||'artifacts/pvp-action-live';
fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={url:URL,runs:[],createdAt:new Date().toISOString()};
async function waitReady(page){
  await page.waitForFunction(()=>window.KeloRuntimeBootstrap&&typeof window.KeloRuntimeBootstrap.ensure==='function',{timeout:30000});
  await page.evaluate(async()=>{await window.KeloRuntimeBootstrap.ensure();});
  await page.waitForFunction(()=>window.KeloPvPWorld&&window.KeloMeleeEngine&&window.KeloCombatEngine&&window.KeloHitResolver&&window.KeloAbilities&&window.KeloStones&&typeof window.enterPvPWorld==='function',{timeout:30000});
}
async function equipSlice(page){await page.evaluate(()=>{const mk=(key)=>window.KeloStones.createAbilityStone(key,'Common',{source:'visual-audit'});STATE.equipped=[mk('fireball'),mk('wind_dash')];STATE.inventory=Array.isArray(STATE.inventory)?STATE.inventory:[];window.KeloAbilities.syncFromWorldState(true);});}
async function enter(page){await page.evaluate(()=>window.enterPvPWorld());await page.waitForFunction(()=>window.KeloPvPWorld&&window.KeloPvPWorld.state.mode==='pvp',{timeout:5000});}
async function shot(page,name){const p=path.join(OUT,name);await page.screenshot({path:p,fullPage:true});return p;}
async function scenario(label,viewport,hasTouch){
  const context=await browser.newContext({viewport,hasTouch,isMobile:hasTouch,deviceScaleFactor:1});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(URL+'?pvp-visual-audit='+Date.now(),{waitUntil:'domcontentloaded'});await waitReady(page);await equipSlice(page);await enter(page);
  await page.evaluate(()=>{localPlayer.x=2790;localPlayer.y=720;const d=simulatedPlayers[0];d.x=2910;d.y=720;d.hp=d.maxHp=100;window.KeloPvPWorld.setAimWorld({x:d.x,y:d.y},'visual-audit');});
  await page.evaluate(()=>window.KeloPvPWorld.startBasicAttack('visual-audit'));await shot(page,`${label}-sword-windup.png`);await page.waitForTimeout(105);await shot(page,`${label}-sword-active-impact.png`);await page.waitForTimeout(150);await shot(page,`${label}-sword-recovery.png`);
  await page.evaluate(()=>{const d=simulatedPlayers[0];d.x=3130;d.y=720;d.hp=d.maxHp=100;window.KeloPvPWorld.setAimWorld({x:d.x,y:d.y},'visual-audit-fireball');});
  await page.locator('.stone-slot[data-slot="0"]').dispatchEvent('pointerdown',{pointerId:71,pointerType:hasTouch?'touch':'mouse',clientX:viewport.width-90,clientY:viewport.height-110,bubbles:true});
  await shot(page,`${label}-fireball-telegraph.png`);
  await page.locator('.stone-slot[data-slot="0"]').dispatchEvent('pointerup',{pointerId:71,pointerType:hasTouch?'touch':'mouse',clientX:viewport.width-180,clientY:Math.round(viewport.height/2),bubbles:true});
  await page.waitForTimeout(90);await shot(page,`${label}-fireball-flight.png`);await page.waitForTimeout(650);
  await page.evaluate(()=>{window.KeloPvPWorld.setAimWorld({x:localPlayer.x+160,y:localPlayer.y-120},'visual-audit-dash');window.KeloPvPWorld.quickCastSlot(1);});
  await shot(page,`${label}-wind-dash-start.png`);await page.waitForTimeout(110);await shot(page,`${label}-wind-dash-mid.png`);await page.waitForTimeout(160);await shot(page,`${label}-wind-dash-end.png`);
  const audit=await page.evaluate(()=>({pvp:window.KELO_PVP_AUDIT,hit:window.KELO_HIT_RESOLVER_AUDIT,melee:window.KELO_MELEE_ENGINE_AUDIT,pos:{x:localPlayer.x,y:localPlayer.y,face:localPlayer._face},dummy:{x:simulatedPlayers[0].x,y:simulatedPlayers[0].y,hp:simulatedPlayers[0].hp}}));
  report.runs.push({label,viewport,hasTouch,errors,audit});await context.close();
}
await scenario('mobile',{width:390,height:844},true);
await scenario('desktop',{width:1440,height:900},false);
await browser.close();
fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
const hardErrors=report.runs.flatMap(r=>r.errors).filter(e=>!/favicon|Failed to load resource/.test(e));
if(hardErrors.length){console.error(hardErrors.join('\n'));process.exit(1)}
for(const run of report.runs){if(!run.audit.pvp||run.audit.pvp.targetLock!==false||run.audit.pvp.aim360!==true)throw new Error('PvP action audit missing for '+run.label);}
console.log('PvP action visual audit OK',OUT);