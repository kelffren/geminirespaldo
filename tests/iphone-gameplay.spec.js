/* KELO-INDEX
 * area: TEST / REAL IPHONE / GAMEPLAY
 * owner: BrowserStack iPhone gameplay smoke
 * purpose: prove LIVE guest entry, real iPhone Safari/touch capability, canvas readiness and touch-joystick player movement
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');

const isBrowserStack = Boolean(
  process.env.BROWSERSTACK_USERNAME ||
  process.env.BROWSERSTACK_ACCESS_KEY ||
  process.env.BROWSERSTACK_BUILD_NAME
);

test.skip(!isBrowserStack, 'Real iPhone gameplay proof only runs through BrowserStack');

function playerPosition(page) {
  return page.evaluate(() => ({
    x: localPlayer.x,
    y: localPlayer.y,
    vx: localPlayer.vx,
    vy: localPlayer.vy,
    input: {
      normX: input.normX,
      normY: input.normY,
      touchActive: input.touchActive,
      touchId: input.touchId,
    },
  }));
}

async function holdTouchJoystickRight(page, holdMs = 900) {
  const canvas = page.locator('#game-canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  const startX = Math.max(24, Math.min(box.width * 0.22, box.width * 0.45));
  const startY = Math.max(80, Math.min(box.height * 0.68, box.height - 80));
  const endX = Math.min(startX + 90, box.width * 0.5);
  const pointerId = 41;

  await canvas.dispatchEvent('pointerdown', {
    pointerId,
    pointerType: 'touch',
    isPrimary: true,
    clientX: startX,
    clientY: startY,
    buttons: 1,
    button: 0,
    pressure: 0.5,
    bubbles: true,
    cancelable: true,
  });

  for (let step = 1; step <= 6; step += 1) {
    const x = startX + ((endX - startX) * step) / 6;
    await canvas.dispatchEvent('pointermove', {
      pointerId,
      pointerType: 'touch',
      isPrimary: true,
      clientX: x,
      clientY: startY,
      buttons: 1,
      pressure: 0.5,
      bubbles: true,
      cancelable: true,
    });
    await page.waitForTimeout(35);
  }

  await page.waitForTimeout(holdMs);
  const held = await playerPosition(page);

  await canvas.dispatchEvent('pointerup', {
    pointerId,
    pointerType: 'touch',
    isPrimary: true,
    clientX: endX,
    clientY: startY,
    buttons: 0,
    button: 0,
    pressure: 0,
    bubbles: true,
    cancelable: true,
  });

  await page.waitForTimeout(150);
  return held;
}

test('real iPhone Safari can enter guest game and move with touch joystick', async ({ page }) => {
  test.setTimeout(120_000);
  fs.mkdirSync('test-results', { recursive: true });

  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('requestfailed', req => failedRequests.push(`${req.url()} :: ${req.failure()?.errorText || 'failed'}`));

  const response = await page.goto('./?guest=1&iphoneGameplay=1', {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);

  await page.waitForFunction(() => !!(
    window.KeloGuestPlay?.active?.() &&
    typeof localPlayer !== 'undefined' &&
    typeof input !== 'undefined' &&
    document.getElementById('game-canvas')
  ), null, { timeout: 30_000 });

  await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#kelo-account-auth')).toBeHidden({ timeout: 15_000 });

  const device = await page.evaluate(() => {
    const gate = document.getElementById('kelo-account-auth');
    const canvas = document.getElementById('game-canvas');
    const rect = canvas.getBoundingClientRect();
    const gateStyle = gate ? getComputedStyle(gate) : null;
    return {
      url: location.href,
      pathname: location.pathname,
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      coarsePointer: matchMedia('(pointer: coarse)').matches,
      canvas: { width: rect.width, height: rect.height },
      guest: window.KeloGuestPlay?.state?.() || null,
      guestDataset: document.documentElement.dataset.keloGuestPlay || null,
      authGateHidden: !gate || gate.hidden || gateStyle?.display === 'none' || gateStyle?.visibility === 'hidden',
    };
  });

  // These assertions prevent a desktop/local Chromium run or wrong Pages root from masquerading as the iPhone proof.
  expect(device.pathname).toMatch(/\/gemini\/?$/);
  expect(device.userAgent).toMatch(/iPhone|iPod/i);
  expect(device.maxTouchPoints).toBeGreaterThan(0);
  expect(device.innerWidth).toBeGreaterThan(250);
  expect(device.innerWidth).toBeLessThanOrEqual(600);
  expect(device.innerHeight).toBeGreaterThan(device.innerWidth);
  expect(device.canvas.width).toBeGreaterThan(250);
  expect(device.canvas.height).toBeGreaterThan(400);
  expect(device.guest?.explicitGuest).toBe(true);
  expect(device.guestDataset).toBe('1');
  expect(device.authGateHidden).toBe(true);

  // A real Playwright tap must work on the live canvas before the held joystick gesture.
  await page.locator('#game-canvas').tap({
    position: {
      x: Math.max(30, device.canvas.width * 0.2),
      y: Math.max(90, device.canvas.height * 0.62),
    },
  });

  const before = await playerPosition(page);
  const held = await holdTouchJoystickRight(page);
  const after = await playerPosition(page);
  const movedWhileHeld = Math.hypot(held.x - before.x, held.y - before.y);
  const movedTotal = Math.hypot(after.x - before.x, after.y - before.y);

  await page.screenshot({ path: 'test-results/iphone-gameplay-after-touch.png', fullPage: true });
  fs.writeFileSync('test-results/iphone-gameplay-report.json', JSON.stringify({
    device,
    before,
    held,
    after,
    movedWhileHeld,
    movedTotal,
    pageErrors,
    consoleErrors,
    failedRequests,
  }, null, 2));

  expect(movedWhileHeld).toBeGreaterThan(8);
  expect(movedTotal).toBeGreaterThan(8);
  expect(after.input.touchActive).toBe(false);
  expect(pageErrors).toEqual([]);
});
