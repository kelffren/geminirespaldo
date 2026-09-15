/* KELO-INDEX
 * area: TEST / REAL IPHONE / MAJOR GAMEPLAY
 * owner: BrowserStack acceptance gate
 * purpose: exercise the majority of player-facing systems on real iPhone Safari, plus authorized Creators access
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');

const isBrowserStack = Boolean(process.env.BROWSERSTACK_USERNAME || process.env.BROWSERSTACK_ACCESS_KEY || process.env.BROWSERSTACK_BUILD_NAME);
test.skip(!isBrowserStack, 'Major gameplay acceptance runs only on BrowserStack real iPhone');

const ROUTES = [
  ['bag','Mochila'],['abilities','Habilidades'],['appearance','Apariencia'],['mounts','Monturas'],
  ['profile','Perfil'],['market','Mercado'],['chat','Chat'],['properties','Propiedades'],
  ['nobility','Nobleza'],['titles','Libro de títulos'],['emotes','Burlas']
];

function routeOwnerReady(tool) {
  const map = {
    bag: !!window.KeloBackpackUI?.open,
    abilities: !!window.KeloAbilities?.openStonePanel || !!window.KeloAbilitiesLoader?.ensure,
    appearance: !!window.KeloCharacterCustomizer?.open,
    mounts: !!window.KeloMountPanel?.open,
    profile: typeof window.inspectPlayer === 'function',
    market: !!window.KeloMarketUI?.open,
    chat: !!window.KELO_LUXE?.closeChat,
    properties: !!window.KELO_HOUSE_UI?.show || typeof window.openSocialTool === 'function',
    nobility: !!window.KeloNobility?.open,
    titles: !!window.KeloTitles?.openBook,
    emotes: !!window.KeloSelfInteractionUI?.openEmotes,
  };
  return !!map[tool];
}

async function surfaceState(page) {
  return page.evaluate(() => {
    const selectors = [
      '[role="dialog"]','[aria-modal="true"]','.lx-chat-drawer.open','#kelo-bag','#kelo-builder',
      '#kelo-mount-panel','#kelo-market-v1','#kelo-commerce-dock.show','#kelo-emotes-panel','#kelo-creators-hub','#kelo-studio-live'
    ];
    const visible = el => {
      if (!el?.isConnected) return false;
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > 0 && r.width > 2 && r.height > 2;
    };
    return Array.from(document.querySelectorAll(selectors.join(','))).filter(visible).map(el => ({
      id: el.id || '', cls: String(el.className || '').slice(0,120), role: el.getAttribute('role') || ''
    }));
  });
}

async function hasBadFallback(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('*')).some(el => {
    const text = (el.textContent || '').trim();
    if (!text || text.length > 170) return false;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    const shown = s.display !== 'none' && s.visibility !== 'hidden' && r.width > 2 && r.height > 2;
    return shown && /todav[ií]a cargando|no tiene una pantalla LIVE v[aá]lida|no se pudieron cargar/i.test(text);
  }));
}

async function openMenu(page) {
  const btn = page.locator('.lx-side-menu');
  await expect(btn).toBeVisible({ timeout: 10000 });
  if (!await page.locator('.lx-menu-panel.open').count()) await btn.tap();
  await expect(page.locator('.lx-menu-panel.open')).toBeVisible({ timeout: 5000 });
}

async function closeSurfaces(page) {
  await page.evaluate(() => {
    try { window.KELO_LUXE?.closeChat?.(); } catch(_) {}
    try { window.KELO_LUXE?.closeMenu?.(); } catch(_) {}
    try { window.KeloBackpackUI?.close?.(); } catch(_) {}
    try { window.KeloMountPanel?.close?.(); } catch(_) {}
    try { window.KeloMarketUI?.close?.(); } catch(_) {}
    try { window.KeloSelfInteractionUI?.closeEmotes?.(); } catch(_) {}
    try { window.KeloCharacterCustomizer?.close?.(); } catch(_) {}
    try { window.KeloNobility?.close?.(); } catch(_) {}
    try { window.KeloTitles?.closeBook?.(); } catch(_) {}
    try { window.KELO_HOUSE_UI?.hide?.(); } catch(_) {}
    const stones = document.getElementById('kelo-builder'); if (stones) stones.style.display='none';
  });
  await page.waitForTimeout(120);
}

async function position(page) { return page.evaluate(() => ({x:localPlayer.x,y:localPlayer.y})); }
async function joystickRight(page) {
  const canvas=page.locator('#game-canvas'), box=await canvas.boundingBox();
  if(!box) throw new Error('GAME_CANVAS_NO_BOX');
  const sx=Math.max(32,box.width*.20), sy=Math.min(box.height-90,box.height*.68), ex=Math.min(box.width*.47,sx+95), id=88;
  await canvas.dispatchEvent('pointerdown',{pointerId:id,pointerType:'touch',isPrimary:true,clientX:sx,clientY:sy,buttons:1,button:0,pressure:.5,bubbles:true,cancelable:true});
  for(let i=1;i<=5;i++){await canvas.dispatchEvent('pointermove',{pointerId:id,pointerType:'touch',isPrimary:true,clientX:sx+(ex-sx)*i/5,clientY:sy,buttons:1,pressure:.5,bubbles:true,cancelable:true});await page.waitForTimeout(40);}
  await page.waitForTimeout(650);
  await canvas.dispatchEvent('pointerup',{pointerId:id,pointerType:'touch',isPrimary:true,clientX:ex,clientY:sy,buttons:0,button:0,pressure:0,bubbles:true,cancelable:true});
  await page.waitForTimeout(120);
}

test('major KELO WORLD systems work on a real iPhone', async ({page}) => {
  test.setTimeout(300000);
  fs.mkdirSync('test-results',{recursive:true});
  const report={startedAt:new Date().toISOString(),checks:[],pageErrors:[],consoleErrors:[],requests:[]};
  page.on('pageerror',e=>report.pageErrors.push(String(e?.stack||e)));
  page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
  page.on('requestfailed',r=>report.requests.push(`${r.url()} :: ${r.failure()?.errorText||'failed'}`));

  async function check(name,fn){const t=Date.now();try{const detail=await fn();report.checks.push({name,status:'PASS',ms:Date.now()-t,detail:detail??null});}catch(e){report.checks.push({name,status:'FAIL',ms:Date.now()-t,error:String(e?.stack||e)});}}

  // mapEditor=1 is an explicit QA/developer authorization path; guest still exercises the no-login player path.
  const res=await page.goto('./?guest=1&mapEditor=1&iphoneMajorGameplay=1',{waitUntil:'domcontentloaded',timeout:45000});
  expect(res).not.toBeNull(); expect(res.status()).toBeLessThan(400);
  await page.waitForFunction(()=>!!(window.KeloGuestPlay?.active?.()&&window.KELO_LUXE&&window.KELO_ADMIN_KEYS?.can?.('world.edit')&&document.getElementById('game-canvas')),null,{timeout:30000});

  await check('device.real-iphone-safari',async()=>{
    const d=await page.evaluate(()=>({ua:navigator.userAgent,touch:navigator.maxTouchPoints,w:innerWidth,h:innerHeight,path:location.pathname,guest:window.KeloGuestPlay?.active?.()}));
    expect(d.ua).toMatch(/iPhone|iPod/i); expect(d.touch).toBeGreaterThan(0); expect(d.w).toBeLessThanOrEqual(600); expect(d.h).toBeGreaterThan(d.w); expect(d.path).toMatch(/\/gemini\/?$/); expect(d.guest).toBe(true); return d;
  });
  await check('auth.guest-wall-hidden',async()=>{await expect(page.locator('#kelo-account-auth')).toBeHidden({timeout:10000});return true;});
  await check('render.canvas',async()=>{const c=page.locator('#game-canvas');await expect(c).toBeVisible();const b=await c.boundingBox();expect(b.width).toBeGreaterThan(250);expect(b.height).toBeGreaterThan(400);return b;});
  await check('input.touch-joystick-moves-player',async()=>{const a=await position(page);await joystickRight(page);const b=await position(page);const d=Math.hypot(b.x-a.x,b.y-a.y);expect(d).toBeGreaterThan(8);return{a,b,d};});
  await check('menu.open-close',async()=>{await openMenu(page);expect(await page.locator('.lx-menu-item[data-tool]').count()).toBeGreaterThanOrEqual(ROUTES.length);await page.locator('#lx-menu-close').tap();await expect(page.locator('.lx-menu-panel.open')).toHaveCount(0);});

  for(const [tool,label] of ROUTES){
    await closeSurfaces(page);
    await check(`route.${tool}.${label}`,async()=>{
      expect(await page.evaluate(routeOwnerReady,tool),`${label} owner/API missing`).toBe(true);
      await openMenu(page);
      const button=page.locator(`.lx-menu-item[data-tool="${tool}"]`);await expect(button).toBeVisible({timeout:5000});
      const before=await surfaceState(page);await button.tap();
      if(tool==='bag') await expect(page.locator('#kelo-bag')).toBeVisible({timeout:8000});
      else if(tool==='abilities') await expect(page.locator('#kelo-builder')).toBeVisible({timeout:20000});
      else if(tool==='mounts') await expect(page.locator('#kelo-mount-panel')).toBeVisible({timeout:8000});
      else if(tool==='chat') await expect(page.locator('.lx-chat-drawer.open')).toBeVisible({timeout:8000});
      else if(tool==='emotes') await expect(page.locator('#kelo-emotes-panel')).toBeVisible({timeout:8000});
      else {await page.waitForTimeout(650);expect(await hasBadFallback(page),`${label} returned a not-ready fallback`).toBe(false);const after=await surfaceState(page);expect(JSON.stringify(after),`${label} produced no visible reaction`).not.toBe(JSON.stringify(before));}
      return{before,after:await surfaceState(page)};
    });
  }

  await closeSurfaces(page);
  await check('chat.write-send-close',async()=>{await openMenu(page);await page.locator('.lx-menu-item[data-tool="chat"]').tap();const input=page.locator('#lx-in');await expect(input).toBeVisible();const token=`iphone-${Date.now()}`;await input.fill(token);await page.locator('#lx-form button').tap();await expect(page.locator('#lx-log')).toContainText(token,{timeout:5000});await page.locator('#lx-chat-close').tap();await expect(page.locator('.lx-chat-drawer.open')).toHaveCount(0);return token;});

  await closeSurfaces(page);
  await check('input.recovers-after-menus',async()=>{const a=await position(page);await joystickRight(page);const b=await position(page);const d=Math.hypot(b.x-a.x,b.y-a.y);expect(d).toBeGreaterThan(6);return{a,b,d};});
  await check('pvp.control-and-owner',async()=>{await expect(page.locator('#lx-side-pvp')).toBeVisible();expect(await page.evaluate(()=>typeof window.enterPvPWorld==='function')).toBe(true);});

  await check('creators.authorized-launcher',async()=>{
    await page.waitForFunction(()=>window.KELO_STUDIO_LAUNCHER?.allowed===true,null,{timeout:10000});
    await openMenu(page);window;
    // Launcher sync is permission driven; force its public sync after renderMenu rebuilds the grid.
    await page.evaluate(()=>window.KELO_STUDIO_LAUNCHER?.sync?.());
    const create=page.locator('#lx-create-studio');await expect(create).toBeVisible({timeout:8000});await create.tap();await expect(page.locator('#kelo-creators-hub')).toBeVisible({timeout:20000});
    await expect(page.locator('#kelo-creators-hub [data-workspace="world"]')).toBeVisible({timeout:8000});
    return{launcher:true,hub:true};
  });

  await page.screenshot({path:'test-results/iphone-major-gameplay-final.png',fullPage:true});
  report.finishedAt=new Date().toISOString();report.summary={pass:report.checks.filter(x=>x.status==='PASS').length,fail:report.checks.filter(x=>x.status==='FAIL').length,total:report.checks.length};
  fs.writeFileSync('test-results/iphone-major-gameplay-report.json',JSON.stringify(report,null,2));
  const failures=report.checks.filter(x=>x.status==='FAIL').map(x=>`${x.name}: ${x.error}`);
  expect(failures,`IPHONE MAJOR GAMEPLAY FAILURES:\n${failures.join('\n')}`).toEqual([]);
  expect(report.pageErrors,`Unhandled page errors:\n${report.pageErrors.join('\n')}`).toEqual([]);
});
