/* KELO-INDEX
 * area: LEGACY TRAINING DUMMY
 * owner: training dummy legacy; extension owners KeloSimulation + KeloRender
 * keys: DUMMY HP RESPAWN SIMULATION RENDER FOUNDATION
 * purpose: conserva dummy de entrenamiento sin wrappers core ni timer no-op
 * public-api: window.trainingDummy
 * consumes: KeloSimulation, KeloRender, skillShots, tile registry
 * state-owned: dummy legacy + authored visual readiness
 * extension-points: KeloSimulation.after + KeloRender.afterFrame
 * reuse: no añadir enemigos nuevos aquí
 * legacy: training prototype
 * do-not: NO envolver updateSimulation/render ni crear polling sin efecto
 */
(function () {
  const dummy = {
    id: 'dummy_plaza',
    name: 'Dummy',
    x: 1580,
    y: 1680,
    radius: 22,
    hp: 80,
    maxHp: 80,
    dead: false,
    respawnIn: 0,
    gear: { bodyColor: '#6b5b4a', armorColor: '#c9a24a', weaponColor: '#888' }
  };
  window.trainingDummy = dummy;
  function resetActive(){return window.KELO_WORLD_DECORATION_RESET===true||window.KELO_WORLD_RENDERER?.decorationReset===true;}

  const registry = window.KELO_TILE_REGISTRY;
  const asset = registry?.atlases?.trainingDummy;
  const prop = registry?.trainingDummyProp;
  const style = registry?.styles?.trainingDummy;
  const dummyImg = new Image();
  dummyImg.decoding = 'async';
  let authoredReady = false;
  let drawCount = 0;
  window.KELO_TRAINING_DUMMY_AUDIT = {
    version:'training-dummy-v1.2-foundation',
    ready:false,
    assetLoaded:false,
    failed:false,
    fallbackActive:true,
    mode:style?.mode || null,
    registryVersion:registry?.version || null,
    gameplayAnchorPreserved:false,
    labelRemoved:true,
    drawCount:0,
    decorationReset:true,
    decorationResetSuppressed:true,
    renderOwner:'KeloRender',
    simulationOwner:'KeloSimulation',
    pollingTimers:0
  };

  if (resetActive()) {
    window.KELO_TRAINING_DUMMY_AUDIT.ready = true;
    window.KELO_TRAINING_DUMMY_AUDIT.assetLoaded = false;
    window.KELO_TRAINING_DUMMY_AUDIT.fallbackActive = false;
  } else if (asset && prop && style) {
    const a = prop.gameplayAnchor;
    const anchorOk = a && a.x === dummy.x && a.y === dummy.y && a.radius === dummy.radius;
    window.KELO_TRAINING_DUMMY_AUDIT.gameplayAnchorPreserved = !!anchorOk;
    if (!anchorOk) {
      console.error('[Kelo training dummy] registry gameplay anchor mismatch');
      window.KELO_TRAINING_DUMMY_AUDIT.failed = true;
    } else {
      dummyImg.onload = function () {
        if (dummyImg.naturalWidth !== asset.width || dummyImg.naturalHeight !== asset.height) {
          console.error('[Kelo training dummy] invalid authored asset dimensions');
          window.KELO_TRAINING_DUMMY_AUDIT.failed = true;
          return;
        }
        authoredReady = true;
        window.KELO_TRAINING_DUMMY_AUDIT.ready = true;
        window.KELO_TRAINING_DUMMY_AUDIT.assetLoaded = true;
        window.KELO_TRAINING_DUMMY_AUDIT.fallbackActive = false;
      };
      dummyImg.onerror = function () {
        console.error('[Kelo training dummy] authored asset load failed');
        window.KELO_TRAINING_DUMMY_AUDIT.failed = true;
      };
      dummyImg.src = asset.src;
    }
  } else {
    console.error('[Kelo training dummy] registry contract missing');
    window.KELO_TRAINING_DUMMY_AUDIT.failed = true;
  }

  function drawHp(p) {
    if (!p || p.hp == null) return;
    const ratio = Math.max(0, Math.min(1, p.hp / (p.maxHp || 100)));
    const w = 36, h = 4;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(p.x - w / 2, p.y - (p.radius || 20) - 16, w, h);
    ctx.fillStyle = ratio > 0.45 ? '#39d353' : ratio > 0.2 ? '#e3b341' : '#ef476f';
    ctx.fillRect(p.x - w / 2, p.y - (p.radius || 20) - 16, w * ratio, h);
  }

  function hitDummy(dmg) {
    if (dummy.dead) return;
    dummy.hp = Math.max(0, dummy.hp - (dmg || 12));
    if (typeof spawnParticle === 'function') spawnParticle(dummy.x, dummy.y, '#ef476f', 14, 0.25);
    if (dummy.hp <= 0) {
      dummy.dead = true;
      dummy.respawnIn = 3;
      if (typeof showToast === 'function') showToast('Dummy fuera. Reaparece en 3s');
    }
  }

  function nearDummy(x, y, r) {
    return !dummy.dead && Math.hypot(x - dummy.x, y - dummy.y) < (r || 40);
  }

  function updateDummy(context) {
    const dt=context.dt;
    if (dummy.dead) {
      dummy.respawnIn -= dt;
      if (dummy.respawnIn <= 0) {
        dummy.dead = false;
        dummy.hp = dummy.maxHp;
      }
    }
    if (window.skillShots) {
      skillShots.forEach(function (s) {
        if (nearDummy(s.x, s.y, 28) || nearDummy(s.tx, s.ty, 36)) hitDummy(18);
      });
    }
  }

  window.addEventListener('pointerdown', function () {
    if (typeof melee === 'undefined') return;
  }, true);

  function drawFallback() {
    ctx.fillStyle = dummy.gear.bodyColor;
    ctx.beginPath();
    ctx.arc(dummy.x, dummy.y, dummy.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDummy() {
    if (resetActive()) {
      window.KELO_TRAINING_DUMMY_AUDIT.decorationReset=true;
      window.KELO_TRAINING_DUMMY_AUDIT.decorationResetSuppressed=true;
      return;
    }
    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    ctx.imageSmoothingEnabled = false;
    if (!dummy.dead) {
      if (authoredReady && prop) {
        ctx.drawImage(dummyImg, prop.x, prop.y, prop.w, prop.h);
        drawCount++;
        window.KELO_TRAINING_DUMMY_AUDIT.drawCount = drawCount;
      } else drawFallback();
    } else {
      ctx.globalAlpha = 0.28;
      if (authoredReady && prop) ctx.drawImage(dummyImg, prop.x, prop.y, prop.w, prop.h);
      else drawFallback();
      ctx.globalAlpha = 1;
    }
    drawHp(localPlayer);
    drawHp(dummy);
    if (typeof simulatedPlayers !== 'undefined') simulatedPlayers.forEach(drawHp);
    ctx.restore();
  }

  if(!window.KeloSimulation) throw new Error('KeloSimulation unavailable before engine-o');
  if(!window.KeloRender) throw new Error('KeloRender unavailable before engine-o');
  window.KeloSimulation.after('engine-o:training-dummy', updateDummy, 20);
  window.KeloRender.afterFrame('engine-o:training-dummy', drawDummy, 60);
})();