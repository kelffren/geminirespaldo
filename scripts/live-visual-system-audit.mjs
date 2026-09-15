/* KELO-INDEX
 * area: QA
 * keys: LIVE MOBILE VISUAL ANIMATION VFX PROJECTILE SEQUENCE FIREBALL REMOTE DECOUPLING SWORD SWAP SPRITESHEET
 * hace: valida en Pages que las piezas visuales son independientes, Sword Swap anima su activation eye y Fireball conserva gameplay sin resolver visual
 * online: simula el mismo evento semántico que recibe un peer; no falsifica autoridad gameplay
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
fs.mkdirSync('artifacts', { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: chrome, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
const consoleErrors = [];
const failedRequests = [];
const httpErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push(`PAGEERROR: ${e.stack || e.message}`));
page.on('requestfailed', r => failedRequests.push({ url: r.url(), error: r.failure()?.errorText || 'failed' }));
page.on('response', r => { if (r.status() >= 400) httpErrors.push({ status: r.status(), url: r.url() }); });

await page.route(/\/(engine-c\.js|engine-net\.js|src\/abilities\/abilityData\.js|src\/visuals\/[^?]+\.js)(\?|$)/, route => {
  const u = new URL(route.request().url());
  u.searchParams.set('visual-audit-bust', `${Date.now()}-${Math.random()}`);
  route.continue({ url: u.toString() });
});

await page.goto(`${base}?visualLab=1&visual-live-audit=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForFunction(() => window.KELO_VISUAL_AUDIT?.integrationReady === true && window.KeloAbilities?.hotbar?.slots, null, { timeout: 15000 });
await page.waitForTimeout(500);

const boot = await page.evaluate(() => {
  const p = window.localPlayer || (typeof localPlayer !== 'undefined' ? localPlayer : null);
  const fireSlot = window.KeloAbilities.hotbar.slots.findIndex(slot => slot?.abilityKey === 'fireball');
  const layout = p && window.KELO_AVATAR_PRESENTATION?.get(p, p._face || 'down');
  return {
    title: document.title,
    fireSlot,
    lab: !!document.getElementById('kelo-visual-lab'),
    audit: JSON.parse(JSON.stringify(window.KELO_VISUAL_AUDIT)),
    api: {
      asset: !!window.KeloAssetRegistry,
      animation: !!window.KeloAnimation,
      fx: !!window.KeloFX,
      projectile: !!window.KeloProjectileVisuals,
      sfx: !!window.KeloSFX,
      sequence: !!window.KeloSequence,
      profile: !!window.KeloAbilityVisuals,
      anchors: !!window.KeloAnchors,
      eventBus: !!window.KeloVisualEventBus
    },
    player: p ? { x: p.x, y: p.y, radius: p.radius, face: p._face } : null,
    layout
  };
});
if (!/^Kelo World — V\d+/i.test(boot.title)) throw new Error(`unexpected LIVE title ${boot.title}`);
if (boot.fireSlot < 0) throw new Error('Fireball starter slot missing');
if (!boot.lab) throw new Error('Visual Lab did not activate with query flag');
for (const [key, value] of Object.entries(boot.api)) if (!value) throw new Error(`missing public visual API ${key}`);
if (!boot.audit.actorBridgeWrapped || !boot.audit.integrationReady) throw new Error(`visual integration unavailable ${JSON.stringify(boot.audit)}`);
if (!boot.layout || boot.layout.footRootY - boot.layout.physicsRootY !== 10) throw new Error('foot-root contract drifted before visual test');

// Sword Swap pilot: prove the uploaded 3x2 sheet is registered, loads, spawns on the actor,
// stays presentation-only, finishes, and is selectable through the same modular resolver.
const swordSwapSetup = await page.evaluate(async () => {
  const p = window.localPlayer || localPlayer;
  const before = { x: p.x, y: p.y, radius: p.radius };
  const asset = window.KELO_VISUAL_MANIFESTS?.assets?.sword_swap_activation_eye_anim_asset || null;
  const fx = window.KeloFXRegistry?.get('sword_swap_activation_eye_anim') || null;
  const sequence = window.KeloSequenceRegistry?.get('sequence_sword_swap_activation_eye_anim') || null;
  const profile = window.KeloAbilityVisuals?.resolveProfile(11, 'swap_sword') || null;
  const loaded = asset ? await window.KeloAssetRegistry.load('sword_swap_activation_eye_anim_asset') : null;
  const fxId = window.KeloFX?.spawn('sword_swap_activation_eye_anim', {
    actor: p, actorId: p.id, visual: { scale: 1.15, seed: 606 }
  }, { socket: 'head', scale: 1.15, loop: false });
  return {
    before,
    asset: asset && { src: asset.src, frameWidth: asset.frameWidth, frameHeight: asset.frameHeight, columns: asset.columns, rows: asset.rows, frames: asset.frames },
    fx: fx && { type: fx.type, assetId: fx.assetId, frameWidth: fx.frameWidth, frameHeight: fx.frameHeight, columns: fx.columns, rows: fx.rows, frames: fx.frames, fps: fx.fps, duration: fx.duration, loop: fx.loop, space: fx.space, layer: fx.layer, socket: fx.socket },
    sequence: sequence && { id: sequence.id, duration: sequence.duration },
    profile: profile && { id: profile.id, abilityKey: profile.abilityKey, castSequence: profile.castSequence },
    loaded: !!loaded,
    fxId,
    active: window.KeloFX.metrics().active
  };
});
if (!swordSwapSetup.asset || swordSwapSetup.asset.src !== 'assets/fx/sword-swap/activation-eye-anim.PNG') throw new Error(`Sword Swap animated asset path missing ${JSON.stringify(swordSwapSetup)}`);
if (swordSwapSetup.asset.frameWidth !== 512 || swordSwapSetup.asset.frameHeight !== 512 || swordSwapSetup.asset.columns !== 3 || swordSwapSetup.asset.rows !== 2 || swordSwapSetup.asset.frames !== 6) throw new Error(`Sword Swap asset grid contract failed ${JSON.stringify(swordSwapSetup.asset)}`);
if (!swordSwapSetup.fx || swordSwapSetup.fx.type !== 'sprite_animation' || swordSwapSetup.fx.frames !== 6 || swordSwapSetup.fx.fps !== 12 || swordSwapSetup.fx.loop !== false || swordSwapSetup.fx.space !== 'ACTOR' || swordSwapSetup.fx.layer !== 'actorFrontFX' || swordSwapSetup.fx.socket !== 'head') throw new Error(`Sword Swap animated FX contract failed ${JSON.stringify(swordSwapSetup.fx)}`);
if (!swordSwapSetup.sequence || swordSwapSetup.sequence.id !== 'sequence_sword_swap_activation_eye_anim') throw new Error(`Sword Swap sequence missing ${JSON.stringify(swordSwapSetup.sequence)}`);
if (!swordSwapSetup.profile || swordSwapSetup.profile.id !== 'ability_visual_sword_swap_01' || swordSwapSetup.profile.castSequence !== 'sequence_sword_swap_activation_eye_anim') throw new Error(`Sword Swap profile did not prioritize animated eye ${JSON.stringify(swordSwapSetup.profile)}`);
if (!swordSwapSetup.loaded || !swordSwapSetup.fxId || swordSwapSetup.active < 1) throw new Error(`Sword Swap animated eye did not load/spawn ${JSON.stringify(swordSwapSetup)}`);
await page.waitForTimeout(250);
const swordSwapMid = await page.evaluate(() => {
  const p = window.localPlayer || localPlayer;
  return { player: { x: p.x, y: p.y, radius: p.radius }, active: KeloFX.metrics().active };
});
if (swordSwapMid.player.x !== swordSwapSetup.before.x || swordSwapMid.player.y !== swordSwapSetup.before.y || swordSwapMid.player.radius !== swordSwapSetup.before.radius) throw new Error('Sword Swap activation VFX mutated gameplay pose/physics');
if (swordSwapMid.active < 1) throw new Error(`Sword Swap animated eye ended before mid-animation ${JSON.stringify(swordSwapMid)}`);
await page.screenshot({ path: 'artifacts/sword-swap-activation-eye-mobile.png', fullPage: false, scale: 'device' });
await page.waitForTimeout(400);
const swordSwapEnd = await page.evaluate(() => ({ active: KeloFX.metrics().active, missingAssets: [...(KELO_VISUAL_AUDIT.missingAssets || [])] }));
if (swordSwapEnd.active !== 0) throw new Error(`Sword Swap activation VFX did not finish cleanly ${JSON.stringify(swordSwapEnd)}`);
if (swordSwapEnd.missingAssets.length) throw new Error(`Sword Swap activation asset missing on LIVE ${JSON.stringify(swordSwapEnd.missingAssets)}`);

const independent = await page.evaluate(() => {
  const p = window.localPlayer || localPlayer;
  const before = { x: p.x, y: p.y, radius: p.radius };
  const animationId = KeloAnimation.play(p, 'cast_magic_01', { force: true });
  const fxId = KeloFX.spawn('fire_explosion_medium', { origin: { x: p.x + 70, y: p.y }, visual: { seed: 101, scale: 1 } });
  const projectileId = KeloProjectileVisuals.preview('projectile_fire_orb_01', { origin: KeloAnchors.get(p, 'castOrigin'), direction: { x: 1, y: 0 }, gameplay: { speed: 260, range: 180 }, visual: { seed: 102 } });
  const sequenceId = KeloSequence.play('sequence_debug_explosion_reuse', { actor: p, actorId: p.id, origin: { x: p.x - 70, y: p.y }, visual: { seed: 103 } });
  const sfxPlayed = KeloSFX.play('fire_cast_01', { actor: p });
  KeloScreenFX.flash('flash_warm_small');
  return { before, animationId, fxId, projectileId, sequenceId, sfxPlayed };
});
for (const key of ['animationId','fxId','projectileId','sequenceId']) if (!independent[key]) throw new Error(`independent ${key} failed`);
if (!independent.sfxPlayed) throw new Error('independent SFX failed');
await page.waitForTimeout(160);
const afterIndependent = await page.evaluate(() => {
  const p = window.localPlayer || localPlayer;
  return {
    player: { x: p.x, y: p.y, radius: p.radius },
    audit: JSON.parse(JSON.stringify(window.KELO_VISUAL_AUDIT)),
    animation: KeloAnimation.metrics(), fx: KeloFX.metrics(), projectile: KeloProjectileVisuals.metrics(), sequence: KeloSequence.metrics()
  };
});
if (afterIndependent.player.x !== independent.before.x || afterIndependent.player.y !== independent.before.y || afterIndependent.player.radius !== independent.before.radius) throw new Error('visual animation mutated gameplay pose/physics');
if (!(afterIndependent.fx.active > 0 && afterIndependent.projectile.active > 0)) throw new Error(`independent visuals not active ${JSON.stringify(afterIndependent)}`);
await page.screenshot({ path: 'artifacts/visual-lab-independent-mobile.png', fullPage: false, scale: 'device' });

const disabledGameplay = await page.evaluate((fireSlot) => {
  const p = window.localPlayer || localPlayer;
  const slot = KeloAbilities.hotbar.slots[fireSlot];
  KeloAbilityVisuals.setEnabled(false);
  slot.cooldown = 0; p.mana = p.maxMana || 100;
  const colorDisabled = slot.definition.visuals?.color;
  const manaBefore = p.mana;
  const result = KeloAbilities.engine.cast({ slotIndex: fireSlot, direction: { x: 1, y: 0 } });
  return { result, manaBefore, manaAfter: p.mana, cooldown: slot.cooldown, colorDisabled, auditEnabled: KELO_VISUAL_AUDIT.abilityResolverEnabled };
}, boot.fireSlot);
if (!disabledGameplay.result?.valid) throw new Error(`Fireball gameplay failed with visual resolver disabled ${JSON.stringify(disabledGameplay)}`);
if (!(disabledGameplay.manaAfter < disabledGameplay.manaBefore && disabledGameplay.cooldown > 0)) throw new Error(`Fireball gameplay did not spend resource/start cooldown ${JSON.stringify(disabledGameplay)}`);
if (disabledGameplay.colorDisabled === 'rgba(0,0,0,0)') throw new Error('legacy fallback was not restored when visual resolver disabled');
if (disabledGameplay.auditEnabled !== false) throw new Error('visual audit did not record disabled resolver');

const enabledFireball = await page.evaluate((fireSlot) => {
  const p = window.localPlayer || localPlayer;
  const slot = KeloAbilities.hotbar.slots[fireSlot];
  KeloAbilityVisuals.setEnabled(true);
  slot.cooldown = 0; p.mana = p.maxMana || 100;
  const result = KeloAbilities.engine.cast({ slotIndex: fireSlot, direction: { x: 1, y: 0 } });
  return { result, colorEnabled: slot.definition.visuals?.color, profile: KeloAbilityVisuals.resolveProfile(slot.abilityId, slot.abilityKey)?.id || null };
}, boot.fireSlot);
if (!enabledFireball.result?.valid || enabledFireball.profile !== 'ability_visual_fireball_01') throw new Error(`Fireball profile integration failed ${JSON.stringify(enabledFireball)}`);
if (enabledFireball.colorEnabled !== 'rgba(0,0,0,0)') throw new Error(`legacy Fireball primitive not masked during new visual ownership: ${enabledFireball.colorEnabled}`);
await page.waitForTimeout(120);
const fireballRuntime = await page.evaluate(() => ({ audit: JSON.parse(JSON.stringify(KELO_VISUAL_AUDIT)), projectile: KeloProjectileVisuals.metrics(), sequence: KeloSequence.metrics(), animation: KeloAnimation.metrics() }));
if (!(fireballRuntime.projectile.active > 0 || fireballRuntime.sequence.active > 0 || fireballRuntime.animation.active > 0)) throw new Error(`Fireball emitted no modular visuals ${JSON.stringify(fireballRuntime)}`);

const remote = await page.evaluate(() => {
  const remoteActor = { id: 'remote_visual_audit', name: 'Remote Audit', x: localPlayer.x - 80, y: localPlayer.y + 70, vx: 0, vy: 0, radius: 20, hp: 100, maxHp: 100, _face: 'right', _gait: 'idle', gear: { bodyColor: '#777', armorColor: '#aaa', weaponColor: '#fff' } };
  if (window.keloNet?.peers) window.keloNet.peers[remoteActor.id] = remoteActor;
  const context = { actor: remoteActor, actorId: remoteActor.id, castId: 'cast_remote_audit_1', abilityId: 1, abilityKey: 'fireball', origin: { x: remoteActor.x, y: remoteActor.y }, direction: { x: 1, y: 0 }, gameplay: { speed: 300, range: 180, radius: 16 }, visual: { seed: 555, scale: 1 }, remote: true, networkReplay: true, confirmed: true };
  KeloVisualEventBus.emit('CAST_CONFIRMED', context);
  KeloVisualEventBus.emit('PROJECTILE_SPAWNED', { ...context, projectileId: 'p_remote_audit_1' });
  return { animation: KeloAnimation.metrics(), projectile: KeloProjectileVisuals.metrics(), sequence: KeloSequence.metrics() };
});
if (!(remote.projectile.active > 0 && (remote.animation.active > 0 || remote.sequence.active > 0))) throw new Error(`remote semantic event did not enter same visual path ${JSON.stringify(remote)}`);
await page.waitForTimeout(100);
await page.screenshot({ path: 'artifacts/visual-fireball-remote-mobile.png', fullPage: false, scale: 'device' });

const final = await page.evaluate(() => {
  const p = window.localPlayer || localPlayer;
  document.getElementById('kelo-visual-lab')?.remove();
  return {
    audit: JSON.parse(JSON.stringify(window.KELO_VISUAL_AUDIT)),
    presentation: window.KELO_AVATAR_PRESENTATION?.get(p, p._face || 'down'),
    movement: window.KELO_MOVEMENT_AUDIT ? JSON.parse(JSON.stringify(window.KELO_MOVEMENT_AUDIT)) : null,
    profile: KeloAbilityVisuals.resolveProfile(1, 'fireball')?.id,
    swordSwapProfile: KeloAbilityVisuals.resolveProfile(11, 'swap_sword')?.id,
    visualLabApiStillAvailable: !!window.KeloVisualLab,
    stoneSystemVisualKnowledge: ['KeloAnimation','KeloFX','KeloSequence'].some(k => Object.prototype.hasOwnProperty.call(window.KeloStones || {}, k))
  };
});
if (final.audit.missingAssets.length) throw new Error(`unexpected missing visual assets ${JSON.stringify(final.audit.missingAssets)}`);
if (!final.presentation || final.presentation.footRootY - final.presentation.physicsRootY !== 10) throw new Error('foot-root drift after visual runtime');
if (!final.movement || final.movement.version !== 'MOV-plant-audit-v1') throw new Error('movement owner/gait contract missing after visual integration');
if (final.profile !== 'ability_visual_fireball_01') throw new Error('Fireball profile lost');
if (final.swordSwapProfile !== 'ability_visual_sword_swap_01') throw new Error('Sword Swap profile lost');
if (!final.visualLabApiStillAvailable || final.stoneSystemVisualKnowledge) throw new Error(`visual lab/stone decoupling regression ${JSON.stringify(final)}`);

if (consoleErrors.length || failedRequests.length || httpErrors.length) throw new Error(`browser errors ${JSON.stringify({ consoleErrors, failedRequests, httpErrors })}`);
const report = { boot, swordSwapSetup, swordSwapMid, swordSwapEnd, independent, afterIndependent, disabledGameplay, enabledFireball, fireballRuntime, remote, final, consoleErrors, failedRequests, httpErrors };
fs.writeFileSync('artifacts/visual-system-live-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await context.close();
await browser.close();
