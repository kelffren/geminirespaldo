import fs from 'node:fs';
import { chromium } from 'playwright';

const AUDIT_REVISION = 'live-playability-v2-pre-dcl-real-touch';
const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/?offline=1&qa-live-audit=1';
const executablePath = process.env.CHROME_BIN || '/usr/bin/google-chrome';

fs.mkdirSync('artifacts', { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true
});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error?.message || error)));

function withBust(value) {
  const url = new URL(value);
  url.searchParams.set('playability-audit', `${Date.now()}-${Math.random()}`);
  return url.href;
}

async function waitForCurrentDeployment() {
  const root = new URL(base);
  const markerUrl = new URL('scripts/live-playability-audit.mjs', `${root.origin}${root.pathname}`).href;
  let lastStatus = 0;
  let lastBody = '';
  for (let attempt = 1; attempt <= 24; attempt += 1) {
    try {
      const response = await context.request.get(`${markerUrl}?deploy-check=${Date.now()}-${attempt}`, {
        headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
        timeout: 20_000
      });
      lastStatus = response.status();
      lastBody = await response.text();
      if (response.ok() && lastBody.includes(AUDIT_REVISION)) return { attempt, status: lastStatus, markerUrl };
    } catch (error) {
      lastBody = String(error?.message || error);
    }
    await page.waitForTimeout(5_000);
  }
  throw new Error(`GitHub Pages did not deploy current playability audit marker. status=${lastStatus} body=${lastBody.slice(0, 180)}`);
}

const deployment = await waitForCurrentDeployment();

try {
  // V6.59 deliberately releases gameplay before DOMContentLoaded. Waiting for
  // networkidle/DCL here would call a playable Safari boot "broken".
  await page.goto(withBust(base), { waitUntil: 'commit', timeout: 60_000 });
  await page.waitForFunction(() => (
    typeof localPlayer !== 'undefined' &&
    typeof input !== 'undefined' &&
    typeof processInput === 'function' &&
    document.getElementById('game-canvas')
  ), null, { timeout: 45_000 });
  await page.waitForTimeout(1_000);

  const boot = await page.evaluate(() => {
    const canvas = document.getElementById('game-canvas');
    const rect = canvas?.getBoundingClientRect();
    const style = canvas ? getComputedStyle(canvas) : null;
    const centerStack = document.elementsFromPoint(innerWidth / 2, innerHeight / 2).slice(0, 8).map((el) => ({
      tag: el.tagName,
      id: el.id || null,
      className: typeof el.className === 'string' ? el.className : null
    }));
    return {
      title: document.title,
      readyState: document.readyState,
      rafReleased: window.__keloRAFReleased === true,
      bodyClass: document.body.className,
      canvas: rect ? {
        x: Number(rect.x.toFixed(1)),
        y: Number(rect.y.toFixed(1)),
        width: Number(rect.width.toFixed(1)),
        height: Number(rect.height.toFixed(1)),
        display: style?.display,
        visibility: style?.visibility,
        opacity: style?.opacity
      } : null,
      centerStack
    };
  });

  if (!boot.canvas || boot.canvas.width < 350 || boot.canvas.height < 700 || boot.canvas.display === 'none' || boot.canvas.visibility === 'hidden') {
    throw new Error(`Gameplay canvas is not visibly mounted: ${JSON.stringify(boot)}`);
  }

  await page.screenshot({ path: 'artifacts/live-playable-before.png', fullPage: false });

  const snapshot = () => page.evaluate(() => ({
    x: Number(localPlayer.x),
    y: Number(localPlayer.y),
    vx: Number(localPlayer.vx || 0),
    vy: Number(localPlayer.vy || 0),
    normX: Number(input.normX || 0),
    normY: Number(input.normY || 0),
    touchActive: Boolean(input.touchActive)
  }));

  await page.evaluate(() => {
    window.__KELO_LIVE_TOUCH_AUDIT = [];
    const capture = (event) => {
      window.__KELO_LIVE_TOUCH_AUDIT.push({
        type: event.type,
        x: event.clientX,
        y: event.clientY,
        pointerType: event.pointerType || null,
        defaultPrevented: event.defaultPrevented,
        target: {
          tag: event.target?.tagName || null,
          id: event.target?.id || null,
          className: typeof event.target?.className === 'string' ? event.target.className : null
        }
      });
    };
    window.addEventListener('pointerdown', capture, { capture: true });
    window.addEventListener('pointermove', capture, { capture: true });
  });

  const start = { x: 70, y: 650 };
  const end = { x: 140, y: 650 };
  const hitStack = await page.evaluate(({ x, y }) => document.elementsFromPoint(x, y).slice(0, 10).map((el) => ({
    tag: el.tagName,
    id: el.id || null,
    className: typeof el.className === 'string' ? el.className : null,
    pointerEvents: getComputedStyle(el).pointerEvents
  })), start);
  const before = await snapshot();

  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: start.x, y: start.y, radiusX: 2, radiusY: 2, force: 1, id: 91 }]
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: end.x, y: end.y, radiusX: 2, radiusY: 2, force: 1, id: 91 }]
  });
  await page.waitForTimeout(900);
  const moving = await snapshot();
  const touchEvents = await page.evaluate(() => window.__KELO_LIVE_TOUCH_AUDIT || []);
  await page.screenshot({ path: 'artifacts/live-playable-after.png', fullPage: false });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
  const stopped = await snapshot();

  const moved = Math.hypot(moving.x - before.x, moving.y - before.y);
  const report = {
    auditRevision: AUDIT_REVISION,
    deployment,
    url: page.url(),
    boot,
    start,
    end,
    hitStack,
    touchEvents,
    before,
    moving,
    stopped,
    moved: Number(moved.toFixed(2)),
    pageErrors
  };
  fs.writeFileSync('artifacts/live-playability-report.json', JSON.stringify(report, null, 2));
  console.log('LIVE_PLAYABILITY_MEASUREMENT ' + JSON.stringify(report));

  if (touchEvents.length === 0) throw new Error(`Browser touch never reached the page. hitStack=${JSON.stringify(hitStack)}`);
  if (moved < 8) throw new Error(`LIVE real touch did not move player enough: ${moved.toFixed(2)}px; input=${JSON.stringify(moving)}; hitStack=${JSON.stringify(hitStack)}`);
  if (!(moving.normX > 0.2)) throw new Error(`LIVE processInput did not receive rightward touch direction: normX=${moving.normX}`);
  if (stopped.touchActive) throw new Error('LIVE touchEnd did not release touch state');
  if (pageErrors.length) throw new Error(`LIVE page errors:\n${pageErrors.join('\n')}`);

  console.log(`LIVE_PLAYABILITY_PASS moved=${moved.toFixed(2)}px readyState=${boot.readyState} target=${JSON.stringify(touchEvents[0]?.target || null)}`);
} catch (error) {
  await page.screenshot({ path: 'artifacts/live-playable-failure.png', fullPage: false }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
