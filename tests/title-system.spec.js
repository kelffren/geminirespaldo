/* KELO-INDEX
 * area: QA / TITLES
 * keys: PLAYWRIGHT TITLES NOBILITY NAMEPLATE MOBILE DEV TITLE BOOK
 * hace: prueba 199→200, equip/unequip, Libro de títulos, panel integrado, nameplate y gate DEV en viewport móvil
 * online: usa fallback local únicamente; autoridad server se cubre en scripts/title-system-audit.js
 */
const { test, expect } = require('@playwright/test');

const BASE = process.env.KELO_TITLE_PAGE || 'http://127.0.0.1:4173/';
function url(dev) { return BASE + (BASE.includes('?') ? '&' : '?') + (dev ? 'titleDev=1' : 'titleDev=0'); }

async function waitFoundation(page) {
  await page.waitForFunction(() => !!(window.KeloTitles && window.KeloPlayerStats && window.KeloNobility && window.KeloActorNameplate && window.KELO_LUXE), null, { timeout: 10000 });
}

test.describe('Kelo Titles foundation', () => {
  test('Libro de títulos abre desde el menú y explica cómo conseguir cada título', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    const response = await page.goto(url(true), { waitUntil: 'domcontentloaded' });
    expect(response.status()).toBeLessThan(400);
    await waitFoundation(page);

    await page.evaluate(() => KELO_LUXE.toggleMenu(true));
    const menuEntry = page.locator('[data-tool="titles"]');
    await expect(menuEntry).toBeVisible();
    await expect(menuEntry).toContainText('Libro de títulos');
    await menuEntry.click();

    const book = page.locator('#kelo-title-book');
    await expect(book).toBeVisible();
    await expect(book).toContainText('LIBRO DE TÍTULOS');
    await expect(book).toContainText('Asesino');
    await expect(book).toContainText('Recolector I');
    await expect(book).toContainText('Forjador I');

    await page.locator('[data-title-book-select="placeholder_gatherer_01"]').click();
    const detail = page.locator('[data-title-book-detail]');
    await expect(detail).toContainText('CÓMO CONSEGUIRLO');
    await expect(detail).toContainText('recolecta 250 recursos');
    await expect(detail).toContainText('PROVISIONAL');
    await expect(detail).toContainText('/ 250');

    await page.locator('[data-title-book-select="placeholder_forgemaster_01"]').click();
    await expect(detail).toContainText('completa 25 forjas válidas');
    await expect(detail).toContainText('/ 25');

    const bounds = await page.locator('.title-book-shell').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(391);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(845);

    await page.locator('#kelo-title-book [data-title-book-close]').last().click();
    await expect(book).toBeHidden();
    expect(pageErrors).toEqual([]);
  });

  test('199→200 desbloquea Asesino una vez, equipa y se refleja en Nobleza/nameplate', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    const response = await page.goto(url(true), { waitUntil: 'domcontentloaded' });
    expect(response.status()).toBeLessThan(400);
    await waitFoundation(page);

    const at199 = await page.evaluate(async () => {
      KeloPlayerStats.dev.set('openWorldPlayerKills', 199);
      const lockedAttempt = await KeloTitles.equip('pvp_assassin');
      return {
        stat: KeloPlayerStats.get('openWorldPlayerKills'),
        progress: KeloTitles.getProgress('pvp_assassin'),
        unlocked: KeloTitles.getUnlocked(),
        lockedAttempt,
        unknown: KeloTitles.getTitle('not-real')
      };
    });
    expect(at199.stat).toBe(199);
    expect(at199.progress.unlocked).toBe(false);
    expect(at199.lockedAttempt.ok).toBe(false);
    expect(at199.lockedAttempt.error).toBe('TITLE_LOCKED');
    expect(at199.unknown).toBeNull();

    const at200 = await page.evaluate(async () => {
      KeloPlayerStats.dev.simulateOpenWorldKill('dev-player-200');
      const equip = await KeloTitles.equip('pvp_assassin');
      const resolved = KeloActorNameplate.resolve(localPlayer);
      const synthetic = KeloActorNameplate.resolve({ name: 'Kelo', nobilityRank: 'king', equippedTitleId: 'pvp_assassin' });
      return {
        stat: KeloPlayerStats.get('openWorldPlayerKills'),
        progress: KeloTitles.getProgress('pvp_assassin'),
        unlocked: KeloTitles.getUnlocked(),
        equip,
        actorTitle: localPlayer.equippedTitleId,
        resolved,
        synthetic
      };
    });
    expect(at200.stat).toBe(200);
    expect(at200.progress.unlocked).toBe(true);
    expect(at200.unlocked.filter((id) => id === 'pvp_assassin')).toHaveLength(1);
    expect(at200.equip.ok).toBe(true);
    expect(at200.actorTitle).toBe('pvp_assassin');
    expect(at200.resolved.title).toBe('Asesino');
    expect(at200.synthetic.nobility).toBe('Rey');
    expect(at200.synthetic.title).toBe('Asesino');

    await page.evaluate(() => KeloNobility.open());
    await page.locator('[data-nob-tab="titles"]').click();
    const titlesPane = page.locator('[data-nob-pane="titles"]');
    await expect(titlesPane).toBeVisible();
    await expect(titlesPane).toContainText('Asesino');
    await expect(titlesPane).toContainText('200');
    await expect(titlesPane).toContainText('Verdugo');
    await expect(titlesPane).toContainText('Equipado');

    const bounds = await page.locator('#kelo-nobility').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(391);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(845);

    const unequipped = await page.evaluate(async () => {
      await KeloTitles.unequip();
      return { id: localPlayer.equippedTitleId, resolved: KeloActorNameplate.resolve(localPlayer) };
    });
    expect(unequipped.id).toBeNull();
    expect(unequipped.resolved.title).toBeNull();
    expect(pageErrors).toEqual([]);
  });

  test('panel cabe en landscape 844×390 y helper DEV no existe fuera del gate', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto(url(true), { waitUntil: 'domcontentloaded' });
    await waitFoundation(page);
    await page.evaluate(() => KeloNobility.open());
    await page.locator('[data-nob-tab="titles"]').click();
    const bounds = await page.locator('#kelo-nobility').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(845);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(391);

    const clean = await page.context().newPage();
    await clean.setViewportSize({ width: 390, height: 844 });
    await clean.goto(url(false), { waitUntil: 'domcontentloaded' });
    await waitFoundation(clean);
    expect(await clean.evaluate(() => !!KeloPlayerStats.dev)).toBe(false);
  });
});
