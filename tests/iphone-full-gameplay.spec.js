/* KELO-INDEX
 * area: TEST / REAL IPHONE / FULL GAMEPLAY
 * owner: BrowserStack real-iPhone gameplay contract
 * purpose: exercise the majority of player-facing LIVE systems on a physical iPhone/Safari session
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');

const isBrowserStack = Boolean(
  process.env.BROWSERSTACK_USERNAME ||
  process.env.BROWSERSTACK_ACCESS_KEY ||
  process.env.BROWSERSTACK_BUILD_NAME
);

test.skip(!isBrowserStack, 'Full iPhone gameplay contract only runs through BrowserStack');

const REQUIRED_ROUTES = Object.freeze([
  ['bag', 'Mochila', "!!window.KeloBackpackUI?.open"],
  ['abilities', 'Habilidades', "!!window.KeloAbilities?.openStonePanel"],
  ['appearance', 'Apariencia', "!!window.KeloCharacterCustomizer?.open"],
  ['mounts', 'Monturas', "!!window.KeloMountPanel?.open"],
  ['profile', 'Perfil', "typeof window.inspectPlayer === 'function'"],
  ['market', 'Mercado', "!!window.KeloMarketUI?.open"],
  ['chat', 'Chat', "!!window.KELO_LUXE?.closeChat"],
  ['properties', 'Propiedades', "!!window.KELO_HOUSE_UI?.show || typeof window.openSocialTool === 'function'"],
  ['nobility', 'Nobleza', "!!window.KeloNobility?.open"],
  ['titles', 'Libro de títulos', "!!window.KeloTitles?.openBook"],
  ['emotes', 'Burlas', "!!window.KeloSelfInteractionUI?.openEmotes"],
]);

function visible(element) {
  if (!element || !element.isConnected) return false;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 2 && rect.height > 2;
}

async function captureSurfaceState(page) {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll(
      '[role="dialog"], [aria-modal="true"], .lx-chat-drawer, #kelo-bag, #kelo-mount-panel, #kelo-market-v1, #kelo-emotes-panel, #kelo-studio-live'
    ));
    const isVisible = el => {
      if (!el || !el.isConnected) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && rect.width > 2 && rect.height > 2;
    };
    return nodes.filter(isVisible).map(el => ({
      id: el.id || null,
      role: el.getAttribute('role'),
      aria: el.getAttribute('aria-label'),
      cls: String(el.className || '').slice(0, 160),
    }));
  });
}

async function playerPos(page) {
  return page.evaluate(() => ({ x: localPlayer.x, y: localPlayer.y, vx: localPlayer.vx, vy: localPlayer.vy }));
}

async function dragJoystick(page, dx = 95, holdMs = 650) {
  const canvas = page.locator('#game-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('GAME_CANVAS_NO_BOX');
  const startX = Math.max(34, Math.min(box.width * 0.20, box.width * 0.42));
  const startY = Math.max(110, Math.min(box.height * 0.68, box.height - 90));
  const endX = Math.min(startX + dx, box.width * 0.48);
  const id = 73;

  await canvas.dispatchEvent('pointerdown', {
    pointerId: id, pointerType: 'touch', isPrimary: true,
    clientX: startX, clientY: startY, buttons: 1, button: 0, pressure: 0.5,
    bubbles: true, cancelable: true,
  });
  for (let i = 1; i <= 5; i += 1) {
    await canvas.dispatchEvent('pointermove', {
      pointerId: id, pointerType: 'touch', isPrimary: true,
      clientX: startX + (endX - startX) * i / 5, clientY: startY,
      buttons: 1, pressure: 0.5, bubbles: true, cancelable: true,
    });
    await page.waitForTimeout(35);
  }
  await page.waitForTimeout(holdMs);
  await canvas.dispatchEvent('pointerup', {
    pointerId: id, pointerType: 'touch', isPrimary: true,
    clientX: endX, clientY: startY, buttons: 0, button: 0, pressure: 0,
    bubbles: true, cancelable: true,
  });
  await page.waitForTimeout(120);
}

async function openMenu(page) {
  const button = page.locator('.lx-side-menu');
  await expect(button).toBeVisible({ timeout: 10_000 });
  if (!await page.locator('.lx-menu-panel.open').count()) await button.tap();
  await expect(page.locator('.lx-menu-panel.open')).toBeVisible({ timeout: 5_000 });
}

async function closeKnownSurfaces(page) {
  await page.evaluate(() => {
    try { window.KELO_LUXE?.closeChat?.(); } catch (_) {}
    try { window.KELO_LUXE?.closeMenu?.(); } catch (_) {}
    try { window.KeloBackpackUI?.close?.(); } catch (_) {}
    try { window.KeloMountPanel?.close?.(); } catch (_) {}
    try { window.KeloMarketUI?.close?.(); } catch (_) {}
    try { window.KeloSelfInteractionUI?.closeEmotes?.(); } catch (_) {}
    try { window.KeloSelfInteractionUI?.close?.(); } catch (_) {}
    try { window.KeloCharacterCustomizer?.close?.(); } catch (_) {}
    try { window.KeloNobility?.close?.(); } catch (_) {}
    try { window.KeloTitles?.closeBook?.(); } catch (_) {}
    try { window.KeloTitles?.close?.(); } catch (_) {}
    try { window.KELO_HOUSE_UI?.hide?.(); } catch (_) {}
  });
  await page.waitForTimeout(120);
}

async function meaningfulReaction(page, before) {
  await page.waitForTimeout(450);
  const after = await captureSurfaceState(page);
  const beforeKey = JSON.stringify(before);
  const afterKey = JSON.stringify(after);
  const toast = await page.evaluate(() => Array.from(document.querySelectorAll('*')).some(el => {
    const text = (el.textContent || '').trim();
    if (!text || text.length > 160) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return /cargando|todav[ií]a|no tiene una pantalla live v[aá]lida/i.test(text) &&
      style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 2 && rect.height > 2;
  }));
  return { changed: beforeKey !== afterKey, before, after, badFallbackToast: toast };
}

test('real iPhone player-facing systems are actually playable', async ({ page }) => {
  test.setTimeout(300_000);
  fs.mkdirSync('test-results', { recursive: true });

  const report = {
    startedAt: new Date().toISOString(),
    device: null,
    checks: [],
    pageErrors: [],
    consoleErrors: [],
    requestFailures: [],
  };

  page.on('pageerror', error => report.pageErrors.push(String(error?.stack || error)));
  page.on('console', msg => { if (msg.type() === 'error') report.consoleErrors.push(msg.text()); });
  page.on('requestfailed', req => report.requestFailures.push(`${req.url()} :: ${req.failure()?.errorText || 'failed'}`));

  async function check(name, fn, options = {}) {
    const started = Date.now();
    try {
      const detail = await fn();
      report.checks.push({ name, status: 'PASS', ms: Date.now() - started, detail: detail ?? null });
      return true;
    } catch (error) {
      report.checks.push({ name, status: options.soft ? 'WARN' : 'FAIL', ms: Date.now() - started, error: String(error?.stack || error) });
      return false;
    }
  }

  const response = await page.goto('./?guest=1&iphoneFullGameplay=1', {
    waitUntil: 'domcontentloaded', timeout: 45_000,
  });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);

  await page.waitForFunction(() => !!(
    window.KeloGuestPlay?.active?.() &&
    typeof localPlayer !== 'undefined' &&
    typeof input !== 'undefined' &&
    document.getElementById('game-canvas') &&
    window.KELO_LUXE
  ), null, { timeout: 35_000 });

  report.device = await page.evaluate(() => ({
    url: location.href,
    pathname: location.pathname,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    width: innerWidth,
    height: innerHeight,
    dpr: devicePixelRatio,
    coarsePointer: matchMedia('(pointer: coarse)').matches,
    guest: window.KeloGuestPlay?.state?.() || null,
  }));

  await check('01.real-iphone-safari', async () => {
    expect(report.device.pathname).toMatch(/\/gemini\/?$/);
    expect(report.device.userAgent).toMatch(/iPhone|iPod/i);
    expect(report.device.maxTouchPoints).toBeGreaterThan(0);
    expect(report.device.width).toBeLessThanOrEqual(600);
    expect(report.device.height).toBeGreaterThan(report.device.width);
    return report.device;
  });

  await check('02.guest-entry-no-auth-wall', async () => {
    expect(await page.evaluate(() => window.KeloGuestPlay?.active?.())).toBe(true);
    await expect(page.locator('#kelo-account-auth')).toBeHidden({ timeout: 10_000 });
    return { guest: true };
  });

  await check('03.canvas-rendered', async () => {
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    const box = await canvas.boundingBox();
    expect(box.width).toBeGreaterThan(250);
    expect(box.height).toBeGreaterThan(400);
    return box;
  });

  await check('04.touch-movement', async () => {
    const before = await playerPos(page);
    await page.locator('#game-canvas').tap({ position: { x: 60, y: Math.min(420, report.device.height * 0.58) } });
    await dragJoystick(page);
    const after = await playerPos(page);
    const distance = Math.hypot(after.x - before.x, after.y - before.y);
    expect(distance).toBeGreaterThan(8);
    return { before, after, distance };
  });

  await check('05.mobile-menu-open-close', async () => {
    await openMenu(page);
    const entries = await page.locator('.lx-menu-item[data-tool]').count();
    expect(entries).toBeGreaterThanOrEqual(REQUIRED_ROUTES.length);
    await page.locator('#lx-menu-close').tap();
    await expect(page.locator('.lx-menu-panel.open')).toHaveCount(0);
    return { entries };
  });

  for (const [tool, label, ownerExpression] of REQUIRED_ROUTES) {
    await closeKnownSurfaces(page);
    await check(`route.${tool}.${label}`, async () => {
      const ownerReady = await page.evaluate(expr => Function(`return (${expr})`)(), ownerExpression);
      expect(ownerReady, `${label} owner/API missing`).toBe(true);

      await openMenu(page);
      const route = page.locator(`.lx-menu-item[data-tool="${tool}"]`);
      await expect(route, `${label} route missing from menu`).toBeVisible({ timeout: 5_000 });
      const before = await captureSurfaceState(page);
      await route.tap();

      if (tool === 'bag') {
        await expect(page.locator('#kelo-bag')).toBeVisible({ timeout: 7_000 });
      } else if (tool === 'mounts') {
        await expect(page.locator('#kelo-mount-panel')).toBeVisible({ timeout: 7_000 });
      } else if (tool === 'chat') {
        await expect(page.locator('.lx-chat-drawer.open')).toBeVisible({ timeout: 7_000 });
      } else if (tool === 'emotes') {
        await expect(page.locator('#kelo-emotes-panel')).toBeVisible({ timeout: 7_000 });
      } else {
        const reaction = await meaningfulReaction(page, before);
        expect(reaction.badFallbackToast, `${label} only returned a not-ready/fake fallback`).toBe(false);
        expect(reaction.changed, `${label} tap produced no visible UI/state reaction`).toBe(true);
      }

      const after = await captureSurfaceState(page);
      return { ownerReady, before, after };
    });
  }

  await closeKnownSurfaces(page);
  await check('06.chat-type-send-close', async () => {
    await openMenu(page);
    await page.locator('.lx-menu-item[data-tool="chat"]').tap();
    const input = page.locator('#lx-in');
    await expect(input).toBeVisible({ timeout: 5_000 });
    const token = `iphone-${Date.now()}`;
    await input.fill(token);
    await page.locator('#lx-form button').tap();
    await expect(page.locator('#lx-log')).toContainText(token, { timeout: 5_000 });
    await page.locator('#lx-chat-close').tap();
    await expect(page.locator('.lx-chat-drawer.open')).toHaveCount(0);
    return { token };
  });

  await closeKnownSurfaces(page);
  await check('07.self-player-actions-and-emotes', async () => {
    const ready = await page.evaluate(() => !!window.KeloSelfInteractionUI?.open && !!window.KeloSelfInteractionUI?.openEmotes);
    expect(ready).toBe(true);
    await page.evaluate(() => window.KeloSelfInteractionUI.open(innerWidth / 2, innerHeight / 2));
    await expect(page.locator('#kelo-self-actions')).toBeVisible({ timeout: 5_000 });
    await page.locator('#kelo-self-actions .ksi-emotes').tap();
    await expect(page.locator('#kelo-emotes-panel')).toBeVisible({ timeout: 5_000 });
    await page.locator('#kelo-emotes-panel .ke-close').tap();
    return { ready };
  });

  await closeKnownSurfaces(page);
  await check('08.input-recovers-after-ui', async () => {
    const before = await playerPos(page);
    await dragJoystick(page, 80, 500);
    const after = await playerPos(page);
    const distance = Math.hypot(after.x - before.x, after.y - before.y);
    expect(distance).toBeGreaterThan(6);
    return { before, after, distance };
  });

  await check('09.pvp-entry-control-present', async () => {
    const pvp = page.locator('#lx-side-pvp');
    await expect(pvp).toBeVisible({ timeout: 5_000 });
    const ready = await page.evaluate(() => typeof window.enterPvPWorld === 'function');
    expect(ready).toBe(true);
    return { ready };
  });

  await check('10.create-launcher-present', async () => {
    await openMenu(page);
    const create = page.locator('#lx-create-studio');
    await expect(create).toBeVisible({ timeout: 8_000 });
    return { text: await create.innerText() };
  });

  await closeKnownSurfaces(page);
  await page.screenshot({ path: 'test-results/iphone-full-gameplay-final.png', fullPage: true });

  report.finishedAt = new Date().toISOString();
  report.summary = {
    pass: report.checks.filter(x => x.status === 'PASS').length,
    fail: report.checks.filter(x => x.status === 'FAIL').length,
    warn: report.checks.filter(x => x.status === 'WARN').length,
    total: report.checks.length,
  };
  fs.writeFileSync('test-results/iphone-full-gameplay-report.json', JSON.stringify(report, null, 2));

  const failures = report.checks.filter(x => x.status === 'FAIL').map(x => `${x.name}: ${x.error || 'failed'}`);
  expect(failures, `FULL IPHONE GAMEPLAY FAILURES:\n${failures.join('\n')}`).toEqual([]);
  expect(report.pageErrors, `Unhandled page errors: ${report.pageErrors.join('\n')}`).toEqual([]);
});
