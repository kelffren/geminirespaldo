const { test, expect } = require('@playwright/test');
const fs = require('fs');

const PAGES = process.env.KELO_PAGES || 'https://kelffren.github.io/gemini/?v=69';
const EXPECT_TITLE = process.env.KELO_TITLE || 'V5.18';
const EXPECT_CACHE = process.env.KELO_CACHE || 'v=69';

function pos() {
  return { x: localPlayer.x, y: localPlayer.y, vx: localPlayer.vx, vy: localPlayer.vy, zone: window.keloZone || null };
}

test.describe('Kelo World live Pages harness', () => {
  test('boot, version, hero audit, stick/keys movement, cafe button', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    const failed = [];
    const status400 = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('requestfailed', (req) => {
      failed.push(req.url() + ' :: ' + (req.failure() && req.failure().errorText));
    });
    page.on('response', (res) => {
      if (res.status() >= 400) status400.push(res.status() + ' ' + res.url());
    });

    fs.mkdirSync('test-results', { recursive: true });
    const res = await page.goto(PAGES, { waitUntil: 'domcontentloaded', timeout: 30000 });
    expect(res.status()).toBeLessThan(400);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'test-results/boot.png', fullPage: true });

    const title = await page.title();
    const probe = await page.evaluate(() => ({
      title: document.title,
      scripts: Array.from(document.scripts).map((s) => s.src),
      canvasW: document.getElementById('game-canvas') ? document.getElementById('game-canvas').width : 0,
      px: localPlayer.x, py: localPlayer.y,
      zone: window.keloZone || null,
      cafeBtn: !!document.getElementById('kelo-cafe-btn'),
      cafeBtnText: (document.getElementById('kelo-cafe-btn') || {}).textContent || null,
      ruralAudit: window.KELO_RURAL_GROUND_AUDIT || null,
    }));

    await page.waitForFunction(() => {
      const audit = window.KELO_HERO_SPRITE_AUDIT;
      return !!(audit && audit.loaded && (audit.processed || audit.error));
    }, null, { timeout: 5000 });

    const heroAudit = await page.evaluate(() => {
      const a = window.KELO_HERO_SPRITE_AUDIT || null;
      return a ? JSON.parse(JSON.stringify(a)) : null;
    });

    fs.writeFileSync('test-results/boot-report.json', JSON.stringify({
      url: page.url(), httpStatus: res.status(), title,
      titleMatch: title.includes(EXPECT_TITLE),
      cacheHint: probe.scripts.some((s) => s.includes(EXPECT_CACHE)),
      probe, heroAudit, consoleErrors, pageErrors, failedRequests: failed, status400,
    }, null, 2));
    fs.writeFileSync('test-results/hero-audit.json', JSON.stringify(heroAudit, null, 2));

    expect(probe.canvasW).toBeGreaterThan(0);
    expect(probe.ruralAudit && probe.ruralAudit.ready).toBe(true);
    expect(probe.ruralAudit.renderingMode).toBe('authored-nine-slice-v1');
    expect(probe.ruralAudit.plotSize).toBe(96);
    expect(heroAudit).not.toBeNull();
    expect(heroAudit.loaded).toBe(true);
    expect(heroAudit.processed).toBe(true);
    expect(heroAudit.error).toBeNull();
    expect(heroAudit.version).toBe('hero-preprocess-audit-v3');
    expect(heroAudit.croppedOpaquePixelCountByFrame).toHaveLength(16);
    expect(heroAudit.sheetMutationAfterIdle).toBe(heroAudit.whiteKnockoutOpaquePixelCount > 0);
    expect(heroAudit.visibleAlphaMutationAfterIdle).toBe(heroAudit.whiteKnockoutOpaquePixelCount > 0);
    expect(heroAudit.lateralComparedPixelCount).toBeGreaterThan(0);
    expect(heroAudit.row1VsRow2RgbaSimilarityPct).toBeGreaterThanOrEqual(0);
    expect(heroAudit.row1VsRow2RgbaSimilarityPct).toBeLessThanOrEqual(100);
    expect(heroAudit.row1VsMirroredRow2RgbaSimilarityPct).toBeGreaterThanOrEqual(0);
    expect(heroAudit.row1VsMirroredRow2RgbaSimilarityPct).toBeLessThanOrEqual(100);

    const beforeKeys = await page.evaluate(pos);
    await page.keyboard.down('d');
    await page.waitForTimeout(800);
    const afterKeys = await page.evaluate(pos);
    await page.keyboard.up('d');
    await page.waitForTimeout(200);
    const keysMoved = Math.hypot(afterKeys.x - beforeKeys.x, afterKeys.y - beforeKeys.y);
    await page.screenshot({ path: 'test-results/after-keys.png', fullPage: true });

    const box = page.locator('#game-canvas');
    const beforePtr = await page.evaluate(pos);
    const canvasBox = await box.boundingBox();
    const sx = canvasBox.x + canvasBox.width * 0.22;
    const sy = canvasBox.y + canvasBox.height * 0.62;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + 80, sy, { steps: 8 });
    await page.waitForTimeout(800);
    const afterPtr = await page.evaluate(pos);
    await page.mouse.up();
    const ptrMoved = Math.hypot(afterPtr.x - beforePtr.x, afterPtr.y - beforePtr.y);
    await page.screenshot({ path: 'test-results/after-pointer.png', fullPage: true });

    fs.writeFileSync('test-results/move-report.json', JSON.stringify({
      beforeKeys, afterKeys, keysMoved, beforePtr, afterPtr, ptrMoved,
    }, null, 2));

    const cafeCycles = [];
    for (let i = 0; i < 3; i++) {
      const before = await page.evaluate(pos);
      const clicked = await page.evaluate(() => {
        const b = document.getElementById('kelo-cafe-btn');
        if (!b) return false;
        b.click();
        return true;
      });
      await page.waitForTimeout(400);
      const inside = await page.evaluate(pos);
      if (i === 0) await page.screenshot({ path: 'test-results/cafe-inside.png', fullPage: true });
      await page.evaluate(() => {
        const b = document.getElementById('kelo-cafe-btn');
        if (b) b.click();
      });
      await page.waitForTimeout(400);
      const after = await page.evaluate(pos);
      cafeCycles.push({
        clicked, before, inside, after,
        entered: inside.zone === 'cafe',
        exited: after.zone === 'plaza',
        farRoom: inside.y > 2200 || inside.x > 2200,
      });
    }
    await page.screenshot({ path: 'test-results/after-cafe.png', fullPage: true });

    const postBefore = await page.evaluate(pos);
    await page.keyboard.down('s');
    await page.waitForTimeout(700);
    const postAfter = await page.evaluate(pos);
    await page.keyboard.up('s');
    const postMoved = Math.hypot(postAfter.x - postBefore.x, postAfter.y - postBefore.y);
    fs.writeFileSync('test-results/cafe-report.json', JSON.stringify({ cafeCycles, postBefore, postAfter, postMoved }, null, 2));
    await page.screenshot({ path: 'test-results/post-cafe-move.png', fullPage: true });

    expect(title.length).toBeGreaterThan(0);
  });
});
