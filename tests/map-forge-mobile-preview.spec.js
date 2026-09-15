/* KELO-INDEX
 * area: TEST / MAP FORGE / MOBILE PREVIEW
 * owner: Map Forge mobile browser smoke
 * purpose: verify Hub launch is independent from generation readiness, plus real preview, visible sprite/scene requirements, reversible exterior handoff, camera focus and session restoration at 390x844
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('Map Forge opens from Creator Hub before a stalled first generation settles', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  const response = await page.goto('./?mapEditor=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
  expect(response.status()).toBeLessThan(400);
  await page.waitForFunction(() => !!(
    window.KeloInputLocks?.acquire &&
    window.KELO_ADMIN_KEYS?.can?.('world.edit')
  ), null, { timeout: 15000 });

  await page.waitForTimeout(1000);
  const recoveredPreview = page.locator('#kelo-map-forge');
  while(await recoveredPreview.count()){
    await recoveredPreview.first().getByRole('button', { name: 'CERRAR', exact: true }).evaluate(button => button.click());
  }
  await expect(recoveredPreview).toHaveCount(0);

  await page.evaluate(async () => {
    const { openCreatorHub } = await import('./src/creators/ui/creator-hub.mjs');
    await openCreatorHub({ root: window });
  });
  await expect(page.locator('#kelo-creators-hub')).toBeVisible();
  await expect(page.locator('#kelo-creators-hub [data-workspace="map-forge"]')).toBeEnabled();

  await page.waitForTimeout(500);
  const recoveredForge = page.locator('#kelo-map-forge');
  while(await recoveredForge.count()){
    await recoveredForge.first().getByRole('button', { name: 'CERRAR', exact: true }).evaluate(button => button.click());
  }
  await expect(recoveredForge).toHaveCount(0);

  await page.evaluate(() => {
    window.__KELO_TEST_REAL_WORKER__ = window.Worker;
    window.Worker = class StalledMapForgeWorker {
      constructor(){ this.onmessage = null; this.onerror = null; }
      postMessage(){}
      terminate(){}
    };
  });

  await page.locator('#kelo-creators-hub [data-workspace="map-forge"]').click();
  const openedForge = page.locator('#kelo-map-forge');
  await expect(openedForge.last()).toBeVisible({ timeout: 2000 });
  await page.waitForTimeout(1500);
  while(await openedForge.count() > 1){
    await openedForge.first().getByRole('button', { name: 'CERRAR', exact: true }).evaluate(button => button.click());
  }
  await expect(openedForge).toHaveCount(1);
  await expect(page.locator('#kelo-creators-hub')).toHaveCount(0, { timeout: 2000 });
  await expect(openedForge.locator('.kmf-canvas')).toBeVisible();
  await expect(openedForge.getByRole('button', { name: 'GENERANDO\u2026' })).toBeVisible();

  await openedForge.getByRole('button', { name: 'CERRAR', exact: true }).click();
  await page.evaluate(() => {
    if(window.__KELO_TEST_REAL_WORKER__)window.Worker = window.__KELO_TEST_REAL_WORKER__;
    delete window.__KELO_TEST_REAL_WORKER__;
  });
  expect(pageErrors).toEqual([]);
});

test('Map Forge real preview exposes scene and sprite requirements, hides before handoff and restores the same candidate', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  fs.mkdirSync('test-results', { recursive: true });

  const response = await page.goto('./?mapEditor=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
  expect(response.status()).toBeLessThan(400);

  await page.waitForFunction(() => !!(
    window.KELO_WORLD_BUILDER?.renderSnapshotPreview &&
    window.KELO_PROPERTY_SYSTEM?.drawPlacements &&
    window.KELO_PROPERTY_CATALOG &&
    window.KeloCamera?.focus &&
    window.KELO_ADMIN_KEYS?.can?.('world.edit')
  ), null, { timeout: 15000 });

  await page.waitForTimeout(1000);
  const recoveredPreview = page.locator('#kelo-map-forge');
  while(await recoveredPreview.count()){
    await recoveredPreview.first().getByRole('button', { name: 'CERRAR', exact: true }).evaluate(button => button.click());
  }
  await expect(recoveredPreview).toHaveCount(0);

  await page.evaluate(async () => {
    const { bootKeloCreators } = await import('./src/creators/creator-entry.mjs');
    const platform = await bootKeloCreators({ root: window });
    window.__KELO_TEST_MAP_FORGE_WORKSPACE__ = await platform.openWorkspace('map-forge');
  });

  const forge = page.locator('#kelo-map-forge');
  await expect(forge).toBeVisible();

  // The product intentionally boots with a random seed and a best-of selector. CI instead uses
  // one exact candidate so visual evidence and arrival-scene expectations are reproducible.
  const fixedSeed = 81746291;
  const seedInput = forge.locator('input[type="number"]').first();
  const selects = forge.locator('select.kmf-select');
  await selects.nth(1).evaluate(select => {
    const option = document.createElement('option');
    option.value = '1';
    option.textContent = 'Best of 1';
    select.append(option);
    select.value = '1';
  });
  await seedInput.fill(String(fixedSeed));
  await forge.getByRole('button', { name: 'GENERAR', exact: true }).click();
  await page.waitForFunction(seed => window.__KELO_TEST_MAP_FORGE_WORKSPACE__?.selected?.metadata?.seed === seed, fixedSeed, { timeout: 30000 });

  await expect(page.getByRole('button', { name: 'VER EN MAPA EXTERIOR' })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'SPRITES NECESARIOS' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'PLAN DE ESCENAS' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'COPIAR COLA DE ARTE' })).toBeVisible();
  await expect(page.locator('#kelo-map-forge .kmf-scene-row')).toHaveCount(await page.locator('#kelo-map-forge .kmf-scene-row').count());
  expect(await page.locator('#kelo-map-forge .kmf-scene-row').count()).toBeGreaterThan(0);
  expect(await page.locator('#kelo-map-forge .kmf-sprite-row').count()).toBeGreaterThan(0);
  await expect(page.locator('#kelo-map-forge .kmf-badge.arrival')).toContainText('LLEGADA');

  await page.waitForFunction(() => {
    const status = document.querySelector('#kelo-map-forge [data-preview-assets]');
    return Number(status?.dataset.previewAssets || 0) > 0;
  }, null, { timeout: 15000 });

  const before = await page.evaluate(async () => {
    const selected = window.__KELO_TEST_MAP_FORGE_WORKSPACE__?.selected;
    return selected ? {
      seed: selected.metadata.seed,
      layoutHash: selected.metadata.layoutHash,
      bounds: selected.worldBounds,
      spawn: selected.spawnPoints?.[0] || null,
      propertyCatalogVersion: window.KELO_PROPERTY_CATALOG?.version || null,
      propertyPreviewRenderer: typeof window.KELO_PROPERTY_SYSTEM?.drawPlacements === 'function',
      snapshotPreviewRenderer: typeof window.KELO_WORLD_BUILDER?.renderSnapshotPreview === 'function',
      spriteManifestVersion: selected.spriteManifest?.version || null,
      uniqueSprites: selected.spriteManifest?.uniqueSprites || 0,
      spriteInstances: selected.spriteManifest?.totalInstances || 0,
      sceneBuildPlanCount: selected.sceneBuildPlan?.length || 0,
      arrivalScenes: (selected.sceneBuildPlan || []).filter(scene => scene.sceneType === 'arrival').length
    } : null;
  });
  expect(before).not.toBeNull();
  expect(before.seed).toBe(fixedSeed);
  expect(before.propertyPreviewRenderer).toBe(true);
  expect(before.snapshotPreviewRenderer).toBe(true);
  expect(before.spriteManifestVersion).toBe('map-forge-sprite-manifest-v2');
  expect(before.uniqueSprites).toBeGreaterThan(0);
  expect(before.spriteInstances).toBeGreaterThan(0);
  expect(before.sceneBuildPlanCount).toBeGreaterThan(0);
  expect(before.arrivalScenes).toBe(1);
  await page.screenshot({ path: 'test-results/map-forge-real-preview-390x844.png', fullPage: true });

  await page.getByRole('button', { name: 'VER EN MAPA EXTERIOR' }).click();
  await expect(forge).toHaveCount(0, { timeout: 1000 });
  await expect(page.locator('.kmf-exterior-status, .kmf-return')).toBeVisible({ timeout: 1500 });
  await expect(page.getByRole('button', { name: 'VOLVER A MAP FORGE' })).toBeVisible({ timeout: 15000 });

  const exterior = await page.evaluate(async () => {
    const selected = window.__KELO_TEST_MAP_FORGE_WORKSPACE__?.selected;
    const runtime = window.KELO_WORLD_BUILDER?.snapshot?.();
    const camera = window.KeloCamera?.snapshot?.();
    const placements = window.KELO_PROPERTY_SYSTEM?.getPlacements?.('parcel:world:editor') || [];
    return {
      seed: selected?.metadata?.seed ?? null,
      layoutHash: selected?.metadata?.layoutHash ?? null,
      bounds: selected?.worldBounds || null,
      viewKind: runtime?.view?.kind || null,
      cellCount: Object.keys(runtime?.cells || {}).length,
      placementCount: placements.length,
      camera: camera ? { x: camera.x, y: camera.y, targetX: camera.targetX, targetY: camera.targetY } : null
    };
  });

  expect(exterior.viewKind).toBe('preview');
  expect(exterior.cellCount).toBeGreaterThan(5000);
  expect(exterior.placementCount).toBeGreaterThan(0);
  expect(exterior.seed).toBe(before.seed);
  expect(exterior.layoutHash).toBe(before.layoutHash);
  expect(exterior.camera).not.toBeNull();
  const b = exterior.bounds;
  expect(exterior.camera.targetX).toBeGreaterThanOrEqual(b.x);
  expect(exterior.camera.targetX).toBeLessThanOrEqual(b.x + b.w);
  expect(exterior.camera.targetY).toBeGreaterThanOrEqual(b.y);
  expect(exterior.camera.targetY).toBeLessThanOrEqual(b.y + b.h);
  await page.screenshot({ path: 'test-results/map-forge-exterior-preview-390x844.png', fullPage: true });

  await page.getByRole('button', { name: 'VOLVER A MAP FORGE' }).click();
  await expect(forge).toBeVisible({ timeout: 10000 });
  const after = await page.evaluate(async () => {
    const selected = window.__KELO_TEST_MAP_FORGE_WORKSPACE__?.selected;
    return selected ? { seed: selected.metadata.seed, layoutHash: selected.metadata.layoutHash } : null;
  });
  expect(after).toEqual({ seed: before.seed, layoutHash: before.layoutHash });
  await expect(page.getByRole('button', { name: 'VER EN MAPA EXTERIOR' })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'SPRITES NECESARIOS' })).toBeVisible();
  await page.screenshot({ path: 'test-results/map-forge-restored-390x844.png', fullPage: true });

  expect(pageErrors).toEqual([]);
});
