/* KELO-INDEX
 * area: QA / CREATORS / SPRITE ABILITY
 * purpose: diagnose the exact mobile Hub → Sprite Ability transition before the full builder audit
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE=(process.env.AUDIT_URL||'http://127.0.0.1:8000/').replace(/\?+$/,'');
const executablePath=process.env.CHROME_BIN||undefined;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const artifactDir='artifacts/sprite-ability-builder';
fs.mkdirSync(artifactDir,{recursive:true});

const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage();
page.setDefaultTimeout(10000);
const consoleMessages=[];
const pageErrors=[];
page.on('console',message=>consoleMessages.push(`${message.type()}: ${message.text()}`));
page.on('pageerror',error=>pageErrors.push(String(error?.stack||error?.message||error)));

async function snapshot(){
  return page.evaluate(()=>{
    const workspace=document.getElementById('kelo-studio-workspace');
    const hub=document.getElementById('kelo-creators-hub');
    const card=[...document.querySelectorAll('.kc-card')].find(node=>node.getAttribute('aria-label')==='Abrir Sprite Ability');
    const launchError=document.querySelector('.kc-launch-error');
    return {
      href:location.href,
      hubConnected:Boolean(hub?.isConnected),
      workspaceConnected:Boolean(workspace?.isConnected),
      workspaceTitle:workspace?.querySelector('.ksw-title')?.textContent||null,
      launchError:launchError?.textContent||null,
      cardBusy:card?.getAttribute('aria-busy')||null,
      cardDisabled:Boolean(card?.disabled),
      bodyClass:document.body.className,
      inputLocks:window.KeloInputLocks?.snapshot?.()||null,
      adminPlayerId:window.KELO_ADMIN_KEYS?.playerId?.()||null,
      abilityEditGlobal:window.KELO_ADMIN_KEYS?.can?.('ability.edit',window.KELO_ADMIN_KEYS?.playerId?.())??null
    };
  });
}

try{
  await page.goto(`${BASE}?offline=1&mapEditor=1&sprite-ability-launch-diagnostic=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.KELO_CREATORS_LAUNCHER&&window.KELO_ADMIN_KEYS?.can?.('ability.edit',window.KELO_ADMIN_KEYS.playerId())===true&&window.KeloInputLocks,{timeout:20000});
  await page.evaluate(()=>{document.documentElement.dataset.keloAuthGate='off';});
  await page.evaluate(()=>{void window.KELO_CREATORS_LAUNCHER.open();return true;});
  await page.waitForSelector('#kelo-creators-hub',{state:'visible',timeout:10000});
  const enabled=await page.evaluate(()=>{const card=[...document.querySelectorAll('.kc-card')].find(node=>node.getAttribute('aria-label')==='Abrir Sprite Ability');return Boolean(card&&!card.disabled);});
  if(!enabled)throw new Error('SPRITE_ABILITY_CARD_NOT_ACTIVE');
  await page.evaluate(()=>{const card=[...document.querySelectorAll('.kc-card')].find(node=>node.getAttribute('aria-label')==='Abrir Sprite Ability');card?.click();return true;});

  let state=null;
  const deadline=Date.now()+12000;
  while(Date.now()<deadline){
    state=await snapshot();
    if(state.workspaceConnected||state.launchError)break;
    await sleep(150);
  }
  state=await snapshot();
  const report={state,consoleMessages,pageErrors};
  fs.writeFileSync(`${artifactDir}/launch-diagnostic.json`,JSON.stringify(report,null,2));
  console.log('SPRITE_ABILITY_LAUNCH_DIAGNOSTIC');
  console.log(JSON.stringify(report,null,2));
  if(!state.workspaceConnected)throw new Error(`SPRITE_ABILITY_LAUNCH_FAILED:${JSON.stringify(report)}`);
  console.log('SPRITE_ABILITY_LAUNCH_DIAGNOSTIC: PASS');
}finally{
  await browser.close();
}
