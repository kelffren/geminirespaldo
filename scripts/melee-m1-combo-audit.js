/* KELO-INDEX
 * area: QA
 * keys: MELEE M1 COMBO FEEL OPENER FOLLOW FINISHER SKIN-AGNOSTIC PERCEPTIBLE BODY MOTION IMPACT ALIGNMENT
 * hace: valida que los tres perfiles M1 produzcan presentación corporal distinta, visible y sincronizada con impacto sin cambiar gameplay ni depender de skin
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

function motionMetrics(def, impactAtMs) {
  const frames = Array.isArray(def && def.keyframes) ? def.keyframes : [];
  const projections = frames.map(k => Number(k.offsetX) || 0);
  const forward = Math.max(...projections);
  const back = Math.abs(Math.min(...projections));
  const peak = frames.reduce((best, k) => (Number(k.offsetX) || 0) > (Number(best.offsetX) || 0) ? k : best, frames[0]);
  const strikeAtMs = Number(peak.t) * Number(def.duration) * 1000;
  return { forward, back, travel: forward + back, strikeAtMs, impactDeltaMs: Math.abs(strikeAtMs - impactAtMs) };
}

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

  const V = sandbox.KeloMeleeVisuals;
  const M = sandbox.KELO_MELEE_VISUAL_MANIFEST;
  assert(V && M, 'melee visual runtime must boot');
  assert.strictEqual(V.comboStyles[1].id, 'opener', 'M1 step 1 style missing');
  assert.strictEqual(V.comboStyles[2].id, 'follow', 'M1 step 2 style missing');
  assert.strictEqual(V.comboStyles[3].id, 'finisher', 'M1 step 3 style missing');
  assert.strictEqual(V.comboStyles[1].impactAtMs, M.impactAtMs, 'opener impact must match base body impact');
  assert(V.comboStyles[2].impactAtMs < V.comboStyles[1].impactAtMs, 'follow hit should visually arrive faster than opener');
  assert(V.comboStyles[3].slashScale > V.comboStyles[2].slashScale, 'finisher must have visibly larger slash scale');

  const actor = { id: 'combo_actor', x: 100, y: 100, radius: 20, _face: 'right', skinId: 'skin_that_should_not_matter' };
  const target = { id: 'combo_target', x: 185, y: 100, radius: 20, _face: 'left', skinId: 'completely_different_skin' };
  const stages = [
    { profileId: 'sword_light_basic', stage: 1, style: 'opener', minForward: 16, minBack: 6, minTravel: 22 },
    { profileId: 'sword_light_follow', stage: 2, style: 'follow', minForward: 16.5, minBack: 6.2, minTravel: 22.7 },
    { profileId: 'sword_light_finisher', stage: 3, style: 'finisher', minForward: 20, minBack: 7.5, minTravel: 27.5 }
  ];
  const clipIds = [];
  const motions = [];

  for (const row of stages) {
    clock += 250;
    const before = { ax: actor.x, ay: actor.y, tx: target.x, ty: target.y };
    const attack = V.playAttack({
      attackId: 'combo_' + row.stage,
      actor,
      targetActor: target,
      direction: { x: 1, y: 0 },
      profileId: row.profileId,
      confirmedHit: false
    });
    assert(attack, 'combo stage ' + row.stage + ' must start');
    assert.strictEqual(attack.comboStage, row.stage, 'wrong combo stage for ' + row.profileId);
    assert.strictEqual(attack.comboStyle, row.style, 'wrong combo style for ' + row.profileId);
    assert.strictEqual(V.comboStageOf({ profileId: row.profileId }), row.stage, 'profile-to-stage mapping failed');
    assert.strictEqual(V.impactDelayFor({ attackId: 'combo_' + row.stage, profileId: row.profileId }), V.comboStyles[row.stage].impactAtMs, 'impact delay must start from accepted attack timestamp');
    sandbox.KeloAnimation.update(0.01);
    const transform = sandbox.KeloAnimation.sampleTransform(actor);
    assert(transform && transform.channel === 'action', 'combo stage must own action presentation channel');
    assert.strictEqual(transform.clipId, attack.clipId, 'runtime returned wrong combo clip id');
    clipIds.push(attack.clipId);

    const def = sandbox.KeloAnimationRegistry.get(attack.clipId);
    const motion = motionMetrics(def, V.comboStyles[row.stage].impactAtMs);
    motions.push(motion);
    assert(motion.forward >= row.minForward, 'stage ' + row.stage + ' forward body strike is not perceptible enough');
    assert(motion.back >= row.minBack, 'stage ' + row.stage + ' anticipation is not perceptible enough');
    assert(motion.travel >= row.minTravel, 'stage ' + row.stage + ' body travel is too small');
    assert(motion.impactDeltaMs <= 8, 'stage ' + row.stage + ' body strike is not synchronized with hit presentation');

    assert.strictEqual(actor.x, before.ax, 'combo presentation moved actor x');
    assert.strictEqual(actor.y, before.ay, 'combo presentation moved actor y');
    assert.strictEqual(target.x, before.tx, 'combo presentation moved target x');
    assert.strictEqual(target.y, before.ty, 'combo presentation moved target y');
  }

  assert.notStrictEqual(clipIds[0], clipIds[1], 'follow must not reuse opener body clip');
  assert.notStrictEqual(clipIds[1], clipIds[2], 'finisher must not reuse follow body clip');
  assert(clipIds[1].includes('_m1_2'), 'follow derived clip id must be explicit');
  assert(clipIds[2].includes('_m1_3'), 'finisher derived clip id must be explicit');
  assert(motions[1].forward > motions[0].forward, 'follow body strike must read stronger than opener');
  assert(motions[2].forward > motions[1].forward, 'finisher body strike must read strongest');

  clock += 250;
  const finisherAttack = V.playAttack({
    attackId: 'combo_finisher_hit', actor, targetActor: target, direction: { x: 1, y: 0 },
    profileId: 'sword_light_finisher', confirmedHit: true, visualStartedAt: clock - 200
  });
  assert(finisherAttack && finisherAttack.comboStage === 3, 'finisher hit attack must start as stage 3');
  const hit = V.playHit({
    attackId: 'combo_finisher_hit', actor, targetActor: target, direction: { x: 1, y: 0 },
    profileId: 'sword_light_finisher', confirmedHit: true, visualStartedAt: clock - 200
  });
  assert(hit && hit.comboStage === 3 && hit.comboStyle === 'finisher', 'finisher hit presentation must preserve combo identity');
  assert.strictEqual(sandbox.KELO_MELEE_VISUAL_AUDIT.lastHitComboStage, 3, 'audit must observe finisher hit stage');
  assert.strictEqual(sandbox.KELO_MELEE_VISUAL_AUDIT.comboStages, 3, 'runtime must declare three combo stages');
  assert.strictEqual(sandbox.KELO_MELEE_VISUAL_AUDIT.skinAgnostic, true, 'combo must preserve skin-agnostic contract');

  const runtimeSource = source('src/visuals/melee-combat-visuals.js');
  assert(!runtimeSource.includes('skinId') && !runtimeSource.includes('appearanceId'), 'combo runtime must never branch on skin identity');
  assert(runtimeSource.includes('sword_light_basic') && runtimeSource.includes('sword_light_follow') && runtimeSource.includes('sword_light_finisher'), 'three M1 profiles must be mapped explicitly');

  console.log('PASS M1 three-hit perceptible combo feel audit');
  console.log(JSON.stringify({
    stages: stages.length,
    styles: stages.map(x => x.style),
    impactAtMs: stages.map(x => V.comboStyles[x.stage].impactAtMs),
    motion: motions,
    distinctBodyClips: new Set(clipIds).size,
    finisherScale: V.comboStyles[3].slashScale,
    skinAgnostic: true,
    gameplayMutation: false
  }, null, 2));
}

main().catch(error => { console.error(error && error.stack || error); process.exit(1); });
