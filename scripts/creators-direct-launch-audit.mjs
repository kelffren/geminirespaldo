import fs from 'node:fs';
import { chromium } from 'playwright';

const base=(process.env.AUDIT_URL||'https://kelffren.github.io/gemini/').replace(/\?+$/,'');
const executablePath=process.env.CHROME_BIN||undefined;
fs.mkdirSync('artifacts',{recursive:true});

const hardTimer=setTimeout(()=>{
  console.error('CREATORS_DIRECT_LAUNCH_AUDIT: HARD_TIMEOUT');
  process.exit(124);
},45000);
hardTimer.unref?.();

let browser=null;
try{
  browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error?.stack||error?.message||error)));

  const url=new URL(base);
  url.searchParams.set('mapEditor','1');
  url.searchParams.set('creators','1');
  url.searchParams.set('directCreatorsAudit',String(Date.now()));

  await page.goto(String(url),{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForFunction(()=>{
    const launcher=window.KELO_CREATORS_LAUNCHER;
    const actor=window.KELO_ADMIN_KEYS?.playerId?.();
    return launcher?.directRequested===true&&launcher?.allowed===true&&!!actor&&window.KELO_ADMIN_KEYS?.can?.('creators.access',actor)===true;
  },null,{timeout:10000});
  await page.waitForSelector('#kelo-creators-hub',{state:'visible',timeout:10000});

  const hubState=await page.evaluate(()=>({
    hubVisible:!!document.getElementById('kelo-creators-hub'),
    directRequested:window.KELO_CREATORS_LAUNCHER?.directRequested===true,
    allowed:window.KELO_CREATORS_LAUNCHER?.allowed===true,
    actor:window.KELO_ADMIN_KEYS?.playerId?.()||null,
    creatorAccess:window.KELO_ADMIN_KEYS?.can?.('creators.access',window.KELO_ADMIN_KEYS?.playerId?.())===true,
    worldButton:!!document.querySelector('#kelo-creators-hub [aria-label="Abrir World"]'),
    avatarButton:!!document.querySelector('#kelo-creators-hub [aria-label="Abrir Avatar"]'),
    spriteAbilityButton:!!document.querySelector('#kelo-creators-hub [aria-label="Abrir Sprite Ability"]')
  }));
  if(!hubState.hubVisible||!hubState.directRequested||!hubState.allowed||!hubState.creatorAccess)throw new Error(`CREATORS_DIRECT_GATE_FAILED:${JSON.stringify(hubState)}`);
  if(!hubState.worldButton||!hubState.avatarButton||!hubState.spriteAbilityButton)throw new Error(`CREATORS_DIRECT_CARDS_MISSING:${JSON.stringify(hubState)}`);
  if(pageErrors.length)throw new Error(`CREATORS_DIRECT_PAGE_ERRORS:${pageErrors.join(' | ')}`);

  await page.screenshot({path:'artifacts/creators-direct-hub.png',fullPage:true});
  console.log(JSON.stringify({ok:true,url:String(url),viewport:{width:390,height:844,dpr:2},hubState},null,2));
  console.log('CREATORS_DIRECT_LAUNCH_AUDIT: PASS');
} finally {
  clearTimeout(hardTimer);
  if(browser)await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,3000))]);
}
