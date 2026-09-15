/* KELO-INDEX
 * area: VISUAL
 * keys: LAB DEBUG GALLERY ANIMATION VFX PROJECTILE SEQUENCE STATUS SFX PREVIEW MOBILE MINIMIZE PLAYFULL STOP DUMMY PIN LOOP GHOST RANGE HIT PAD TAP CAM SEED FAMILY
 * hace: galería de desarrollo; SKILL usa playCue/eventos del combate, PIEZAS prueba componentes; dock móvil con hueco de joystick, pad 8-dir, tap dummy, cam peek, seed lock
 * online: N/A; solo aparece con ?visualLab=1 y no muta HP/mana/inventario
 */
(function (root) {
  'use strict';

  const PREF_KEY = 'kelo-visual-lab-prefs-v1';
  let panel = null;
  let body = null;
  let collapsed = false;
  let compactPlay = false;
  let pinned = false;
  let currentTab = 'abilities';
  let dummyOn = false;
  let dummyFxId = null;
  let ghostOn = true;
  let ghostIds = [];
  let loopOn = false;
  let camOn = true;
  let seedLock = false;
  let lastSeed = 1;
  let armTap = false;
  let camSnap = null;
  let familyFilter = 'all';
  let labTimers = [];
  let statusLine = null;
  let headerStatus = null;
  let chipLine = null;
  let pinBtn = null;

  function enabled() {
    try { return new URLSearchParams(root.location.search).get('visualLab') === '1'; }
    catch (e) { return false; }
  }
  if (!enabled()) return;

  function actor() { try { return typeof localPlayer !== 'undefined' ? localPlayer : null; } catch (e) { return null; } }
  function originFor(direction, distance) {
    const p = actor(); if (!p) return { x: 1400, y: 1600 };
    return { x: p.x + direction.x * (distance || 0), y: p.y + direction.y * (distance || 0) };
  }
  function directionOf(value) {
    const map = {
      up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
      'up-left': { x: -1, y: -1 }, 'up-right': { x: 1, y: -1 },
      'down-left': { x: -1, y: 1 }, 'down-right': { x: 1, y: 1 }
    };
    const raw = map[value] || { x: 1, y: 0 };
    const len = Math.hypot(raw.x, raw.y) || 1;
    return { x: raw.x / len, y: raw.y / len };
  }
  function faceOf(dir) {
    if (Math.abs(dir.x) >= Math.abs(dir.y)) return dir.x < 0 ? 'left' : 'right';
    return dir.y < 0 ? 'up' : 'down';
  }
  function options(select, values) {
    select.innerHTML = '';
    values.forEach(function (value) {
      const option = document.createElement('option');
      option.value = value.id || value;
      option.textContent = value.label || value.id || value;
      select.appendChild(option);
    });
  }
  function row(label, node) {
    const wrap = document.createElement('label'); wrap.style.cssText = 'display:grid;grid-template-columns:72px 1fr;gap:6px;align-items:center;margin:5px 0';
    const span = document.createElement('span'); span.textContent = label; span.style.color = '#a9b1bc'; wrap.appendChild(span); wrap.appendChild(node); return wrap;
  }
  function button(text, fn) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.style.cssText = 'background:#191f29;color:#f3d48b;border:1px solid #4a5260;border-radius:8px;padding:10px 9px;min-height:40px;font-weight:800;touch-action:manipulation'; b.onclick = fn; return b;
  }
  function later(ms, fn) {
    const id = setTimeout(fn, ms);
    labTimers.push(id);
    return id;
  }
  function clearLabTimers() {
    labTimers.forEach(function (id) { clearTimeout(id); });
    labTimers = [];
  }
  function setStatus(text) {
    const value = text || '';
    if (statusLine) statusLine.textContent = value;
    if (headerStatus) headerStatus.textContent = value;
  }
  function isMobile() { return (root.innerWidth || 390) < 720; }
  function slim() { return collapsed || compactPlay; }
  function loadPrefs() {
    try { return JSON.parse(sessionStorage.getItem(PREF_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }

  function abilityDef(key) {
    if (!key) return null;
    if (root.KeloAbilities && root.KeloAbilities.registry && typeof root.KeloAbilities.registry.getByKey === 'function') {
      const byKey = root.KeloAbilities.registry.getByKey(key); if (byKey) return byKey;
    }
    return (root.ABILITIES || []).find(function (item) { return item.key === key; }) || null;
  }

  function applyChrome() {
    if (!panel || !body) return;
    const mobile = isMobile();
    const hide = slim();
    body.style.display = hide ? 'none' : 'block';
    panel.dataset.visualLabDock = mobile ? 'bottom' : 'top';
    panel.style.right = '8px';
    panel.style.left = 'auto';
    panel.style.overflow = hide ? 'hidden' : 'auto';
    if (mobile) {
      panel.style.top = 'auto';
      panel.style.bottom = 'max(8px,env(safe-area-inset-bottom))';
      panel.style.width = hide ? 'auto' : 'min(340px,calc(100vw - 104px))';
      panel.style.maxHeight = hide ? '58px' : '46vh';
    } else {
      panel.style.top = 'max(8px,env(safe-area-inset-top))';
      panel.style.bottom = 'auto';
      panel.style.width = hide ? 'auto' : 'min(350px,calc(100vw - 16px))';
      panel.style.maxHeight = hide ? '58px' : '90vh';
    }
    const toggle = panel.querySelector('[data-visual-lab-toggle]');
    if (toggle) {
      toggle.textContent = hide ? '＋' : '−';
      toggle.setAttribute('aria-label', hide ? 'Abrir Visual Lab' : 'Minimizar Visual Lab');
    }
    const label = panel.querySelector('[data-visual-lab-dev-label]');
    if (label) label.style.display = hide ? 'none' : 'inline';
    panel.querySelectorAll('[data-visual-lab-tab]').forEach(function (el) {
      el.style.display = hide ? 'none' : '';
    });
  }

  function setCollapsed(value) {
    collapsed = value === true;
    compactPlay = false;
    applyChrome();
  }

  function beginPreview(restoreMs) {
    if (!pinned && !collapsed) {
      compactPlay = true;
      applyChrome();
    }
    if (!pinned && !loopOn && restoreMs > 0) {
      later(restoreMs, function () {
        compactPlay = false;
        if (!collapsed) applyChrome();
      });
    }
  }

  function playActivationEyePreview() {
    const p = actor();
    if (!p || !root.KeloFX) return;
    const spawn = function () {
      root.KeloFX.spawn('sword_swap_activation_eye_anim', {
        actor: p, actorId: p.id, visual: { scale: 1.35, seed: Date.now() & 65535 }
      }, { socket: 'head', scale: 1.35, loop: false, duration: 1.0 });
      beginPreview(1100);
    };
    if (root.KeloAssetRegistry && !root.KeloAssetRegistry.isReady('sword_swap_activation_eye_anim_asset')) {
      root.KeloAssetRegistry.load('sword_swap_activation_eye_anim_asset').then(spawn);
    } else spawn();
  }

  function playKatanaThrowPreview() {
    const p = actor();
    if (!p || !root.KeloProjectileVisuals) return;
    const face = p._face || 'right';
    const dir = directionOf(face);
    const spawn = function () {
      const origin = root.KeloAnchors ? root.KeloAnchors.get(p, 'weapon') : { x: p.x, y: p.y };
      root.KeloProjectileVisuals.preview('sword_swap_katana_throw_visual', {
        actor: p, actorId: p.id, origin: origin, direction: dir,
        gameplay: { speed: 360, range: 290 },
        visual: { scale: 1, seed: Date.now() & 65535 }
      }, { scale: 1, loop: true });
      beginPreview(900);
    };
    if (root.KeloAssetRegistry && !root.KeloAssetRegistry.isReady('sword_swap_katana_throw_asset')) {
      root.KeloAssetRegistry.load('sword_swap_katana_throw_asset').then(spawn);
    } else spawn();
  }

  function build() {
    if (panel || !document.body) return;
    const prefs = loadPrefs();
    panel = document.createElement('div'); panel.id = 'kelo-visual-lab';
    panel.style.cssText = 'position:fixed;z-index:100000;background:rgba(7,10,15,.97);border:1px solid rgba(231,197,106,.55);border-radius:14px;padding:10px;color:#e6edf3;font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:auto;touch-action:pan-y;box-shadow:0 8px 28px rgba(0,0,0,.42)';

    const header = document.createElement('div'); header.style.cssText = 'display:flex;align-items:center;gap:5px;min-height:36px';
    const title = document.createElement('button'); title.type = 'button'; title.textContent = 'LAB'; title.style.cssText = 'background:transparent;color:#e7c56a;border:0;padding:4px 2px;text-align:left;font:800 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;touch-action:manipulation'; title.onclick = function () { setCollapsed(!collapsed); }; header.appendChild(title);
    headerStatus = document.createElement('span'); headerStatus.dataset.visualLabHeaderStatus = '1'; headerStatus.style.cssText = 'flex:1;min-width:0;color:#8be0ac;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700'; header.appendChild(headerStatus);
    const tabAbilities = document.createElement('button'); tabAbilities.type = 'button'; tabAbilities.dataset.visualLabTab = 'abilities'; tabAbilities.textContent = 'SKILL'; tabAbilities.style.cssText = 'background:#2a2112;color:#f3d48b;border:1px solid #c9a24a;border-radius:8px;padding:8px 8px;min-height:36px;font-weight:800;touch-action:manipulation';
    const tabPieces = document.createElement('button'); tabPieces.type = 'button'; tabPieces.dataset.visualLabTab = 'pieces'; tabPieces.textContent = 'PIEZAS'; tabPieces.style.cssText = 'background:#191f29;color:#a9b1bc;border:1px solid #4a5260;border-radius:8px;padding:8px 8px;min-height:36px;font-weight:800;touch-action:manipulation';
    header.appendChild(tabAbilities); header.appendChild(tabPieces);
    const stopHeader = button('■', function () { stopAll(true); compactPlay = false; if (!collapsed) applyChrome(); });
    stopHeader.dataset.visualLabStop = '1';
    stopHeader.setAttribute('aria-label', 'Stop preview');
    stopHeader.style.cssText += ';width:36px;height:36px;min-height:36px;padding:0;color:#ffb4b4;border-color:#7a3a3a';
    header.appendChild(stopHeader);
    pinBtn = button('PIN', function () {
      pinned = !pinned;
      paintPin();
      if (pinned) { compactPlay = false; applyChrome(); }
      savePrefs();
    });
    pinBtn.dataset.visualLabPin = '1';
    pinBtn.setAttribute('aria-label', 'Pin Visual Lab');
    pinBtn.style.cssText += ';width:40px;height:36px;min-height:36px;padding:0;font-size:9px';
    header.appendChild(pinBtn);
    const dev = document.createElement('span'); dev.dataset.visualLabDevLabel = '1'; dev.textContent = 'DEV'; dev.style.cssText = 'color:#78808b;white-space:nowrap'; header.appendChild(dev);
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.dataset.visualLabToggle = '1'; toggle.textContent = '−'; toggle.setAttribute('aria-label', 'Minimizar Visual Lab'); toggle.style.cssText = 'width:36px;height:36px;background:#191f29;color:#f3d48b;border:1px solid #4a5260;border-radius:8px;font-size:18px;font-weight:900;line-height:1;touch-action:manipulation'; toggle.onclick = function () { setCollapsed(!collapsed); }; header.appendChild(toggle);
    panel.appendChild(header);

    body = document.createElement('div'); body.dataset.visualLabBody = '1'; panel.appendChild(body);

    const shared = document.createElement('div'); shared.dataset.visualLabShared = '1'; body.appendChild(shared);
    const abilitiesPane = document.createElement('div'); abilitiesPane.dataset.visualLabPane = 'abilities';
    const piecesPane = document.createElement('div'); piecesPane.dataset.visualLabPane = 'pieces'; piecesPane.style.display = 'none';
    body.appendChild(abilitiesPane); body.appendChild(piecesPane);

    function setTab(tab) {
      currentTab = tab === 'pieces' ? 'pieces' : 'abilities';
      abilitiesPane.style.display = currentTab === 'abilities' ? 'block' : 'none';
      piecesPane.style.display = currentTab === 'pieces' ? 'block' : 'none';
      tabAbilities.style.background = currentTab === 'abilities' ? '#2a2112' : '#191f29';
      tabAbilities.style.color = currentTab === 'abilities' ? '#f3d48b' : '#a9b1bc';
      tabAbilities.style.borderColor = currentTab === 'abilities' ? '#c9a24a' : '#4a5260';
      tabPieces.style.background = currentTab === 'pieces' ? '#2a2112' : '#191f29';
      tabPieces.style.color = currentTab === 'pieces' ? '#f3d48b' : '#a9b1bc';
      tabPieces.style.borderColor = currentTab === 'pieces' ? '#c9a24a' : '#4a5260';
    }
    tabAbilities.onclick = function () { setTab('abilities'); };
    tabPieces.onclick = function () { setTab('pieces'); };

    const direction = document.createElement('select');
    options(direction, ['right', 'down', 'left', 'up', 'up-right', 'up-left', 'down-right', 'down-left']);
    direction.style.display = 'none';
    const scale = document.createElement('input'); scale.type = 'range'; scale.min = '0.5'; scale.max = '2'; scale.step = '0.1'; scale.value = prefs.scale || '1';
    const speed = document.createElement('input'); speed.type = 'range'; speed.min = '0.25'; speed.max = '2'; speed.step = '0.25'; speed.value = prefs.speed || '1';
    const dummyRange = document.createElement('input'); dummyRange.type = 'range'; dummyRange.min = '40'; dummyRange.max = '280'; dummyRange.step = '10'; dummyRange.value = prefs.dummyRange || '140';
    const loop = document.createElement('input'); loop.type = 'checkbox'; loop.dataset.visualLabLoop = '1';
    const seedBox = document.createElement('input'); seedBox.type = 'checkbox'; seedBox.dataset.visualLabSeed = '1';
    const anchor = document.createElement('select'); options(anchor, ['foot', 'center', 'chest', 'head', 'hand', 'weapon', 'castOrigin', 'ground']); anchor.value = 'head';

    function rangeRow(label, input, format) {
      const wrap = row(label, input);
      wrap.style.gridTemplateColumns = '72px 1fr 42px';
      const read = document.createElement('span');
      read.style.cssText = 'color:#f3d48b;text-align:right;font-weight:800';
      function sync() { read.textContent = format(input.value); }
      input.addEventListener('input', sync);
      sync();
      wrap.appendChild(read);
      return wrap;
    }

    const profile = document.createElement('select');
    profile.dataset.visualLabProfile = '1';
    profile.style.cssText = 'width:100%;min-height:36px;background:#12171f;color:#e6edf3;border:1px solid #4a5260;border-radius:8px';

    function familyOf(prof, def) {
      const type = def && def.delivery && def.delivery.type || '';
      if (prof && prof.projectileVisual || type === 'projectile') return 'projectile';
      if (prof && (prof.persistentFx || prof.placeSequence) || type === 'trap') return 'trap';
      if (prof && (prof.dashSequence || prof.travelEffect) || type === 'dash' || type === 'blink') return 'dash';
      if (prof && prof.throwVisual || type === 'swap_sword') return 'throw';
      if (type === 'chain') return 'chain';
      if (type === 'wall') return 'wall';
      if (type === 'aura' || type === 'persistent_area') return 'aura';
      if (type === 'instant') return 'self';
      return 'aoe';
    }

    function hasVisual(def) {
      if (!def) return false;
      if (root.KeloAbilityVisuals && typeof root.KeloAbilityVisuals.hasProfile === 'function') return root.KeloAbilityVisuals.hasProfile(def);
      const registry = root.KeloVisualProfileRegistry;
      if (registry && def.visualProfileId && registry.get(def.visualProfileId)) return true;
      if (registry && typeof registry.resolve === 'function' && registry.resolve(def.id, def.key)) return true;
      return false;
    }

    function catalogRows() {
      const defs = root.ABILITIES || [];
      return defs.filter(function (def) {
        const fam = familyOf(null, def);
        const has = hasVisual(def);
        if (familyFilter === 'missing') return !has;
        if (familyFilter === 'all') return true;
        if (familyFilter === 'projectile') return fam === 'projectile' || fam === 'chain' || fam === 'throw';
        if (familyFilter === 'aoe') return fam === 'aoe' || fam === 'aura' || fam === 'self' || fam === 'wall';
        if (familyFilter === 'dash') return fam === 'dash';
        if (familyFilter === 'trap') return fam === 'trap';
        return true;
      }).map(function (def) {
        const type = def && def.delivery && def.delivery.type || 'visual';
        return { id: def.key, label: (def.name || def.key) + ' · ' + type + (hasVisual(def) ? '' : ' · MISSING') };
      });
    }

    function fillProfiles(keep) {
      const selected = keep || profile.value;
      const rows = catalogRows();
      options(profile, rows.length ? rows : [{ id: 'fireball', label: 'Bola de Fuego · projectile' }]);
      let pick = selected || prefs.ability || 'fireball';
      const idx = Array.from(profile.options).findIndex(function (option) { return option.value === pick; });
      profile.selectedIndex = idx >= 0 ? idx : 0;
    }

    function currentDef() { return abilityDef(profile.value); }
    function currentProfile() {
      const def = currentDef();
      if (root.KeloVisualProfileRegistry && typeof root.KeloVisualProfileRegistry.resolve === 'function') {
        return root.KeloVisualProfileRegistry.resolve(def && def.id, profile.value) || null;
      }
      return root.KeloVisualProfileRegistry && root.KeloVisualProfileRegistry.get(def && def.visualProfileId) || null;
    }
    function labContext(extra) {
      const p = actor();
      const dir = directionOf(direction.value);
      const origin = p ? { x: p.x, y: p.y } : originFor(dir, 0);
      const prof = currentProfile();
      const key = profile.value || (prof && prof.abilityKey) || null;
      const def = abilityDef(key);
      const delivery = def && def.delivery || {};
      const targeting = def && def.targeting || {};
      const telegraph = def && def.telegraph || {};
      const range = Number(dummyRange.value) || Number(delivery.maxDistance || targeting.range || delivery.distance) || 140;
      if (p) p._face = faceOf(dir);
      if (!seedLock) lastSeed = Date.now() & 65535;
      return Object.assign({
        actor: p, actorId: p && p.id, abilityId: def && def.id, abilityKey: key,
        origin: origin, target: originFor(dir, range),
        direction: dir,
        gameplay: {
          speed: (Number(delivery.speed) || 420) * Number(speed.value),
          range: Number(delivery.maxDistance || targeting.range || delivery.distance || delivery.width) || range,
          radius: Number(delivery.radius || delivery.activationRadius || telegraph.radius) || 80,
          duration: Number(delivery.duration) || 0.18,
          width: Number(delivery.width || telegraph.width) || 0
        },
        visual: { scale: Number(scale.value), seed: lastSeed },
        trapId: 'lab_trap'
      }, extra || {});
    }

    const cueButtons = {};
    function playAbilityCue(cue, collapse, extra) {
      if (!root.KeloAbilityVisuals) return;
      const ctx = labContext(extra);
      root.KeloAbilityVisuals.playCue(ctx.abilityId, cue, ctx);
      if (cue === 'impact') dummyHit(ctx);
      if (collapse !== false) beginPreview(700);
    }

    function trapCtx() {
      const ctx = labContext({ trapId: 'lab_trap' });
      return Object.assign({}, ctx, { origin: ctx.target, target: ctx.target, position: ctx.target });
    }

    function spawnDummy() {
      if (dummyFxId && root.KeloFX) root.KeloFX.stop(dummyFxId);
      dummyFxId = null;
      if (!dummyOn || !root.KeloFX) return;
      const ctx = labContext();
      dummyFxId = root.KeloFX.spawn('magic_ground_ring_01', {
        origin: ctx.target, target: ctx.target, visual: { scale: 1, seed: 17 }
      }, { x: ctx.target.x, y: ctx.target.y, loop: true, duration: 0.9, scale: 1.15 });
    }

    function stopGhosts() {
      ghostIds.forEach(function (id) { if (id && root.KeloFX) root.KeloFX.stop(id); });
      ghostIds = [];
    }

    function spawnGhosts() {
      stopGhosts();
      if (!ghostOn || !root.KeloFX || typeof root.KeloFX.preview !== 'function') return;
      const ctx = labContext();
      const family = familyOf(currentProfile(), currentDef());
      const def = currentDef();
      const telegraph = def && def.telegraph || {};
      const radius = Math.max(12, Number(ctx.gameplay.radius) || 80);
      const path = Math.max(24, Number(dummyRange.value) || 140);
      ghostIds.push(root.KeloFX.preview({
        id: 'lab_origin_ghost', type: 'glow', space: 'WORLD', layer: 'groundFX',
        duration: 0.9, loop: true, radius: 14, color: 'rgba(243,212,139,0.85)', alpha: 0.8, fade: 'pulse'
      }, ctx, { x: ctx.origin.x, y: ctx.origin.y, loop: true, duration: 0.9 }));
      const atOrigin = family === 'aoe' || family === 'aura' || family === 'self';
      const diskAt = atOrigin ? ctx.origin : ctx.target;
      if (family === 'aoe' || family === 'aura' || family === 'self' || family === 'trap') {
        ghostIds.push(root.KeloFX.preview({
          id: 'lab_radius_ghost', type: 'area_disk', space: 'WORLD', layer: 'groundFX',
          duration: 0.9, loop: true, radius: radius,
          color: 'rgba(231,197,106,0.12)', accent: 'rgba(243,212,139,0.9)',
          lineWidth: 2.2, alpha: 0.75, fade: 'pulse'
        }, ctx, { x: diskAt.x, y: diskAt.y, loop: true, duration: 0.9, scale: 1 }));
      }
      if (family === 'wall' || telegraph.shape === 'wall') {
        const width = Math.max(40, Number(ctx.gameplay.width) || 150);
        ghostIds.push(root.KeloFX.preview({
          id: 'lab_wall_ghost', type: 'beam', space: 'WORLD', layer: 'foregroundFX',
          duration: 0.9, loop: true, width: 10, color: 'rgba(168,216,255,0.85)', alpha: 0.8
        }, Object.assign({}, ctx, {
          origin: { x: ctx.target.x - width / 2, y: ctx.target.y },
          target: { x: ctx.target.x + width / 2, y: ctx.target.y }
        }), { x: ctx.target.x - width / 2, y: ctx.target.y, loop: true, duration: 0.9 }));
      }
      if (family === 'projectile' || family === 'dash' || family === 'throw' || family === 'chain') {
        ghostIds.push(root.KeloFX.preview({
          id: 'lab_range_ghost', type: 'streak', space: 'WORLD', layer: 'foregroundFX',
          duration: 0.8, loop: true, length: path, width: 7,
          color: 'rgba(231,197,106,0.7)', accent: 'rgba(255,255,255,0.4)', alpha: 0.8, fade: 'pulse'
        }, Object.assign({}, ctx, { origin: ctx.target }), { x: ctx.target.x, y: ctx.target.y, loop: true, duration: 0.8 }));
        ghostIds.push(root.KeloFX.preview({
          id: 'lab_impact_ghost', type: 'area_disk', space: 'WORLD', layer: 'groundFX',
          duration: 0.9, loop: true, radius: Math.max(16, Number(ctx.gameplay.radius) || 16),
          color: 'rgba(231,197,106,0.10)', accent: 'rgba(243,212,139,0.75)',
          lineWidth: 1.6, alpha: 0.7, fade: 'pulse'
        }, ctx, { x: ctx.target.x, y: ctx.target.y, loop: true, duration: 0.9 }));
      }
    }

    function dummyHit(ctx) {
      if (!dummyOn || !root.KeloFX || typeof root.KeloFX.preview !== 'function') return;
      const at = (ctx && ctx.target) || labContext().target;
      root.KeloFX.preview({
        id: 'lab_dummy_hit', type: 'burst', space: 'WORLD', layer: 'foregroundFX',
        duration: 0.28, loop: false, radius: 30, rays: 9,
        color: '#ffb4b4', accent: '#fff4f0', alpha: 0.95, fade: 'out'
      }, ctx || labContext(), { x: at.x, y: at.y, loop: false, duration: 0.28 });
    }

    function restoreCamera() {
      if (!camSnap || !root.KeloCamera || typeof root.KeloCamera.restoreState !== 'function') { camSnap = null; return; }
      try { root.KeloCamera.restoreState(camSnap, { source: 'visual-lab' }); } catch (e) {}
      camSnap = null;
    }
    function peekCamera(ctx, ms) {
      if (!camOn || !root.KeloCamera || !ctx || typeof root.KeloCamera.setTarget !== 'function') return;
      try {
        if (!camSnap) camSnap = root.KeloCamera.snapshot();
        root.KeloCamera.setTarget((ctx.origin.x + ctx.target.x) / 2, (ctx.origin.y + ctx.target.y) / 2, { source: 'visual-lab' });
        later(Math.max(240, ms || 800), restoreCamera);
      } catch (e) {}
    }

    function restoreHelpers() {
      dummyFxId = null;
      ghostIds = [];
      if (dummyOn) spawnDummy();
      if (ghostOn) spawnGhosts();
    }

    function stopAll(restoreDummy) {
      clearLabTimers();
      restoreCamera();
      const ctx = labContext();
      if (root.KeloVisualEventBus) {
        root.KeloVisualEventBus.emit('TRAP_EXPIRED', Object.assign({}, ctx, { trapId: 'lab_trap', origin: ctx.target, target: ctx.target }));
        root.KeloVisualEventBus.emit('DASH_ENDED', ctx);
      }
      if (root.KeloSequence && root.KeloSequence.stopAll) root.KeloSequence.stopAll();
      if (root.KeloProjectileVisuals && root.KeloProjectileVisuals.stopAll) root.KeloProjectileVisuals.stopAll();
      if (root.KeloFX && root.KeloFX.stopAll) root.KeloFX.stopAll();
      dummyFxId = null;
      ghostIds = [];
      if (restoreDummy !== false) restoreHelpers();
      setStatus('stop');
    }

    function playFull() {
      const prof = currentProfile();
      const def = currentDef();
      if (!root.KeloAbilityVisuals) { setStatus('sin resolver'); return; }
      if (!prof) { setStatus('MISSING profile · ' + (def && def.name || profile.value || '')); beginPreview(900); return; }
      stopAll(true);
      const ctx = labContext();
      const family = familyOf(prof, def);
      const speedMs = Math.max(80, (Number(dummyRange.value) || 160) / Math.max(60, Number(ctx.gameplay.speed) || 420) * 1000);
      let restoreAt = 700;
      playAbilityCue('cast', false);
      if (family === 'projectile') {
        later(90, function () { root.KeloAbilityVisuals.playCue(ctx.abilityId, 'projectile', ctx); });
        later(90 + Math.min(900, speedMs), function () {
          root.KeloAbilityVisuals.playCue(ctx.abilityId, 'impact', Object.assign({}, ctx, { origin: ctx.target }));
          dummyHit(ctx);
        });
        restoreAt = 90 + Math.min(900, speedMs) + 420;
      } else if (family === 'aoe' || family === 'chain') {
        later(80, function () {
          root.KeloAbilityVisuals.playCue(ctx.abilityId, 'impact', ctx);
          if (prof.areaFx) root.KeloAbilityVisuals.playCue(ctx.abilityId, 'area', ctx);
          dummyHit(ctx);
        });
        restoreAt = 620;
      } else if (family === 'dash') {
        if (root.KeloVisualEventBus) {
          root.KeloVisualEventBus.emit('DASH_STARTED', ctx);
          later(Math.max(120, (Number(ctx.gameplay.duration) || 0.18) * 1000), function () {
            root.KeloVisualEventBus.emit('DASH_ENDED', ctx);
          });
        } else {
          playAbilityCue('dash', false);
          later(180, function () { playAbilityCue('dashEnd', false); });
        }
        restoreAt = Math.max(280, (Number(ctx.gameplay.duration) || 0.18) * 1000 + 200);
      } else if (family === 'trap') {
        const placed = trapCtx();
        if (root.KeloVisualEventBus) {
          root.KeloVisualEventBus.emit('TRAP_PLACED', placed);
          later(500, function () { root.KeloVisualEventBus.emit('TRAP_ARMED', placed); });
        } else {
          playAbilityCue('place', false, placed);
          playAbilityCue('persistent', false, placed);
          playAbilityCue('area', false, placed);
        }
        restoreAt = 900;
      } else if (family === 'throw') {
        later(80, function () { root.KeloAbilityVisuals.playCue(ctx.abilityId, 'throw', ctx); });
        restoreAt = 880;
      } else if (family === 'aura' || family === 'self') {
        later(80, function () {
          if (prof.areaFx) root.KeloAbilityVisuals.playCue(ctx.abilityId, 'area', ctx);
          else playAbilityCue('impact', false);
        });
        restoreAt = 700;
      } else if (family === 'wall') {
        later(80, function () { playAbilityCue('place', false, trapCtx()); });
        restoreAt = 700;
      }
      setStatus('play ' + (def && def.name || prof.abilityKey) + ' · ' + family + ' · seed ' + lastSeed);
      peekCamera(ctx, restoreAt);
      if (loopOn) {
        later(restoreAt, function () { if (loopOn) playFull(); });
        beginPreview(0);
      } else {
        beginPreview(restoreAt);
      }
    }

    function playInGame() {
      const def = currentDef();
      if (!def) { setStatus('sin definition'); return; }
      const run = function (retried) {
        const ctx = labContext();
        const request = { direction: ctx.direction, position: ctx.target };
        const slots = root.KeloAbilities && root.KeloAbilities.hotbar && root.KeloAbilities.hotbar.slots || [];
        const slot = slots.findIndex(function (entry) { return entry && (entry.abilityKey === def.key || entry.definition && entry.definition.key === def.key); });
        let result = null;
        if (slot >= 0 && root.KeloAbilities.engine && root.KeloAbilities.engine.predict) {
          result = root.KeloAbilities.engine.predict(Object.assign({ slotIndex: slot }, request));
        }
        if ((!result || result.valid === false) && root.KeloAbilities && root.KeloAbilities.engine && root.KeloAbilities.engine.predictSource) {
          result = root.KeloAbilities.engine.predictSource({
            sourceType: 'visual-lab', sourceId: 'lab', definition: def, request: request
          });
        }
        if (result && result.valid === false && result.reason === 'INVALID_POSITION' && !retried) {
          const max = Number(def.targeting && def.targeting.range || def.delivery && def.delivery.maxDistance) || 280;
          dummyRange.value = String(Math.max(40, Math.min(280, Math.round(max / 10) * 10)));
          dummyRange.dispatchEvent(new Event('input'));
          if (dummyOn) spawnDummy();
          if (ghostOn) spawnGhosts();
          return run(true);
        }
        if (!result) {
          playFull();
          setStatus('fallback playCue');
          return;
        }
        if (result.valid === false) setStatus(result.reason || 'FAILED');
        else setStatus('in-game ' + def.key + (slot >= 0 ? ' slot ' + slot : ' source lab'));
        peekCamera(ctx, 1100);
        beginPreview(1100);
      };
      if (root.KeloAbilitiesLoader && typeof root.KeloAbilitiesLoader.ensure === 'function') {
        root.KeloAbilitiesLoader.ensure().then(function () { run(false); }).catch(function (error) { setStatus(String(error && error.message || error)); });
      } else run(false);
    }

    function savePrefs() {
      try {
        sessionStorage.setItem(PREF_KEY, JSON.stringify({
          ability: profile.value, pin: pinned, ghost: ghostOn, dummy: dummyOn, loop: loopOn, cam: camOn,
          seedLock: seedLock, seed: lastSeed, dir: direction.value, scale: scale.value, speed: speed.value,
          dummyRange: dummyRange.value, family: familyFilter
        }));
      } catch (e) {}
    }

    const hint = document.createElement('div'); hint.textContent = 'Hueco izquierdo para el joystick · TAP SET coloca el dummy · CAM sigue el preview'; hint.style.cssText = 'color:#78808b;margin:6px 0 8px'; abilitiesPane.appendChild(hint);

    const pad = document.createElement('div');
    pad.dataset.visualLabPad = '1';
    pad.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin:6px 0 8px';
    const padMap = [
      ['up-left', '↖'], ['up', '↑'], ['up-right', '↗'],
      ['left', '←'], [null, 'DIR'], ['right', '→'],
      ['down-left', '↙'], ['down', '↓'], ['down-right', '↘']
    ];
    const padBtns = {};
    function paintPad() {
      Object.keys(padBtns).forEach(function (key) {
        const on = direction.value === key;
        padBtns[key].style.borderColor = on ? '#c9a24a' : '#4a5260';
        padBtns[key].style.background = on ? '#2a2112' : '#191f29';
        padBtns[key].style.color = on ? '#f3d48b' : '#a9b1bc';
      });
    }
    function setDir(value) {
      direction.value = value;
      paintPad();
      direction.dispatchEvent(new Event('change'));
    }
    padMap.forEach(function (pair) {
      if (!pair[0]) {
        const spacer = document.createElement('div');
        spacer.style.cssText = 'display:flex;align-items:center;justify-content:center;color:#78808b;font-weight:800';
        spacer.textContent = pair[1];
        pad.appendChild(spacer);
        return;
      }
      const b = button(pair[1], function () { setDir(pair[0]); });
      b.style.cssText += ';min-height:36px;padding:0;font-size:14px';
      padBtns[pair[0]] = b;
      pad.appendChild(b);
    });
    shared.appendChild(pad);
    shared.appendChild(direction);
    shared.appendChild(rangeRow('Escala', scale, function (v) { return Number(v).toFixed(1) + '×'; }));
    shared.appendChild(rangeRow('Velocidad', speed, function (v) { return Number(v).toFixed(2) + '×'; }));
    const loopRow = row('Loop', loop);
    loopRow.style.gridTemplateColumns = '72px 1fr';
    shared.appendChild(loopRow);
    const seedRow = row('Seed lock', seedBox);
    seedRow.style.gridTemplateColumns = '72px 1fr';
    shared.appendChild(seedRow);

    const familyRow = document.createElement('div');
    familyRow.dataset.visualLabFamily = '1';
    familyRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin:0 0 8px';
    const familyBtns = {};
    ['all', 'missing', 'projectile', 'aoe', 'dash', 'trap'].forEach(function (key) {
      const labels = { all: 'ALL', missing: 'MISSING', projectile: 'PROJ', aoe: 'AOE', dash: 'DASH', trap: 'TRAP' };
      const b = button(labels[key], function () {
        familyFilter = key;
        fillProfiles(profile.value);
        paintFamily();
        syncCues();
        savePrefs();
      });
      b.dataset.visualLabFamilyChip = key;
      b.style.cssText += ';min-height:32px;padding:6px 8px;font-size:9px';
      familyBtns[key] = b;
      familyRow.appendChild(b);
    });
    function paintFamily() {
      familyRow.dataset.visualLabFamily = familyFilter;
      Object.keys(familyBtns).forEach(function (key) {
        const on = familyFilter === key;
        familyBtns[key].style.borderColor = on ? '#c9a24a' : '#4a5260';
        familyBtns[key].style.background = on ? '#2a2112' : '#191f29';
        familyBtns[key].style.color = on ? '#f3d48b' : '#a9b1bc';
      });
    }
    abilitiesPane.appendChild(familyRow);

    abilitiesPane.appendChild(rangeRow('Dummy m', dummyRange, function (v) { return String(Math.round(Number(v))); }));
    const abilityRow = document.createElement('div');
    abilityRow.style.cssText = 'display:grid;grid-template-columns:40px 1fr 40px;gap:6px;align-items:center;margin:5px 0 8px';
    const prevBtn = button('◀', function () { stepAbility(-1); });
    const nextBtn = button('▶', function () { stepAbility(1); });
    prevBtn.dataset.visualLabPrev = '1';
    nextBtn.dataset.visualLabNext = '1';
    prevBtn.style.cssText += ';padding:0;min-height:36px';
    nextBtn.style.cssText += ';padding:0;min-height:36px';
    abilityRow.appendChild(prevBtn);
    abilityRow.appendChild(profile);
    abilityRow.appendChild(nextBtn);
    abilitiesPane.appendChild(abilityRow);
    function stepAbility(delta) {
      const n = profile.options.length;
      if (!n) return;
      profile.selectedIndex = (profile.selectedIndex + delta + n) % n;
      profile.dispatchEvent(new Event('change'));
    }

    const mainActions = document.createElement('div'); mainActions.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0';
    const playBtn = button('▶ PLAY FULL', playFull);
    playBtn.style.cssText += ';background:#2a2112;border-color:#c9a24a';
    mainActions.appendChild(playBtn);
    mainActions.appendChild(button('🎮 TEST IN GAME', playInGame));
    abilitiesPane.appendChild(mainActions);

    const cueGrid = document.createElement('div'); cueGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 8px';
    function addCue(key, label, fn) {
      const b = button(label, fn);
      b.dataset.visualLabCue = key;
      cueButtons[key] = b;
      cueGrid.appendChild(b);
    }
    addCue('cast', '▶ CAST', function () { playAbilityCue('cast'); });
    addCue('projectile', '➜ PROJECTILE', function () { playAbilityCue('projectile'); });
    addCue('impact', '✸ IMPACT', function () { playAbilityCue('impact'); });
    addCue('area', '◎ AREA', function () {
      const ctx = labContext();
      const family = familyOf(currentProfile(), currentDef());
      const extra = family === 'trap' || family === 'wall' ? trapCtx() : ctx;
      playAbilityCue('area', true, extra);
    });
    addCue('dash', '💨 DASH', function () {
      const ctx = labContext();
      if (root.KeloVisualEventBus) {
        root.KeloVisualEventBus.emit('DASH_STARTED', ctx);
        later(180, function () { root.KeloVisualEventBus.emit('DASH_ENDED', ctx); });
      } else playAbilityCue('dash');
      beginPreview(420);
    });
    addCue('end', '⏹ END', function () {
      const ctx = labContext();
      if (root.KeloVisualEventBus) root.KeloVisualEventBus.emit('DASH_ENDED', ctx);
      else playAbilityCue('dashEnd');
      beginPreview(420);
    });
    addCue('place', '🪤 PLACE', function () {
      const ctx = trapCtx();
      if (root.KeloVisualEventBus) root.KeloVisualEventBus.emit('TRAP_PLACED', ctx);
      else { playAbilityCue('place', false, ctx); playAbilityCue('persistent', false, ctx); playAbilityCue('area', false, ctx); }
      beginPreview(700);
    });
    addCue('arm', '⚡ ARM', function () {
      const ctx = trapCtx();
      if (root.KeloVisualEventBus) root.KeloVisualEventBus.emit('TRAP_ARMED', ctx);
      else playAbilityCue('arm', true, ctx);
      beginPreview(500);
    });
    addCue('trigger', '☠ TRIGGER', function () {
      const ctx = trapCtx();
      if (root.KeloVisualEventBus) root.KeloVisualEventBus.emit('TRAP_TRIGGERED', ctx);
      else playAbilityCue('trigger', true, ctx);
      dummyHit(ctx);
      beginPreview(500);
    });
    abilitiesPane.appendChild(cueGrid);

    const helperRow = document.createElement('div'); helperRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 8px';
    const dummyBtn = button('◎ DUMMY ON', function () {
      dummyOn = !dummyOn;
      paintDummy();
      if (dummyOn) spawnDummy(); else if (dummyFxId && root.KeloFX) { root.KeloFX.stop(dummyFxId); dummyFxId = null; }
      savePrefs();
    });
    const ghostBtn = button('◯ GHOST OFF', function () {
      ghostOn = !ghostOn;
      paintGhost();
      if (ghostOn) spawnGhosts(); else stopGhosts();
      savePrefs();
    });
    ghostBtn.dataset.visualLabGhost = '1';
    helperRow.appendChild(dummyBtn);
    helperRow.appendChild(ghostBtn);
    abilitiesPane.appendChild(helperRow);

    const extraRow = document.createElement('div'); extraRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 8px';
    const tapBtn = button('TAP SET', function () {
      armTap = !armTap;
      paintTap();
      setStatus(armTap ? 'tap the world' : '');
    });
    tapBtn.dataset.visualLabTap = '1';
    const camBtn = button('CAM ON', function () {
      camOn = !camOn;
      paintCam();
      savePrefs();
    });
    camBtn.dataset.visualLabCam = '1';
    extraRow.appendChild(tapBtn);
    extraRow.appendChild(camBtn);
    abilitiesPane.appendChild(extraRow);

    function paintPin() {
      pinBtn.style.borderColor = pinned ? '#8be0ac' : '#4a5260';
      pinBtn.style.color = pinned ? '#8be0ac' : '#f3d48b';
    }
    function paintDummy() {
      dummyBtn.textContent = dummyOn ? '◎ DUMMY OFF' : '◎ DUMMY ON';
      dummyBtn.style.borderColor = dummyOn ? '#8be0ac' : '#4a5260';
    }
    function paintGhost() {
      ghostBtn.textContent = ghostOn ? '◯ GHOST OFF' : '◯ GHOST ON';
      ghostBtn.style.borderColor = ghostOn ? '#8be0ac' : '#4a5260';
      ghostBtn.dataset.visualLabGhost = ghostOn ? '1' : '0';
    }
    function paintTap() {
      tapBtn.textContent = armTap ? 'TAP…' : 'TAP SET';
      tapBtn.style.borderColor = armTap ? '#8be0ac' : '#4a5260';
      tapBtn.style.color = armTap ? '#8be0ac' : '#f3d48b';
    }
    function paintCam() {
      camBtn.textContent = camOn ? 'CAM ON' : 'CAM OFF';
      camBtn.style.borderColor = camOn ? '#8be0ac' : '#4a5260';
    }

    dummyRange.addEventListener('input', function () { if (dummyOn) spawnDummy(); if (ghostOn) spawnGhosts(); savePrefs(); });
    direction.addEventListener('change', function () { if (dummyOn) spawnDummy(); if (ghostOn) spawnGhosts(); savePrefs(); });
    scale.addEventListener('change', savePrefs);
    speed.addEventListener('change', savePrefs);
    loop.addEventListener('change', function () { loopOn = loop.checked === true; savePrefs(); });
    seedBox.addEventListener('change', function () { seedLock = seedBox.checked === true; savePrefs(); });

    const missing = document.createElement('div'); missing.dataset.visualLabMissing = '1'; missing.style.cssText = 'color:#efd98f;margin:6px 0 8px;line-height:1.45'; abilitiesPane.appendChild(missing);
    function refreshMissing() {
      const defs = root.ABILITIES || [];
      const absent = defs.filter(function (def) { return def.visualProfileId && !hasVisual(def); }).map(function (def) { return def.name || def.key; });
      missing.textContent = absent.length ? 'MISSING · ' + absent.join(' · ') : '';
    }

    statusLine = document.createElement('div'); statusLine.style.cssText = 'color:#8be0ac;margin:4px 0'; abilitiesPane.appendChild(statusLine);
    chipLine = document.createElement('div'); chipLine.style.cssText = 'color:#8b949e;border-top:1px solid #252b35;padding-top:8px;margin-top:6px'; abilitiesPane.appendChild(chipLine);

    function syncCues() {
      const prof = currentProfile();
      const def = currentDef();
      const family = familyOf(prof, def);
      const visible = {
        cast: !!(prof && (prof.castSequence || family === 'aoe' || family === 'chain' || family === 'aura' || family === 'self' || family === 'throw' || family === 'wall') && family !== 'dash'),
        projectile: !!(prof && prof.projectileVisual),
        impact: !!(prof && (prof.impactSequence || family === 'aoe' || family === 'projectile' || family === 'chain')),
        area: !!(prof && prof.areaFx) || family === 'aoe' || family === 'trap' || family === 'aura',
        dash: family === 'dash',
        end: family === 'dash',
        place: family === 'trap' || family === 'wall',
        arm: family === 'trap',
        trigger: family === 'trap'
      };
      Object.keys(cueButtons).forEach(function (key) {
        cueButtons[key].style.display = visible[key] ? '' : 'none';
      });
      if (ghostOn) spawnGhosts();
      if (dummyOn) spawnDummy();
    }
    profile.addEventListener('change', function () {
      try { sessionStorage.setItem('kelo-visual-lab-ability', profile.value); } catch (e) {}
      syncCues();
      savePrefs();
    });

    const pieceHint = document.createElement('div'); pieceHint.textContent = 'Componentes sueltos · no son una skill · Dirección/Escala/Loop están arriba'; pieceHint.style.cssText = 'color:#78808b;margin:6px 0 8px'; piecesPane.appendChild(pieceHint);
    const eyeQuick = button('👁 ACTIVATION EYE', playActivationEyePreview);
    eyeQuick.style.cssText += ';display:block;width:100%;margin:0 0 7px;background:#2b1740;border-color:#8b5cf6;color:#f0ddff;font-size:11px';
    piecesPane.appendChild(eyeQuick);
    const katanaQuick = button('🗡 KATANA THROW', playKatanaThrowPreview);
    katanaQuick.style.cssText += ';display:block;width:100%;margin:0 0 10px;background:#21152f;border-color:#a774ff;color:#f0ddff;font-size:11px';
    piecesPane.appendChild(katanaQuick);
    piecesPane.appendChild(row('Anchor', anchor));

    const animation = document.createElement('select'); options(animation, root.KeloAnimationRegistry ? root.KeloAnimationRegistry.list() : []); piecesPane.appendChild(row('Animation', animation));
    piecesPane.appendChild(button('▶ PLAY ANIMATION', function () {
      const p = actor(); if (!p || !root.KeloAnimation) return;
      p._face = faceOf(directionOf(direction.value)); root.KeloAnimation.play(p, animation.value, { speed: Number(speed.value), loop: loop.checked, force: true, context: { actor: p, visual: { scale: Number(scale.value) } } }); beginPreview(900);
    }));

    const fx = document.createElement('select'); options(fx, root.KeloFXRegistry ? root.KeloFXRegistry.list() : []); piecesPane.appendChild(row('VFX', fx));
    const eyeIndex = Array.from(fx.options).findIndex(function (option) { return option.value === 'sword_swap_activation_eye_anim'; });
    if (eyeIndex >= 0) fx.selectedIndex = eyeIndex;
    piecesPane.appendChild(button('✦ SPAWN VFX', function () {
      const p = actor(), dir = directionOf(direction.value), pos = originFor(dir, 70);
      const def = root.KeloFXRegistry && root.KeloFXRegistry.get(fx.value);
      const isActor = def && def.space === 'ACTOR';
      root.KeloFX && root.KeloFX.spawn(fx.value, { actor: isActor ? p : null, actorId: isActor && p ? p.id : null, origin: isActor ? null : pos, direction: dir, visual: { scale: Number(scale.value), seed: lastSeed } }, { socket: anchor.value, scale: Number(scale.value), loop: loop.checked });
      beginPreview(900);
    }));

    const projectile = document.createElement('select'); options(projectile, root.KeloProjectileVisualRegistry ? root.KeloProjectileVisualRegistry.list() : []); piecesPane.appendChild(row('Projectile', projectile));
    const katanaIndex = Array.from(projectile.options).findIndex(function (option) { return option.value === 'sword_swap_katana_throw_visual'; });
    if (katanaIndex >= 0) projectile.selectedIndex = katanaIndex;
    piecesPane.appendChild(button('➜ PREVIEW PROJECTILE', function () {
      const p = actor(), dir = directionOf(direction.value); if (p) p._face = faceOf(dir);
      root.KeloProjectileVisuals && root.KeloProjectileVisuals.preview(projectile.value, { actor: p, actorId: p && p.id, origin: p && root.KeloAnchors ? root.KeloAnchors.get(p, anchor.value) : originFor(dir, 0), direction: dir, gameplay: { speed: 420 * Number(speed.value), range: 320 }, visual: { scale: Number(scale.value), seed: lastSeed } }); beginPreview(900);
    }));

    const sequence = document.createElement('select'); options(sequence, root.KeloSequenceRegistry ? root.KeloSequenceRegistry.list() : []); piecesPane.appendChild(row('Sequence', sequence));
    const seqIndex = Array.from(sequence.options).findIndex(function (option) { return option.value === 'sequence_sword_swap_activation_eye_anim'; });
    if (seqIndex >= 0) sequence.selectedIndex = seqIndex;
    piecesPane.appendChild(button('▶ PLAY SEQUENCE', function () {
      const p = actor(), dir = directionOf(direction.value); if (p) p._face = faceOf(dir);
      root.KeloSequence && root.KeloSequence.play(sequence.value, { actor: p, actorId: p && p.id, origin: p ? { x: p.x, y: p.y } : originFor(dir, 0), direction: dir, target: originFor(dir, 100), gameplay: { speed: 420, range: 320 }, visual: { scale: Number(scale.value), seed: lastSeed } }, { speed: Number(speed.value), loop: loop.checked }); beginPreview(900);
    }));

    const status = document.createElement('select'); const statuses = Object.keys(root.KELO_VISUAL_MANIFESTS && root.KELO_VISUAL_MANIFESTS.statusVisuals || {}).map(function (id) { return { id: id }; }); options(status, statuses); piecesPane.appendChild(row('Status', status));
    piecesPane.appendChild(button('◉ PREVIEW STATUS', function () {
      const p = actor(), ref = root.KELO_VISUAL_MANIFESTS.statusVisuals[status.value];
      if (p && ref && root.KeloFX) root.KeloFX.spawn(ref, { actor: p, actorId: p.id, visual: { scale: Number(scale.value), seed: lastSeed } }, { socket: 'center', loop: loop.checked }); beginPreview(900);
    }));

    const sfx = document.createElement('select'); options(sfx, root.KeloSFXRegistry ? root.KeloSFXRegistry.list() : []); piecesPane.appendChild(row('SFX', sfx));
    piecesPane.appendChild(button('♪ PLAY SFX', function () { root.KeloSFX && root.KeloSFX.play(sfx.value, { actor: actor() }); }));

    const actions = document.createElement('div'); actions.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px';
    actions.appendChild(button('Shake', function () { root.KeloScreenFX && root.KeloScreenFX.shake('impact_medium'); beginPreview(400); }));
    actions.appendChild(button('Flash', function () { root.KeloScreenFX && root.KeloScreenFX.flash('flash_warm_small'); beginPreview(400); })); piecesPane.appendChild(actions);

    function onArmPointer(ev) {
      if (!armTap) return;
      if (panel && panel.contains(ev.target)) return;
      const cam = root.KeloCamera;
      if (!cam || typeof cam.screenToWorld !== 'function') return;
      const world = cam.screenToWorld(ev.clientX, ev.clientY);
      if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) return;
      if (ev.cancelable) ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      const p = actor();
      if (p) {
        const dx = world.x - p.x, dy = world.y - p.y;
        const dist = Math.hypot(dx, dy);
        dummyRange.value = String(Math.max(40, Math.min(280, Math.round(dist / 10) * 10)));
        dummyRange.dispatchEvent(new Event('input'));
        const dirs = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];
        const idx = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
        setDir(dirs[idx]);
      }
      dummyOn = true;
      paintDummy();
      spawnDummy();
      spawnGhosts();
      armTap = false;
      paintTap();
      setStatus('dummy ' + Math.round(world.x) + ',' + Math.round(world.y));
      savePrefs();
    }
    document.addEventListener('pointerdown', onArmPointer, true);

    setInterval(function () {
      if (!chipLine || !root.KELO_VISUAL_AUDIT) return;
      const a = root.KELO_VISUAL_AUDIT;
      const last = a.lastEvent && a.lastEvent.name || '—';
      const ctx = labContext();
      chipLine.textContent = 'FX ' + (a.activeFX || 0) + ' · P ' + (a.activeProjectiles || 0) + ' · SEQ ' + (a.activeSequences || 0) + ' · R' + Math.round(ctx.gameplay.range) + ' r' + Math.round(ctx.gameplay.radius) + ' · seed ' + lastSeed + (seedLock ? ' lock' : '') + ' · ' + last;
    }, 250);

    if (prefs.pin === true) pinned = true;
    if (prefs.ghost === false) ghostOn = false;
    if (prefs.dummy === true) dummyOn = true;
    if (prefs.loop === true) { loopOn = true; loop.checked = true; }
    if (prefs.cam === false) camOn = false;
    if (prefs.seedLock === true) { seedLock = true; seedBox.checked = true; }
    if (Number.isFinite(Number(prefs.seed))) lastSeed = Number(prefs.seed);
    if (prefs.family) familyFilter = String(prefs.family);
    fillProfiles(prefs.ability);
    if (prefs.dir && Array.from(direction.options).some(function (option) { return option.value === prefs.dir; })) direction.value = prefs.dir;
    paintPin(); paintDummy(); paintGhost(); paintTap(); paintCam(); paintFamily(); paintPad();
    refreshMissing();
    syncCues();

    document.body.appendChild(panel);
    setTab('abilities');
    applyChrome();
    later(80, function () { if (ghostOn) spawnGhosts(); if (dummyOn) spawnDummy(); });
    root.addEventListener('resize', applyChrome);

    root.KeloVisualLabPlayFull = playFull;
    root.KeloVisualLabStop = function () { stopAll(true); compactPlay = false; if (!collapsed) applyChrome(); };
    root.KeloVisualLabPlayInGame = playInGame;
  }

  root.KeloVisualLab = Object.freeze({
    version: 'visual-lab-v1.7.0',
    open: build,
    minimize: function () { setCollapsed(true); },
    expand: function () { setCollapsed(false); },
    playFull: function () { if (root.KeloVisualLabPlayFull) root.KeloVisualLabPlayFull(); },
    stop: function () { if (root.KeloVisualLabStop) root.KeloVisualLabStop(); },
    playInGame: function () { if (root.KeloVisualLabPlayInGame) root.KeloVisualLabPlayInGame(); },
    previewActivationEye: playActivationEyePreview,
    previewKatanaThrow: playKatanaThrowPreview,
    get enabled() { return enabled(); },
    get collapsed() { return collapsed; },
    get pinned() { return pinned; },
    get tab() { return currentTab; },
    get family() { return familyFilter; }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build, { once: true }); else build();
})(typeof globalThis !== 'undefined' ? globalThis : window);
