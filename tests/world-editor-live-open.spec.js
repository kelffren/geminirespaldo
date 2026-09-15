const { test, expect } = require('@playwright/test');

const PAGES = process.env.KELO_PAGES || 'https://kelffren.github.io/gemini/';

test.describe('Kelo World editor live open contract', () => {
  test('World edit authority lazy-boots in real Chromium on Pages', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    const url = `${PAGES}${PAGES.includes('?') ? '&' : '?'}world-editor-smoke=${Date.now()}`;
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    expect(response && response.status()).toBeLessThan(400);

    const probe = await page.evaluate(async () => {
      const moduleUrl = new URL(`src/creators/adapters/world-creator-adapter.mjs?smoke=${Date.now()}`, location.href).href;
      const adapter = await import(moduleUrl);
      const authority = await adapter.waitForWorldEditAuthority(window, { timeoutMs: 12000 });
      return {
        authorityExists: !!window.KELO_WORLD_EDIT,
        ready: !!authority?.ready,
        version: authority?.version || null,
        source: authority?.authoritySource?.() || null,
        draftStore: !!window.KELO_WORLD_DRAFT_STORE,
        revisionSystem: !!window.KELO_WORLD_REVISIONS,
        localAuthority: typeof window.LocalWorldEditAuthority === 'function',
        audit: window.KELO_WORLD_EDIT_AUDIT || null
      };
    });

    await page.screenshot({ path: 'test-results/world-editor-live-open.png', fullPage: true });
    console.log(JSON.stringify({ probe, pageErrors, consoleErrors }, null, 2));

    expect(probe.authorityExists).toBe(true);
    expect(probe.ready).toBe(true);
    expect(probe.draftStore).toBe(true);
    expect(probe.revisionSystem).toBe(true);
    expect(probe.localAuthority).toBe(true);
    expect(probe.audit && probe.audit.readinessContract).toBe(true);
  });
});
