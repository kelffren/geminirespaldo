const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  fs.mkdirSync('artifacts', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 844, height: 430 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const url = `${process.env.AUDIT_URL}?tree-game-capture=${Date.now()}`;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (!response?.ok()) throw new Error(`LIVE page HTTP ${response?.status()}`);

  const guest = page.getByText('Jugar como invitado', { exact: true });
  await guest.waitFor({ state: 'visible', timeout: 15000 });
  await guest.click({ force: true });
  await page.waitForTimeout(2500);

  // Some auth screens attach the guest handler after first paint. Retry once if still visible.
  if (await guest.isVisible().catch(() => false)) {
    await guest.click({ force: true });
    await page.waitForTimeout(2500);
  }

  await page.waitForFunction(() => typeof localPlayer !== 'undefined' && typeof camera !== 'undefined', null, { timeout: 30000 });
  await page.waitForFunction(() => window.KELO_GENERIC_PROPS?.isAssetReady?.('plazaRoundTree') === true, null, { timeout: 30000 });

  const guestStillVisible = await guest.isVisible().catch(() => false);
  if (guestStillVisible) {
    throw new Error('Guest login overlay remained visible after two real clicks');
  }

  await page.evaluate(() => {
    localPlayer.x = 1375;
    localPlayer.y = 1710;
    localPlayer.vx = 0;
    localPlayer.vy = 0;
    camera.x = 1360;
    camera.y = 1625;
    camera.targetX = 1360;
    camera.targetY = 1625;
    camera.lookOffsetX = 0;
    camera.lookOffsetY = 0;
    if (typeof input !== 'undefined') {
      input.normX = 0;
      input.normY = 0;
      input.touchActive = false;
    }
  });

  await page.waitForTimeout(1600);
  await page.screenshot({ path: 'artifacts/game-arbol-redondo.png', fullPage: false });

  const audit = await page.evaluate(() => {
    const prop = window.KELO_PROP_CONTRACT?.props?.find?.(p => p.id === 'plaza-round-tree-imperial');
    return {
      prop: prop ? { id: prop.id, asset: prop.asset, position: prop.position, size: prop.size } : null,
      assetReady: window.KELO_GENERIC_PROPS?.isAssetReady?.('plazaRoundTree') === true,
      href: location.href
    };
  });
  fs.writeFileSync('artifacts/game-audit.json', JSON.stringify(audit, null, 2));
  console.log(JSON.stringify(audit, null, 2));
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
