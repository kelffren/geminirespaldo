/* KELO-INDEX
 * area: TEST / REAL IPHONE / WORLD VISIBLE FLOW
 * owner: BrowserStack iPhone World acceptance
 * purpose: prove the player-visible Menu -> Creators -> World path mounts an interactive Studio, exposes the world viewport, places an object and can close/reopen without black-screening
 * acceptance: no programmatic Creator Hub import/open; all launch transitions use visible touch controls
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');

const isBrowserStack = Boolean(
  process.env.BROWSERSTACK_USERNAME ||
  process.env.BROWSERSTACK_ACCESS_KEY ||
  process.env.BROWSERSTACK_BUILD_NAME
);

test.skip(!isBrowserStack, 'Visible World proof only runs through BrowserStack real iPhone');

async function assertRealIPhone(page) {
  const device = await page.evaluate(() => ({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    width: innerWidth,
    height: innerHeight,
    pathname: location.pathname,
    dpr: devicePixelRatio,
  }));
  expect(device.pathname).toMatch(/\/gemini\/?$/);
  expect(device.userAgent).toMatch(/iPhone|iPod/i);
  expect(device.maxTouchPoints).toBeGreaterThan(0);
  expect(device.width).toBeGreaterThan(250);
  expect(device.width).toBeLessThanOrEqual(600);
  return device;
}

async function objectCount(studio) {
  const text = await studio.locator('.ks-status').textContent().catch(() => '');
  const match = String(text || '').match(/(\d+)\s+objects?/i);
  return match ? Number(match[1]) : 0;
}

async function placeOneObject(page, studio) {
  const before = await objectCount(studio);
  const edit = studio.locator('[data-act="edit-assets"]:visible').first();
  await expect(edit).toBeVisible({ timeout: 10_000 });
  await edit.tap();

  const asset = studio.locator('[data-pane="assets"] [data-asset]:visible').first();
  await expect(asset).toBeVisible({ timeout: 15_000 });
  await asset.tap();
  await expect(studio).toHaveAttribute('data-active-asset', /.+/, { timeout: 5_000 });

  const canvas = page.locator('#game-canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const viewportTap = {
    x: Math.max(40, Math.min(box.width - 40, box.width * 0.5)),
    y: Math.max(120, Math.min(box.height - 180, box.height * 0.42)),
  };
  await canvas.tap({ position: viewportTap });

  await page.waitForFunction(previous => {
    const status = document.querySelector('#kelo-studio-live .ks-status')?.textContent || '';
    const match = status.match(/(\d+)\s+objects?/i);
    return match && Number(match[1]) > previous;
  }, before, { timeout: 15_000 });

  const after = await objectCount(studio);
  expect(after).toBeGreaterThan(before);
  return { before, after, viewportTap };
}

async function openWorldThroughVisibleUI(page, phase, { placeObject = false } = {}) {
  const menu = page.locator('#lx-side-menu');
  await expect(menu).toBeVisible({ timeout: 20_000 });
  await menu.tap();

  const panel = page.locator('#lx-menu-panel');
  await expect(panel).toHaveClass(/open/, { timeout: 10_000 });

  const creators = page.locator('#lx-create-studio');
  await expect(creators).toBeVisible({ timeout: 20_000 });
  await expect(creators).toHaveAttribute('aria-label', /Kelo Creators/i);
  await creators.tap();

  const hub = page.locator('#kelo-creators-hub');
  await expect(hub).toBeVisible({ timeout: 20_000 });

  const world = hub.locator('[data-workspace="world"]');
  await expect(world).toBeVisible({ timeout: 10_000 });
  await expect(world).toContainText(/World/i);

  const startedAt = Date.now();
  await world.tap();

  const studio = page.locator('#kelo-studio-live');
  await expect(studio).toBeVisible({ timeout: 15_000 });
  const chromeMs = Date.now() - startedAt;

  // Chrome hydration happens before the heavier draft import. The historical
  // black viewport came from keeping the opaque loading style until the entire
  // open promise resolved, so require the viewport to be released as soon as
  // the real shell exists.
  await page.waitForFunction(() => {
    const root = document.getElementById('kelo-studio-live');
    return !!(
      root?.dataset?.shellVersion &&
      root.querySelector('.ks-top') &&
      !root.hasAttribute('style')
    );
  }, null, { timeout: 15_000 });

  const earlyViewport = await page.evaluate(() => {
    const root = document.getElementById('kelo-studio-live');
    const canvas = document.getElementById('game-canvas');
    const style = root ? getComputedStyle(root) : null;
    const canvasStyle = canvas ? getComputedStyle(canvas) : null;
    return {
      shellVersion: root?.dataset?.shellVersion || null,
      inlineStyle: root?.getAttribute('style') || null,
      background: style?.backgroundColor || '',
      pointerEvents: style?.pointerEvents || '',
      canvasDisplay: canvasStyle?.display || '',
      canvasWidth: canvas?.getBoundingClientRect().width || 0,
      canvasHeight: canvas?.getBoundingClientRect().height || 0,
    };
  });
  expect(earlyViewport.inlineStyle).toBeNull();
  expect(earlyViewport.canvasDisplay).not.toBe('none');
  expect(earlyViewport.canvasWidth).toBeGreaterThan(250);
  expect(earlyViewport.canvasHeight).toBeGreaterThan(400);

  // A painted loading curtain is not acceptance. Require the actual Studio status
  // and the world-loading marker to clear before calling the editor interactive.
  await expect(studio.locator('.ks-status')).toBeVisible({ timeout: 25_000 });
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading', '1', { timeout: 30_000 });
  await expect(page.locator('#kelo-creators-hub')).toHaveCount(0, { timeout: 10_000 });

  // Prove touch reaches an actual Studio tool, not just the shell.
  const move = studio.locator('[data-mode="move"]:visible').first();
  await expect(move).toBeVisible({ timeout: 10_000 });
  await move.tap();
  await expect(move).toHaveClass(/on/, { timeout: 5_000 });

  const placement = placeObject ? await placeOneObject(page, studio) : null;
  const snapshot = await studio.evaluate(root => ({
    loading: root.dataset.keloWorldLoading || null,
    status: root.querySelector('.ks-status')?.textContent || '',
    activeTool: root.querySelector('.ks-active-tool-value')?.textContent || '',
    position: getComputedStyle(root).position,
    width: root.getBoundingClientRect().width,
    height: root.getBoundingClientRect().height,
    inlineStyle: root.getAttribute('style'),
  }));

  await page.screenshot({ path: `test-results/iphone-world-visible-${phase}.png`, fullPage: true });
  return { studio, chromeMs, snapshot, earlyViewport, placement };
}

test('real iPhone visibly opens World, places an object, closes and reopens it', async ({ page }) => {
  test.setTimeout(180_000);
  fs.mkdirSync('test-results', { recursive: true });

  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('requestfailed', req => failedRequests.push(`${req.url()} :: ${req.failure()?.errorText || 'failed'}`));

  const response = await page.goto('./?guest=1&mapEditor=1&iphoneWorldVisible=1', {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);

  const device = await assertRealIPhone(page);
  await page.waitForFunction(() => !!(
    window.KeloGuestPlay?.active?.() &&
    window.KELO_ADMIN_KEYS?.can?.('world.edit') &&
    window.KELO_LUXE?.toggleMenu &&
    window.KELO_CREATORS_LAUNCHER
  ), null, { timeout: 30_000 });

  const first = await openWorldThroughVisibleUI(page, 'first-open', { placeObject: true });
  expect(first.snapshot.position).toBe('fixed');
  expect(first.snapshot.width).toBeGreaterThan(250);
  expect(first.snapshot.height).toBeGreaterThan(400);
  expect(first.snapshot.inlineStyle).toBeNull();
  expect(first.placement.after).toBeGreaterThan(first.placement.before);

  // Close through the visible Studio control, then repeat the complete visible
  // launcher path. This targets the historical stale-shell/reopen black screen.
  const close = first.studio.locator('[data-act="close"]:visible').first();
  await expect(close).toBeVisible({ timeout: 10_000 });
  await close.tap();
  await expect(page.locator('#kelo-studio-live')).toHaveCount(0, { timeout: 15_000 });

  const second = await openWorldThroughVisibleUI(page, 'second-open');
  expect(second.snapshot.position).toBe('fixed');
  expect(second.snapshot.width).toBeGreaterThan(250);
  expect(second.snapshot.height).toBeGreaterThan(400);
  expect(second.snapshot.inlineStyle).toBeNull();

  const report = {
    device,
    first: {
      chromeMs: first.chromeMs,
      snapshot: first.snapshot,
      earlyViewport: first.earlyViewport,
      placement: first.placement,
    },
    second: {
      chromeMs: second.chromeMs,
      snapshot: second.snapshot,
      earlyViewport: second.earlyViewport,
    },
    pageErrors,
    consoleErrors,
    failedRequests,
  };
  fs.writeFileSync('test-results/iphone-world-visible-report.json', JSON.stringify(report, null, 2));

  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter(row => /CREATOR_WORLD_STUDIO_MOUNT_FAILED|WORLD_EDIT_NOT_READY|WORLD_EDITOR_OPEN_TIMEOUT/.test(row))).toEqual([]);
});