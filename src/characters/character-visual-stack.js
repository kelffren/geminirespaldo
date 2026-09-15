/* KELO-INDEX
 * area: CHARACTERS
 * owner: KeloCharacterVisualStack
 * keys: VISUAL STACK LAYER ORDER DEPTH PALETTE REVISION CACHE REUSABLE
 * purpose: resuelve piezas visuales activas, paletas, orden y profundidad sin dibujar ni tocar gameplay
 * public-api: KeloCharacterVisualStack.resolve/ids/invalidate
 * consumes: KeloCharacterCustomization + KeloCharacterSlotSchema
 * state-owned: cache efímero de resoluciones visuales por actor/revision/cara/sección
 * extension-points: nuevos slots usan el schema; nuevas propiedades visuales se añaden al entry genérico
 * reuse: renderer del juego, preview, remote players y futuros inspectores visuales
 * legacy: acepta estados sin palettes mediante fallback null
 * do-not: NO drawImage, NO persistir, NO modificar selección/gameplay
 * online: consume snapshots visuales por ID; no decide ownership ni autoridad
 */
(function (root) {
  'use strict';

  const VERSION = 'character-visual-stack-v2.0.0';
  const CACHE_LIMIT = 256;
  const UP_BACK_SLOTS = new Set(['back','weaponSecondary','weaponMain','weaponSkin']);
  const cache = new Map();
  const audit = root.KELO_CHARACTER_VISUAL_STACK_AUDIT = {
    version:VERSION,
    ready:true,
    resolves:0,
    cacheHits:0,
    cacheMisses:0,
    invalidations:0,
    lastFace:null,
    lastCount:0,
    pureResolver:true,
    sharedSlotSchema:true,
    paletteAware:true,
    revisionCache:true
  };

  function api() { return root.KeloCharacterCustomization || null; }
  function schema() { return root.KeloCharacterSlotSchema || null; }
  function stateFor(A, actor, explicitState) {
    if (explicitState && explicitState.slots) return explicitState;
    if (actor && typeof A.stateForActor === 'function') return A.stateForActor(actor);
    return A.getState();
  }
  function actorKey(actor, explicitState) {
    if (explicitState) return 'explicit';
    if (!actor) return 'local';
    return String(actor.id || actor.playerKey || 'actor');
  }
  function cacheKey(actor, state, face, section, explicitState) {
    return [actorKey(actor,explicitState), Number(state && state.revision)||0, face, section||'all'].join('|');
  }
  function remember(key, value) {
    cache.set(key, value);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
    return value;
  }
  function invalidate() {
    cache.clear();
    audit.invalidations += 1;
    return true;
  }

  function resolve(options) {
    const A = api(), Schema = schema();
    if (!A || !Schema) return [];
    const o = options || {};
    const face = Schema.normalizeFace(o.face || (o.actor && (o.actor._face || o.actor._visualMotion && o.actor._visualMotion.face)) || 'down');
    const state = stateFor(A, o.actor || null, o.state || null);
    const sectionFilter = o.section === 'back' || o.section === 'front' ? o.section : null;
    const key = cacheKey(o.actor || null, state, face, sectionFilter, o.state || null);
    if (!o.noCache && cache.has(key)) {
      audit.cacheHits += 1;
      const hit = cache.get(key);
      audit.lastFace = face;
      audit.lastCount = hit.length;
      return hit;
    }

    audit.cacheMisses += 1;
    const order = Schema.orderFor(face);
    const entries = [];
    order.forEach(function (slot, index) {
      const item = A.getItem(state.slots && state.slots[slot]);
      if (!item || !item.visual || !item.visual.source) return;
      const section = item.visual.layer === 'back' || (face === 'up' && UP_BACK_SLOTS.has(slot)) ? 'back' : 'front';
      if (sectionFilter && section !== sectionFilter) return;
      const paletteId = state.palettes && state.palettes[slot] ? String(state.palettes[slot]) : (item.visual.paletteId || item.defaultPaletteId || null);
      entries.push(Object.freeze({
        slot:String(slot),
        item:item,
        visual:item.visual,
        paletteId:paletteId,
        index:index,
        section:section,
        face:face,
        revision:Number(state.revision)||0
      }));
    });
    const frozen = Object.freeze(entries);
    audit.resolves += 1;
    audit.lastFace = face;
    audit.lastCount = frozen.length;
    return o.noCache ? frozen : remember(key, frozen);
  }

  function ids(options) { return resolve(options).map(function (entry) { return entry.item.id; }); }

  root.addEventListener('kelo:character-customization-changed', invalidate);
  root.addEventListener('kelo:character-content-pack-ready', invalidate);

  root.KeloCharacterVisualStack = Object.freeze({
    version:VERSION,
    resolve:resolve,
    ids:ids,
    invalidate:invalidate,
    upBackSlots:Object.freeze(Array.from(UP_BACK_SLOTS))
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
