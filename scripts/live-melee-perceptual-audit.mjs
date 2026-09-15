/* KELO-INDEX
 * area: QA / LIVE COMBAT FEEL
 * owner: live-melee-perceptual-audit
 * keys: LIVE MOBILE PVP PERCEPTUAL BODY MOTION ANTICIPATION STRIKE IMPACT REACTION DRAKANTOS CONVERGENCE
 * purpose: rechaza ataques técnicamente correctos que visualmente casi no cambian; mide cuerpo real antes/durante/después del impacto en Pages
 * invariant: usa el PvP público y el runtime desplegado; no concede puntos por arquitectura si el movimiento corporal no es perceptible
 */
import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
const threshold = Number(process.env.PERCEPTUAL_MOTION_THRESHOLD || 90);
const outDir = 'artifacts/melee-live-perceptual';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await context.newPage();
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', e => pageErrors.push(String(e.stack || e.message || e)));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

await page.route(/\/(src\/systems\/(?:pvp-world\.js|melee\/[^?]+\.js)|src\/visuals\/(?:melee-visual-manifest|melee-combat-visuals|combat-presentation-bridge|visual-integration)\.js)(\?|$)/, route => {
  const u = new URL(route.request().url());
  u.searchParams.set('perceptual-live-bust', `${Date.now()}-${Math.random()}`);
  route.continue({ url: u.toString() });
});

function add(points, ok, evidence, rows, name) {
  rows.push({ name, pointsPossible: points, points: ok ? points : 0, ok, evidence });
  return ok ? points : 0;
}

try {
  const response = await page.goto(`${base}?perceptual-melee-agent=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  if (!response || response.status() >= 400) throw new Error(`LIVE_PAGE_HTTP_${response?.status() || 'NO_RESPONSE'}`);
  await page.waitForFunction(() => /^Kelo World — V/i.test(document.title), null, { timeout: 30000 });
  await page.waitForFunction(() => !!window.KeloRuntimeBootstrap?.ensure, null, { timeout: 15000 });
  await page.evaluate(async () => { await window.KeloRuntimeBootstrap.ensure(); });
  await page.waitForFunction(() => !!(window.KeloPvPWorld && window.KeloMeleeVisuals && window.KeloAnimationRegistry && window.KELO_MELEE_VISUAL_MANIFEST), null, { timeout: 30000 });

  await page.evaluate(() => window.enterPvPWorld());
  await page.waitForFunction(() => window.KeloPvPWorld?.state?.combatEnabled === true, null, { timeout: 7000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outDir}/00-pvp-ready.png`, scale: 'device' });

  const stages = [
    { stage: 1, profileId: 'sword_light_basic', minForward: 16, minBack: 6, minLiveImpact: 12, anticipationSampleMs: 35 },
    { stage: 2, profileId: 'sword_light_follow', minForward: 16.5, minBack: 6.2, minLiveImpact: 12, anticipationSampleMs: 32 },
    { stage: 3, profileId: 'sword_light_finisher', minForward: 20, minBack: 7.5, minLiveImpact: 17, anticipationSampleMs: 45 }
  ];
  const traces = [];

  for (const cfg of stages) {
    await page.waitForFunction(() => !window.KeloPvPWorld.state.basicAttack, null, { timeout: 2500 });
    const setup = await page.evaluate(() => {
      const p = typeof localPlayer !== 'undefined' ? localPlayer : window.localPlayer;
      const d = simulatedPlayers[0];
      if (!p || !d) throw new Error('LIVE_PVP_ACTORS_UNAVAILABLE');
      d.maxHp = 500; d.hp = 500;
      p.x = d.x - 105; p.y = d.y; p.vx = p.vy = 0;
      if (typeof camera !== 'undefined') {
        camera.x = p.x; camera.y = p.y;
        if ('targetX' in camera) camera.targetX = p.x;
        if ('targetY' in camera) camera.targetY = p.y;
      }
      window.KeloPvPWorld.setAimWorld({ x: d.x, y: d.y }, 'live-perceptual-agent', 1);
      return { player: { x: p.x, y: p.y }, dummy: { x: d.x, y: d.y, hp: d.hp } };
    });

    const startAt = Date.now();
    const accepted = await page.evaluate(() => window.KeloPvPWorld.startBasicAttack('live-perceptual-agent'));
    if (!accepted) throw new Error(`M1_STAGE_${cfg.stage}_REJECTED`);
    await page.waitForFunction(() => !!window.KeloPvPWorld.state.basicAttack, null, { timeout: 800 });

    const definition = await page.evaluate(expectedStage => {
      const p = typeof localPlayer !== 'undefined' ? localPlayer : window.localPlayer;
      const transform = window.KeloAnimation.sampleTransform(p);
      const def = transform && window.KeloAnimationRegistry.get(transform.clipId);
      const style = window.KeloMeleeVisuals.comboStyles[expectedStage];
      const frames = def?.keyframes || [];
      const projections = frames.map(k => Number(k.offsetX) || 0);
      const forward = projections.length ? Math.max(...projections) : 0;
      const back = projections.length ? Math.abs(Math.min(...projections)) : 0;
      const peak = frames.reduce((best, k) => !best || (Number(k.offsetX) || 0) > (Number(best.offsetX) || 0) ? k : best, null);
      const strikeAtMs = peak ? Number(peak.t) * Number(def.duration) * 1000 : Infinity;
      return {
        clipId: transform?.clipId || null,
        durationMs: Number(def?.duration || 0) * 1000,
        impactAtMs: Number(style?.impactAtMs || 0),
        forwardPeakPx: forward,
        anticipationBackPx: back,
        visualTravelPx: forward + back,
        strikeAtMs,
        impactDeltaMs: Math.abs(strikeAtMs - Number(style?.impactAtMs || 0))
      };
    }, cfg.stage);

    await page.waitForTimeout(Math.max(0, cfg.anticipationSampleMs - (Date.now() - startAt)));
    const anticipation = await page.evaluate(() => {
      const p = typeof localPlayer !== 'undefined' ? localPlayer : window.localPlayer;
      const t = window.KeloAnimation.sampleTransform(p);
      return { offsetX: Number(t?.offsetX) || 0, offsetY: Number(t?.offsetY) || 0, rotation: Number(t?.rotation) || 0, clipId: t?.clipId || null };
    });
    await page.screenshot({ path: `${outDir}/m1-${cfg.stage}-anticipation.png`, scale: 'device' });

    const impactAtMs = definition.impactAtMs;
    await page.waitForTimeout(Math.max(0, impactAtMs - (Date.now() - startAt)));
    const impact = await page.evaluate(() => {
      const p = typeof localPlayer !== 'undefined' ? localPlayer : window.localPlayer;
      const t = window.KeloAnimation.sampleTransform(p);
      return { offsetX: Number(t?.offsetX) || 0, offsetY: Number(t?.offsetY) || 0, rotation: Number(t?.rotation) || 0, clipId: t?.clipId || null };
    });
    await page.screenshot({ path: `${outDir}/m1-${cfg.stage}-impact.png`, scale: 'device' });

    await page.waitForTimeout(42);
    const reaction = await page.evaluate(() => {
      const d = simulatedPlayers[0];
      const t = window.KeloAnimation.sampleTransform(d);
      return {
        offsetX: Number(t?.offsetX) || 0,
        offsetY: Number(t?.offsetY) || 0,
        magnitudePx: Math.hypot(Number(t?.offsetX) || 0, Number(t?.offsetY) || 0),
        clipId: t?.clipId || null,
        channel: t?.channel || null,
        hp: d.hp
      };
    });
    await page.screenshot({ path: `${outDir}/m1-${cfg.stage}-reaction.png`, scale: 'device' });

    await page.waitForFunction(() => !window.KeloPvPWorld.state.basicAttack, null, { timeout: 2500 });
    traces.push({ cfg, setup, definition, anticipation, impact, reaction, elapsedToImpactSampleMs: Date.now() - startAt });
    await page.waitForTimeout(35);
  }

  const rows = [];
  let score = 0;
  traces.forEach((trace, i) => {
    const cfg = trace.cfg;
    score += add(5, trace.definition.forwardPeakPx >= cfg.minForward, trace.definition.forwardPeakPx, rows, `M1-${cfg.stage} definition forward peak`);
    score += add(5, trace.definition.anticipationBackPx >= cfg.minBack, trace.definition.anticipationBackPx, rows, `M1-${cfg.stage} definition anticipation`);
    score += add(5, trace.definition.impactDeltaMs <= 8, trace.definition.impactDeltaMs, rows, `M1-${cfg.stage} strike-hit alignment`);

    score += add(5, trace.anticipation.offsetX <= -3, trace.anticipation, rows, `M1-${cfg.stage} LIVE body winds back`);
    score += add(5, trace.impact.offsetX >= cfg.minLiveImpact, trace.impact, rows, `M1-${cfg.stage} LIVE body reaches strike`);
    score += add(5, trace.reaction.magnitudePx >= 5 && trace.reaction.channel === 'reaction', trace.reaction, rows, `M1-${cfg.stage} LIVE target recoil`);
  });

  const forward = traces.map(t => t.definition.forwardPeakPx);
  score += add(5, forward[1] > forward[0] && forward[2] > forward[1], forward, rows, 'combo body escalation 1<2<3');
  score += add(5, pageErrors.length === 0, pageErrors, rows, 'LIVE runtime stability');
  score = Math.round(score * 10) / 10;

  const verdict = score >= threshold ? 'PERCEPTIBLE_BODY_MOTION_ACCEPTED' : 'PERCEPTUAL_GAP_REMAINS';
  const report = {
    version: 'live-melee-perceptual-audit-v1.0.0',
    generatedAt: new Date().toISOString(),
    url: page.url(),
    threshold,
    score,
    verdict,
    traces,
    checks: rows,
    diagnostics: { pageErrors, consoleErrors }
  };
  fs.writeFileSync(`${outDir}/perceptual-motion-score.json`, JSON.stringify(report, null, 2));
  console.log('KELO LIVE PERCEPTUAL MELEE SCORE');
  console.log(JSON.stringify({ score, threshold, verdict, motion: traces.map(t => ({ stage: t.cfg.stage, definition: t.definition, anticipation: t.anticipation, impact: t.impact, reaction: t.reaction })) }, null, 2));

  if (score < threshold) throw new Error(`PERCEPTUAL_MELEE_BELOW_THRESHOLD score=${score} threshold=${threshold}`);
} catch (error) {
  fs.writeFileSync(`${outDir}/fatal-error.txt`, String(error?.stack || error));
  try { await page.screenshot({ path: `${outDir}/fatal-live-state.png`, scale: 'device' }); } catch {}
  throw error;
} finally {
  await browser.close();
}
