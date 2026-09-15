/* KELO-INDEX
 * area: QA / LIVE COMBAT FEEL
 * keys: LIVE MOBILE PVP DRAKANTOS-STYLE AIM COMBO MOVEMENT IMPACT RESPONSIVENESS EVIDENCE SCORE
 * hace: juega una traza PvP real en GitHub Pages, puntúa combat feel y falla si no alcanza el umbral de convergencia
 * invariant: usa APIs/inputs reales del runtime; no concede puntos por documentación ni por tamaño del diff
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
const threshold = Number(process.env.COMBAT_FEEL_THRESHOLD || 90);
const outDir = 'artifacts/melee-live';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true
});
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const httpErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => pageErrors.push(String(e.stack || e.message || e)));
page.on('requestfailed', r => failedRequests.push({ url: r.url(), error: r.failure()?.errorText || 'failed' }));
page.on('response', r => { if (r.status() >= 400) httpErrors.push({ status: r.status(), url: r.url() }); });

await page.route(/\/(src\/systems\/(?:pvp-world\.js|melee\/[^?]+\.js)|src\/visuals\/(?:visual-manifests|melee-visual-manifest|melee-combat-visuals|visual-integration)\.js)(\?|$)/, route => {
  const u = new URL(route.request().url());
  u.searchParams.set('combat-feel-live-bust', `${Date.now()}-${Math.random()}`);
  route.continue({ url: u.toString() });
});

try {
  const response = await page.goto(`${base}?combat-feel-agent=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  if (!response || response.status() >= 400) throw new Error(`LIVE_PAGE_HTTP_${response?.status() || 'NO_RESPONSE'}`);
  await page.waitForFunction(() => /^Kelo World — V/i.test(document.title), null, { timeout: 30000 });
  await page.waitForFunction(() => !!window.KeloRuntimeBootstrap && typeof window.KeloRuntimeBootstrap.ensure === 'function', null, { timeout: 15000 });
  await page.evaluate(async () => { await window.KeloRuntimeBootstrap.ensure(); });
  await page.waitForFunction(() => {
    return !!(
      window.KeloPvPWorld &&
      window.KeloMeleeEngine &&
      window.KeloMeleeProfiles &&
      window.KeloMeleeVisuals &&
      window.KELO_MELEE_VISUAL_MANIFEST &&
      window.KELO_MELEE_VISUAL_AUDIT?.runtimeReady === true
    );
  }, null, { timeout: 30000 });
  await page.waitForTimeout(700);

  const boot = await page.evaluate(async () => {
    const p = typeof localPlayer !== 'undefined' ? localPlayer : window.localPlayer;
    const manifest = window.KELO_MELEE_VISUAL_MANIFEST;
    const assets = {};
    for (const [direction, id] of Object.entries(manifest.slashAssets || {})) {
      assets[direction] = !!(await window.KeloAssetRegistry.load(id));
    }
    const profiles = ['sword_light_basic', 'sword_light_follow', 'sword_light_finisher'].map(id => {
      const x = window.KeloMeleeProfiles.get(id);
      return x && {
        id: x.id,
        damage: x.damage,
        windup: x.windup,
        active: x.active,
        recovery: x.recovery,
        cancelWindow: x.cancelWindow,
        movementScale: x.movementScale,
        comboWindow: x.comboWindow,
        comboTimeout: x.comboTimeout
      };
    });
    return {
      title: document.title,
      player: p && { id: p.id, x: p.x, y: p.y, radius: p.radius, face: p._face },
      pvpVersion: window.KeloPvPWorld?.version || null,
      meleeVersion: window.KeloMeleeEngine?.version || null,
      visualVersion: window.KeloMeleeVisuals?.version || null,
      manifest: {
        version: manifest.version,
        directions: manifest.directions?.length || 0,
        slashAssets: Object.keys(manifest.slashAssets || {}).length,
        skinAgnostic: manifest.skinAgnostic === true
      },
      comboStyles: JSON.parse(JSON.stringify(window.KeloMeleeVisuals.comboStyles || {})),
      profiles,
      assets,
      screenFx: {
        lightImpact: window.KeloScreenFX?.get('impact_melee_light') || null,
        lightFlash: window.KeloScreenFX?.get('flash_melee_light') || null,
        mediumImpact: window.KeloScreenFX?.get('impact_medium') || null
      }
    };
  });
  if (!boot.player) throw new Error('LIVE_LOCAL_PLAYER_UNAVAILABLE');

  await page.screenshot({ path: `${outDir}/00-live-boot.png`, fullPage: false, scale: 'device' });

  const directionVectors = {
    right: { x: 1, y: 0 },
    down_right: { x: 1, y: 1 },
    down: { x: 0, y: 1 },
    down_left: { x: -1, y: 1 },
    left: { x: -1, y: 0 },
    up_left: { x: -1, y: -1 },
    up: { x: 0, y: -1 },
    up_right: { x: 1, y: -1 }
  };
  const directionResults = await page.evaluate(vectors => {
    const rows = [];
    let n = 0;
    for (const [expected, dir] of Object.entries(vectors)) {
      const actor = { id: `live_aim_actor_${n}`, x: 500, y: 500, radius: 20, _face: 'down', skinId: `skin_${n}` };
      const target = { id: `live_aim_target_${n}`, x: 500 + dir.x * 90, y: 500 + dir.y * 90, radius: 20, _face: 'down', skinId: `other_${n}` };
      const result = window.KeloMeleeVisuals.playAttack({
        attackId: `live_aim_${n}_${Date.now()}`,
        actor, targetActor: target, direction: dir,
        profileId: 'sword_light_basic', confirmedHit: false, source: 'live-combat-feel-agent'
      });
      rows.push({ expected, actual: result?.direction8 || null, face: result?.face || null, ok: result?.direction8 === expected });
      n++;
    }
    return rows;
  }, directionVectors);

  await page.evaluate(() => window.enterPvPWorld());
  await page.waitForFunction(() => window.KeloPvPWorld?.state?.combatEnabled === true, null, { timeout: 7000 });
  await page.waitForTimeout(250);

  await page.evaluate(() => {
    const p = typeof localPlayer !== 'undefined' ? localPlayer : window.localPlayer;
    const d = typeof simulatedPlayers !== 'undefined' ? simulatedPlayers[0] : null;
    if (!p || !d) throw new Error('LIVE_PVP_ACTORS_UNAVAILABLE');
    d.maxHp = 500;
    d.hp = 500;
    p.vx = p.vy = 0;
  });

  const expectedProfiles = ['sword_light_basic', 'sword_light_follow', 'sword_light_finisher'];
  const expectedDamage = [18, 20, 28];
  const comboTrace = [];

  for (let stage = 0; stage < 3; stage++) {
    await page.waitForFunction(() => !window.KeloPvPWorld.state.basicAttack, null, { timeout: 2500 });
    const prepared = await page.evaluate(() => {
      const p = typeof localPlayer !== 'undefined' ? localPlayer : window.localPlayer;
      const d = simulatedPlayers[0];
      p.x = d.x - 105;
      p.y = d.y;
      p.vx = p.vy = 0;
      if (typeof camera !== 'undefined') {
        camera.x = p.x; camera.y = p.y;
        if ('targetX' in camera) camera.targetX = p.x;
        if ('targetY' in camera) camera.targetY = p.y;
      }
      window.KeloPvPWorld.setAimWorld({ x: d.x, y: d.y }, 'live-combat-feel-agent', 1);
      return {
        player: { x: p.x, y: p.y },
        dummy: { x: d.x, y: d.y, hp: d.hp },
        attacksBefore: window.KELO_MELEE_VISUAL_AUDIT?.attacksStarted || 0,
        hitsBefore: window.KELO_MELEE_VISUAL_AUDIT?.hitsPresented || 0
      };
    });

    const t0 = Date.now();
    const accepted = await page.evaluate(() => window.KeloPvPWorld.startBasicAttack('live-combat-feel-agent'));
    if (!accepted) throw new Error(`M1_STAGE_${stage + 1}_REJECTED`);
    await page.waitForFunction(() => !!window.KeloPvPWorld.state.basicAttack, null, { timeout: 800 });

    await page.keyboard.down('d');
    await page.waitForTimeout(105);
    const mid = await page.evaluate(() => {
      const p = typeof localPlayer !== 'undefined' ? localPlayer : window.localPlayer;
      const a = window.KeloPvPWorld.state.basicAttack;
      const transform = window.KeloAnimation.sampleTransform(p);
      const def = transform && window.KeloAnimationRegistry.get(transform.clipId);
      const peakOffset = def && Array.isArray(def.keyframes)
        ? Math.max(...def.keyframes.map(k => Math.hypot(Number(k.offsetX) || 0, Number(k.offsetY) || 0)))
        : 0;
      return {
        player: { x: p.x, y: p.y },
        profileId: a?.profileId || null,
        phase: a?.phase || null,
        clipId: transform?.clipId || null,
        peakVisualLungePx: peakOffset,
        visualStage: window.KELO_MELEE_VISUAL_AUDIT?.lastComboStage || null,
        visualDirection: window.KELO_MELEE_VISUAL_AUDIT?.lastDirection || null
      };
    });
    await page.keyboard.up('d');
    await page.screenshot({ path: `${outDir}/m1-${stage + 1}-swing.png`, fullPage: false, scale: 'device' });

    await page.waitForFunction(() => !window.KeloPvPWorld.state.basicAttack, null, { timeout: 2500 });
    const ended = await page.evaluate(() => {
      const p = typeof localPlayer !== 'undefined' ? localPlayer : window.localPlayer;
      const d = simulatedPlayers[0];
      return {
        player: { x: p.x, y: p.y },
        dummyHp: d.hp,
        visualStage: window.KELO_MELEE_VISUAL_AUDIT?.lastComboStage || null,
        hitStage: window.KELO_MELEE_VISUAL_AUDIT?.lastHitComboStage || null,
        attacks: window.KELO_MELEE_VISUAL_AUDIT?.attacksStarted || 0,
        hits: window.KELO_MELEE_VISUAL_AUDIT?.hitsPresented || 0,
        comboStep: window.KeloPvPWorld.state.comboStep
      };
    });

    comboTrace.push({
      stage: stage + 1,
      accepted: true,
      startLatencyMs: Date.now() - t0,
      profileId: mid.profileId,
      clipId: mid.clipId,
      visualStage: mid.visualStage,
      hitStage: ended.hitStage,
      direction: mid.visualDirection,
      movementPx: Math.hypot(mid.player.x - prepared.player.x, mid.player.y - prepared.player.y),
      peakVisualLungePx: mid.peakVisualLungePx,
      damage: prepared.dummy.hp - ended.dummyHp,
      hpAfter: ended.dummyHp,
      attacksDelta: ended.attacks - prepared.attacksBefore,
      hitsDelta: ended.hits - prepared.hitsBefore,
      comboStepAfter: ended.comboStep
    });
    await page.waitForTimeout(35);
  }

  await page.screenshot({ path: `${outDir}/04-combo-finished.png`, fullPage: false, scale: 'device' });

  const reversalBefore = await page.evaluate(() => {
    const p = typeof localPlayer !== 'undefined' ? localPlayer : window.localPlayer;
    return { x: p.x, y: p.y };
  });
  await page.keyboard.down('a');
  await page.waitForTimeout(140);
  const reversalAfter = await page.evaluate(() => {
    const p = typeof localPlayer !== 'undefined' ? localPlayer : window.localPlayer;
    return { x: p.x, y: p.y };
  });
  await page.keyboard.up('a');
  const reversalPx = Math.hypot(reversalAfter.x - reversalBefore.x, reversalAfter.y - reversalBefore.y);
  const reversalCorrect = reversalAfter.x < reversalBefore.x;

  await page.waitForTimeout(700);
  const performanceResult = await page.evaluate(async () => {
    const frames = [];
    let last = performance.now();
    for (let i = 0; i < 45; i++) {
      await new Promise(resolve => requestAnimationFrame(t => { frames.push(t - last); last = t; resolve(); }));
    }
    const sorted = frames.slice().sort((a, b) => a - b);
    const average = frames.reduce((a, b) => a + b, 0) / Math.max(1, frames.length);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] || 0;
    return {
      samples: frames.length,
      averageMs: average,
      p95Ms: p95,
      fx: window.KeloFX?.metrics?.() || null,
      animation: window.KeloAnimation?.metrics?.() || null,
      sequence: window.KeloSequence?.metrics?.() || null
    };
  });

  const dims = [];
  function dimension(name, max, earned, evidence) {
    const points = Math.max(0, Math.min(max, Number(earned) || 0));
    dims.push({ name, max, points, evidence });
  }

  const loadedCount = Object.values(boot.assets).filter(Boolean).length;
  const archPoints =
    (boot.manifest.directions === 8 ? 3 : 0) +
    (boot.manifest.slashAssets === 8 && loadedCount === 8 ? 2 : 0) +
    (boot.manifest.skinAgnostic ? 2 : 0) +
    (Object.keys(boot.comboStyles || {}).length === 3 ? 2 : 0) +
    (/^pvp-world-v3\./.test(boot.pvpVersion || '') ? 1 : 0);
  dimension('architecture-and-8way', 10, archPoints, { boot, loadedCount });

  const correctDirections = directionResults.filter(x => x.ok).length;
  dimension('free-aim-directional-precision', 20, 20 * correctDirections / 8, { correctDirections, directionResults });

  const profileOk = comboTrace.every((x, i) => x.profileId === expectedProfiles[i]);
  const visualStageOk = comboTrace.every((x, i) => x.visualStage === i + 1 && x.hitStage === i + 1);
  const distinctClips = new Set(comboTrace.map(x => x.clipId).filter(Boolean)).size;
  const damageOk = comboTrace.every((x, i) => x.damage === expectedDamage[i]);
  const comboPoints = (profileOk ? 8 : 0) + (visualStageOk ? 6 : 0) + (distinctClips === 3 ? 5 : 0) + (damageOk ? 6 : 0);
  dimension('m1-chain-readability-and-authority', 25, comboPoints, { expectedProfiles, expectedDamage, profileOk, visualStageOk, distinctClips, damageOk, comboTrace });

  const movingStages = comboTrace.filter(x => x.movementPx >= 2).length;
  const profileMovementOk = boot.profiles.every(p => p && Number(p.movementScale?.windup) > 0 && Number(p.movementScale?.active) > 0 && Number(p.movementScale?.recovery) > 0);
  const movementPoints = movingStages * 4 + (reversalPx >= 2 && reversalCorrect ? 4 : 0) + (profileMovementOk ? 4 : 0);
  dimension('movement-freedom-and-reversal', 20, movementPoints, { movingStages, reversalPx, reversalCorrect, profileMovementOk, movementPx: comboTrace.map(x => x.movementPx), movementScale: boot.profiles.map(p => p?.movementScale) });

  const impactTimes = [1, 2, 3].map(i => Number(boot.comboStyles?.[i]?.impactAtMs));
  const impactDistinct = new Set(impactTimes).size === 3 && impactTimes.every(x => Number.isFinite(x) && x < 150);
  const scales = [1, 2, 3].map(i => Number(boot.comboStyles?.[i]?.slashScale));
  const scaleProgression = scales[2] > scales[1] && scales[1] > scales[0];
  const lunges = comboTrace.map(x => Number(x.peakVisualLungePx) || 0);
  const lungeProgression = lunges[2] > lunges[1] && lunges[1] >= lunges[0] && lunges[0] > 0;
  const heavyFinisher = boot.comboStyles?.[3]?.heavyImpact === true && boot.comboStyles?.[1]?.heavyImpact !== true;
  const feedbackPresent = !!boot.screenFx.lightImpact && !!boot.screenFx.lightFlash;
  const impactPoints = (impactDistinct ? 4 : 0) + (scaleProgression ? 3 : 0) + (lungeProgression ? 4 : 0) + (heavyFinisher ? 2 : 0) + (feedbackPresent ? 2 : 0);
  dimension('impact-cadence-and-visual-lunge', 15, impactPoints, { impactTimes, impactDistinct, scales, scaleProgression, lunges, lungeProgression, heavyFinisher, feedbackPresent });

  const criticalFailures = failedRequests.filter(x => /pvp-world|melee-|visual-|engine-c|index\.html/i.test(x.url));
  const criticalHttp = httpErrors.filter(x => /pvp-world|melee-|visual-|engine-c|index\.html/i.test(x.url));
  const stabilityPoints =
    (performanceResult.p95Ms <= 40 ? 4 : performanceResult.p95Ms <= 55 ? 2 : 0) +
    (performanceResult.averageMs <= 25 ? 2 : 0) +
    (pageErrors.length === 0 ? 2 : 0) +
    (criticalFailures.length === 0 && criticalHttp.length === 0 ? 2 : 0);
  dimension('mobile-stability-and-frame-time', 10, stabilityPoints, { performanceResult, pageErrors, criticalFailures, criticalHttp });

  const score = Math.round(dims.reduce((sum, x) => sum + x.points, 0) * 10) / 10;
  const weakest = dims.slice().sort((a, b) => (a.points / a.max) - (b.points / b.max))[0];
  const verdict = score >= threshold ? 'ACCEPTED_DRAKANTOS_STYLE' : score >= threshold - 10 ? 'CLOSE_TUNE_NEXT_GAP' : 'REJECTED_COMBAT_FEEL_GAP';
  const report = {
    version: 'live-combat-feel-agent-v1.0.1-lazy-bootstrap',
    generatedAt: new Date().toISOString(),
    url: page.url(),
    threshold,
    score,
    verdict,
    weakestDimension: weakest?.name || null,
    dimensions: dims,
    boot,
    directionResults,
    comboTrace,
    reversal: { before: reversalBefore, after: reversalAfter, distancePx: reversalPx, correctDirection: reversalCorrect },
    performance: performanceResult,
    diagnostics: { consoleErrors, pageErrors, failedRequests, httpErrors }
  };
  fs.writeFileSync(`${outDir}/combat-feel-score.json`, JSON.stringify(report, null, 2));
  console.log('KELO LIVE COMBAT FEEL SCORE');
  console.log(JSON.stringify({ score, threshold, verdict, weakestDimension: report.weakestDimension, dimensions: dims.map(x => ({ name: x.name, points: x.points, max: x.max })) }, null, 2));

  if (score < threshold) throw new Error(`COMBAT_FEEL_BELOW_THRESHOLD score=${score} threshold=${threshold} weakest=${report.weakestDimension}`);
} catch (error) {
  fs.writeFileSync(`${outDir}/fatal-error.txt`, String(error?.stack || error));
  try { await page.screenshot({ path: `${outDir}/fatal-live-state.png`, fullPage: false, scale: 'device' }); } catch {}
  throw error;
} finally {
  await browser.close();
}
