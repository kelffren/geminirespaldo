import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
fs.mkdirSync('artifacts', { recursive: true });

async function waitForDeployedMovementSource() {
  const deadline = Date.now() + 120000;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const url = new URL('engine-ac.js', base);
      url.searchParams.set('movement-source-check', String(Date.now()));
      const response = await fetch(url, { cache: 'no-store' });
      last = await response.text();
      const exactPlantSelector = last.includes('const rawPlantFrame = params.get(\'plantFrame\');') &&
        last.includes('rawPlantFrame == null ? NaN : Number(rawPlantFrame)') &&
        last.includes('const DEFAULT_PLANT_FRAME = 2;');
      if (response.ok && last.includes("version: 'MOV-plant-audit-v1'") && exactPlantSelector) return;
    } catch (error) {
      last = String(error && error.message ? error.message : error);
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  throw new Error(`Pages did not expose the exact frame2 plant selector before timeout; last=${last.slice(0, 240)}`);
}

await waitForDeployedMovementSource();

const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

async function runViewport(name, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(`PAGEERROR: ${e.stack || e.message}`));

  await page.route(/\/(engine-ac\.js|engine-ah\.js)(\?|$)/, route => {
    const u = new URL(route.request().url());
    u.searchParams.set('movement-audit-bust', `${Date.now()}-${Math.random()}`);
    route.continue({ url: u.toString() });
  });

  await page.goto(`${base}?movement-live-audit=${name}-${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000
  });

  await page.waitForFunction(() => window.KELO_MOVEMENT_AUDIT?.version === 'MOV-plant-audit-v1', null, { timeout: 10000 });

  async function snap(label) {
    return page.evaluate(sampleLabel => {
      const p = window.localPlayer || (typeof localPlayer !== 'undefined' ? localPlayer : null);
      return {
        label: sampleLabel,
        player: p ? { x: p.x, y: p.y, vx: p.vx || 0, vy: p.vy || 0, face: p._face || null } : null,
        movement: window.KELO_MOVEMENT_AUDIT ? JSON.parse(JSON.stringify(window.KELO_MOVEMENT_AUDIT)) : null
      };
    }, label);
  }

  const samples = [];
  samples.push(await snap('baseline'));
  await page.keyboard.down('d');
  await page.waitForTimeout(220);
  samples.push(await snap('right'));
  await page.keyboard.up('d');
  await page.keyboard.down('a');
  await page.waitForTimeout(220);
  samples.push(await snap('left-reversal'));
  await page.keyboard.up('a');
  await page.waitForTimeout(140);
  samples.push(await snap('release'));

  const [baseline, right, left, release] = samples;
  if (!samples.every(s => s.player && s.movement)) throw new Error(`${name}: incomplete movement samples`);

  const metrics = {
    rightDxPx: right.player.x - baseline.player.x,
    reversalDxPx: left.player.x - right.player.x,
    reversalCountDelta: (release.movement.reversalCount || 0) - (baseline.movement.reversalCount || 0),
    reversalAccidentalIdleDelta: (release.movement.reversalAccidentalIdleCount || 0) - (baseline.movement.reversalAccidentalIdleCount || 0),
    reversalFrameJumpDelta: (release.movement.reversalFrameJumpCount || 0) - (baseline.movement.reversalFrameJumpCount || 0),
    releaseCountDelta: (release.movement.releaseCount || 0) - (baseline.movement.releaseCount || 0),
    plantFrame: release.movement.plantFrame,
    releaseVisualFrame: release.movement.visualFrame,
    releaseStridePhase: release.movement.stridePhase,
    releaseVisualOn: release.movement.visualOn
  };

  if (!(metrics.rightDxPx > 8)) throw new Error(`${name}: RIGHT movement missing ${JSON.stringify(metrics)}`);
  if (!(metrics.reversalDxPx < -8)) throw new Error(`${name}: LEFT reversal movement missing ${JSON.stringify(metrics)}`);
  if (!(metrics.reversalCountDelta >= 1)) throw new Error(`${name}: reversal was not detected ${JSON.stringify(metrics)}`);
  if (metrics.reversalAccidentalIdleDelta !== 0) throw new Error(`${name}: reversal introduced accidental idle ${JSON.stringify(metrics)}`);
  if (metrics.reversalFrameJumpDelta !== 0) throw new Error(`${name}: reversal skipped animation frames ${JSON.stringify(metrics)}`);
  if (!(metrics.releaseCountDelta >= 1)) throw new Error(`${name}: release was not observed ${JSON.stringify(metrics)}`);
  if (metrics.plantFrame !== 2 || metrics.releaseVisualOn || metrics.releaseVisualFrame !== 2 || Math.abs(metrics.releaseStridePhase - 0.5) > 0.0001) {
    throw new Error(`${name}: release did not settle on authored contact candidate ${JSON.stringify(metrics)}`);
  }
  if (errors.length) throw new Error(`${name}: browser errors ${JSON.stringify(errors)}`);

  await page.screenshot({ path: `artifacts/movement-${name}.png`, scale: 'device' });
  await context.close();
  return { name, samples, metrics, errors };
}

const mobile = await runViewport('mobile', {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true
});
const desktop = await runViewport('desktop', {
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false
});

const report = { version: 'lateral-plant-live-v2', sourceContract: 'frame2-null-safe-selector-v1', mobile, desktop };
fs.writeFileSync('artifacts/movement-live-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
