/* KELO-INDEX
 * area: LEGACY PLAZA NPCS
 * owner: plaza NPC/minigame legacy; extension owners KeloSimulation + KeloRender
 * keys: NPC JOYERO MINIGAME SIMULATION RENDER FOUNDATION
 * purpose: conserva NPCs y minijuego sin wrappers core
 * public-api: window.keloNpcs
 * consumes: KeloSimulation, KeloRender, tile registry, localPlayer, STATE
 * state-owned: near/talkOpen/game + authored NPC runtime
 * extension-points: KeloSimulation.after + KeloRender.afterFrame
 * reuse: no añadir NPC systems nuevos aquí
 * legacy: plaza NPC prototype
 * do-not: NO envolver updateSimulation ni render
 */
(function () {
  const npcs = [
    { id: 'portero', name: 'Portero', x: 1320, y: 1580, color: '#8ab4ff', line: 'Bienvenido a la Plaza Kelo. El Joyero espera a tu derecha.' },
    { id: 'joyero', name: 'Joyero', x: 1520, y: 1520, color: '#e7c56a', line: 'Corta en el brillo. Si aciertas, hay KC.' }
  ];
  window.keloNpcs = npcs;
  function resetActive(){return window.KELO_WORLD_DECORATION_RESET===true||window.KELO_WORLD_RENDERER?.decorationReset===true;}

  const registry = window.KELO_TILE_REGISTRY;
  const npcAtlas = registry?.atlases?.plazaNpcs;
  const npcVisuals = registry?.plazaNpcVisuals;
  const npcStyle = registry?.styles?.plazaNpcs;
  const npcImg = new Image();
  npcImg.decoding = 'async';
  let authoredReady = false;
  let drawCount = 0;
  window.KELO_PLAZA_NPC_AUDIT = {
    version:'plaza-npcs-v1.2-foundation',
    ready:false,
    assetLoaded:false,
    failed:false,
    fallbackActive:true,
    mode:npcStyle?.mode || null,
    labelMode:npcStyle?.labelMode || null,
    registryVersion:registry?.version || null,
    drawCount:0,
    gameplayAnchorsPreserved:true,
    decorationReset:true,
    decorationResetSuppressed:true,
    renderOwner:'KeloRender',
    simulationOwner:'KeloSimulation'
  };
  if (resetActive()) {
    window.KELO_PLAZA_NPC_AUDIT.ready = true;
    window.KELO_PLAZA_NPC_AUDIT.assetLoaded = false;
    window.KELO_PLAZA_NPC_AUDIT.fallbackActive = false;
  } else if (npcAtlas && npcVisuals && npcStyle) {
    npcImg.onload = function () {
      if (npcImg.naturalWidth !== npcAtlas.width || npcImg.naturalHeight !== npcAtlas.height) {
        console.error('[Kelo plaza npcs] invalid authored atlas dimensions');
        window.KELO_PLAZA_NPC_AUDIT.failed = true;
        return;
      }
      authoredReady = true;
      window.KELO_PLAZA_NPC_AUDIT.ready = true;
      window.KELO_PLAZA_NPC_AUDIT.assetLoaded = true;
      window.KELO_PLAZA_NPC_AUDIT.fallbackActive = false;
    };
    npcImg.onerror = function () {
      console.error('[Kelo plaza npcs] authored atlas load failed');
      window.KELO_PLAZA_NPC_AUDIT.failed = true;
    };
    npcImg.src = npcAtlas.src;
  } else {
    console.error('[Kelo plaza npcs] registry contract missing');
    window.KELO_PLAZA_NPC_AUDIT.failed = true;
  }

  let near = null;
  let talkOpen = false;
  let game = { on: false, t: 0, hit: 0.62, hold: false };

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function closest() {
    if (resetActive()) return null;
    let best = null, bestD = 64;
    npcs.forEach(function (n) {
      const d = dist(localPlayer, n);
      if (d < bestD) { best = n; bestD = d; }
    });
    return best;
  }

  function reward(ok) {
    if (!STATE) return;
    if (ok) {
      STATE.kc = (STATE.kc || 0) + 8;
      STATE.gold = (STATE.gold || 0) + 15;
      if (typeof showToast === 'function') showToast('Corte limpio +8 KC +15 oro');
    } else if (typeof showToast === 'function') showToast('Fallaste el brillo');
    if (typeof saveState === 'function') saveState();
    if (typeof updateHud === 'function') updateHud();
  }

  function startCut() {
    if (resetActive()) return;
    game.on = true;
    game.t = 0;
    talkOpen = false;
  }

  function tryCut() {
    if (!game.on) return;
    const pos = (Math.sin(game.t * 3.2) + 1) / 2;
    const ok = Math.abs(pos - game.hit) < 0.09;
    game.on = false;
    reward(ok);
  }

  window.addEventListener('keydown', function (e) {
    if (resetActive()) return;
    if (e.key === 'e' || e.key === 'E') {
      if (game.on) { tryCut(); return; }
      near = closest();
      if (near) talkOpen = !talkOpen;
    }
    if (e.key === ' ' && game.on) tryCut();
  });

  window.addEventListener('pointerdown', function (e) {
    if (resetActive()) return;
    if (game.on) {
      e.preventDefault();
      tryCut();
      return;
    }
    if (!near) return;
    const top = e.target && e.target.id === 'npc-talk-go';
    if (top) return;
  }, true);

  function ensureUi() {
    if (document.getElementById('npc-talk')) return;
    const box = document.createElement('div');
    box.id = 'npc-talk';
    box.style.cssText = 'display:none;position:absolute;left:10px;right:10px;bottom:118px;z-index:80;pointer-events:auto;background:rgba(10,13,18,.94);border:1px solid #c9a24a;border-radius:12px;padding:12px;color:#eee;font-size:13px';
    box.innerHTML = '<div id="npc-talk-name" style="color:#e7c56a;font-weight:700;margin-bottom:6px"></div><div id="npc-talk-line" style="margin-bottom:10px"></div><button id="npc-talk-go" style="background:#9e6a03;border:1px solid #e5a93c;color:#fff;padding:8px 12px;border-radius:8px;font-weight:700">OK</button>';
    document.body.appendChild(box);
    document.getElementById('npc-talk-go').addEventListener('click', function () {
      if (near && near.id === 'joyero') startCut();
      else talkOpen = false;
    });
    const hint = document.createElement('div');
    hint.id = 'npc-hint';
    hint.style.cssText = 'display:none;position:absolute;left:50%;bottom:210px;transform:translateX(-50%);z-index:70;color:#e7c56a;font-size:12px;background:rgba(0,0,0,.55);padding:6px 10px;border-radius:999px;pointer-events:none';
    hint.textContent = 'Hablar';
    document.body.appendChild(hint);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUi);
  else ensureUi();

  function updateNpcState(context) {
    const dt=context.dt;
    if (resetActive()) {
      near=null;talkOpen=false;game.on=false;
      const hint=document.getElementById('npc-hint');
      const box=document.getElementById('npc-talk');
      if(hint)hint.style.display='none';
      if(box)box.style.display='none';
      return;
    }
    near = closest();
    if (game.on) game.t += dt;
    const hint = document.getElementById('npc-hint');
    const box = document.getElementById('npc-talk');
    if (hint) hint.style.display = (!talkOpen && !game.on && near) ? 'block' : 'none';
    if (box) {
      box.style.display = talkOpen && near ? 'block' : 'none';
      if (talkOpen && near) {
        document.getElementById('npc-talk-name').textContent = near.name;
        document.getElementById('npc-talk-line').textContent = near.line;
        document.getElementById('npc-talk-go').textContent = near.id === 'joyero' ? 'Cortar' : 'Cerrar';
      }
    }
  }

  function drawFallbackNpc(n) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(n.x, n.y + 16, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = n.color;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawAuthoredNpc(n) {
    const v = npcVisuals && npcVisuals[n.id];
    if (!authoredReady || !v) { drawFallbackNpc(n); return; }
    const sx = (v.sprite % npcAtlas.columns) * npcAtlas.spriteWidth;
    const sy = Math.floor(v.sprite / npcAtlas.columns) * npcAtlas.spriteHeight;
    ctx.drawImage(npcImg, sx, sy, npcAtlas.spriteWidth, npcAtlas.spriteHeight, n.x + v.xOffset, n.y + v.yOffset, v.w, v.h);
    drawCount++;
    window.KELO_PLAZA_NPC_AUDIT.drawCount = drawCount;
  }

  function drawNpcLayer() {
    if (resetActive()) {
      window.KELO_PLAZA_NPC_AUDIT.decorationReset=true;
      window.KELO_PLAZA_NPC_AUDIT.decorationResetSuppressed=true;
      return;
    }
    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    ctx.imageSmoothingEnabled = false;
    npcs.forEach(function (n) {
      drawAuthoredNpc(n);
      if (near === n || (talkOpen && near === n)) {
        const v = npcVisuals && npcVisuals[n.id];
        ctx.fillStyle = '#f7f1dd';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(n.name, n.x, n.y + (v?.labelYOffset || -28));
      }
    });
    ctx.restore();

    if (game.on) {
      const pos = (Math.sin(game.t * 3.2) + 1) / 2;
      const x = 24, y = screenH * 0.38, w = screenW - 48, h = 28;
      ctx.fillStyle = 'rgba(8,10,14,0.82)';
      ctx.fillRect(x - 8, y - 36, w + 16, 78);
      ctx.fillStyle = '#e7c56a';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Toca cuando entre en el brillo', screenW / 2, y - 14);
      ctx.fillStyle = '#1b2230';
      ctx.fillRect(x, y, w, h);
      const zx = x + w * (game.hit - 0.08);
      ctx.fillStyle = 'rgba(231,197,106,0.55)';
      ctx.fillRect(zx, y, w * 0.16, h);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + w * pos - 3, y - 4, 6, h + 8);
    }
  }

  if(!window.KeloSimulation) throw new Error('KeloSimulation unavailable before engine-p');
  if(!window.KeloRender) throw new Error('KeloRender unavailable before engine-p');
  window.KeloSimulation.after('engine-p:plaza-npcs', updateNpcState, 30);
  window.KeloRender.afterFrame('engine-p:plaza-npcs', drawNpcLayer, 70);
})();