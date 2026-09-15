const { test, expect } = require('@playwright/test');
const path = require('node:path');

const root = process.cwd();
const systemCss = path.join(root, 'src/ui/kelo-interface-system.css');
const compatCss = path.join(root, 'src/ui/kelo-interface-compat.css');
const runtimeJs = path.join(root, 'src/ui/kelo-interface-runtime.js');

async function loadSharedInterface(page, body) {
  await page.setContent(`<!doctype html><html><head></head><body>${body}</body></html>`);
  await page.addStyleTag({ path: systemCss });
  await page.addStyleTag({ path: compatCss });
}

async function metric(page, selector) {
  return page.locator(selector).evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      width: rect.width,
      height: rect.height,
      fontFamily: style.fontFamily,
      fontSize: parseFloat(style.fontSize),
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth) || 0,
      backgroundColor: style.backgroundColor,
      opacity: parseFloat(style.opacity),
      transform: style.transform,
      transitionDuration: style.transitionDuration,
    };
  });
}

test('shared UI chrome renders with 44px targets and system software typography', async ({ page }) => {
  await loadSharedInterface(page, `
    <section id="kelo-luxe"><button id="menuClose" class="lx-menu-close">×</button></section>
    <section id="kelo-account-auth"><button id="authPrimary" class="ka-primary">Entrar</button></section>
    <section id="kelo-creators-hub"><button id="creatorClose" class="kc-close">Cerrar</button></section>
    <section id="kelo-profile-18"><button id="profilePrimary" class="kap-primary">Continuar</button></section>
    <section id="kelo-market-v1" class="km-panel"><button id="marketClose" class="km-close">×</button></section>
    <section id="kelo-warehouse" class="kw-panel"><button id="warehouseClose" class="kw-close">×</button></section>
    <section id="kelo-arena-panel"><button id="arenaClose" class="ka-close">×</button></section>
    <section id="kelo-boutique"><button id="boutiqueClose" class="lx-b-close">×</button></section>
    <section id="kelo-house-panel"><button id="housePrimary" class="hi-btn primary">Entrar</button></section>
    <section id="kelo-studio-live"><div class="ks-top"><button id="studioPrimary" class="primary">Save</button><input id="studioSearch" class="ks-search" /></div></section>
  `);

  for (const selector of ['#menuClose','#authPrimary','#creatorClose','#profilePrimary','#marketClose','#warehouseClose','#arenaClose','#boutiqueClose','#housePrimary','#studioPrimary']) {
    const m = await metric(page, selector);
    expect(m.height, `${selector} should have a 44px minimum touch target`).toBeGreaterThanOrEqual(44);
    expect(m.fontFamily.toLowerCase(), `${selector} should not use ornamental serif software typography`).not.toContain('georgia');
    expect(m.fontFamily.toLowerCase()).not.toContain('times new roman');
    expect(m.fontSize, `${selector} should remain readable`).toBeGreaterThanOrEqual(11);
  }

  const search = await metric(page, '#studioSearch');
  expect(search.height, 'Studio search should use the same 44px control tier').toBeGreaterThanOrEqual(44);

  await page.evaluate(() => document.activeElement?.blur?.());
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('Tab');
  await expect(page.locator('#marketClose')).toBeFocused();
  const focusStyle = await page.locator('#marketClose').evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      focusVisible: el.matches(':focus-visible'),
      style: style.outlineStyle,
      width: parseFloat(style.outlineWidth) || 0,
    };
  });
  expect(focusStyle.focusVisible).toBe(true);
  expect(focusStyle.style).not.toBe('none');
  expect(focusStyle.width).toBeGreaterThanOrEqual(2);
});

test('Asset Repairer defaults to a calm task path and reveals advanced tools on demand', async ({ page }) => {
  await loadSharedInterface(page, `
    <section id="kelo-asset-repairer">
      <header class="kar-top">
        <div class="kar-title"><small>old subtitle</small></div>
        <div class="kar-step"><span>1</span><span>2</span><span>3</span><span>4</span></div>
        <div class="kar-actions">
          <button class="kar-btn" data-act="reset">RESET</button>
          <button class="kar-btn" data-act="undo">UNDO</button>
          <button class="kar-btn primary" data-act="open">OPEN</button>
          <button class="kar-btn" data-repair-close>CLOSE</button>
        </div>
      </header>
      <aside class="kar-tools">
        <div class="kar-kicker">TOOLS</div>
        <button class="kar-tool" data-tool="auto"><b>✦</b><strong>AUTO</strong><small>auto</small></button>
        <button class="kar-tool" data-tool="align"><b>↕</b><strong>ALIGN</strong><small>align</small></button>
        <button class="kar-tool" data-tool="background"><b>◇</b><strong>BG</strong><small>bg</small></button>
        <button class="kar-tool" data-tool="edges"><b>◈</b><strong>EDGES</strong><small>edges</small></button>
        <button class="kar-tool" data-tool="pivot"><b>⌖</b><strong>PIVOT</strong><small>pivot</small></button>
        <button class="kar-tool" data-tool="scale"><b>⤢</b><strong>SCALE</strong><small>scale</small></button>
        <button class="kar-tool" data-tool="seams"><b>⌗</b><strong>SEAMS</strong><small>seams</small></button>
      </aside>
      <main><div class="kar-stage-head"><h2>WORKSPACE</h2></div></main>
      <button class="kar-btn primary" data-act="export" disabled>EXPORT</button>
    </section>
  `);
  await page.addScriptTag({ path: runtimeJs });
  await expect(page.locator('#kelo-asset-repairer')).toHaveAttribute('data-kui-enhanced','true');

  await expect(page.locator('[data-act="open"]')).toHaveText('Open Asset');
  await expect(page.locator('[data-tool="auto"] strong')).toHaveText('Auto Repair');
  await expect(page.locator('[data-tool="align"] strong')).toHaveText('Align Frames');
  await expect(page.locator('[data-kui-more-tools]')).toHaveText('More Tools');
  await expect(page.locator('[data-tool="background"]')).toBeHidden();
  await expect(page.locator('[data-tool="seams"]')).toBeHidden();
  await expect(page.locator('[data-tool="auto"]')).toBeDisabled();
  await expect(page.locator('[data-act="reset"]')).toBeDisabled();

  await page.locator('[data-kui-more-tools]').click();
  await expect(page.locator('[data-tool="background"]')).toBeVisible();
  await expect(page.locator('[data-tool="seams"]')).toBeVisible();
  await expect(page.locator('[data-kui-more-tools]')).toHaveAttribute('aria-expanded','true');

  await page.locator('[data-act="export"]').evaluate((el) => { el.disabled = false; });
  await page.evaluate(() => window.KELO_INTERFACE_RUNTIME.scan());
  await expect(page.locator('#kelo-asset-repairer')).toHaveAttribute('data-kui-has-asset','true');
  await expect(page.locator('[data-tool="auto"]')).toBeEnabled();
  await expect(page.locator('[data-act="reset"]')).toBeEnabled();

  const primary = await metric(page, '[data-act="open"]');
  expect(primary.height, 'Asset Repairer primary action should meet the shared 44px target').toBeGreaterThanOrEqual(44);
  expect(primary.fontFamily.toLowerCase()).not.toContain('georgia');
});

test('mobile interaction behavior stays calm, readable and state-aware', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await loadSharedInterface(page, `
    <section id="kelo-account-auth">
      <input id="mobileEmail" class="ka-input" type="email" />
      <button id="mobilePrimary" class="ka-primary">Continue</button>
      <button id="mobileSecondary" class="ka-secondary">Later</button>
      <button id="mobileDisabled" class="ka-secondary" disabled>Unavailable</button>
    </section>
  `);
  await page.addScriptTag({ path: runtimeJs });

  const input = await metric(page, '#mobileEmail');
  expect(input.fontSize, 'mobile forms should not trigger iOS focus zoom').toBeGreaterThanOrEqual(16);

  const disabled = await metric(page, '#mobileDisabled');
  expect(disabled.opacity, 'disabled controls should be visibly de-emphasized').toBeLessThanOrEqual(.45);
  expect(disabled.transform, 'disabled controls should not look pressed or animated').toBe('none');

  const primary = await metric(page, '#mobilePrimary');
  const secondary = await metric(page, '#mobileSecondary');
  expect(primary.backgroundColor, 'primary and secondary actions need clear visual hierarchy').not.toBe(secondary.backgroundColor);

  const durationValues = primary.transitionDuration.split(',').map(value => parseFloat(value) || 0);
  expect(Math.max(...durationValues), 'reduced-motion users should get near-instant UI transitions').toBeLessThanOrEqual(.001);
});

test('dynamic UI mutation bursts are coalesced into very few full interface scans', async ({ page }) => {
  await loadSharedInterface(page, '<main id="mutationHost"></main>');
  await page.addScriptTag({ path: runtimeJs });
  const before = await page.evaluate(() => window.KELO_INTERFACE_RUNTIME.snapshot());

  await page.evaluate(() => new Promise((resolve) => {
    const host = document.querySelector('#mutationHost');
    let finished = 0;
    for (let i = 0; i < 30; i += 1) {
      setTimeout(() => {
        const node = document.createElement('span');
        node.textContent = String(i);
        host.appendChild(node);
        finished += 1;
        if (finished === 30) requestAnimationFrame(() => requestAnimationFrame(resolve));
      }, 0);
    }
  }));

  const after = await page.evaluate(() => window.KELO_INTERFACE_RUNTIME.snapshot());
  const callbacks = after.observerCallbacks - before.observerCallbacks;
  const scans = after.scanRuns - before.scanRuns;
  expect(callbacks, 'the observer should see the mutation burst').toBeGreaterThan(0);
  expect(scans, 'the runtime should coalesce mutation work by frame').toBeLessThanOrEqual(2);
  expect(scans).toBeLessThanOrEqual(callbacks);
});
