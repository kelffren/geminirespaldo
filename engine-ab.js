/* KELO-INDEX
 * area: AVATAR / HERO PRESENTATION
 * owner: engine-ab production hero sprite middleware; identity text delegates to KeloActorNameplate when available
 * keys: HERO SPRITE FOOT ROOT VISUAL SCALE NAMEPLATE DELEGATION
 * purpose: renderiza el hero de producción y publica anchors semánticos sin competir con el owner moderno de identidad
 * consumes: KeloAvatar; optional KeloActorNameplate
 * do-not: NO duplicar nombre/título/nobleza cuando KeloActorNameplate está LIVE
 */
(function () {
  const raw = new Image();
  raw.decoding = 'async';
  if ('fetchPriority' in raw) raw.fetchPriority = 'high';
  let sheet = null, ok = false, FW = 256, FH = 384;
  const COLS = 4;
  const ROWS = 4;
  const FOOT_ROOT_OFFSET_Y = 10;
  const AVATAR_VISUAL_SCALE = 1.15;
  const HERO_AUDIT = window.KELO_HERO_SPRITE_AUDIT = {
    version: 'hero-preprocess-audit-v6-nameplate-delegation',
    source: 'assets/hero.PNG',
    loaded: false,
    processed: false,
    sheetWidth: 0,
    sheetHeight: 0,
    frameWidth: 0,
    frameHeight: 0,
    nearWhitePixelCount: 0,
    whiteKnockoutAffectedPixelCount: 0,
    whiteKnockoutOpaquePixelCount: 0,
    whiteKnockoutOpaqueLossPct: 0,
    croppedOpaquePixelCount: 0,
    croppedOpaquePixelCountByFrame: [],
    lateralComparedPixelCount: 0,
    row1VsRow2RgbaSimilarityPct: 0,
    row1VsMirroredRow2RgbaSimilarityPct: 0,
    lateralSimilarityDeltaPct: 0,
    lateralRenderedRow: 2,
    lateralContactEvidenceMode: 'visible-silhouette-bottom-band-v1',
    lateralContactFrames: [],
    avatarVisualScale: AVATAR_VISUAL_SCALE,
    sheetMutationAfterIdle: false,
    visibleAlphaMutationAfterIdle: false,
    identityFallbackOnly: true,
    delegatesIdentityWhenNameplateLive: true,
    preprocessMs: 0,
    error: null
  };

  function useRawSheet() {
    sheet = raw;
    FW = raw.width / COLS;
    FH = raw.height / ROWS;
    ok = true;
    HERO_AUDIT.loaded = true;
    HERO_AUDIT.sheetWidth = raw.width;
    HERO_AUDIT.sheetHeight = raw.height;
    HERO_AUDIT.frameWidth = FW;
    HERO_AUDIT.frameHeight = FH;
  }

  function rgbaEqual(d, a, b) {
    return d[a] === d[b] && d[a + 1] === d[b + 1] && d[a + 2] === d[b + 2] && d[a + 3] === d[b + 3];
  }

  function compareLateralRows(d, width) {
    const fw = Math.floor(FW);
    const fh = Math.floor(FH);
    if (!(fw > 0 && fh > 0)) return;
    const row1Y = fh;
    const row2Y = fh * 2;
    let comparedDirect = 0;
    let equalDirect = 0;
    let comparedMirror = 0;
    let equalMirror = 0;

    for (let col = 0; col < COLS; col++) {
      const frameX = col * fw;
      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
          const xMirror = fw - 1 - x;
          const i1 = ((row1Y + y) * width + frameX + x) * 4;
          const i2 = ((row2Y + y) * width + frameX + x) * 4;
          const i2m = ((row2Y + y) * width + frameX + xMirror) * 4;

          if (d[i1 + 3] > 0 || d[i2 + 3] > 0) {
            comparedDirect += 1;
            if (rgbaEqual(d, i1, i2)) equalDirect += 1;
          }
          if (d[i1 + 3] > 0 || d[i2m + 3] > 0) {
            comparedMirror += 1;
            if (rgbaEqual(d, i1, i2m)) equalMirror += 1;
          }
        }
      }
    }

    const directPct = comparedDirect ? equalDirect / comparedDirect * 100 : 0;
    const mirrorPct = comparedMirror ? equalMirror / comparedMirror * 100 : 0;
    HERO_AUDIT.lateralComparedPixelCount = Math.max(comparedDirect, comparedMirror);
    HERO_AUDIT.row1VsRow2RgbaSimilarityPct = directPct;
    HERO_AUDIT.row1VsMirroredRow2RgbaSimilarityPct = mirrorPct;
    HERO_AUDIT.lateralSimilarityDeltaPct = mirrorPct - directPct;
  }

  function measureLateralContactFrames(d, width, padX, padY) {
    const fw = Math.floor(FW);
    const fh = Math.floor(FH);
    const minX = Math.ceil(padX);
    const maxX = Math.max(minX, Math.floor(FW - padX - 1));
    const minY = Math.ceil(padY);
    const maxY = Math.max(minY, Math.floor(FH - padY - 1));
    const rowY = fh * 2;
    const frames = [];

    for (let col = 0; col < COLS; col++) {
      const frameX = col * fw;
      let lowestOpaqueY = -1;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const i = ((rowY + y) * width + frameX + x) * 4;
          if (d[i + 3] > 0 && y > lowestOpaqueY) lowestOpaqueY = y;
        }
      }

      let bottomBandOpaquePixelCount = 0;
      let supportMinX = null;
      let supportMaxX = null;
      let supportXSum = 0;
      if (lowestOpaqueY >= 0) {
        const bandMinY = Math.max(minY, lowestOpaqueY - 2);
        for (let y = bandMinY; y <= lowestOpaqueY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const i = ((rowY + y) * width + frameX + x) * 4;
            if (d[i + 3] <= 0) continue;
            bottomBandOpaquePixelCount += 1;
            supportXSum += x;
            supportMinX = supportMinX == null ? x : Math.min(supportMinX, x);
            supportMaxX = supportMaxX == null ? x : Math.max(supportMaxX, x);
          }
        }
      }

      frames.push({
        frame: col,
        lowestOpaqueY,
        bottomBandHeightPx: lowestOpaqueY >= 0 ? 3 : 0,
        bottomBandOpaquePixelCount,
        supportMinX,
        supportMaxX,
        supportWidthPx: supportMinX == null ? 0 : supportMaxX - supportMinX + 1,
        supportCentroidX: bottomBandOpaquePixelCount ? supportXSum / bottomBandOpaquePixelCount : null
      });
    }
    HERO_AUDIT.lateralContactFrames = frames;
  }

  function knockWhite() {
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    try {
      const c = document.createElement('canvas');
      c.width = raw.width;
      c.height = raw.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(raw, 0, 0);
      const data = g.getImageData(0, 0, c.width, c.height);
      const d = data.data;
      compareLateralRows(d, c.width);
      const padX = Math.max(2, FW * 0.05);
      const padY = Math.max(2, FH * 0.04);
      const cropByFrame = new Array(COLS * ROWS).fill(0);
      let nearWhite = 0;
      let affected = 0;
      let affectedOpaque = 0;
      let opaqueTotal = 0;
      let croppedOpaque = 0;

      for (let y = 0; y < c.height; y++) {
        const row = Math.min(ROWS - 1, Math.floor(y / FH));
        const localY = y - row * FH;
        for (let x = 0; x < c.width; x++) {
          const col = Math.min(COLS - 1, Math.floor(x / FW));
          const localX = x - col * FW;
          const i = (y * c.width + x) * 4;
          const alpha = d[i + 3];
          const isNearWhite = d[i] > 232 && d[i + 1] > 232 && d[i + 2] > 232;
          if (alpha > 0) opaqueTotal += 1;
          if (isNearWhite) nearWhite += 1;
          if (alpha > 0 && (localX < padX || localX >= FW - padX || localY < padY || localY >= FH - padY)) {
            const frameIndex = row * COLS + col;
            cropByFrame[frameIndex] += 1;
            croppedOpaque += 1;
          }
          if (isNearWhite) {
            affected += 1;
            if (alpha > 0) affectedOpaque += 1;
            d[i + 3] = 0;
          }
        }
      }
      measureLateralContactFrames(d, c.width, padX, padY);
      g.putImageData(data, 0, 0);
      sheet = c;
      HERO_AUDIT.processed = true;
      HERO_AUDIT.nearWhitePixelCount = nearWhite;
      HERO_AUDIT.whiteKnockoutAffectedPixelCount = affected;
      HERO_AUDIT.whiteKnockoutOpaquePixelCount = affectedOpaque;
      HERO_AUDIT.whiteKnockoutOpaqueLossPct = opaqueTotal ? affectedOpaque / opaqueTotal * 100 : 0;
      HERO_AUDIT.croppedOpaquePixelCount = croppedOpaque;
      HERO_AUDIT.croppedOpaquePixelCountByFrame = cropByFrame;
      HERO_AUDIT.visibleAlphaMutationAfterIdle = affectedOpaque > 0;
      HERO_AUDIT.sheetMutationAfterIdle = HERO_AUDIT.visibleAlphaMutationAfterIdle;
    } catch (e) {
      HERO_AUDIT.error = String(e && e.message ? e.message : e);
    }
    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    HERO_AUDIT.preprocessMs = Math.max(0, t1 - t0);
  }

  raw.onload = function () {
    useRawSheet();
    const later = function () { knockWhite(); };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(later, { timeout: 900 });
    else setTimeout(later, 0);
  };
  raw.onerror = function () {
    HERO_AUDIT.error = 'production sprite load failed';
    console.error('[Kelo hero] production sprite load failed');
  };
  raw.src = 'assets/hero.PNG';

  function legacyMovingOf(p) {
    if (p._lx == null) { p._lx = p.x; p._ly = p.y; }
    const dx = p.x - p._lx;
    const dy = p.y - p._ly;
    const dist = Math.hypot(dx, dy);
    const spd = Math.hypot(p.vx || 0, p.vy || 0);
    const toTarget = (p.targetX != null)
      ? Math.hypot((p.targetX - p.x), (p.targetY - p.y))
      : 0;
    if (dist > 0.12 || spd > 16 || toTarget > 14) p._walkHold = 10;
    else if (p._walkHold) p._walkHold -= 1;
    if (dist > 0.12) {
      p._mdx = dx;
      p._mdy = dy;
    } else if (spd > 16) {
      p._mdx = p.vx;
      p._mdy = p.vy;
    } else if (toTarget > 14) {
      p._mdx = p.targetX - p.x;
      p._mdy = p.targetY - p.y;
    }
    p._lx = p.x;
    p._ly = p.y;
    return { dx: p._mdx || 0, dy: p._mdy || 0, on: (p._walkHold || 0) > 0 };
  }

  function motionOf(p) {
    const v = p && p._visualMotion;
    if (v) return { dx: v.dx || 0, dy: v.dy || 0, on: !!v.on, face: v.face || p._face || 'down', frame: v.frame || 0 };
    const m = legacyMovingOf(p);
    m.face = p._face || 'down';
    m.frame = null;
    return m;
  }

  function faceOf(p, m) {
    if (m.face) return m.face;
    if (!m.on) return p._face || 'down';
    const side = Math.abs(m.dx) * 1.15 >= Math.abs(m.dy);
    const f = side ? (m.dx >= 0 ? 'right' : 'left') : (m.dy >= 0 ? 'down' : 'up');
    p._face = f;
    return f;
  }

  function stepCol(p, m) {
    if (!m.on) return 0;
    if (m.frame != null) return m.frame % COLS;
    return Math.floor(Date.now() / 130) % COLS;
  }

  function presentationOf(p, face) {
    const side = face === 'left' || face === 'right';
    const baseVisualWidth = side ? 48 : 54;
    const baseVisualHeight = Math.round(54 * (FH / FW));
    const visualWidth = Math.round(baseVisualWidth * AVATAR_VISUAL_SCALE);
    const visualHeight = Math.round(baseVisualHeight * AVATAR_VISUAL_SCALE);
    const physicsRootX = p.x;
    const physicsRootY = p.y;
    const footRootX = p.x;
    const footRootY = p.y + FOOT_ROOT_OFFSET_Y;
    return {
      physicsRootX, physicsRootY,
      colliderRadius: p.radius,
      footRootX, footRootY,
      depthRootX: footRootX, depthRootY: footRootY,
      shadowAnchorX: footRootX, shadowAnchorY: footRootY,
      visualScale: AVATAR_VISUAL_SCALE,
      baseVisualWidth, baseVisualHeight,
      visualWidth, visualHeight,
      visualLeft: footRootX - visualWidth / 2,
      visualTop: footRootY - visualHeight,
      visualRight: footRootX + visualWidth / 2,
      visualBottom: footRootY,
      nameplateAnchorX: footRootX,
      nameplateAnchorY: footRootY - visualHeight - 6
    };
  }

  window.KELO_AVATAR_PRESENTATION = Object.freeze({
    version: 'foot-root-scale-v2',
    footRootOffsetY: FOOT_ROOT_OFFSET_Y,
    visualScale: AVATAR_VISUAL_SCALE,
    get: function (p, face) { return presentationOf(p, face || (p && p._face) || 'down'); }
  });

  function renderProductionHero(p, isSelf, next) {
    if (!ok || !p || !sheet) return next();
    const m = motionOf(p);
    const face = faceOf(p, m);
    const col = stepCol(p, m);
    const row = face === 'up' ? 3 : (face === 'down' ? 0 : 2);
    const padX = Math.max(2, FW * 0.05);
    const padY = Math.max(2, FH * 0.04);
    const layout = presentationOf(p, face);
    const dw = layout.visualWidth;
    const dh = layout.visualHeight;
    const footY = layout.footRootY;
    ctx.save();
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    if (face === 'left') {
      ctx.translate(p.x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-p.x, 0);
    }
    ctx.drawImage(
      sheet,
      col * FW + padX, row * FH + padY, FW - padX * 2, FH - padY * 2,
      Math.round(p.x - dw / 2), Math.round(footY - dh),
      dw, dh
    );
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.restore();
    if (!window.KeloActorNameplate) {
      ctx.save();
      ctx.fillStyle = isSelf ? '#e7c56a' : '#f3eee4';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name || 'Kelo', Math.round(layout.nameplateAnchorX), Math.round(layout.nameplateAnchorY));
      ctx.restore();
    }
  }

  if(!window.KeloAvatar) throw new Error('KeloAvatar unavailable before engine-ab');
  window.KeloAvatar.use('engine-ab:production-hero', renderProductionHero, 100);
})();