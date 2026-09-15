// Focused live smoke: prove deployed Sprite Ability opens in zero-training Easy Mode.
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const url=new URL(base);
url.searchParams.set('mapEditor','1');
url.searchParams.set('spriteAbilityEasySmoke',String(Date.now()));

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage();
page.setDefaultTimeout(12000);
const errors=[];
page.on('pageerror',error=>errors.push(String(error?.stack||error)));
page.on('console',msg=>console.log(`[browser] ${msg.type()}:${msg.text()}`));
const report={ok:false,url:String(url),hub:false,spriteAbility:false,easy:false,actions:[],errors};
try{
  await page.goto(String(url),{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.KELO_ADMIN_KEYS?.can?.('ability.edit',window.KELO_ADMIN_KEYS?.playerId?.()),null,{timeout:15000});
  const authGate=page.locator('#kelo-account-auth');
  if(await authGate.count()&&await authGate.isVisible().catch(()=>false))throw new Error('ACCOUNT_GATE_BLOCKS_EXPLICIT_EDITOR_MODE');
  await page.locator('#lx-side-menu').click();
  await page.locator('#lx-create-studio').click();
  await page.locator('#kelo-creators-hub').waitFor({state:'visible'});report.hub=true;
  report.beforeClick=await page.evaluate(()=>({inputLocks:{present:!!window.KeloInputLocks,acquire:typeof window.KeloInputLocks?.acquire,release:typeof window.KeloInputLocks?.release,fallback:!!window.KeloInputLocks?.__keloCreatorFallback},bodyClass:document.body.className}));
  await page.getByRole('button',{name:'Abrir Sprite Ability'}).click();
  const workspace=page.locator('#kelo-studio-workspace');
  try{await workspace.waitFor({state:'visible',timeout:15000});}
  catch(error){
    report.postClick=await page.evaluate(()=>({bodyClass:document.body.className,hubVisible:!!document.querySelector('#kelo-creators-hub'),workspacePresent:!!document.querySelector('#kelo-studio-workspace'),toasts:[...document.querySelectorAll('[class*="toast"],#toast,.toast')].map(n=>n.textContent?.trim()).filter(Boolean).slice(-8),inputLocks:{present:!!window.KeloInputLocks,size:window.KeloInputLocks?.size??null,fallback:!!window.KeloInputLocks?.__keloCreatorFallback}}));
    throw error;
  }
  report.spriteAbility=true;
  await page.locator('.sab-easy-dock').waitFor({state:'visible',timeout:10000});
  report.easy=await workspace.getAttribute('data-sab-easy')==='1';
  if(!report.easy)throw new Error('SPRITE_ABILITY_EASY_MODE_NOT_DEFAULT');
  report.actions=await page.locator('.sab-easy-dock button span').allTextContents();
  const expected=['SUBIR','VER','PROBAR','AJUSTAR','GUARDAR'];
  if(JSON.stringify(report.actions)!==JSON.stringify(expected))throw new Error(`SPRITE_ABILITY_EASY_ACTIONS_MISMATCH:${JSON.stringify(report.actions)}`);
  const welcome=page.locator('.sab-easy-welcome');
  if(!await welcome.isVisible())throw new Error('SPRITE_ABILITY_EASY_WELCOME_NOT_VISIBLE');
  const advanced=page.locator('.sab-easy-mode-toggle');
  if(!await advanced.isVisible())throw new Error('SPRITE_ABILITY_ADVANCED_ESCAPE_NOT_VISIBLE');
  const visibleErrors=errors.filter(text=>!text.includes('Failed to load resource'));
  if(visibleErrors.length)throw new Error(`PAGE_ERRORS:${JSON.stringify(visibleErrors)}`);
  report.ok=true;
  console.log(JSON.stringify(report,null,2));
} catch(error){report.failure=String(error?.stack||error);console.error(JSON.stringify(report,null,2));throw error;}
finally{await browser.close();}