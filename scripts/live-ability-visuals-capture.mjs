/* KELO-INDEX
 * area: QA
 * keys: LIVE VISUAL FIREBALL ICE NOVA WIND DASH POISON TRAP SCREENSHOT
 * hace: captura evidencia visual de 4 familias de ability usando las mismas APIs que el juego
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'http://127.0.0.1:8080/';
const chrome = process.env.CHROME_BIN || '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const outDir = process.env.CAPTURE_DIR || '/workspace/artifacts';
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync('/tmp/gemini/artifacts', { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true
});
const page = await context.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push(`PAGEERROR: ${e.stack || e.message}`));

const shot = async (name) => {
  const dataUrl = await page.evaluate(() => document.getElementById('game-canvas').toDataURL('image/png'));
  const dest = `${outDir}/${name}.png`;
  fs.writeFileSync(dest, Buffer.from(dataUrl.split(',')[1], 'base64'));
  fs.copyFileSync(dest, `/tmp/gemini/artifacts/${name}.png`);
  return dest;
};

try {
  await page.goto(`${base}?visualLab=1&ability-visual-capture=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.KELO_VISUAL_AUDIT?.integrationReady === true && window.KeloAbilityVisuals && typeof localPlayer !== 'undefined' && localPlayer, null, { timeout: 25000 });
  await page.evaluate(async () => {
    try { await window.KeloRuntimeBootstrap?.ensure?.(); } catch (e) {}
    try { await window.KeloAbilitiesLoader?.ensure?.(); } catch (e) {}
  });
  await page.waitForTimeout(600);

  const boot = await page.evaluate(() => {
    const p = window.localPlayer || (typeof localPlayer !== 'undefined' ? localPlayer : null);
    const profiles = window.KeloVisualProfileRegistry?.list?.().map(d => d.id) || [];
    return {
      title: document.title,
      x: p.x, y: p.y,
      profiles,
      fire: !!window.KeloAbilityVisuals.resolveProfile(1, 'fireball'),
      ice: !!window.KeloAbilityVisuals.resolveProfile(2, 'ice_nova'),
      dash: !!window.KeloAbilityVisuals.resolveProfile(4, 'wind_dash'),
      trap: !!window.KeloAbilityVisuals.resolveProfile(9, 'poison_trap'),
      fxTypes: (window.KeloFXRegistry?.list?.() || []).map(d => d.type),
      lab: !!document.getElementById('kelo-visual-lab')
    };
  });
  if (!boot.fire || !boot.ice || !boot.dash || !boot.trap) throw new Error('profiles missing ' + JSON.stringify(boot));

  await page.evaluate(() => {
    const lab = document.getElementById('kelo-visual-lab');
    if (lab) lab.style.display = 'none';
    const p = window.localPlayer || (typeof localPlayer !== 'undefined' ? localPlayer : null);
    p._face = 'right';
    if (window.KeloCamera?.setFollow) window.KeloCamera.setFollow(p);
  });
  await page.waitForTimeout(200);
  await shot('00-baseline');

  const fireCtx = () => page.evaluate(() => {
    const p = window.localPlayer || (typeof localPlayer !== 'undefined' ? localPlayer : null);
    const ctx = {
      actor: p, actorId: p.id, abilityId: 1, abilityKey: 'fireball',
      origin: { x: p.x, y: p.y - 8 },
      target: { x: p.x + 220, y: p.y - 8 },
      direction: { x: 1, y: 0 },
      gameplay: { speed: 420, range: 280, radius: 16 },
      visual: { scale: 1, seed: 77 }
    };
    window.KeloAbilityVisuals.playCue(1, 'cast', ctx);
    window.KeloAbilityVisuals.playCue(1, 'projectile', ctx);
    return { x: p.x, y: p.y };
  });

  await fireCtx();
  await page.waitForTimeout(220);
  await shot('01-fireball-travel');
  await page.evaluate(() => {
    const p = window.localPlayer || (typeof localPlayer !== 'undefined' ? localPlayer : null);
    window.KeloAbilityVisuals.playCue(1, 'impact', {
      actor: p, actorId: p.id, abilityId: 1, abilityKey: 'fireball',
      origin: { x: p.x + 70, y: p.y - 8 },
      target: { x: p.x + 70, y: p.y - 8 },
      visual: { scale: 1.15, seed: 91 }
    });
  });
  await page.waitForTimeout(120);
  await shot('02-fireball-impact');
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    const p = window.localPlayer || (typeof localPlayer !== 'undefined' ? localPlayer : null);
    const ctx = {
      actor: p, actorId: p.id, abilityId: 2, abilityKey: 'ice_nova',
      origin: { x: p.x, y: p.y }, target: { x: p.x, y: p.y },
      gameplay: { radius: 130 }, visual: { scale: 1, seed: 11 }
    };
    window.KeloAbilityVisuals.playCue(2, 'cast', ctx);
    window.KeloVisualEventBus.emit('ABILITY_IMPACT', ctx);
  });
  await page.waitForTimeout(160);
  await shot('03-ice-nova-expanding');
  await page.waitForTimeout(180);
  await shot('04-ice-nova-peak');
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const p = window.localPlayer || (typeof localPlayer !== 'undefined' ? localPlayer : null);
    const ctx = {
      actor: p, actorId: p.id, abilityId: 4, abilityKey: 'wind_dash',
      origin: { x: p.x, y: p.y }, target: { x: p.x + 160, y: p.y },
      direction: { x: 1, y: 0 }, visual: { scale: 1.1, seed: 22 }
    };
    window.KeloVisualEventBus.emit('DASH_STARTED', ctx);
  });
  await page.waitForTimeout(110);
  await shot('05-wind-dash');
  await page.evaluate(() => {
    const p = window.localPlayer || (typeof localPlayer !== 'undefined' ? localPlayer : null);
    window.KeloVisualEventBus.emit('DASH_ENDED', {
      actor: p, actorId: p.id, abilityId: 4, abilityKey: 'wind_dash',
      origin: { x: p.x + 40, y: p.y }, target: { x: p.x + 40, y: p.y }
    });
  });
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    const p = window.localPlayer || (typeof localPlayer !== 'undefined' ? localPlayer : null);
    const origin = { x: p.x + 70, y: p.y + 10 };
    window.KeloVisualEventBus.emit('TRAP_PLACED', {
      actor: p, actorId: p.id, abilityId: 9, abilityKey: 'poison_trap',
      origin, target: origin, trapId: 'capture_trap',
      radius: 55, duration: 15, visual: { scale: 1, seed: 33 }
    });
  });
  await page.waitForTimeout(200);
  await shot('06-poison-trap-idle');
  await page.evaluate(() => {
    const p = window.localPlayer || (typeof localPlayer !== 'undefined' ? localPlayer : null);
    const origin = { x: p.x + 70, y: p.y + 10 };
    window.KeloVisualEventBus.emit('TRAP_ARMED', {
      actor: p, actorId: p.id, abilityId: 9, abilityKey: 'poison_trap',
      origin, target: origin, trapId: 'capture_trap'
    });
  });
  await page.waitForTimeout(120);
  await shot('07-poison-trap-armed');
  await page.evaluate(() => {
    const p = window.localPlayer || (typeof localPlayer !== 'undefined' ? localPlayer : null);
    const origin = { x: p.x + 70, y: p.y + 10 };
    window.KeloVisualEventBus.emit('TRAP_TRIGGERED', {
      actor: p, actorId: p.id, abilityId: 9, abilityKey: 'poison_trap',
      origin, target: origin, trapId: 'capture_trap'
    });
  });
  await page.waitForTimeout(80);
  await shot('08-poison-trap-trigger');

  const metrics = await page.evaluate(() => {
    const fx = window.KeloFX?.metrics?.() || null;
    const projectiles = window.KeloProjectileVisuals?.metrics?.() || null;
    const audit = window.KELO_VISUAL_AUDIT;
    return { fx, projectiles, audit, consoleReady: true };
  });

  const report = { ok: true, boot, metrics, consoleErrors: consoleErrors.slice(0, 20) };
  fs.writeFileSync(`${outDir}/ability-visuals-capture.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (consoleErrors.length) console.log('CONSOLE_ERRORS', consoleErrors.length);
} catch (error) {
  await shot('99-error').catch(() => {});
  console.error('CAPTURE_FAILED', error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
