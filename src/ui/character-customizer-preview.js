/* KELO-INDEX
 * area: UI / CHARACTERS
 * owner: KeloCharacterCustomizerPreview (presentation only)
 * keys: CHARACTER CUSTOMIZER PREVIEW VISUAL STACK DIRECTION WALK PALETTE MOBILE
 * purpose: presenta el mismo VisualStack del juego con dirección/idle/walk sin poseer estado de personaje
 * public-api: KeloCharacterCustomizerPreview.render/setFace/setMotion/getState/entries
 * consumes: KeloCharacterCustomization + KeloCharacterVisualStack
 * state-owned: únicamente face/motion/frame efímeros del preview
 * extension-points: nuevas animaciones solo se exponen cuando el runtime real tenga un clip compatible
 * reuse: editor móvil/desktop e inspección visual
 * legacy: el hero base replica el contrato real engine-ab (lateral row 2 + mirror left)
 * do-not: NO mutar CharacterCustomization, NO inventar animaciones, NO hardcodear slots
 * online: N/A; presentación cliente
 */
(function (root) {
  'use strict';

  const VERSION = 'character-customizer-preview-v2.0.0';
  const VALID_FACES = ['down','left','right','up'];
  const previewState = { face:'down', motion:'idle', frame:0 };
  let raf = 0;
  let lastStep = 0;

  const audit = root.KELO_CHARACTER_CUSTOMIZER_PREVIEW_AUDIT = {
    version:VERSION,
    ready:false,
    renders:0,
    layers:0,
    lastKey:null,
    genericVisualStack:true,
    hardcodedSlots:false,
    directional:true,
    idleWalk:true,
    fakeAttack:false,
    paletteAware:true,
    observer:false
  };

  function api() { return root.KeloCharacterCustomization || null; }
  function stackApi() { return root.KeloCharacterVisualStack || null; }
  function normalizeFace(face) { return VALID_FACES.indexOf(String(face)) >= 0 ? String(face) : 'down'; }
  function normalizeMotion(motion) { return String(motion) === 'walk' ? 'walk' : 'idle'; }
  function heroRow(face) { return face === 'up' ? 3 : (face === 'down' ? 0 : 2); }
  function percent(index, count) { return count > 1 ? (Math.max(0,Math.min(count-1,index))/(count-1))*100 : 0; }

  function ensureStyle() {
    if (document.getElementById('kelo-character-customizer-preview-style')) return;
    const s = document.createElement('style');
    s.id = 'kelo-character-customizer-preview-style';
    s.textContent = `
#kelo-character-customizer .kc-kit-layer{position:absolute;pointer-events:none;image-rendering:pixelated;background-repeat:no-repeat}
#kelo-character-customizer .kc-kit-sheet{left:50%;bottom:26px;transform:translateX(-50%);width:180px;height:270px}
#kelo-character-customizer .kc-kit-socket{object-fit:contain;transform-origin:50% 88%;image-rendering:pixelated}
#kelo-character-customizer .kc-hero.kc-preview-left{transform:translateX(-50%) scaleX(-1)}
@media(max-width:680px){#kelo-character-customizer .kc-kit-sheet{width:104px;height:156px;bottom:17px}}
`;
    document.head.appendChild(s);
  }

  function previewEntries() {
    const A = api(), Stack = stackApi();
    if (!A || !Stack) return [];
    return Stack.resolve({ state:A.getState(), face:previewState.face });
  }
  function layerZ(entry) { return entry.section === 'back' ? 1 : 4 + Math.min(40, Number(entry.index) || 0); }
  function previewSource(A, entry) {
    if (!A || !entry || !entry.visual) return entry && entry.visual && entry.visual.source;
    if (typeof A.previewSource !== 'function') return entry.visual.source;
    return A.previewSource(entry.visual.source, entry.paletteId, entry.visual.paletteRole || entry.item.id) || entry.visual.source;
  }

  function renderBaseHero(stage) {
    const hero = stage.querySelector('.kc-hero');
    if (!hero) return;
    const col = previewState.motion === 'walk' ? previewState.frame : 0;
    const row = heroRow(previewState.face);
    hero.style.backgroundPosition = percent(col,4) + '% ' + percent(row,4) + '%';
    hero.classList.toggle('kc-preview-left', previewState.face === 'left');
    hero.dataset.kcPreviewFace = previewState.face;
    hero.dataset.kcPreviewFrame = String(col);
  }
  function renderSheet(stage, entry, A) {
    const visual = entry.visual;
    const layer = document.createElement('div');
    layer.className = 'kc-kit-layer kc-kit-sheet';
    layer.dataset.kcPreviewSlot = entry.slot;
    layer.dataset.kcPreviewItem = entry.item.id;
    layer.dataset.kcPreviewPalette = entry.paletteId || '';
    layer.style.zIndex = String(layerZ(entry));
    const src = previewSource(A,entry);
    layer.style.backgroundImage = 'url("' + String(src || '').replace(/"/g, '') + '")';
    layer.style.backgroundSize = (visual.columns * 100) + '% ' + (visual.rows * 100) + '%';
    const row = Math.max(0, Math.min(visual.rows - 1, Number(visual.faceRows && visual.faceRows[previewState.face]) || 0));
    const col = previewState.motion === 'walk' ? Math.abs(previewState.frame) % visual.columns : 0;
    layer.style.backgroundPosition = percent(col,visual.columns) + '% ' + percent(row,visual.rows) + '%';
    stage.appendChild(layer);
  }
  function renderSocket(stage, entry, A) {
    const visual = entry.visual, p = visual.preview || {};
    const img = document.createElement('img');
    const left = Number.isFinite(Number(p.leftPercent)) ? Number(p.leftPercent) : 50;
    const bottom = Number.isFinite(Number(p.bottomPercent)) ? Number(p.bottomPercent) : 20;
    const width = Number.isFinite(Number(p.widthPercent)) ? Number(p.widthPercent) : 24;
    const defaultRotation = Number(p.rotationDeg) || 0;
    const directional = visual.offsets && (visual.offsets[previewState.face] || visual.offsets.default) || {};
    const rotation = Number.isFinite(Number(directional.rotation)) ? Number(directional.rotation) : defaultRotation;
    const anchorX = Number.isFinite(Number(p.anchorX)) ? Number(p.anchorX) : Number(visual.anchor && visual.anchor.x) || 0.5;
    img.className = 'kc-kit-layer kc-kit-socket';
    img.dataset.kcPreviewSlot = entry.slot;
    img.dataset.kcPreviewItem = entry.item.id;
    img.dataset.kcPreviewPalette = entry.paletteId || '';
    img.alt = '';
    img.src = previewSource(A,entry);
    img.style.zIndex = String(layerZ(entry));
    img.style.left = left + '%';
    img.style.bottom = bottom + '%';
    img.style.width = width + '%';
    img.style.height = 'auto';
    img.style.transform = 'translateX(-' + (anchorX * 100) + '%) rotate(' + rotation + 'deg)';
    stage.appendChild(img);
  }

  function updateControls() {
    const rootEl = document.getElementById('kelo-character-customizer');
    if (!rootEl) return;
    rootEl.querySelectorAll('[data-kc-face]').forEach(function (button) { button.classList.toggle('active', button.dataset.kcFace === previewState.face); });
    rootEl.querySelectorAll('[data-kc-motion]').forEach(function (button) { button.classList.toggle('active', button.dataset.kcMotion === previewState.motion); });
  }
  function renderPreview() {
    const stage = document.querySelector('#kelo-character-customizer .kc-stage');
    const A = api(), Stack = stackApi();
    if (!A || !Stack || !stage) return false;
    ensureStyle();
    renderBaseHero(stage);
    const entries = previewEntries();
    const key = [previewState.face,previewState.motion,previewState.frame].concat(entries.map(function (entry) {
      return entry.slot + ':' + entry.item.id + ':' + entry.section + ':' + (entry.paletteId || '');
    })).join('|');
    if (stage.dataset.keloKitPreviewKey !== key || stage.querySelectorAll('.kc-kit-layer').length !== entries.length) {
      stage.querySelectorAll('.kc-kit-layer').forEach(function (node) { node.remove(); });
      entries.forEach(function (entry) {
        if (entry.visual.mode === 'sheet') renderSheet(stage, entry, A);
        else renderSocket(stage, entry, A);
      });
      stage.dataset.keloKitPreviewKey = key;
      audit.renders += 1;
      audit.layers = entries.length;
      audit.lastKey = key;
    }
    updateControls();
    return true;
  }

  function isVisible() {
    const rootEl = document.getElementById('kelo-character-customizer');
    return !!(rootEl && getComputedStyle(rootEl).display !== 'none');
  }
  function loop(now) {
    raf = 0;
    if (!isVisible() || previewState.motion !== 'walk') return;
    if (!lastStep || now - lastStep >= 130) {
      lastStep = now;
      previewState.frame = (previewState.frame + 1) % 4;
      renderPreview();
    }
    raf = requestAnimationFrame(loop);
  }
  function ensureLoop() {
    if (previewState.motion === 'walk' && isVisible() && !raf) raf = requestAnimationFrame(loop);
    if (previewState.motion !== 'walk' && raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  function setFace(face) {
    previewState.face = normalizeFace(face);
    renderPreview();
    return previewState.face;
  }
  function setMotion(motion) {
    previewState.motion = normalizeMotion(motion);
    if (previewState.motion === 'idle') previewState.frame = 0;
    lastStep = 0;
    renderPreview(); ensureLoop();
    return previewState.motion;
  }
  function schedule() { requestAnimationFrame(function () { renderPreview(); ensureLoop(); }); }

  function boot() {
    ensureStyle();
    root.addEventListener('kelo:character-customization-changed', schedule);
    root.addEventListener('kelo:character-content-pack-ready', schedule);
    root.addEventListener('kelo:character-palette-ready', schedule);
    root.addEventListener('kelo:character-visual-asset-ready', schedule);
    root.addEventListener('kelo:character-customizer-rendered', schedule);
    root.addEventListener('kelo:character-customizer-opened', schedule);
    root.addEventListener('kelo:character-customizer-closed', function () { if (raf) cancelAnimationFrame(raf); raf=0; });
    setTimeout(schedule,0);
    audit.ready = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  root.KeloCharacterCustomizerPreview = Object.freeze({
    version:VERSION,
    render:renderPreview,
    entries:previewEntries,
    setFace:setFace,
    setMotion:setMotion,
    getState:function () { return Object.freeze({ face:previewState.face, motion:previewState.motion, frame:previewState.frame }); }
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
