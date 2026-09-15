/* KELO-INDEX
 * area: CHARACTERS
 * owner: KeloCharacterAppearance; avatar composition owned by KeloAvatar
 * keys: APPEARANCE PLAYER BOT HERO SPRITE FALLBACK FOUNDATION PVP AIM FACING STRAFE LOCOMOTION PLANT PIXEL PHASE DPR CAMERA CAST BASE ZOO
 * hace: asigna y renderiza sprites de apariencia; el jugador local delega el cuerpo a Base Zoo y este módulo conserva apariencias de actores no locales
 * online: visual cliente; autoridad de actor fuera de este modulo; en PvP conserva aim de gameplay y usa fila de aim solo durante compromiso de ataque/aim/cast explícito
 * extension-points: KeloAvatar.use como middleware condicional de apariencia
 * do-not: NO envolver renderAvatar, NO decidir aim ni gameplay desde apariencia, NO volver a pintar un full-body encima del Base Zoo local
 */
(function () {
  'use strict';

  const VERSION = 'character-appearance-v2.8.0-base-zoo-main';
  const DEFAULT_PLAYER = 'player_hero_v1';
  const DEFAULT_BOT = DEFAULT_PLAYER;
  const ALPHA_CLEANUP_THRESHOLD = 8;
  const HERO_SOURCE = 'assets/hero.PNG?hero=deeab966';
  const HERO_FACE_ROWS = Object.freeze({ down: 0, left: 1, right: 2, up: 3 });
  const HERO_MIRROR_FACES = Object.freeze({ down: false, left: false, right: false, up: false });
  const HERO_FRAME_METRICS = Object.freeze({
    down: Object.freeze({ bodyHeight: 303, footX: Object.freeze([160,142,107,94]), footY: Object.freeze([364,369,368,368]) }),
    left: Object.freeze({ bodyHeight: 302, footX: Object.freeze([132,108,91,77]), footY: Object.freeze([344,346,347,348]) }),
    right: Object.freeze({ bodyHeight: 369, footX: Object.freeze([145,135,121,113]), footY: Object.freeze([384,384,384,384]) }),
    up: Object.freeze({ bodyHeight: 307, footX: Object.freeze([134,118,107,121]), footY: Object.freeze([300,308,308,312]) })
  });

  const definitions = Object.freeze({
    player_hero_v1: Object.freeze({
      id: 'player_hero_v1', role: 'player', source: HERO_SOURCE, delegateToLegacyHero: false,
      columns: 4, rows: 4, frameWidth: 256, frameHeight: 384,
      faceRows: HERO_FACE_ROWS,
      mirrorFaces: HERO_MIRROR_FACES,
      frameMetrics: HERO_FRAME_METRICS
    }),
    bot_crimson_v1: Object.freeze({
      id: 'bot_crimson_v1', role: 'bot', source: HERO_SOURCE, delegateToLegacyHero: true, retiredVisual: true,
      columns: 4, rows: 4, frameWidth: 256, frameHeight: 384,
      faceRows: HERO_FACE_ROWS,
      mirrorFaces: HERO_MIRROR_FACES,
      frameMetrics: HERO_FRAME_METRICS
    })
  });

  const runtimes = Object.create(null);
  const audit = window.KELO_CHARACTER_APPEARANCE_AUDIT = {
    version: VERSION, defaultPlayerId: DEFAULT_PLAYER, defaultBotId: DEFAULT_BOT,
    assignedPlayers: 0, assignedBots: 0, loaded: {}, dimensions: {}, loadErrors: {}, cleanupPixels: {},
    drawCountByAppearance: {}, fallbackDraws: 0, imageSmoothingDisabled: true,
    usesSingleImagePerAppearance: true, usesActorAppearanceId: true, usesPerFrameFootAnchor: true,
    usesExplicitIdleFrame: true,
    usesCombatAimFacing: true, combatAimFacingPolicy: 'idle-or-attack-or-cast-windup-active',
    adaptivePhysicalPixelSnap: true, physicalPixelSnapCount: 0, worldPixelFallbackCount: 0,
    avatarOwner: 'KeloAvatar', avatarMiddleware: 'character-appearance:custom-sprite',
    localPlayerBodyOwner: 'main-hero:base-zoo', localPlayerDelegates: 0, lastDraw: null
  };

  function getDefinition(id) { return definitions[id] || definitions[DEFAULT_PLAYER]; }

  function makeCleanSource(image, def) {
    try {
      const cleanupCanvas = document.createElement('canvas');
      cleanupCanvas.width = image.naturalWidth || image.width;
      cleanupCanvas.height = image.naturalHeight || image.height;
      const c = cleanupCanvas.getContext('2d', { willReadFrequently: true });
      if (!c) return image;
      c.imageSmoothingEnabled = false;
      c.drawImage(image, 0, 0);
      const data = c.getImageData(0, 0, cleanupCanvas.width, cleanupCanvas.height);
      let cleaned = 0;
      for (let i = 3; i < data.data.length; i += 4) {
        if (data.data[i] <= ALPHA_CLEANUP_THRESHOLD) {
          if (data.data[i] !== 0 || data.data[i-1] !== 0 || data.data[i-2] !== 0 || data.data[i-3] !== 0) cleaned += 1;
          data.data[i-3] = 0; data.data[i-2] = 0; data.data[i-1] = 0; data.data[i] = 0;
        }
      }
      c.putImageData(data, 0, 0);
      audit.cleanupPixels[def.id] = cleaned;
      return cleanupCanvas;
    } catch (error) {
      audit.loadErrors[def.id + ':cleanup'] = String(error && error.message || error);
      return image;
    }
  }

  function ensureRuntime(def) {
    if (!def || def.delegateToLegacyHero) return null;
    if (runtimes[def.id]) return runtimes[def.id];
    const runtime = runtimes[def.id] = { image: new Image(), source: null, ready: false, failed: false };
    runtime.image.decoding = 'async';
    runtime.image.onload = function () {
      const w = runtime.image.naturalWidth || runtime.image.width;
      const h = runtime.image.naturalHeight || runtime.image.height;
      audit.dimensions[def.id] = { width: w, height: h, frameWidth: w/def.columns, frameHeight: h/def.rows };
      if (w !== def.frameWidth*def.columns || h !== def.frameHeight*def.rows) {
        runtime.failed = true; audit.loadErrors[def.id] = 'DIMENSION_MISMATCH_' + w + 'x' + h;
        console.error('[Kelo appearance] invalid sprite dimensions', def.id, w, h); return;
      }
      runtime.source = makeCleanSource(runtime.image, def);
      runtime.ready = true; audit.loaded[def.id] = true;
    };
    runtime.image.onerror = function () {
      runtime.failed = true; audit.loadErrors[def.id] = 'LOAD_FAILED';
      console.error('[Kelo appearance] sprite load failed', def.id, def.source);
    };
    runtime.image.src = def.source;
    return runtime;
  }

  Object.keys(definitions).forEach(function (id) { const def = definitions[id]; if (!def.delegateToLegacyHero && !(window.KELO_WORLD_DECORATION_RESET === true && def.role === 'bot')) ensureRuntime(def); });

  function assignDefaults() {
    if (typeof localPlayer !== 'undefined' && localPlayer) {
      if (!localPlayer.appearanceId) localPlayer.appearanceId = DEFAULT_PLAYER;
      if (!localPlayer.actorKind) localPlayer.actorKind = 'player';
      audit.assignedPlayers = 1;
    }
    if (typeof simulatedPlayers !== 'undefined' && Array.isArray(simulatedPlayers)) {
      simulatedPlayers.forEach(function (actor) {
        if (!actor) return;
        if (!actor.appearanceId) actor.appearanceId = DEFAULT_BOT;
        if (!actor.actorKind) actor.actorKind = 'bot';
      });
      audit.assignedBots = simulatedPlayers.length;
    }
  }

  function assign(actor, appearanceId) { if (!actor || !definitions[appearanceId]) return false; actor.appearanceId = appearanceId; return true; }

  window.KeloCharacterAppearance = Object.freeze({
    version: VERSION, defaultPlayerId: DEFAULT_PLAYER, defaultBotId: DEFAULT_BOT,
    get: getDefinition, assign: assign, list: function(){ return Object.keys(definitions); }, refreshDefaults: assignDefaults
  });
  assignDefaults();

  if (!window.KeloAvatar || typeof window.KeloAvatar.use !== 'function') { audit.loadErrors.renderer = 'KELO_AVATAR_UNAVAILABLE'; return; }

  function actorFace(actor) {
    const face = actor && actor._face;
    return HERO_FACE_ROWS[face] == null ? null : face;
  }

  function abilityCastAimCommitted() {
    const predictor = window.KeloPvPCastMovementPrediction;
    if (!predictor || !predictor.active) return false;
    return predictor.phase === 'windup' || predictor.phase === 'active';
  }

  function combatAimCommitted(actor, visual) {
    if (window.KELO_COMBAT_ENABLED !== true || !actorFace(actor)) return false;
    if (!visual || !visual.on) return true;
    try {
      const pvp = window.KeloPvPWorld && window.KeloPvPWorld.state;
      return !!(pvp && (pvp.basicAttack || pvp.specialHolding || Number(pvp.armedSlot) >= 0)) || abilityCastAimCommitted();
    } catch (_) {
      return abilityCastAimCommitted();
    }
  }

  function motionOf(actor) {
    const visual = actor && actor._visualMotion;
    if (visual) {
      const combatFace = combatAimCommitted(actor, visual) ? actorFace(actor) : null;
      return {
        dx: visual.dx||0,
        dy: visual.dy||0,
        moving: !!visual.on,
        face: combatFace || visual.face || actorFace(actor) || 'down',
        frame: Number.isFinite(visual.frame)?visual.frame:null,
        faceSource: combatFace ? 'combat-aim' : 'movement'
      };
    }
    if (actor._appearanceLastX == null) { actor._appearanceLastX = actor.x; actor._appearanceLastY = actor.y; }
    const dx = actor.x-actor._appearanceLastX, dy = actor.y-actor._appearanceLastY;
    const velocity = Math.hypot(actor.vx||0, actor.vy||0);
    const targetDistance = actor.targetX != null && actor.targetY != null ? Math.hypot(actor.targetX-actor.x, actor.targetY-actor.y) : 0;
    const moving = Math.hypot(dx,dy)>0.12 || velocity>16 || targetDistance>14;
    if (Math.hypot(dx,dy)>0.12) { actor._appearanceMoveX=dx; actor._appearanceMoveY=dy; }
    else if (velocity>16) { actor._appearanceMoveX=actor.vx||0; actor._appearanceMoveY=actor.vy||0; }
    else if (targetDistance>14) { actor._appearanceMoveX=actor.targetX-actor.x; actor._appearanceMoveY=actor.targetY-actor.y; }
    actor._appearanceLastX=actor.x; actor._appearanceLastY=actor.y;
    const mx=actor._appearanceMoveX||0, my=actor._appearanceMoveY||0;
    let face=actorFace(actor)||'down';
    if (moving && (Math.abs(mx)>0.01 || Math.abs(my)>0.01) && window.KELO_COMBAT_ENABLED !== true) {
      const side=Math.abs(mx)*1.15>=Math.abs(my);
      face=side?(mx>=0?'right':'left'):(my>=0?'down':'up'); actor._face=face;
    }
    return { dx:mx, dy:my, moving:moving, face:face, frame:null, faceSource:window.KELO_COMBAT_ENABLED===true?'combat-aim':'movement' };
  }

  function frameColumn(actor, motion, def) {
    // MOV-PLANT-V2: KeloMovement owns stride/plant semantics. Appearance must honor an explicit frame even when idle.
    if (motion.frame != null) return Math.abs(Math.floor(motion.frame)) % def.columns;
    if (!motion.moving) return 0;
    const phase = actor && actor.id ? Array.from(String(actor.id)).reduce(function(sum,ch){ return sum+ch.charCodeAt(0); },0) : 0;
    return Math.floor((performance.now()+phase*23)/130) % def.columns;
  }

  function fallbackPresentation(actor, face) {
    const side=face==='left'||face==='right', width=side?55:62, height=93, footY=actor.y+10;
    return { footRootX:actor.x, footRootY:footY, depthRootX:actor.x, depthRootY:footY,
      visualWidth:width, visualHeight:height, nameplateAnchorX:actor.x, nameplateAnchorY:footY-height-6 };
  }
  function presentationOf(actor, face) {
    if (window.KELO_AVATAR_PRESENTATION && typeof window.KELO_AVATAR_PRESENTATION.get === 'function') return window.KELO_AVATAR_PRESENTATION.get(actor, face);
    return fallbackPresentation(actor, face);
  }

  function renderAppearance(actor, isSelf, next) {
    if (!actor) return next();
    // Base Zoo is the authoritative full-body owner for the local player. This middleware
    // must delegate instead of consuming the chain with the historical hero.PNG body.
    const baseZooAudit = window.KELO_MAIN_HERO_SPRITE_AUDIT;
    if (isSelf && baseZooAudit && baseZooAudit.version === 'main-hero-base-zoo-v1') {
      audit.localPlayerDelegates += 1;
      return next();
    }
    const def=getDefinition(actor.appearanceId);
    if (!def || def.delegateToLegacyHero) return next();
    const runtime=ensureRuntime(def);
    if (!runtime || !runtime.ready || runtime.failed || !runtime.source) { audit.fallbackDraws += 1; return next(); }
    const motion=motionOf(actor), face=def.faceRows[motion.face]==null?'down':motion.face, row=def.faceRows[face], col=frameColumn(actor,motion,def);
    const metrics=def.frameMetrics[face]||def.frameMetrics.down, layout=presentationOf(actor,face);
    const targetBodyHeight=Math.max(1,Number(layout.visualHeight)||93), scale=targetBodyHeight/metrics.bodyHeight;
    const sx=col*def.frameWidth, sy=row*def.frameHeight, sw=def.frameWidth, sh=def.frameHeight;
    const anchorX=metrics.footX[col]==null?metrics.footX[0]:metrics.footX[col], anchorY=metrics.footY[col]==null?metrics.footY[0]:metrics.footY[col];
    const rawDx=layout.footRootX-anchorX*scale, rawDy=layout.footRootY-anchorY*scale;
    let dx=Math.round(rawDx), dy=Math.round(rawDy), pixelSnapMode='world';
    const cameraApi=window.KeloCamera;
    if (cameraApi && typeof cameraApi.worldToScreen==='function' && typeof cameraApi.getEffectiveZoom==='function' && typeof cameraApi.activeDpr==='function') {
      const z=Math.max(0.0001,Number(cameraApi.getEffectiveZoom())||1), dpr=Math.max(1,Number(cameraApi.activeDpr())||1);
      // RENDER/PIXEL-PHASE: physical snapping is only finer than legacy 1-world-px rounding when zoom×DPR >= 1.
      if (z*dpr>=1) {
        const screen=cameraApi.worldToScreen(rawDx,rawDy);
        const snappedScreenX=Math.round(screen.x*dpr)/dpr, snappedScreenY=Math.round(screen.y*dpr)/dpr;
        dx=rawDx+(snappedScreenX-screen.x)/z;
        dy=rawDy+(snappedScreenY-screen.y)/z;
        pixelSnapMode='physical';
        audit.physicalPixelSnapCount += 1;
      } else {
        audit.worldPixelFallbackCount += 1;
      }
    }
    const dw=Math.round(sw*scale), dh=Math.round(sh*scale);
    ctx.save(); const previousSmoothing=ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled=false;
    if (def.mirrorFaces && def.mirrorFaces[face]) { ctx.translate(Math.round(layout.footRootX),0); ctx.scale(-1,1); ctx.translate(-Math.round(layout.footRootX),0); }
    ctx.drawImage(runtime.source,sx,sy,sw,sh,dx,dy,dw,dh); ctx.imageSmoothingEnabled=previousSmoothing; ctx.restore();
    ctx.save(); ctx.fillStyle=isSelf?'#e7c56a':'#f3eee4'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center';
    ctx.fillText(actor.name||'Kelo',Math.round(layout.nameplateAnchorX),Math.round(layout.nameplateAnchorY)); ctx.restore();
    audit.drawCountByAppearance[def.id]=(audit.drawCountByAppearance[def.id]||0)+1;
    audit.lastDraw={ actorId:actor.id||null, appearanceId:def.id, face:face, faceSource:motion.faceSource||'movement', frame:col, sourceRect:[sx,sy,sw,sh], destinationRect:[dx,dy,dw,dh], rawDestination:[rawDx,rawDy], pixelSnapMode:pixelSnapMode, scale:scale, sourceFootAnchor:[anchorX,anchorY], footRoot:[layout.footRootX,layout.footRootY] };
  }

  window.KeloAvatar.use('character-appearance:custom-sprite', renderAppearance, 200);
})();