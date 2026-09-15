/* KELO-INDEX
 * area: QA / PVP QUALITY
 * owner: strict-pvp-quality-judge
 * keys: PVP QUALITY MOBILE INPUT AIM MOVEMENT DODGE COMBO HIT MISS IMPACT PERFORMANCE HARD-BLOCKER VISUAL-REVIEW
 * purpose: juez estricto de calidad percibida y competitiva; no concede PASS por arquitectura ni por score medio si existe un fallo crítico
 * policy: AUTO PASS >=96/100 + cero hard blockers; FINAL PASS requiere además revisión visual de las capturas >=8.5/10
 */
// Autonomous PvP round baseline trigger: no gameplay semantics.
import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
const threshold = Number(process.env.PVP_QUALITY_THRESHOLD || 96);
const outDir = process.env.PVP_QUALITY_OUT || 'artifacts/pvp-quality-judge';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', e => pageErrors.push(String(e.stack || e.message || e)));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

const rows = [];
const blockers = [];
let score = 0;
function check(name, points, ok, evidence, hard = false, blockerCode = name) {
  const passed = !!ok;
  rows.push({ name, pointsPossible: points, points: passed ? points : 0, passed, hard, evidence });
  if (passed) score += points;
  else if (hard) blockers.push({ code: blockerCode, name, evidence });
}
function percentile(values, p) {
  if (!values.length) return Infinity;
  const sorted = values.slice().sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[i];
}
function angularError(a, b) {
  const al = Math.hypot(a.x, a.y) || 1, bl = Math.hypot(b.x, b.y) || 1;
  const dot = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (al * bl)));
  return Math.acos(dot) * 180 / Math.PI;
}
function stageFromProfile(profileId) {
  return ({ sword_light_basic: 1, sword_light_follow: 2, sword_light_finisher: 3 })[String(profileId || '')] || 1;
}
async function waitCombat() {
  await page.waitForFunction(() => window.KeloPvPWorld?.state?.combatEnabled === true, null, { timeout: 8000 });
  await page.waitForTimeout(120);
}
async function reenter() {
  const mode = await page.evaluate(() => window.KeloPvPWorld?.state?.mode || 'unknown');
  if (mode === 'pvp') {
    await page.evaluate(() => window.leavePvPWorld());
    await page.waitForFunction(() => window.KeloPvPWorld?.state?.mode === 'social', null, { timeout: 3000 });
  }
  await page.evaluate(() => window.enterPvPWorld());
  await waitCombat();
}
async function clearMoveHook() {
  await page.evaluate(() => {
    if (window.__strictJudgeMoveHook && window.KeloInput) window.KeloInput.unregister(window.__strictJudgeMoveHook);
    window.__strictJudgeMoveHook = null;
    if (typeof input !== 'undefined' && input) { input.normX = 0; input.normY = 0; }
    window.KeloInput?.combat?.setAxes({ source: 'strict-judge', move: { x: 0, y: 0, magnitude: 0 } });
  });
}
async function holdMoveRight() {
  await clearMoveHook();
  await page.evaluate(() => {
    window.__strictJudgeMoveHook = window.KeloInput.after('strict-pvp-quality:move-right', ctx => {
      if (ctx?.input) { ctx.input.normX = 1; ctx.input.normY = 0; }
      window.KeloInput.combat.setAxes({ source: 'strict-judge', move: { x: 1, y: 0, magnitude: 1 } });
    }, 9999);
  });
}
async function startAttackAndWait(source = 'strict-judge') {
  await page.evaluate(src => {
    window.__strictJudgeAttackRequestedAt = performance.now();
    window.KeloPvPWorld.startBasicAttack(src);
  }, source);
  await page.waitForFunction(() => !!window.KeloPvPWorld?.state?.basicAttack, null, { timeout: 700, polling: 'raf' });
  return page.evaluate(() => ({
    latencyMs: performance.now() - window.__strictJudgeAttackRequestedAt,
    requestAt: window.__strictJudgeAttackRequestedAt,
    attack: window.KeloPvPWorld.state.basicAttack,
    comboStep: window.KeloPvPWorld.state.comboStep
  }));
}
async function waitAttackEnd() {
  await page.waitForFunction(() => !window.KeloPvPWorld?.state?.basicAttack, null, { timeout: 1800, polling: 'raf' });
}
async function setupActors({ dummyDx = 105, dummyDy = 0, hp = 500 } = {}) {
  return page.evaluate(({ dummyDx, dummyDy, hp }) => {
    const p = typeof localPlayer !== 'undefined' ? localPlayer : window.localPlayer;
    const d = simulatedPlayers?.[0];
    if (!p || !d) throw new Error('STRICT_JUDGE_ACTORS_UNAVAILABLE');
    p.x = 2860; p.y = 700; p.vx = 0; p.vy = 0;
    d.x = p.x + dummyDx; d.y = p.y + dummyDy;
    d.targetX = d.x; d.targetY = d.y;
    d.maxHp = hp; d.hp = hp;
    if (typeof camera !== 'undefined') {
      camera.x = p.x; camera.y = p.y;
      if ('targetX' in camera) camera.targetX = p.x;
      if ('targetY' in camera) camera.targetY = p.y;
    }
    window.KeloPvPWorld.setAimWorld({ x: p.x + 200, y: p.y }, 'strict-judge', 1);
    return { player: { x: p.x, y: p.y }, dummy: { x: d.x, y: d.y, hp: d.hp } };
  }, { dummyDx, dummyDy, hp });
}
async function startFrameProbe() {
  await page.evaluate(() => {
    window.__strictJudgeFrames = [];
    window.__strictJudgeFrameProbe = true;
    let last = performance.now();
    function step(t) {
      if (!window.__strictJudgeFrameProbe) return;
      window.__strictJudgeFrames.push(t - last);
      last = t;
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}
async function stopFrameProbe() {
  return page.evaluate(() => {
    window.__strictJudgeFrameProbe = false;
    return (window.__strictJudgeFrames || []).slice(1);
  });
}
async function samplePlayerTravel(origin, durationMs = 260, stepMs = 8) {
  const samples = [];
  const until = Date.now() + durationMs;
  while (Date.now() < until) {
    samples.push(await page.evaluate(() => ({ x: localPlayer.x, y: localPlayer.y, active: window.KeloPvPWorld.state.dodgeActive, cooldown: window.KeloPvPWorld.state.dodgeCooldown })));
    await page.waitForTimeout(stepMs);
  }
  const distances = samples.map(s => Math.hypot(s.x - origin.x, s.y - origin.y));
  return { samples, maxDistance: distances.length ? Math.max(...distances) : 0, final: samples.at(-1) || null };
}
async function sampleTargetWindow(origin, durationMs = 220, stepMs = 8) {
  const samples = [];
  const until = Date.now() + durationMs;
  while (Date.now() < until) {
    samples.push(await page.evaluate(() => {
      const d = simulatedPlayers[0];
      const t = window.KeloAnimation.sampleTransform(d);
      return {
        x: d.x, y: d.y, hp: d.hp,
        recoilPx: Math.hypot(Number(t?.offsetX) || 0, Number(t?.offsetY) || 0),
        reactionChannel: t?.channel || null,
        hitsPresented: window.KELO_MELEE_VISUAL_AUDIT?.hitsPresented || 0,
        missesPresented: window.KELO_MELEE_VISUAL_AUDIT?.missesPresented || 0
      };
    }));
    await page.waitForTimeout(stepMs);
  }
  return {
    samples,
    minHp: samples.length ? Math.min(...samples.map(s => Number(s.hp))) : Infinity,
    maxRecoilPx: samples.length ? Math.max(...samples.map(s => s.recoilPx)) : 0,
    maxKnockbackPx: samples.length ? Math.max(...samples.map(s => Math.hypot(s.x - origin.x, s.y - origin.y))) : 0,
    anyReaction: samples.some(s => s.reactionChannel === 'reaction'),
    maxHitsPresented: samples.length ? Math.max(...samples.map(s => s.hitsPresented)) : 0,
    maxMissesPresented: samples.length ? Math.max(...samples.map(s => s.missesPresented)) : 0
  };
}

try {
  const sep = base.includes('?') ? '&' : '?';
  const url = `${base}${sep}offline=1&strict-pvp-quality=${Date.now()}`;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  if (!response || response.status() >= 400) throw new Error(`STRICT_JUDGE_HTTP_${response?.status() || 'NO_RESPONSE'}`);
  await page.waitForFunction(() => /^Kelo World — V/i.test(document.title), null, { timeout: 30000 });
  await page.waitForFunction(() => !!window.KeloRuntimeBootstrap?.ensure, null, { timeout: 15000 });
  await page.evaluate(async () => { await window.KeloRuntimeBootstrap.ensure(); });
  await page.waitForFunction(() => !!(
    window.KeloPvPWorld && window.KeloInput && window.KeloMeleeEngine && window.KeloCombatEngine &&
    window.KeloMeleeVisuals && window.KeloAnimation && window.KeloAnimationRegistry && window.KELO_MELEE_VISUAL_MANIFEST
  ), null, { timeout: 30000 });
  await page.evaluate(() => window.enterPvPWorld());
  await waitCombat();
  await page.screenshot({ path: `${outDir}/00-pvp-ready.png`, scale: 'device' });

  // 1) REAL MOBILE INPUT — actual touchscreen path, not direct combat API.
  await setupActors({ dummyDx: 220 });
  const canvas = page.locator('#game-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('STRICT_JUDGE_CANVAS_NOT_VISIBLE');
  const touchStartedAt = Date.now();
  await page.touchscreen.tap(box.x + box.width * 0.82, box.y + box.height * 0.50);
  let touchAttack = null;
  try {
    await page.waitForFunction(() => !!window.KeloPvPWorld?.state?.basicAttack, null, { timeout: 300, polling: 'raf' });
    touchAttack = await page.evaluate(() => ({ attack: window.KeloPvPWorld.state.basicAttack, aim: window.KeloPvPWorld.state.aim }));
  } catch (_) {}
  const touchLatencyMs = Date.now() - touchStartedAt;
  check('Real mobile touch starts M1', 7, !!touchAttack && touchLatencyMs <= 180, { touchLatencyMs, touchAttack }, true, 'MOBILE_TOUCH_INPUT_FAILED');
  await page.screenshot({ path: `${outDir}/01-touch-m1.png`, scale: 'device' });
  if (touchAttack) await waitAttackEnd();

  // 2) 360 AIM — eight representative directions must remain mathematically precise.
  const dirs = [
    ['right', 1, 0], ['down_right', 1, 1], ['down', 0, 1], ['down_left', -1, 1],
    ['left', -1, 0], ['up_left', -1, -1], ['up', 0, -1], ['up_right', 1, -1]
  ];
  const aimRows = [];
  for (const [name, x, y] of dirs) {
    const got = await page.evaluate(({ x, y }) => {
      const p = typeof localPlayer !== 'undefined' ? localPlayer : window.localPlayer;
      window.KeloPvPWorld.setAimWorld({ x: p.x + x * 220, y: p.y + y * 220 }, 'strict-judge', 1);
      return { aim: window.KeloPvPWorld.state.aim, face: p._face };
    }, { x, y });
    const expectedLen = Math.hypot(x, y) || 1;
    const expected = { x: x / expectedLen, y: y / expectedLen };
    aimRows.push({ name, errorDeg: angularError(got.aim, expected), face: got.face, aim: got.aim });
  }
  const maxAimError = Math.max(...aimRows.map(r => r.errorDeg));
  check('8-way representative aim stays precise', 7, maxAimError <= 1, { maxAimError, aimRows }, true, 'AIM_PRECISION_FAILED');

  // 3) MOVEMENT WEIGHT — attacking must slow the body without rooting it.
  await reenter();
  await setupActors({ dummyDx: 300 });
  await holdMoveRight();
  const baselineX = await page.evaluate(() => localPlayer.x);
  await page.waitForTimeout(180);
  const baselineEndX = await page.evaluate(() => localPlayer.x);
  const baselineDx = baselineEndX - baselineX;
  await setupActors({ dummyDx: 300 });
  const attackMoveStartX = await page.evaluate(() => localPlayer.x);
  const moveAttackStart = await startAttackAndWait('strict-judge-move');
  await page.waitForTimeout(180);
  const attackMoveEndX = await page.evaluate(() => localPlayer.x);
  const attackMoveDx = attackMoveEndX - attackMoveStartX;
  const movementRatio = baselineDx > 0 ? attackMoveDx / baselineDx : 0;
  check('Attack preserves controlled movement weight', 7, baselineDx >= 12 && movementRatio >= 0.30 && movementRatio <= 0.95,
    { baselineDx, attackMoveDx, movementRatio, attackStartLatencyMs: moveAttackStart.latencyMs }, movementRatio < 0.18 || baselineDx < 8, 'ATTACK_MOVEMENT_ROOTED');
  await clearMoveHook();
  await waitAttackEnd();

  // 4) DODGE — measure peak world displacement, not one arbitrary late frame.
  await reenter();
  await setupActors({ dummyDx: 300 });
  await holdMoveRight();
  const dodgeOrigin = await page.evaluate(() => ({ x: localPlayer.x, y: localPlayer.y }));
  const dodgeRequestedAt = Date.now();
  await page.evaluate(() => window.KeloInput.combat.push('DODGE_PRESS', { source: 'strict-judge' }));
  let dodgeStarted = false;
  try {
    await page.waitForFunction(() => window.KeloPvPWorld?.state?.dodgeActive === true, null, { timeout: 220, polling: 'raf' });
    dodgeStarted = true;
  } catch (_) {}
  const dodgeLatencyMs = Date.now() - dodgeRequestedAt;
  const dodgeTravel = await samplePlayerTravel(dodgeOrigin, 260, 8);
  const dodgeDistance = dodgeTravel.maxDistance;
  check('Dodge is responsive and travels decisively', 7,
    dodgeStarted && dodgeLatencyMs <= 160 && dodgeDistance >= 90 && dodgeDistance <= 140,
    { dodgeStarted, dodgeLatencyMs, dodgeDistance, final: dodgeTravel.final }, true, 'DODGE_RESPONSE_FAILED');
  await clearMoveHook();
  await page.screenshot({ path: `${outDir}/02-dodge.png`, scale: 'device' });

  // 5) THREE-HIT M1 — derive stage from active profile, never from comboStep after finisher wraps to zero.
  await reenter();
  await setupActors({ dummyDx: 105 });
  await startFrameProbe();
  const comboExpected = ['sword_light_basic', 'sword_light_follow', 'sword_light_finisher'];
  const combo = [];
  for (let i = 0; i < 3; i++) {
    await page.waitForFunction(() => !window.KeloPvPWorld.state.basicAttack, null, { timeout: 1800 });
    await page.evaluate(() => {
      const p = typeof localPlayer !== 'undefined' ? localPlayer : window.localPlayer;
      const d = simulatedPlayers[0];
      d.x = p.x + 105; d.y = p.y; d.targetX = d.x; d.targetY = d.y; d.hp = d.maxHp = 500;
      window.KeloPvPWorld.setAimWorld({ x: p.x + 220, y: p.y }, 'strict-judge', 1);
    });
    const started = await startAttackAndWait(`strict-judge-combo-${i + 1}`);
    const profileId = started.attack?.profileId;
    const expectedStage = stageFromProfile(profileId);
    await page.waitForTimeout(10);
    const definition = await page.evaluate(({ expectedStage, profileId }) => {
      const p = typeof localPlayer !== 'undefined' ? localPlayer : window.localPlayer;
      const t = window.KeloAnimation.sampleTransform(p);
      const def = t && window.KeloAnimationRegistry.get(t.clipId);
      const style = window.KeloMeleeVisuals.comboStyles[expectedStage];
      const frames = def?.keyframes || [];
      const xs = frames.map(k => Number(k.offsetX) || 0);
      const forward = xs.length ? Math.max(...xs) : 0;
      const back = xs.length ? Math.abs(Math.min(...xs)) : 0;
      const peak = frames.reduce((best, k) => !best || (Number(k.offsetX) || 0) > (Number(best.offsetX) || 0) ? k : best, null);
      const strikeAtMs = peak ? Number(peak.t) * Number(def.duration) * 1000 : Infinity;
      return {
        stage: expectedStage, profileId,
        clipId: t?.clipId || null,
        durationMs: Number(def?.duration || 0) * 1000,
        impactAtMs: Number(style?.impactAtMs || 0),
        strikeAtMs,
        impactDeltaMs: Math.abs(strikeAtMs - Number(style?.impactAtMs || 0)),
        forwardPx: forward,
        backPx: back,
        travelPx: forward + back,
        slashScale: Number(style?.slashScale || 0)
      };
    }, { expectedStage, profileId });
    await page.waitForTimeout(Math.max(0, definition.impactAtMs - started.latencyMs - 10));
    const impactPose = await page.evaluate(() => {
      const p = typeof localPlayer !== 'undefined' ? localPlayer : window.localPlayer;
      const t = window.KeloAnimation.sampleTransform(p);
      return { offsetX: Number(t?.offsetX) || 0, offsetY: Number(t?.offsetY) || 0, rotation: Number(t?.rotation) || 0, clipId: t?.clipId || null };
    });
    await page.screenshot({ path: `${outDir}/combo-${i + 1}-impact.png`, scale: 'device' });
    const durationStartedAt = Date.now();
    await waitAttackEnd();
    const postImpactRemainingMs = Date.now() - durationStartedAt;
    combo.push({ index: i + 1, started, definition, impactPose, postImpactRemainingMs });
    await page.waitForTimeout(35);
  }
  const combatFrames = await stopFrameProbe();
  const comboProfiles = combo.map(x => x.started.attack?.profileId || null);
  const comboLatencies = combo.map(x => x.started.latencyMs);
  const impactDeltas = combo.map(x => x.definition.impactDeltaMs);
  const travels = combo.map(x => x.definition.travelPx);
  const impactOffsets = combo.map(x => x.impactPose.offsetX);
  check('M1 pipeline advances 1→2→3 exactly', 6, comboProfiles.every((v, i) => v === comboExpected[i]), { comboProfiles, comboExpected }, true, 'M1_SEQUENCE_FAILED');
  check('M1 input-to-attack latency stays tight', 5, Math.max(...comboLatencies) <= 80, { comboLatencies }, Math.max(...comboLatencies) > 140, 'M1_INPUT_LATENCY_FAILED');
  check('Body strike peaks align with hit timing', 9, impactDeltas.every(v => v <= 8), { impactDeltas, combo: combo.map(x => x.definition) }, true, 'BODY_HIT_DESYNC');
  check('M1 silhouette/body travel escalates to finisher', 6,
    travels[0] >= 20 && travels[1] > travels[0] && travels[2] > travels[1] && impactOffsets[2] > impactOffsets[0],
    { travels, impactOffsets }, travels[0] < 16 || travels[2] <= travels[0], 'M1_BODY_HIERARCHY_FAILED');
  check('Finisher reads heavier than follow', 4,
    combo[2].definition.durationMs > combo[1].definition.durationMs && combo[2].definition.slashScale > combo[1].definition.slashScale,
    { durations: combo.map(x => x.definition.durationMs), slashScale: combo.map(x => x.definition.slashScale) });

  // 6) CONTACT TRUTH — sample the whole short contact window so one frame cannot create a false fail.
  await reenter();
  const hitSetup = await setupActors({ dummyDx: 105, hp: 500 });
  const hitAuditBefore = await page.evaluate(() => ({ hits: window.KELO_MELEE_VISUAL_AUDIT?.hitsPresented || 0 }));
  await startAttackAndWait('strict-judge-hit');
  const hitWindow = await sampleTargetWindow(hitSetup.dummy, 230, 8);
  await page.screenshot({ path: `${outDir}/03-confirmed-hit.png`, scale: 'device' });
  await waitAttackEnd();
  const hitDamage = 500 - hitWindow.minHp;
  const knockbackPx = hitWindow.maxKnockbackPx;
  check('Confirmed hit changes gameplay truth', 6, hitDamage >= 18 && knockbackPx >= 10,
    { hitDamage, knockbackPx, maxHitsPresented: hitWindow.maxHitsPresented }, true, 'CONFIRMED_HIT_TRUTH_FAILED');
  check('Confirmed hit visibly recoils target', 5, hitWindow.maxRecoilPx >= 5 && hitWindow.anyReaction,
    { maxRecoilPx: hitWindow.maxRecoilPx, anyReaction: hitWindow.anyReaction }, true, 'TARGET_REACTION_FAILED');

  await reenter();
  const missSetup = await setupActors({ dummyDx: -105, hp: 500 });
  const missBefore = await page.evaluate(() => ({ hp: simulatedPlayers[0].hp, hits: window.KELO_MELEE_VISUAL_AUDIT?.hitsPresented || 0 }));
  await startAttackAndWait('strict-judge-miss');
  const missWindow = await sampleTargetWindow(missSetup.dummy, 230, 8);
  await waitAttackEnd();
  const missAfter = await page.evaluate(() => ({ hp: simulatedPlayers[0].hp, hits: window.KELO_MELEE_VISUAL_AUDIT?.hitsPresented || 0 }));
  check('Guaranteed miss never damages target', 6, missAfter.hp === missBefore.hp && missWindow.minHp === missBefore.hp,
    { missBefore, missAfter, minHp: missWindow.minHp }, true, 'MISS_DEALT_DAMAGE');
  check('Presentation distinguishes hit and miss', 3,
    hitWindow.maxHitsPresented > hitAuditBefore.hits && missAfter.hits === missBefore.hits && !missWindow.anyReaction && missWindow.maxRecoilPx < 1,
    { hitBefore: hitAuditBefore, hitMax: hitWindow.maxHitsPresented, missBefore, missAfter, missMaxRecoilPx: missWindow.maxRecoilPx, missAnyReaction: missWindow.anyReaction });

  // 7) PERFORMANCE/STABILITY — measured while executing the real three-hit combo.
  const p95 = percentile(combatFrames, 0.95);
  const p99 = percentile(combatFrames, 0.99);
  const long33 = combatFrames.filter(v => v > 33.4).length / Math.max(1, combatFrames.length);
  const maxFrame = combatFrames.length ? Math.max(...combatFrames) : Infinity;
  check('Combat frame pacing p95 remains >=30fps class', 6, combatFrames.length >= 40 && p95 <= 33.5,
    { samples: combatFrames.length, p95, p99, maxFrame }, p95 > 50 || combatFrames.length < 20, 'COMBAT_FRAME_PACING_FAILED');
  check('Combat avoids repeated long frames', 4, long33 <= 0.10, { long33, p95, p99, maxFrame }, long33 > 0.20, 'COMBAT_LONG_FRAME_RATIO_FAILED');
  check('No runtime page errors during judge', 4, pageErrors.length === 0, pageErrors, true, 'PVP_RUNTIME_ERROR');

  // 8) COMPETITIVE FOUNDATION — properties, not feature count.
  const foundation = await page.evaluate(() => ({
    pvp: window.KELO_PVP_AUDIT || null,
    melee: window.KELO_MELEE_VISUAL_AUDIT || null,
    input: window.KeloInput?.combat?.snapshot?.() || null
  }));
  check('No target lock; 360 aim remains the combat contract', 4,
    foundation.pvp?.targetLock === false && foundation.pvp?.aim360 === true && Number(foundation.pvp?.inputBufferMs) <= 125,
    foundation.pvp, true, 'COMPETITIVE_CONTROL_CONTRACT_FAILED');
  check('Universal melee keeps 8-way skin-agnostic presentation', 2,
    foundation.melee?.skinAgnostic === true && Number(foundation.melee?.directionCount) === 8,
    foundation.melee, true, 'UNIVERSAL_MELEE_CONTRACT_FAILED');
  check('Input foundation keeps radial/gamepad-ready semantics', 2,
    foundation.pvp?.radialDeadzone === true && foundation.pvp?.gamepadReady === true,
    foundation.pvp);

  const totalPossible = rows.reduce((sum, row) => sum + row.pointsPossible, 0);
  if (totalPossible !== 100) {
    blockers.push({ code: 'JUDGE_SCORE_SCHEMA_INVALID', name: 'Judge score must total exactly 100 points', evidence: { totalPossible } });
  }
  score = Math.round(score * 10) / 10;
  const autoPass = score >= threshold && blockers.length === 0 && totalPossible === 100;
  const grade = score >= 98 ? 'S' : score >= 96 ? 'A' : score >= 92 ? 'B' : score >= 85 ? 'C' : 'FAIL';
  const verdict = autoPass ? 'AUTO_GATE_PASS_REQUIRES_VISUAL_REVIEW' : 'PVP_QUALITY_REJECTED';
  const visualReview = {
    requiredForFinalPass: true,
    minimumHumanOrVisionScore: 8.5,
    rule: 'AUTO PASS is not FINAL PASS. Review screenshots at actual mobile scale; visible combat quality can veto the numeric score.',
    rejectIfAny: [
      'attack silhouette change is hard to notice without slow motion',
      'slash/VFX obscures attacker or defender read',
      'contact appears before/after body strike',
      'finisher does not look materially heavier than opener/follow',
      'dodge direction or distance is visually ambiguous',
      'camera/flash feedback makes target tracking harder',
      'nameplates, damage text or HUD overlap obscures either combatant',
      'fixed mobile UI occupies the combat focus enough to reduce target readability',
      'attacker and defender silhouettes become hard to distinguish during contact'
    ]
  };
  const report = {
    version: 'strict-pvp-quality-judge-v1.1.0-robust-sampling',
    generatedAt: new Date().toISOString(),
    url: page.url(), threshold, totalPossible, score, grade, verdict, autoPass,
    hardBlockerCount: blockers.length, blockers,
    dimensions: {
      realInputAndAim: rows.filter(r => /mobile|8-way/i.test(r.name)),
      movementAndDodge: rows.filter(r => /movement|dodge/i.test(r.name)),
      comboTiming: rows.filter(r => /M1|Body strike|Finisher/i.test(r.name)),
      contactTruth: rows.filter(r => /hit|miss|recoil|Presentation distinguishes/i.test(r.name)),
      performance: rows.filter(r => /frame|runtime page/i.test(r.name)),
      competitiveFoundation: rows.filter(r => /target lock|Universal melee|Input foundation/i.test(r.name))
    },
    checks: rows,
    metrics: {
      touchLatencyMs, maxAimError, baselineDx, attackMoveDx, movementRatio,
      dodgeLatencyMs, dodgeDistance,
      comboProfiles, comboLatencies, impactDeltas, travels, impactOffsets,
      hitDamage, knockbackPx, hitMaxRecoilPx: hitWindow.maxRecoilPx,
      combatFrames: { samples: combatFrames.length, p95, p99, maxFrame, long33 }
    },
    visualReview,
    diagnostics: { pageErrors, consoleErrors }
  };
  fs.writeFileSync(`${outDir}/strict-pvp-quality-report.json`, JSON.stringify(report, null, 2));
  fs.writeFileSync(`${outDir}/FINAL-VISUAL-REVIEW-REQUIRED.txt`, [
    'STRICT PVP QUALITY JUDGE',
    `AUTO SCORE: ${score}/100 (${grade})`,
    `AUTO VERDICT: ${verdict}`,
    `HARD BLOCKERS: ${blockers.length}`,
    '',
    'FINAL PASS REQUIRES HUMAN/VISION REVIEW >= 8.5/10 OF THE PNG EVIDENCE.',
    ...visualReview.rejectIfAny.map(x => `REJECT IF: ${x}`)
  ].join('\n'));

  console.log('KELO STRICT PVP QUALITY JUDGE');
  console.log(JSON.stringify({ score, threshold, totalPossible, grade, verdict, blockers, metrics: report.metrics, visualReview }, null, 2));
  if (!autoPass) throw new Error(`STRICT_PVP_QUALITY_REJECTED score=${score} blockers=${blockers.length}`);
} catch (error) {
  fs.writeFileSync(`${outDir}/fatal-error.txt`, String(error?.stack || error));
  try { await page.screenshot({ path: `${outDir}/fatal-state.png`, scale: 'device' }); } catch {}
  throw error;
} finally {
  try { await clearMoveHook(); } catch {}
  await browser.close();
}
