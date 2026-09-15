/* KELO-INDEX
 * area: TEST / REAL IPHONE / VISIBLE GUEST
 * owner: BrowserStack iPhone acceptance
 * purpose: prove the human-visible "Jugar como invitado" flow on a fresh real iPhone Safari session
 * acceptance: visible auth -> tap guest -> gameplay -> auth gate stays closed without ?guest=1 bypass
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');

const isBrowserStack = Boolean(
  process.env.BROWSERSTACK_USERNAME ||
  process.env.BROWSERSTACK_ACCESS_KEY ||
  process.env.BROWSERSTACK_BUILD_NAME
);

test.skip(!isBrowserStack, 'Visible Guest proof only runs through BrowserStack real iPhone');

async function readDevice(page) {
  return page.evaluate(() => ({
    url: location.href,
    pathname: location.pathname,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    guest: window.KeloGuestPlay?.state?.() || null,
    guestActive: !!window.KeloGuestPlay?.active?.(),
    guestDataset: document.documentElement.dataset.keloGuestPlay || null,
    authGateHidden: (() => {
      const gate = document.getElementById('kelo-account-auth');
      if (!gate) return true;
      const style = getComputedStyle(gate);
      return gate.hidden || style.display === 'none' || style.visibility === 'hidden';
    })(),
    canvasReady: !!document.getElementById('game-canvas'),
    playerReady: typeof localPlayer !== 'undefined',
  }));
}

test('fresh real iPhone can tap visible Jugar como invitado and remain in gameplay', async ({ page, context }) => {
  test.setTimeout(120_000);
  fs.mkdirSync('test-results', { recursive: true });

  const pageErrors = [];
  const failedRequests = [];
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
  page.on('requestfailed', req => failedRequests.push(`${req.url()} :: ${req.failure()?.errorText || 'failed'}`));

  await context.clearCookies();
  let response = await page.goto('./?iphoneVisibleGuest=1', {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);

  // Force a genuinely fresh browser identity for this origin without using the
  // production ?guest=1 shortcut. The second navigation is the acceptance run.
  await page.evaluate(() => {
    try { localStorage.clear(); } catch (_) {}
    try { sessionStorage.clear(); } catch (_) {}
  });
  await context.clearCookies();

  response = await page.goto(`./?iphoneVisibleGuest=1&fresh=${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);

  const gate = page.locator('#kelo-account-auth');
  await expect(gate).toBeVisible({ timeout: 30_000 });

  const guestButton = gate.locator('[data-action="guest"]');
  await expect(guestButton).toBeVisible({ timeout: 15_000 });
  await expect(guestButton).toContainText(/Jugar como invitado/i);

  const before = await readDevice(page);
  expect(before.pathname).toMatch(/\/gemini\/?$/);
  expect(before.userAgent).toMatch(/iPhone|iPod/i);
  expect(before.maxTouchPoints).toBeGreaterThan(0);
  expect(before.innerWidth).toBeGreaterThan(250);
  expect(before.innerWidth).toBeLessThanOrEqual(600);
  expect(before.guestActive).toBe(false);

  // Real touch action through the visible human UI. Supabase anonymous auth may
  // reload; if it is unavailable, KeloGuestPlay falls back to local Guest.
  await guestButton.tap();

  await page.waitForFunction(() => {
    const gate = document.getElementById('kelo-account-auth');
    const style = gate ? getComputedStyle(gate) : null;
    const hidden = !gate || gate.hidden || style?.display === 'none' || style?.visibility === 'hidden';
    return !!(
      window.KeloGuestPlay?.active?.() &&
      hidden &&
      document.documentElement.dataset.keloGuestPlay === '1' &&
      document.getElementById('game-canvas') &&
      typeof localPlayer !== 'undefined'
    );
  }, null, { timeout: 45_000 });

  // The original bug was a gate/session race. Stay in gameplay long enough to
  // prove the gate does not simply reopen after the first transition.
  await page.waitForTimeout(4_000);
  await expect(gate).toBeHidden({ timeout: 10_000 });

  const after = await readDevice(page);
  expect(after.guestActive).toBe(true);
  expect(after.guestDataset).toBe('1');
  expect(after.authGateHidden).toBe(true);
  expect(after.canvasReady).toBe(true);
  expect(after.playerReady).toBe(true);
  expect(after.guest?.anonymous || after.guest?.local).toBe(true);
  expect(after.guest?.explicitGuest).toBe(false);

  await page.screenshot({ path: 'test-results/iphone-visible-guest-pass.png', fullPage: true });
  fs.writeFileSync('test-results/iphone-visible-guest-report.json', JSON.stringify({
    before,
    after,
    pageErrors,
    failedRequests,
  }, null, 2));

  expect(pageErrors).toEqual([]);
});
