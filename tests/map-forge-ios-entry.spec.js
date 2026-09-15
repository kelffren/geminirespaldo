/* KELO-INDEX
 * area: TEST / MAP FORGE / IOS ENTRY
 * owner: Map Forge iPhone entry smoke
 * purpose: prove exact visible MENÚ → CREATORS → Map Forge touch path in WebKit/iPhone without direct workspace calls
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');

function collectErrors(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  return { pageErrors, consoleErrors };
}

async function tapExactPath(page, screenshotName) {
  fs.mkdirSync('test-results', { recursive: true });
  const menu = page.locator('#lx-side-menu');
  await expect(menu).toBeVisible({ timeout: 10000 });
  await menu.tap();

  const creators = page.locator('#lx-create-studio');
  await expect(creators).toBeVisible({ timeout: 10000 });
  await creators.tap();

  const hub = page.locator('#kelo-creators-hub');
  await expect(hub).toBeVisible({ timeout: 10000 });
  const mapForge = hub.locator('[data-workspace="map-forge"]');
  await expect(mapForge).toBeVisible();
  await expect(mapForge).toBeEnabled();

  const hitTest = await mapForge.evaluate(node => {
    const r = node.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      hitInsideCard: !!hit && (hit === node || node.contains(hit)),
      hitWorkspace: hit?.closest?.('[data-workspace]')?.dataset?.workspace || null,
      pointerEvents: getComputedStyle(node).pointerEvents,
      disabled: !!node.disabled,
    };
  });
  expect(hitTest.pointerEvents).not.toBe('none');
  expect(hitTest.disabled).toBe(false);
  expect(hitTest.hitInsideCard).toBe(true);
  expect(hitTest.hitWorkspace).toBe('map-forge');

  await mapForge.tap();
  const forge = page.locator('#kelo-map-forge');
  await expect(forge).toHaveCount(1, { timeout: 10000 });
  await expect(forge).toBeVisible({ timeout: 10000 });
  await expect(hub).toHaveCount(0, { timeout: 5000 });
  await expect(forge.locator('.kmf-canvas')).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: `test-results/${screenshotName}`, fullPage: true });
}

test('iPhone exact MENÚ to CREATORS to Map Forge tap path', async ({ page }) => {
  const { pageErrors, consoleErrors } = collectErrors(page);
  const response = await page.goto('./?mapEditor=1&iosMapForgeEntry=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
  expect(response.status()).toBeLessThan(400);
  await page.waitForFunction(() => !!(
    window.KeloInputLocks?.acquire &&
    window.KELO_ADMIN_KEYS?.can?.('world.edit')
  ), null, { timeout: 15000 });
  await tapExactPath(page, 'map-forge-ios-exact-entry.png');
  expect(pageErrors).toEqual([]);
  if (consoleErrors.length) console.log('IOS_ENTRY_CONSOLE_ERRORS', JSON.stringify(consoleErrors));
});

test('iPhone normal game URL past auth gate opens Map Forge with visible taps', async ({ page }) => {
  const { pageErrors, consoleErrors } = collectErrors(page);
  let response = await page.goto('./?mapEditor=1&seedCreatorPermission=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
  expect(response.status()).toBeLessThan(400);
  await page.waitForFunction(() => !!window.KELO_ADMIN_KEYS?.can?.('world.edit'), null, { timeout: 15000 });

  response = await page.goto('./?iosMapForgeNormalEntry=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
  expect(response.status()).toBeLessThan(400);
  expect(new URL(page.url()).searchParams.has('mapEditor')).toBe(false);
  await page.waitForFunction(() => !!(
    window.KeloInputLocks?.acquire &&
    window.KELO_ADMIN_KEYS?.can?.('world.edit') &&
    window.KeloAccountAuthUI?.close
  ), null, { timeout: 15000 });
  await page.evaluate(() => window.KeloAccountAuthUI.close());
  await expect(page.locator('#kelo-account-auth')).toBeHidden();
  await tapExactPath(page, 'map-forge-ios-normal-game-entry.png');
  expect(pageErrors).toEqual([]);
  if (consoleErrors.length) console.log('IOS_NORMAL_ENTRY_CONSOLE_ERRORS', JSON.stringify(consoleErrors));
});
