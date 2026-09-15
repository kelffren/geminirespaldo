import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
fs.mkdirSync('artifacts', { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

async function runViewport(name, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(`PAGEERROR: ${e.stack || e.message}`));

  await page.route(/\/engine-h\.js(\?|$)/, route => {
    const u = new URL(route.request().url());
    u.searchParams.set('render-hotpath-audit-bust', `${Date.now()}-${Math.random()}`);
    route.continue({ url: u.toString() });
  });

  let ready = false;
  for (let attempt = 0; attempt < 18 && !ready; attempt++) {
    await page.goto(`${base}?render-hotpath-audit-after=${name}-${Date.now()}-${attempt}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });
    ready = await page.evaluate(() => window.KELO_HD_RENDER?.hotPathAuditVersion === 'legacy-plaza-intercept-removed-v1');
    if (!ready) await page.waitForTimeout(5000);
  }
  if (!ready) throw new Error(`${name}: deployed engine-h removal marker did not become LIVE`);

  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => ({
    title: document.title,
    mode: window.KELO_HD_RENDER?.mode || null,
    auditVersion: window.KELO_HD_RENDER?.hotPathAuditVersion || null,
    legacyPlazaMonkeyPatch: window.KELO_HD_RENDER?.legacyPlazaMonkeyPatch,
    renderHooks: window.KeloRender?.snapshot ? window.KeloRender.snapshot() : null,
    decorationReset: window.KELO_WORLD_DECORATION_RESET === true,
    canvas: (() => {
      const c = document.getElementById('game-canvas');
      return c ? { width:c.width, height:c.height, cssWidth:c.clientWidth, cssHeight:c.clientHeight } : null;
    })()
  }));

  await page.screenshot({ path:`artifacts/render-hotpath-after-${name}.png`, fullPage:false, scale:'device' });
  await context.close();

  if (result.legacyPlazaMonkeyPatch !== false) throw new Error(`${name}: legacy plaza monkey patch still enabled`);
  const before = result.renderHooks?.beforeFrame || [];
  const after = result.renderHooks?.afterFrame || [];
  if (before.some(h => h.owner === 'engine-h:legacy-plaza-fillrect') || after.some(h => h.owner === 'engine-h:legacy-plaza-fillrect')) {
    throw new Error(`${name}: legacy plaza render hook still registered`);
  }
  if (consoleErrors.length) throw new Error(`${name}: browser errors ${JSON.stringify(consoleErrors)}`);
  return { name, ...result, consoleErrors };
}

const mobile = await runViewport('mobile', {
  viewport:{ width:390, height:844 },
  deviceScaleFactor:2,
  isMobile:true,
  hasTouch:true
});

const desktop = await runViewport('desktop', {
  viewport:{ width:1280, height:720 },
  deviceScaleFactor:1,
  isMobile:false,
  hasTouch:false
});

const report = {
  version:'live-render-hotpath-audit-v2',
  mobile,
  desktop,
  legacyHookPresent:false,
  legacyMonkeyPatchPresent:false
};

fs.writeFileSync('artifacts/render-hotpath-live-audit.json', JSON.stringify(report, null, 2));
console.log('LEGACY_PLAZA_INTERCEPT_REMOVAL_MEASUREMENT', JSON.stringify(report));
await browser.close();
