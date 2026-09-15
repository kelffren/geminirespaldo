/* KELO-INDEX
 * area: QA
 * keys: MELEE VISUAL TEST HIT MISS DIRECTION GAMEPLAY DECOUPLING MOBILE 8WAY SKIN-AGNOSTIC PERCEPTIBLE IMPACT ALIGNMENT
 * hace: valida en Node el contrato visual melee, sus 8 direcciones, amplitud corporal perceptible y que no mute gameplay
 * online: prueba eventos semánticos; no introduce autoridad visual sobre daño/cooldown
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
function source(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function run(rel, sandbox) { vm.runInContext(source(rel), sandbox, { filename: rel }); }

class FakeParam { setValueAtTime() {} exponentialRampToValueAtTime() {} }
class FakeOscillator { constructor() { this.frequency = new FakeParam(); this.type = 'sine'; } connect() {} start() {} stop() {} }
class FakeGain { constructor() { this.gain = new FakeParam(); } connect() {} }
class FakeAudioContext {
  constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
  createOscillator() { return new FakeOscillator(); }
  createGain() { return new FakeGain(); }
  resume() { return Promise.resolve(); }
}
class FakeImage {
  constructor() { this.width = 128; this.height = 128; this.naturalWidth = 128; this.naturalHeight = 128; this.decoding = 'async'; }
  set src(value) { this._src = value; setTimeout(() => { if (this.onload) this.onload(); }, 0); }
  get src() { return this._src; }
}
class FakeAudio { addEventListener() {} load() {} cloneNode() { return this; } play() { return Promise.resolve(); } }

async function main() {
  let clock = 1000;
  const sandbox = {
    console, URLSearchParams,
    performance: { now: () => clock },
    setTimeout, clearTimeout, setInterval, clearInterval,
    Image: FakeImage, Audio: FakeAudio, AudioContext: FakeAudioContext,
    location: { search: '' }, innerWidth: 390, innerHeight: 844,
    document: { readyState: 'loading', addEventListener() {}, body: null, hidden: false },
    addEventListener() {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  [
    'src/visuals/visual-system.js',
    'src/visuals/visual-manifests.js',
    'src/visuals/asset-registry.js',
    'src/visuals/animation-system.js',
    'src/visuals/fx-system.js',
    'src/visuals/sequence-system.js',
    'src/visuals/melee-visual-manifest.js',
    'src/visuals/melee-combat-visuals.js'
  ].forEach(rel => run(rel, sandbox));

  const manifest = sandbox.KELO_MELEE_VISUAL_MANIFEST;
  assert(manifest, 'melee manifest must boot');
  assert.strictEqual(manifest.attackDurationMs, 330, 'attack duration drifted');
  assert.strictEqual(manifest.impactAtMs, 90, 'body impact timing must stay aligned to opener hit');
  assert.strictEqual(Object.keys(manifest.attackClips).length, 8, 'eight directional attack clips required');
  assert.strictEqual(Object.keys(manifest.reactionClips).length, 8, 'eight directional reaction clips required');
  assert.strictEqual(Object.keys(manifest.slashAssets).length, 8, 'eight directional slash assets required');
  assert.strictEqual(manifest.anchorSocket, 'center', 'universal melee must use generic center anchor');
  assert.strictEqual(manifest.skinAgnostic, true, 'melee manifest must declare skin independence');
  assert.strictEqual(manifest.directions.length, 8, 'manifest must expose eight presentation directions');
  assert(manifest.perceptualMotion && manifest.perceptualMotion.impactAligned === true, 'perceptual body-motion contract missing');
  assert(sandbox.KeloScreenFX.get('impact_melee_light'), 'light melee shake missing');
  assert(sandbox.KeloScreenFX.get('flash_melee_light'), 'light melee flash missing');

  const rightClip = sandbox.KeloAnimationRegistry.get(manifest.attackClips.right);
  assert(rightClip && Array.isArray(rightClip.keyframes), 'right attack transform clip missing');
  const rightProjections = rightClip.keyframes.map(k => Number(k.offsetX) || 0);
  const rightPeak = Math.max(...rightProjections);
  const rightBack = Math.abs(Math.min(...rightProjections));
  const rightPeakFrame = rightClip.keyframes.reduce((best, k) => (Number(k.offsetX) || 0) > (Number(best.offsetX) || 0) ? k : best, rightClip.keyframes[0]);
  const rightStrikeAtMs = Number(rightPeakFrame.t) * Number(rightClip.duration) * 1000;
  assert(rightPeak >= 16, 'base melee body strike is still visually too small');
  assert(rightBack >= 6, 'base melee anticipation is still visually too small');
  assert(rightPeak + rightBack >= 22, 'base melee body travel must be perceptible');
  assert(Math.abs(rightStrikeAtMs - manifest.impactAtMs) <= 5, 'body strike peak must land on the hit frame');

  const reactionRight = sandbox.KeloAnimationRegistry.get(manifest.reactionClips.right);
  const reactionPeak = Math.max(...reactionRight.keyframes.map(k => Math.hypot(Number(k.offsetX) || 0, Number(k.offsetY) || 0)));
  assert(reactionPeak >= 9, 'hit reaction displacement must be visible');

  const directions = {
    right: { dir: { x: 1, y: 0 }, face: 'right' },
    down_right: { dir: { x: 1, y: 1 }, face: 'down' },
    down: { dir: { x: 0, y: 1 }, face: 'down' },
    down_left: { dir: { x: -1, y: 1 }, face: 'down' },
    left: { dir: { x: -1, y: 0 }, face: 'left' },
    up_left: { dir: { x: -1, y: -1 }, face: 'up' },
    up: { dir: { x: 0, y: -1 }, face: 'up' },
    up_right: { dir: { x: 1, y: -1 }, face: 'up' }
  };

  for (const [direction8, cfg] of Object.entries(directions)) {
    clock += 250;
    const actor = { id: 'actor_' + direction8, x: 100, y: 100, radius: 20, _face: 'down', skinId: 'arbitrary_skin_' + direction8 };
    const target = { id: 'target_' + direction8, x: 100 + cfg.dir.x * 80, y: 100 + cfg.dir.y * 80, radius: 20, _face: 'down', skinId: 'different_skin' };
    const before = { x: actor.x, y: actor.y, targetX: target.x, targetY: target.y };
    const attack = sandbox.KeloMeleeVisuals.playAttack({
      attackId: 'dir_' + direction8, actor, targetActor: target, direction: cfg.dir, confirmedHit: false, visualStartedAt: clock
    });
    assert(attack, 'attack must start for ' + direction8);
    assert.strictEqual(attack.direction8, direction8, '8-way direction mapping failed for ' + direction8);
    assert.strictEqual(attack.face, cfg.face, 'cardinal skin facing compatibility failed for ' + direction8);
    assert.strictEqual(actor._face, cfg.face, 'actor base facing must remain cardinal for ' + direction8);
    assert.strictEqual(actor.x, before.x, 'visual attack moved actor x for ' + direction8);
    assert.strictEqual(actor.y, before.y, 'visual attack moved actor y for ' + direction8);
    assert.strictEqual(target.x, before.targetX, 'miss moved target x for ' + direction8);
    assert.strictEqual(target.y, before.targetY, 'miss moved target y for ' + direction8);
    sandbox.KeloAnimation.update(0.08);
    sandbox.KeloSequence.update(0.08);
    const transform = sandbox.KeloAnimation.sampleTransform(actor);
    assert(transform, 'body transform missing for ' + direction8);
    assert.strictEqual(transform.clipId, manifest.attackClips[direction8], 'wrong attack clip for ' + direction8);
    const fxDef = sandbox.KeloFXRegistry.get(manifest.slashFx[direction8]);
    assert(fxDef && fxDef.socket === 'center' && fxDef.space === 'ACTOR', 'slash must use universal actor center for ' + direction8);
    assert(sandbox.KeloFX.metrics().active > 0, 'slash FX did not spawn for ' + direction8);
  }

  clock += 400;
  const attacker = { id: 'hit_attacker', x: 200, y: 200, radius: 20, _face: 'right', skinId: 'skin_a' };
  const victim = { id: 'hit_victim', x: 285, y: 200, radius: 20, _face: 'left', skinId: 'skin_b' };
  const beforeHit = { ax: attacker.x, ay: attacker.y, vx: victim.x, vy: victim.y };
  const hitPayload = {
    attackId: 'confirmed_hit_1', actor: attacker, targetActor: victim,
    direction: { x: 1, y: 0 }, confirmedHit: true, visualStartedAt: clock - 200,
    gameplay: { damage: 18, range: 150, cooldown: 0.12 }
  };
  assert(sandbox.KeloMeleeVisuals.playAttack(hitPayload), 'confirmed attack must start');
  assert(sandbox.KeloMeleeVisuals.playHit(hitPayload), 'confirmed hit must present');
  sandbox.KeloAnimation.update(0.05);
  sandbox.KeloSequence.update(0.01);
  const reaction = sandbox.KeloAnimation.sampleTransform(victim);
  assert(reaction && reaction.channel === 'reaction', 'confirmed hit must trigger reaction channel');
  assert.strictEqual(attacker.x, beforeHit.ax, 'hit visual mutated attacker x');
  assert.strictEqual(attacker.y, beforeHit.ay, 'hit visual mutated attacker y');
  assert.strictEqual(victim.x, beforeHit.vx, 'hit reaction mutated victim x');
  assert.strictEqual(victim.y, beforeHit.vy, 'hit reaction mutated victim y');
  assert.strictEqual(sandbox.KELO_MELEE_VISUAL_AUDIT.hitsPresented, 1, 'hit audit count wrong');
  assert.strictEqual(sandbox.KELO_MELEE_VISUAL_AUDIT.missesPresented, 8, 'miss audit count wrong');
  assert.strictEqual(sandbox.KELO_MELEE_VISUAL_AUDIT.skinAgnostic, true, 'runtime audit lost skin-agnostic contract');

  const hitSparks = sandbox.KeloFXRegistry.get('melee_hit_sparks_light_01');
  assert(hitSparks && hitSparks.space === 'WORLD' && hitSparks.layer === 'foregroundFX', 'finishing hit FX must survive victim render removal');

  const visualsSource = source('src/visuals/melee-combat-visuals.js');
  assert(!visualsSource.includes('skinId') && !visualsSource.includes('appearanceId'), 'melee visual runtime must not branch on skin identity');

  const pvp = source('src/systems/pvp-world.js');
  assert(!pvp.includes("t.hp=Math.max(0,(t.hp==null?100:t.hp)-18)"), 'legacy direct PvP damage mutation must stay removed');
  assert(pvp.includes('KeloMeleeEngine.beginAttack'), 'PvP must start basic melee through shared MeleeEngine');
  assert(pvp.includes('KeloCombatEngine.attackSweep'), 'PvP active frame must resolve through shared CombatEngine sweep');
  assert(pvp.includes('KeloHitResolver.resolveMelee'), 'online prediction must reuse shared melee geometry');
  assert(!pvp.includes('emitVisual('), 'PvP must not own visual event emission');

  const index = source('index.html');
  const core = index.indexOf('src/visuals/sequence-system.js');
  const manifestAt = index.indexOf('src/visuals/melee-visual-manifest.js');
  const runtimeAt = index.indexOf('src/visuals/melee-combat-visuals.js');
  assert(core >= 0 && manifestAt > core && runtimeAt > manifestAt, 'melee visual load order invalid');
  assert(index.includes('src/systems/pvp-world.js?v=6'), 'PvP cache bust missing');

  Object.keys(directions).forEach(direction8 => {
    const slug = direction8.replace('_', '-');
    assert(fs.existsSync(path.join(ROOT, 'src/visuals/melee-assets/sword-light-slash-' + slug + '.svg')), 'slash SVG missing: ' + direction8);
  });

  await new Promise(resolve => setTimeout(resolve, 5));
  const missing = sandbox.KeloAssetRegistry.metrics().missing;
  assert.strictEqual(missing.length, 0, 'melee assets reported missing: ' + JSON.stringify(missing));

  console.log('PASS universal 8-way melee visual contract audit');
  console.log(JSON.stringify({
    version: manifest.version,
    attackDurationMs: manifest.attackDurationMs,
    anticipationMs: manifest.anticipationMs,
    impactAtMs: manifest.impactAtMs,
    recoveryMs: manifest.recoveryMs,
    baseAnticipationPx: rightBack,
    baseForwardPeakPx: rightPeak,
    baseTravelPx: rightPeak + rightBack,
    strikeAtMs: rightStrikeAtMs,
    reactionPeakPx: reactionPeak,
    attackClips: Object.keys(manifest.attackClips).length,
    reactionClips: Object.keys(manifest.reactionClips).length,
    slashAssets: Object.keys(manifest.slashAssets).length,
    directions: manifest.directions.length,
    anchorSocket: manifest.anchorSocket,
    skinAgnostic: manifest.skinAgnostic,
    attacksStarted: sandbox.KELO_MELEE_VISUAL_AUDIT.attacksStarted,
    hitsPresented: sandbox.KELO_MELEE_VISUAL_AUDIT.hitsPresented,
    missesPresented: sandbox.KELO_MELEE_VISUAL_AUDIT.missesPresented,
    gameplayAuthorityUnchanged: true
  }, null, 2));
}

main().catch(error => { console.error(error && error.stack || error); process.exit(1); });
