// Focused live smoke: prove the deployed World editor opens and closes.
// 2026-09-10: exact Creator Hub → World tap path plus observer-loop diagnostics.
import { chromium } from 'playwright';

const base=process.env.AUDIT_URL||'https://kelffren.github.io/gemini/';
const url=new URL(base);
url.searchParams.set('mapEditor','1');
url.searchParams.set('studioOpenSmoke',String(Date.now()));

const browser=await chromium.launch({
  headless:true,
  executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',
  args:['--no-sandbox','--disable-dev-shm-usage']
});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage();
page.setDefaultTimeout(10000);
const errors=[],consoleLines=[];
page.on('pageerror',error=>errors.push(String(error?.stack||error)));
page.on('console',msg=>{const line=`${msg.type()}:${msg.text()}`;consoleLines.push(line);console.log(`[browser] ${line}`);});

const report={ok:false,url:String(url),permission:false,menu:false,creators:false,studio:false,accountGateHidden:false,closed:false,errors,consoleLines};
async function diagnostics(){
  report.diagnostics=await page.evaluate(()=>{
    const E=window.KELO_WORLD_EDIT;
    return {
      worldEdit:{exists:!!E,ready:!!E?.ready,version:E?.version||null,hasWhenReady:typeof E?.whenReady==='function',hasRequest:typeof E?.request==='function'},
      inputLocks:{exists:!!window.KeloInputLocks,acquire:typeof window.KeloInputLocks?.acquire==='function',release:typeof window.KeloInputLocks?.release==='function'},
      builder:{exists:!!window.KELO_WORLD_BUILDER,isMainWorld:window.KELO_WORLD_BUILDER?.isMainWorld?.()??null},
      toasts:Array.isArray(window.__studioSmokeToasts)?window.__studioSmokeToasts.slice():[],
      observerStats:Array.isArray(window.__studioObserverStats)?window.__studioObserverStats.map(row=>({...row})):[]
    };
  }).catch(error=>({diagnosticError:String(error)}));
}
async function installObserverGuard(){
  await page.evaluate(()=>{
    const NativeObserver=window.MutationObserver;
    if(!NativeObserver||window.__studioObserverGuardInstalled)return;
    window.__studioObserverGuardInstalled=true;
    window.__studioObserverStats=[];
    let sequence=0;
    window.MutationObserver=class StudioGuardedMutationObserver{
      constructor(callback){
        const id=++sequence;
        const createdAt=String(new Error(`Studio observer #${id}`).stack||'');
        const stat={id,count:0,tripped:false,createdAt};
        window.__studioObserverStats.push(stat);
        let wrapper=this;
        this._native=new NativeObserver((records)=>{
          stat.count++;
          if(stat.count===1)console.info(`[StudioObserver#${id}] first callback`);
          if(stat.count===50||stat.count===150)console.warn(`[StudioObserver#${id}] callbacks=${stat.count}`);
          if(stat.count>250){
            stat.tripped=true;
            wrapper._native.disconnect();
            console.error(`[StudioObserverLoop#${id}] disconnected after ${stat.count} callbacks\n${createdAt}`);
            return;
          }
          callback(records,wrapper);
        });
      }
      observe(...args){return this._native.observe(...args);}
      disconnect(){return this._native.disconnect();}
      takeRecords(){return this._native.takeRecords();}
    };
  });
}
try{
  await page.goto(String(url),{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.KELO_ADMIN_KEYS?.can?.('world.edit',window.KELO_ADMIN_KEYS?.playerId?.()),null,{timeout:12000});
  report.permission=true;
  await page.evaluate(()=>{window.__studioSmokeToasts=[];const previous=window.showToast;window.showToast=(...args)=>{window.__studioSmokeToasts.push(args.map(String).join(' '));return previous?.(...args);};});

  const authGate=page.locator('#kelo-account-auth');
  report.accountGateHidden=await authGate.count()===0||await authGate.isHidden().catch(()=>false);
  if(!report.accountGateHidden)throw new Error('ACCOUNT_GATE_BLOCKS_EXPLICIT_EDITOR_MODE');

  await page.locator('#lx-side-menu').click();report.menu=true;
  await page.locator('#lx-create-studio').click();
  await page.locator('#kelo-creators-hub').waitFor({state:'visible',timeout:10000});report.creators=true;
  await diagnostics();
  await installObserverGuard();

  await page.getByRole('button',{name:'Abrir World'}).click();
  try{await page.locator('#kelo-studio-live').waitFor({state:'visible',timeout:15000});}
  catch(error){await diagnostics();throw error;}
  report.studio=true;
  report.shell=await page.locator('#kelo-studio-live').evaluate(node=>({id:node.id,shellVersion:node.dataset.shellVersion||null,compact:node.dataset.compact||null}));
  await diagnostics();

  const loops=report.diagnostics?.observerStats?.filter?.(row=>row.tripped)||[];
  if(loops.length)throw new Error(`STUDIO_OBSERVER_LOOP:${JSON.stringify(loops)}`);

  await page.locator('#kelo-studio-live [data-act="close"]').click();
  await page.locator('#kelo-studio-live').waitFor({state:'detached',timeout:8000});report.closed=true;
  if(errors.length)throw new Error(`PAGE_ERRORS:${JSON.stringify(errors)}`);
  report.ok=true;console.log(JSON.stringify(report,null,2));
} catch(error){report.failure=String(error?.stack||error);await diagnostics();console.error(JSON.stringify(report,null,2));throw error;}
finally{await browser.close();}
