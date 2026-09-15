import { chromium } from 'playwright';

const url = process.env.AUDIT_URL || 'http://127.0.0.1:4173/?offline=1&qa-live-audit=1';
const executablePath = process.env.CHROME_BIN || undefined;

const browser = await chromium.launch({ headless:true, executablePath, args:['--no-sandbox','--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
const page = await context.newPage();
const pageErrors=[];
const consoleErrors=[];
page.on('pageerror',e=>pageErrors.push(String(e?.stack||e?.message||e)));
page.on('console',m=>{ if(m.type()==='error') consoleErrors.push(m.text()); });

const cdp=await context.newCDPSession(page);
await cdp.send('Debugger.enable');
const parsedScripts=new Map();
cdp.on('Debugger.scriptParsed',e=>parsedScripts.set(e.scriptId,e.url||'<inline>'));

async function captureBootBlocker(){
  let resolvePaused;
  const pausedPromise=new Promise(resolve=>{resolvePaused=resolve;});
  cdp.once('Debugger.paused',resolvePaused);
  await cdp.send('Debugger.pause').catch(()=>{});
  const paused=await Promise.race([pausedPromise,new Promise(resolve=>setTimeout(()=>resolve(null),4000))]);
  if(!paused)return [];
  const stack=(paused.callFrames||[]).slice(0,12).map(frame=>({
    functionName:frame.functionName||'<anonymous>',
    url:frame.url||parsedScripts.get(frame.location?.scriptId)||'<inline>',
    line:Number(frame.location?.lineNumber||0)+1,
    column:Number(frame.location?.columnNumber||0)+1
  }));
  console.error('BOOT_BLOCKER_STACK '+JSON.stringify(stack));
  await cdp.send('Debugger.resume').catch(()=>{});
  return stack;
}

async function waitForGameplay(){
  try{
    await page.waitForFunction(()=>(
      typeof localPlayer!=='undefined' &&
      typeof input!=='undefined' &&
      typeof processInput==='function' &&
      typeof renderActionBar==='function' &&
      !!document.getElementById('game-canvas')
    ),null,{timeout:45000});
  }catch(error){
    const blocker=await captureBootBlocker();
    throw new Error(`Gameplay boot did not become ready within 45s. blocker=${JSON.stringify(blocker)} original=${error?.message||error}`);
  }
}

try{
  // `commit` is deliberate: Kelo World V6.59 releases the game loop before DCL so
  // Safari can paint/play even if the large legacy document has not finished parsing.
  await page.goto(url,{waitUntil:'commit',timeout:60000});
  await waitForGameplay();
  await page.waitForTimeout(500);

  const boot=await page.evaluate(()=>{
    const canvas=document.getElementById('game-canvas');
    const rect=canvas?.getBoundingClientRect();
    return {
      title:document.title,
      readyState:document.readyState,
      rafReleased:window.__keloRAFReleased===true,
      canvas:rect?{width:rect.width,height:rect.height,display:getComputedStyle(canvas).display,visibility:getComputedStyle(canvas).visibility}:null,
      player:{x:Number(localPlayer.x),y:Number(localPlayer.y)},
      inputReady:typeof processInput==='function',
      luxeReady:!!window.KELO_LUXE
    };
  });
  console.log('BOOT_MEASUREMENT '+JSON.stringify(boot));
  if(!boot.canvas||boot.canvas.width<300||boot.canvas.height<500||boot.canvas.display==='none'||boot.canvas.visibility==='hidden'){
    throw new Error(`Gameplay canvas is not visibly mounted: ${JSON.stringify(boot)}`);
  }

  const abilityBar=await page.evaluate(()=>{
    const bar=document.getElementById('action-bar-container');
    try{renderActionBar();}catch(error){return {error:String(error?.message||error)};}
    const slots=bar?Array.from(bar.querySelectorAll('.stone-slot')):[];
    const visible=slots.filter(slot=>{
      const s=getComputedStyle(slot),r=slot.getBoundingClientRect();
      return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0&&r.width>0&&r.height>0;
    });
    return {present:!!bar,slotCount:slots.length,visibleSlots:visible.length,socialMode:document.body.classList.contains('social-mode')};
  });
  console.log('ABILITY_BAR_MEASUREMENT '+JSON.stringify(abilityBar));
  if(abilityBar.error||!abilityBar.present||abilityBar.slotCount!==5)throw new Error(`Ability bar contract failed: ${JSON.stringify(abilityBar)}`);

  const snapshot=()=>page.evaluate(()=>({x:Number(localPlayer.x),y:Number(localPlayer.y),vx:Number(localPlayer.vx||0),vy:Number(localPlayer.vy||0),normX:Number(input.normX||0),normY:Number(input.normY||0),touchActive:Boolean(input.touchActive)}));
  const start={x:70,y:650},end={x:140,y:650};
  const hitStack=await page.evaluate(({x,y})=>document.elementsFromPoint(x,y).slice(0,10).map(el=>({tag:el.tagName,id:el.id||null,className:typeof el.className==='string'?el.className:null,pointerEvents:getComputedStyle(el).pointerEvents})),start);
  await page.evaluate(()=>{
    window.__KELO_REAL_TOUCH_AUDIT=[];
    window.addEventListener('pointerdown',e=>window.__KELO_REAL_TOUCH_AUDIT.push({type:e.type,x:e.clientX,y:e.clientY,target:{tag:e.target?.tagName||null,id:e.target?.id||null,className:typeof e.target?.className==='string'?e.target.className:null}}),{capture:true,once:true});
  });

  const before=await snapshot();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x,y:start.y,radiusX:2,radiusY:2,force:1,id:77}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:end.x,y:end.y,radiusX:2,radiusY:2,force:1,id:77}]});
  await page.waitForTimeout(900);
  const moving=await snapshot();
  const touchEvents=await page.evaluate(()=>window.__KELO_REAL_TOUCH_AUDIT||[]);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(400);
  const stopped=await snapshot();
  const moved=Math.hypot(moving.x-before.x,moving.y-before.y);
  console.log('MOVEMENT_MEASUREMENT '+JSON.stringify({start,end,hitStack,touchEvents,before,moving,stopped,moved:Number(moved.toFixed(2))}));
  if(!touchEvents.length)throw new Error(`Touch never reached the page. stack=${JSON.stringify(hitStack)}`);
  if(moved<8)throw new Error(`Real touch did not move player enough: ${moved.toFixed(2)}px; moving=${JSON.stringify(moving)} stack=${JSON.stringify(hitStack)}`);
  if(!(moving.normX>0.2))throw new Error(`processInput did not receive rightward touch direction: normX=${moving.normX}`);
  if(stopped.touchActive)throw new Error('touchEnd did not release touch state');

  const menuButton=page.locator('#lx-side-menu');
  if(await menuButton.count()){
    await menuButton.click();
    await page.waitForFunction(()=>document.getElementById('lx-menu-panel')?.classList.contains('open')===true,null,{timeout:5000});
    await page.locator('#lx-menu-close').click();
    await page.waitForFunction(()=>document.getElementById('lx-menu-panel')?.classList.contains('open')===false,null,{timeout:5000});
  }

  if(pageErrors.length)throw new Error(`Page errors during gameplay audit:\n${pageErrors.join('\n')}`);
  console.log(JSON.stringify({status:'PASS',boot,abilityBar,moved:Number(moved.toFixed(2)),consoleErrors:consoleErrors.slice(0,8)},null,2));
}finally{
  await browser.close();
}
