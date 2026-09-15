/* KELO-INDEX
 * area: TEST / WORLD EDITOR / FUNCTIONAL PLACEMENT
 * owner: World editor acceptance
 * purpose: prove the visible mobile Creator flow can open World, select an asset, place it on the live canvas, and expose the new entity in Explorer
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');

async function objectCount(studio) {
  const text = await studio.locator('.ks-status').textContent().catch(() => '');
  const match = String(text || '').match(/(\d+)\s+objects?/i);
  return match ? Number(match[1]) : 0;
}

async function openWorld(page) {
  // The game intentionally has a long global boot graph. For this acceptance test
  // we only need the first response committed, then we wait on the exact runtime
  // capabilities required to open World. DOMContentLoaded is not an editor contract.
  await page.goto('./?guest=1&mapEditor=1&worldPlacementFunctional=1', {
    waitUntil: 'commit',
    timeout: 15_000,
  });

  await page.waitForFunction(() => !!(
    window.KeloGuestPlay?.active?.() &&
    window.KELO_ADMIN_KEYS?.can?.('world.edit') &&
    window.KELO_LUXE?.toggleMenu &&
    window.KELO_CREATORS_LAUNCHER
  ), null, { timeout: 45_000 });

  const menu = page.locator('#lx-side-menu');
  await expect(menu).toBeVisible({ timeout: 20_000 });
  await menu.tap();

  const panel = page.locator('#lx-menu-panel');
  await expect(panel).toHaveClass(/open/, { timeout: 10_000 });

  const creators = page.locator('#lx-create-studio');
  await expect(creators).toBeVisible({ timeout: 20_000 });
  await creators.tap();

  const hub = page.locator('#kelo-creators-hub');
  await expect(hub).toBeVisible({ timeout: 20_000 });

  const world = hub.locator('[data-workspace="world"]');
  await expect(world).toBeVisible({ timeout: 10_000 });
  await world.tap();

  const studio = page.locator('#kelo-studio-live');
  await expect(studio).toBeVisible({ timeout: 20_000 });
  await expect(studio.locator('.ks-status')).toBeVisible({ timeout: 30_000 });
  await expect(studio).not.toHaveAttribute('data-kelo-world-loading', '1', { timeout: 40_000 });
  await expect(hub).toHaveCount(0, { timeout: 10_000 });
  return studio;
}

test('mobile World editor places a real asset into the map', async ({ page }) => {
  test.setTimeout(180_000);
  fs.mkdirSync('test-results', { recursive: true });

  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e?.stack || e)));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  const studio = await openWorld(page);
  const beforeObjects = await objectCount(studio);
  const beforeExplorer = await studio.locator('[data-entity]').count();

  const editAssets = studio.locator('[data-act="edit-assets"]:visible').first();
  await expect(editAssets).toBeVisible({ timeout: 10_000 });
  await editAssets.tap();

  const asset = studio.locator('[data-pane="assets"] [data-asset]:visible').first();
  await expect(asset).toBeVisible({ timeout: 20_000 });
  const assetId = await asset.getAttribute('data-asset');
  expect(assetId).toBeTruthy();
  await asset.tap();
  await expect(studio).toHaveAttribute('data-active-asset', String(assetId), { timeout: 5_000 });

  const canvas = page.locator('#game-canvas');
  await expect(canvas).toBeVisible({ timeout: 10_000 });
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const tap = {
    x: Math.max(50, Math.min(box.width - 50, box.width * 0.52)),
    y: Math.max(140, Math.min(box.height - 170, box.height * 0.46)),
  };
  await canvas.tap({ position: tap });

  await page.waitForFunction(previous => {
    const status = document.querySelector('#kelo-studio-live .ks-status')?.textContent || '';
    const match = status.match(/(\d+)\s+objects?/i);
    return !!(match && Number(match[1]) > previous);
  }, beforeObjects, { timeout: 20_000 });

  const afterObjects = await objectCount(studio);
  expect(afterObjects).toBeGreaterThan(beforeObjects);
  await expect.poll(async () => studio.locator('[data-entity]').count(), { timeout: 15_000 })
    .toBeGreaterThan(beforeExplorer);

  const save = studio.locator('[data-act="save"]:visible').first();
  await expect(save).toBeVisible({ timeout: 10_000 });
  await save.tap();

  await page.screenshot({ path: 'test-results/world-placement-functional.png', fullPage: true });
  fs.writeFileSync('test-results/world-placement-functional.json', JSON.stringify({
    assetId,
    beforeObjects,
    afterObjects,
    beforeExplorer,
    afterExplorer: await studio.locator('[data-entity]').count(),
    tap,
    status: await studio.locator('.ks-status').textContent(),
    pageErrors,
    consoleErrors,
  }, null, 2));

  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter(row => /CREATOR_WORLD_STUDIO_MOUNT_FAILED|WORLD_EDIT_NOT_READY|WORLD_EDITOR_OPEN_TIMEOUT/.test(row))).toEqual([]);
});
