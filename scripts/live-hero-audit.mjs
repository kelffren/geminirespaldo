import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL || 'https://kelffren.github.io/gemini/';
const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
fs.mkdirSync('artifacts', { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

async function runViewport(name, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  const httpErrors = [];

  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(`PAGEERROR: ${e.stack || e.message}`));
  page.on('requestfailed', r => failedRequests.push({ url: r.url(), error: r.failure()?.errorText || 'failed' }));
  page.on('response', r => { if (r.status() >= 400) httpErrors.push({ status: r.status(), url: r.url() }); });

  // Hero presentation, lateral gait and dependent aura are under active locomotion/scale research.
  // Bust only these resources so the audit cannot validate stale visual or gait code.
  await page.route(/\/(engine-ab\.js|engine-ac\.js|engine-ah\.js|assets\/hero\.PNG|src\/systems\/armor-aura\.js)(\?|$)/, route => {
    const u = new URL(route.request().url());
    u.searchParams.set('hero-audit-bust', `${Date.now()}-${Math.random()}`);
    route.continue({ url: u.toString() });
  });

  await page.goto(`${base}?hero-live-audit=${name}-${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000
  });

  await page.waitForFunction(() => {
    const a = window.KELO_HERO_SPRITE_AUDIT;
    return !!(a && a.loaded && (a.processed || a.error));
  }, null, { timeout: 10000 });

  await page.waitForFunction(() => {
    const m = window.KELO_MOVEMENT_AUDIT;
    return !!(m && m.version === 'MOV-plant-audit-v1');
  }, null, { timeout: 5000 });

  const result = await page.evaluate(() => {
    const a = window.KELO_HERO_SPRITE_AUDIT ? JSON.parse(JSON.stringify(window.KELO_HERO_SPRITE_AUDIT)) : null;
    const p = window.localPlayer || (typeof localPlayer !== 'undefined' ? localPlayer : null);
    const presentation = p && window.KELO_AVATAR_PRESENTATION ? window.KELO_AVATAR_PRESENTATION.get(p, p._face || 'down') : null;
    const auraAudit = window.KELO_ARMOR_AURA_AUDIT ? JSON.parse(JSON.stringify(window.KELO_ARMOR_AURA_AUDIT)) : null;
    const auraMetrics = p && window.KeloArmorAura && typeof window.KeloArmorAura.visualMetrics === 'function'
      ? window.KeloArmorAura.visualMetrics(p)
      : null;
    const c = document.getElementById('game-canvas');
    return {
      title: document.title,
      audit: a,
      presentation,
      auraAudit,
      auraMetrics,
      player: p ? { x: p.x, y: p.y, radius: p.radius, face: p._face || null } : null,
      canvas: c ? { width: c.width, height: c.height, cssWidth: c.clientWidth, cssHeight: c.clientHeight } : null,
      dpr: window.devicePixelRatio || 1
    };
  });

  await page.screenshot({ path: `artifacts/hero-${name}.png`, fullPage: false, scale: 'device' });

  if (!result.audit) throw new Error(`${name}: hero audit missing`);
  if (result.audit.version !== 'hero-preprocess-audit-v5') throw new Error(`${name}: unexpected hero audit ${result.audit.version}`);
  if (!result.audit.loaded || !result.audit.processed || result.audit.error) throw new Error(`${name}: hero preprocessing failed ${JSON.stringify(result.audit)}`);
  if (result.audit.avatarVisualScale !== 1.15) throw new Error(`${name}: hero audit visual scale mismatch ${result.audit.avatarVisualScale}`);
  if (!Array.isArray(result.audit.croppedOpaquePixelCountByFrame) || result.audit.croppedOpaquePixelCountByFrame.length !== 16) throw new Error(`${name}: crop buckets invalid`);
  if (!(result.audit.lateralComparedPixelCount > 0)) throw new Error(`${name}: lateral row comparison missing`);
  for (const k of ['row1VsRow2RgbaSimilarityPct', 'row1VsMirroredRow2RgbaSimilarityPct']) {
    const v = result.audit[k];
    if (!(v >= 0 && v <= 100)) throw new Error(`${name}: ${k} out of range: ${v}`);
  }
  if (result.audit.lateralRenderedRow !== 2 || result.audit.lateralContactEvidenceMode !== 'visible-silhouette-bottom-band-v1') {
    throw new Error(`${name}: lateral contact evidence contract missing`);
  }
  if (!Array.isArray(result.audit.lateralContactFrames) || result.audit.lateralContactFrames.length !== 4) {
    throw new Error(`${name}: lateral contact frame evidence missing`);
  }
  for (const frame of result.audit.lateralContactFrames) {
    if (!Number.isInteger(frame.frame) || frame.frame < 0 || frame.frame > 3) throw new Error(`${name}: invalid contact frame index ${JSON.stringify(frame)}`);
    if (!(frame.lowestOpaqueY >= 0 && frame.lowestOpaqueY < result.audit.frameHeight)) throw new Error(`${name}: invalid lowest opaque y ${JSON.stringify(frame)}`);
    if (!(frame.bottomBandOpaquePixelCount > 0 && frame.supportWidthPx > 0)) throw new Error(`${name}: empty bottom support evidence ${JSON.stringify(frame)}`);
    if (!(frame.supportCentroidX >= 0 && frame.supportCentroidX < result.audit.frameWidth)) throw new Error(`${name}: invalid support centroid ${JSON.stringify(frame)}`);
  }
  if (result.audit.visibleAlphaMutationAfterIdle !== (result.audit.whiteKnockoutOpaquePixelCount > 0)) throw new Error(`${name}: alpha mutation semantics inconsistent`);
  if (!result.presentation || result.presentation.colliderRadius !== result.player?.radius) throw new Error(`${name}: presentation/collider contract unavailable`);
  if (result.presentation.visualScale !== 1.15) throw new Error(`${name}: presentation scale mismatch ${result.presentation.visualScale}`);
  if (result.presentation.footRootX !== result.presentation.physicsRootX || result.presentation.footRootY - result.presentation.physicsRootY !== 10) throw new Error(`${name}: foot root drift under visual scale`);
  if (!(result.presentation.visualWidth > result.presentation.baseVisualWidth && result.presentation.visualHeight > result.presentation.baseVisualHeight)) throw new Error(`${name}: 1.15x visual scale did not enlarge avatar`);
  if (!result.auraAudit || result.auraAudit.version !== 'armor-aura-v1.1' || result.auraAudit.usesAvatarPresentation !== true) throw new Error(`${name}: aura audit contract missing`);
  if (!result.auraMetrics) throw new Error(`${name}: aura visual metrics missing`);
  if (result.auraMetrics.physicsRadius !== result.player?.radius) throw new Error(`${name}: aura changed physics radius`);
  if (result.auraMetrics.visualScale !== result.presentation.visualScale) throw new Error(`${name}: aura visual scale drift ${result.auraMetrics.visualScale}`);
  if (!(result.auraMetrics.effectRadius > result.auraMetrics.physicsRadius)) throw new Error(`${name}: aura did not follow enlarged avatar`);

  async function movementSnapshot(label) {
    return page.evaluate((sampleLabel) => {
      const p = window.localPlayer || (typeof localPlayer !== 'undefined' ? localPlayer : null);
      const movement = window.KELO_MOVEMENT_AUDIT ? JSON.parse(JSON.stringify(window.KELO_MOVEMENT_AUDIT)) : null;
      const presentation = p && window.KELO_AVATAR_PRESENTATION ? window.KELO_AVATAR_PRESENTATION.get(p, p._face || 'down') : null;
      return {
        label: sampleLabel,
        player: p ? { x: p.x, y: p.y, vx: p.vx || 0, vy: p.vy || 0, radius: p.radius, face: p._face || null } : null,
        movement,
        presentation
      };
    }, label);
  }

  function assertPresentationInvariant(sample) {
    if (!sample.player || !sample.movement || !sample.presentation) throw new Error(`${name}: incomplete dynamic sample ${sample.label}`);
    if (sample.movement.version !== 'MOV-plant-audit-v1') throw new Error(`${name}: stale movement contract during ${sample.label}`);
    if (sample.presentation.visualScale !== 1.15) throw new Error(`${name}: visual scale drift during ${sample.label}`);
    if (sample.presentation.colliderRadius !== sample.player.radius) throw new Error(`${name}: collider drift during ${sample.label}`);
    if (sample.presentation.footRootX !== sample.presentation.physicsRootX || sample.presentation.footRootY - sample.presentation.physicsRootY !== 10) {
      throw new Error(`${name}: foot root drift during ${sample.label}`);
    }
  }

  function assertPlantedRelease(sample) {
    const m = sample.movement;
    if (m.visualOn) throw new Error(`${name}: ${sample.label} still visually moving ${JSON.stringify(sample)}`);
    if (m.visualFrame !== m.plantFrame) throw new Error(`${name}: ${sample.label} frame ${m.visualFrame} != plant ${m.plantFrame}`);
    if (Math.abs((m.stridePhase || 0) - (m.plantPhase || 0)) > 0.001) throw new Error(`${name}: ${sample.label} phase ${m.stridePhase} != plant ${m.plantPhase}`);
    if (Math.abs(m.strideDistancePx || 0) > 0.001) throw new Error(`${name}: ${sample.label} retained stride distance ${m.strideDistancePx}`);
  }

  // Controlled short trace: cardinal RIGHT, immediate reversal LEFT, release, then diagonal.
  // Short holds keep the run close to spawn so environment collision differences do not dominate the hero contract.
  const dynamic = { samples: [] };
  dynamic.samples.push(await movementSnapshot('baseline'));

  await page.keyboard.down('d');
  await page.waitForTimeout(220);
  dynamic.samples.push(await movementSnapshot('right'));
  await page.keyboard.up('d');
  await page.keyboard.down('a');
  await page.waitForTimeout(220);
  dynamic.samples.push(await movementSnapshot('left-reversal'));
  await page.keyboard.up('a');
  await page.waitForTimeout(140);
  dynamic.samples.push(await movementSnapshot('release'));

  await page.keyboard.down('d');
  await page.keyboard.down('s');
  await page.waitForTimeout(220);
  dynamic.samples.push(await movementSnapshot('diagonal-down-right'));
  await page.keyboard.up('d');
  await page.keyboard.up('s');
  await page.waitForTimeout(140);
  dynamic.samples.push(await movementSnapshot('final-release'));

  for (const sample of dynamic.samples) assertPresentationInvariant(sample);

  const [baseline, right, left, release, diagonal, finalRelease] = dynamic.samples;
  dynamic.rightDistancePx = Math.hypot(right.player.x - baseline.player.x, right.player.y - baseline.player.y);
  dynamic.reversalDistancePx = Math.hypot(left.player.x - right.player.x, left.player.y - right.player.y);
  dynamic.diagonalDxPx = diagonal.player.x - release.player.x;
  dynamic.diagonalDyPx = diagonal.player.y - release.player.y;
  dynamic.finalOffsetPx = Math.hypot(finalRelease.player.x - baseline.player.x, finalRelease.player.y - baseline.player.y);
  dynamic.releaseCountDelta = (finalRelease.movement.releaseCount || 0) - (baseline.movement.releaseCount || 0);
  dynamic.reversalCountDelta = (finalRelease.movement.reversalCount || 0) - (baseline.movement.reversalCount || 0);
  dynamic.reversalAccidentalIdleDelta = (finalRelease.movement.reversalAccidentalIdleCount || 0) - (baseline.movement.reversalAccidentalIdleCount || 0);
  dynamic.reversalFrameJumpDelta = (finalRelease.movement.reversalFrameJumpCount || 0) - (baseline.movement.reversalFrameJumpCount || 0);
  dynamic.plantFrame = finalRelease.movement.plantFrame;
  dynamic.plantPhase = finalRelease.movement.plantPhase;

  if (!(dynamic.rightDistancePx > 8 && right.player.x > baseline.player.x)) throw new Error(`${name}: RIGHT trace did not move right ${JSON.stringify(dynamic)}`);
  if (!(dynamic.reversalDistancePx > 8 && left.player.x < right.player.x)) throw new Error(`${name}: LEFT reversal did not move left ${JSON.stringify(dynamic)}`);
  if (!(Math.abs(dynamic.diagonalDxPx) > 4 && Math.abs(dynamic.diagonalDyPx) > 4)) throw new Error(`${name}: diagonal trace missing one axis ${JSON.stringify(dynamic)}`);
  if (!(dynamic.reversalCountDelta >= 1)) throw new Error(`${name}: LEFT/RIGHT reversal was not observed ${JSON.stringify(dynamic)}`);
  if (dynamic.reversalAccidentalIdleDelta !== 0) throw new Error(`${name}: reversal introduced accidental idle ${JSON.stringify(dynamic)}`);
  if (dynamic.reversalFrameJumpDelta !== 0) throw new Error(`${name}: reversal introduced a frame jump ${JSON.stringify(dynamic)}`);
  if (!(dynamic.releaseCountDelta >= 2)) throw new Error(`${name}: release transitions were not observed ${JSON.stringify(dynamic)}`);
  assertPlantedRelease(release);
  assertPlantedRelease(finalRelease);

  await page.screenshot({ path: `artifacts/hero-${name}-after-dynamic-trace.png`, fullPage: false, scale: 'device' });

  if (consoleErrors.length || failedRequests.length || httpErrors.length) {
    throw new Error(`${name}: browser errors ${JSON.stringify({ consoleErrors, failedRequests, httpErrors })}`);
  }

  await context.close();
  return { name, ...result, dynamic, consoleErrors, failedRequests, httpErrors };
}

const mobile = await runViewport('mobile', {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true
});

const desktop = await runViewport('desktop', {
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false
});

const report = { mobile, desktop };
fs.writeFileSync('artifacts/hero-live-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await browser.close();