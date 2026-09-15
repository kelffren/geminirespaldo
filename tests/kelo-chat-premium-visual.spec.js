/* KELO-INDEX
 * area: TEST / UI / CHAT PREMIUM VISUAL
 * owner: Kelo Chat Premium Visual Judge
 * purpose: browser-level judge for Waze-style bottom sheet, one-message collapsed preview, 50% expansion and KELO keyboard
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');

const BASE_URL = process.env.KELO_CHAT_JUDGE_URL || 'http://127.0.0.1:4173/';

async function snapshotState(page) {
  return page.evaluate(() => {
    const drawer = document.getElementById('lx-chat-drawer');
    const tab = document.getElementById('lx-chat-tab');
    const preview = document.getElementById('kc-latest-preview');
    const log = document.getElementById('lx-log');
    const form = document.getElementById('lx-form');
    const keyboard = document.getElementById('kc-keyboard');
    const style = drawer ? getComputedStyle(drawer) : null;
    const pStyle = preview ? getComputedStyle(preview) : null;
    const lStyle = log ? getComputedStyle(log) : null;
    const fStyle = form ? getComputedStyle(form) : null;
    const kStyle = keyboard ? getComputedStyle(keyboard) : null;
    const rect = drawer?.getBoundingClientRect();
    const previewRect = preview?.getBoundingClientRect();
    return {
      exists: !!drawer,
      open: !!drawer?.classList.contains('open'),
      keyboardOpen: !!drawer?.classList.contains('kc-keyboard-open'),
      ariaExpanded: drawer?.getAttribute('aria-expanded'),
      tabExpanded: tab?.getAttribute('aria-expanded'),
      viewport: { width: innerWidth, height: innerHeight },
      rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom } : null,
      previewRect: previewRect ? { x: previewRect.x, y: previewRect.y, width: previewRect.width, height: previewRect.height } : null,
      drawerPointerEvents: style?.pointerEvents,
      background: style?.backgroundImage || style?.backgroundColor,
      borderTopColor: style?.borderTopColor,
      borderRadius: style?.borderRadius,
      previewDisplay: pStyle?.display,
      logDisplay: lStyle?.display,
      formDisplay: fStyle?.display,
      keyboardDisplay: kStyle?.display,
      latestUser: preview?.querySelector('.kc-preview-user')?.textContent?.trim() || '',
      latestText: preview?.querySelector('.kc-preview-text')?.textContent?.trim() || '',
      duplicateDrawer: document.querySelectorAll('#lx-chat-drawer').length,
      duplicateTab: document.querySelectorAll('#lx-chat-tab').length,
      duplicatePreview: document.querySelectorAll('#kc-latest-preview').length,
      hasGoldHandle: !!tab?.querySelector('.kc-drag-handle'),
      hasChatIcon: !!tab?.querySelector('.kc-chat-icon svg'),
      hasUnreadBadge: !!tab?.querySelector('.kc-unread'),
      keloApi: !!window.KeloChatUI,
      integrationBridge: !!window.KeloChatIntegrationBridge,
    };
  });
}

async function drag(page, locator, deltaY) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Drag surface has no bounding box');
  const x = box.x + box.width * 0.5;
  const y = box.y + Math.min(box.height * 0.5, 40);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + deltaY, { steps: 8 });
  await page.mouse.up();
}

test.describe('KELO Chat premium Waze reference judge', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test('matches the approved premium interaction contract on iPhone-size viewport', async ({ page }) => {
    test.setTimeout(90_000);
    fs.mkdirSync('test-results/chat-premium-judge', { recursive: true });

    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));

    const response = await page.goto(`${BASE_URL}?guest=1&chatPremiumJudge=1&ts=${Date.now()}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    expect(response).not.toBeNull();
    expect(response.status()).toBeLessThan(400);

    await page.waitForFunction(() => !!(
      document.querySelector('#lx-chat-drawer.kc-premium') &&
      document.getElementById('kc-latest-preview') &&
      window.KeloChatUI &&
      window.KeloChatIntegrationBridge
    ), null, { timeout: 30_000 });

    // Feed two synthetic UI-only entries into the REAL existing #lx-log. This
    // does not bypass or replace transport; it only gives the visual judge a
    // deterministic latest-message pair to evaluate.
    await page.evaluate(() => {
      const log = document.getElementById('lx-log');
      const a = document.createElement('div');
      a.textContent = 'Andrea: Primer mensaje de control';
      const b = document.createElement('div');
      b.textContent = 'Duelist_V: Nos vemos en la raid de esta noche!';
      log.append(a, b);
    });
    await page.waitForTimeout(120);

    const collapsed = await snapshotState(page);
    expect(collapsed.exists).toBe(true);
    expect(collapsed.open).toBe(false);
    expect(collapsed.ariaExpanded).toBe('false');
    expect(collapsed.tabExpanded).toBe('false');
    expect(collapsed.duplicateDrawer).toBe(1);
    expect(collapsed.duplicateTab).toBe(1);
    expect(collapsed.duplicatePreview).toBe(1);
    expect(collapsed.hasGoldHandle).toBe(true);
    expect(collapsed.hasChatIcon).toBe(true);
    expect(collapsed.hasUnreadBadge).toBe(true);
    expect(collapsed.keloApi).toBe(true);
    expect(collapsed.integrationBridge).toBe(true);
    expect(collapsed.latestUser).toBe('Duelist_V');
    expect(collapsed.latestText).toBe('Nos vemos en la raid de esta noche!');
    expect(collapsed.previewDisplay).not.toBe('none');
    expect(collapsed.logDisplay).toBe('none');
    expect(collapsed.formDisplay).toBe('none');
    expect(collapsed.keyboardDisplay).toBe('none');
    expect(collapsed.drawerPointerEvents).toBe('none');
    expect(collapsed.rect.bottom).toBeCloseTo(collapsed.viewport.height, -1);
    expect(collapsed.previewRect.width).toBeGreaterThan(300);
    expect(collapsed.borderRadius).toMatch(/2[68]px/);
    expect(collapsed.background).toMatch(/gradient/i);

    await page.screenshot({
      path: 'test-results/chat-premium-judge/collapsed-latest-message.png',
      fullPage: true,
    });

    // The approved interaction is physical: pull the visible latest-message
    // card upward, Waze-style, instead of opening via an artificial API call.
    await drag(page, page.locator('#kc-latest-preview'), -110);
    await expect(page.locator('#lx-chat-drawer')).toHaveClass(/open/, { timeout: 5_000 });
    await page.waitForTimeout(280);

    const expanded = await snapshotState(page);
    expect(expanded.open).toBe(true);
    expect(expanded.ariaExpanded).toBe('true');
    expect(expanded.tabExpanded).toBe('true');
    expect(expanded.previewDisplay).toBe('none');
    expect(expanded.logDisplay).not.toBe('none');
    expect(expanded.formDisplay).not.toBe('none');
    expect(expanded.drawerPointerEvents).toBe('auto');
    expect(expanded.rect.height).toBeLessThanOrEqual(expanded.viewport.height * 0.5 + 2);
    expect(expanded.rect.y).toBeGreaterThanOrEqual(expanded.viewport.height * 0.5 - 2);
    expect(expanded.rect.bottom).toBeCloseTo(expanded.viewport.height, -1);

    // Open the custom keyboard through the real existing input.
    await page.locator('#lx-in').click({ force: true });
    await page.waitForTimeout(80);
    const keyboard = await snapshotState(page);
    expect(keyboard.keyboardOpen).toBe(true);
    expect(keyboard.keyboardDisplay).not.toBe('none');
    await expect(page.locator('#kc-keyboard .kc-key')).toHaveCount(33);
    await expect(page.locator('#kc-keyboard')).toContainText('espacio');
    await expect(page.locator('#kc-keyboard')).toContainText('➤');

    await page.screenshot({
      path: 'test-results/chat-premium-judge/expanded-kelo-keyboard.png',
      fullPage: true,
    });

    // Collapse by dragging the header downward. The world must regain input.
    await drag(page, page.locator('#lx-chat-tab'), 110);
    await page.waitForTimeout(280);
    const closedAgain = await snapshotState(page);
    expect(closedAgain.open).toBe(false);
    expect(closedAgain.logDisplay).toBe('none');
    expect(closedAgain.formDisplay).toBe('none');
    expect(closedAgain.drawerPointerEvents).toBe('none');

    const severeErrors = pageErrors.filter(message => !/favicon|supabase|network|websocket/i.test(message));
    expect(severeErrors, severeErrors.join('\n')).toEqual([]);

    fs.writeFileSync(
      'test-results/chat-premium-judge/report.json',
      JSON.stringify({ reference: 'approved Waze-style KELO chat mockup', collapsed, expanded, keyboard, closedAgain, pageErrors }, null, 2)
    );
  });
});
