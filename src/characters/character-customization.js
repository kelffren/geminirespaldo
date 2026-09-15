/* KELO-INDEX
 * area: CHARACTERS
 * owner: KeloCharacterCustomization
 * keys: CUSTOMIZATION MODULAR APPEARANCE OUTFIT PRESET PALETTE HISTORY SAVE SHARE ONLINE AVATAR
 * purpose: owner del estado visual modular, catálogo visual y operaciones del creador de personaje
 * public-api: register/select/palette/preset/outfit/randomize/undo/redo/save/load/export/import/networkSnapshot/applyRemote
 * consumes: KeloCharacterSlotSchema, KeloCharacterVisualStack, KeloAvatar, KeloEquipment, KeloAnchors/KeloAnimation opcionales
 * state-owned: selección visual local, historial editor, catálogos visuales y saves locales de fallback
 * extension-points: ContentPacks registra data; UI solicita operaciones; KeloAvatar compone capas mediante middleware
 * reuse: jugador local, remote players, NPC visuales, ropa/equipo/cosméticos y futuro persistence adapter online
 * legacy: lee estados v1 sin palettes/facial slots y conserva assets/base hero existentes
 * do-not: NO envolver renderAvatar; NO modificar HP/daño/inventario/autoridad gameplay
 * online: snapshots contienen solo IDs/paletas/revision; servidor futuro valida ownership antes de aceptar cambios
 */
(function (root) {
  'use strict';

  const VERSION = 'character-customization-v2.0.0';
  const STORAGE_KEY = 'kelo_character_customization_v1';
  const SAVE_STORAGE_KEY = 'kelo_character_creator_saves_v1';
  const NETWORK_SCHEMA = 'kelo-character-visual-v2';
  const LEGACY_NETWORK_SCHEMA = 'kelo-character-visual-v1';
  const SHARE_PREFIX = 'KW2';
  const HISTORY_LIMIT = 40;
  const SAVE_SLOT_COUNT = 5;
  const Schema = root.KeloCharacterSlotSchema;
  if (!Schema) throw new Error('CHARACTER_SLOT_SCHEMA_NOT_LOADED');
  const ALL_SLOTS = Schema.slots;

  const imageCache = new Map();
  const paletteImageCache = new Map();
  const catalog = new Map();
  const outfits = new Map();
  const presets = new Map();
  const palettes = new Map();
  const remoteState = new Map();
  const historyPast = [];
  const historyFuture = [];
  let revisionSeed = 2;
  let rendererMiddlewareId = null;

  function emptyPaletteSlots() {
    const out = {};
    ALL_SLOTS.forEach(function (slot) { out[slot] = null; });
    return out;
  }

  const DEFAULT_STATE = Object.freeze({
    version:2,
    mode:'modular',
    baseAppearanceId:'player_hero_v1',
    outfitId:'outfit_default',
    slots:Object.freeze({
      body:'body_legacy_hero', skinTone:'skin_default', face:'face_default', eyes:'eyes_default',
      eyebrows:'eyebrows_default', nose:'nose_default', mouth:'mouth_default', hair:null, facialHair:null,
      torso:null, legs:null, feet:null, gloves:null,
      head:null, faceAccessory:null, armor:null, back:null, weaponMain:null, weaponSecondary:null, accessory1:null, accessory2:null,
      aura:null, weaponSkin:null, characterFX:null
    }),
    palettes:Object.freeze(emptyPaletteSlots()),
    revision:1
  });

  const audit = root.KELO_CHARACTER_CUSTOMIZATION_AUDIT = {
    version:VERSION,
    ready:true,
    modular:true,
    legacyBaseFallback:true,
    backwardStateV1:true,
    sharedAnimationState:true,
    actionTransformShared:true,
    independentEquipmentLayers:true,
    sharedSlotSchema:true,
    sharedVisualStack:true,
    outfitEquipmentIndependence:true,
    upFacingWeaponOcclusion:true,
    gameplayStatsOwnedElsewhere:true,
    onlineUsesIdsOnly:true,
    networkSchema:NETWORK_SCHEMA,
    acceptsLegacyNetworkSchema:true,
    paletteSwap:true,
    paletteCache:true,
    history:true,
    saveSlots:SAVE_SLOT_COUNT,
    shareCodes:true,
    avatarMiddleware:true,
    directRenderAvatarWrapper:false,
    slotCount:ALL_SLOTS.length,
    registeredItems:0,
    registeredOutfits:0,
    registeredPresets:0,
    registeredPalettes:0,
    draws:0,
    paletteBuilds:0,
    palettePixelsChanged:0,
    missingAssets:[],
    lastChange:null,
    lastDraw:null,
    lastPaletteBuild:null,
    lastImportWarnings:[]
  };

  function cloneSlots(input) {
    const out = {};
    ALL_SLOTS.forEach(function (slot) {
      out[slot] = input && Object.prototype.hasOwnProperty.call(input, slot) ? input[slot] : DEFAULT_STATE.slots[slot];
    });
    return out;
  }
  function clonePalettes(input) {
    const out = {};
    ALL_SLOTS.forEach(function (slot) {
      const value = input && Object.prototype.hasOwnProperty.call(input, slot) ? input[slot] : DEFAULT_STATE.palettes[slot];
      out[slot] = value == null || value === '' ? null : String(value);
    });
    return out;
  }
  function normalizeState(input) {
    const src = input && typeof input === 'object' ? input : {};
    return {
      version:2,
      mode:src.mode === 'fullBodyOverride' ? 'fullBodyOverride' : 'modular',
      baseAppearanceId:String(src.baseAppearanceId || DEFAULT_STATE.baseAppearanceId),
      outfitId:src.outfitId == null ? null : String(src.outfitId),
      slots:cloneSlots(src.slots),
      palettes:clonePalettes(src.palettes),
      revision:Math.max(1, Math.floor(Number(src.revision) || revisionSeed++))
    };
  }
  function plainState(input) {
    const s = normalizeState(input || state);
    return {
      version:2,
      mode:s.mode,
      baseAppearanceId:s.baseAppearanceId,
      outfitId:s.outfitId,
      slots:Object.assign({}, s.slots),
      palettes:Object.assign({}, s.palettes),
      revision:s.revision
    };
  }
  function localStateContainer() {
    try { return typeof STATE !== 'undefined' && STATE ? STATE : null; } catch (e) { return null; }
  }
  function readStored() {
    const container = localStateContainer();
    if (container && container.characterCustomization) return normalizeState(container.characterCustomization);
    try {
      const raw = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : normalizeState(DEFAULT_STATE);
    } catch (e) { return normalizeState(DEFAULT_STATE); }
  }
  let state = readStored();

  function persist() {
    const container = localStateContainer();
    if (container) container.characterCustomization = plainState(state);
    try { if (root.localStorage) root.localStorage.setItem(STORAGE_KEY, JSON.stringify(plainState(state))); } catch (e) {}
    try { if (typeof saveState === 'function') saveState(); } catch (e) {}
  }
  function snapshot(inputState) {
    const s = normalizeState(inputState || state);
    return Object.freeze({
      version:s.version,
      mode:s.mode,
      baseAppearanceId:s.baseAppearanceId,
      outfitId:s.outfitId,
      slots:Object.freeze(Object.assign({}, s.slots)),
      palettes:Object.freeze(Object.assign({}, s.palettes)),
      revision:s.revision
    });
  }
  function networkSnapshot(inputState) {
    const s = normalizeState(inputState || state);
    return Object.freeze({
      schema:NETWORK_SCHEMA,
      version:2,
      mode:s.mode,
      baseAppearanceId:s.baseAppearanceId,
      outfitId:s.outfitId,
      slots:Object.freeze(Object.assign({}, s.slots)),
      palettes:Object.freeze(Object.assign({}, s.palettes)),
      revision:s.revision
    });
  }
  function emitCurrent(reason, detail) {
    const payload = { reason:String(reason || 'change'), detail:detail || null, state:snapshot(), network:networkSnapshot() };
    audit.lastChange = { reason:payload.reason, revision:state.revision };
    try { root.dispatchEvent(new CustomEvent('kelo:character-customization-changed', { detail:payload })); } catch (e) {}
    return payload;
  }
  function pushHistory(input) {
    historyPast.push(plainState(input));
    if (historyPast.length > HISTORY_LIMIT) historyPast.shift();
    historyFuture.length = 0;
  }
  function commit(nextState, reason, detail, options) {
    const o = options || {};
    if (!o.skipHistory) pushHistory(state);
    const next = normalizeState(nextState);
    next.revision = Math.max(Number(state.revision) + 1, Number(next.revision) + 1, revisionSeed++);
    state = next;
    persist();
    emitCurrent(reason, detail);
    return snapshot();
  }
  function canUndo() { return historyPast.length > 0; }
  function canRedo() { return historyFuture.length > 0; }
  function undo() {
    if (!historyPast.length) return { ok:false, error:'NOTHING_TO_UNDO' };
    const previous = historyPast.pop();
    historyFuture.push(plainState(state));
    const out = commit(previous, 'undo', null, { skipHistory:true });
    return { ok:true, state:out };
  }
  function redo() {
    if (!historyFuture.length) return { ok:false, error:'NOTHING_TO_REDO' };
    const next = historyFuture.pop();
    historyPast.push(plainState(state));
    const out = commit(next, 'redo', null, { skipHistory:true });
    return { ok:true, state:out };
  }
  function clearHistory() { historyPast.length = 0; historyFuture.length = 0; }

  function normalizeHex(value) {
    let text = String(value || '').trim().toLowerCase();
    if (/^[0-9a-f]{6}$/.test(text)) text = '#' + text;
    return /^#[0-9a-f]{6}$/.test(text) ? text : null;
  }
  function rgbFromHex(value) {
    const hex = normalizeHex(value);
    if (!hex) return null;
    return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
  }
  function hexFromRgb(r,g,b) {
    return '#' + [r,g,b].map(function (v) { return Math.max(0,Math.min(255,v|0)).toString(16).padStart(2,'0'); }).join('');
  }

  function normalizeVisual(visual) {
    if (!visual || typeof visual !== 'object') return null;
    const out = Object.assign({}, visual);
    out.mode = out.mode === 'sheet' ? 'sheet' : 'socket';
    out.source = out.source ? String(out.source) : null;
    out.socket = String(out.socket || 'center');
    out.layer = String(out.layer || 'front');
    out.columns = Math.max(1, Math.floor(Number(out.columns) || 1));
    out.rows = Math.max(1, Math.floor(Number(out.rows) || 1));
    out.faceRows = Object.assign({ down:0, left:1, right:2, up:3 }, out.faceRows || {});
    out.anchor = Object.assign({ x:0.5, y:1 }, out.anchor || {});
    out.width = Number(out.width) || 28;
    out.height = Number(out.height) || 28;
    out.heightScale = Number(out.heightScale) || 1;
    out.rotation = Number(out.rotation) || 0;
    out.offsets = out.offsets && typeof out.offsets === 'object' ? Object.assign({}, out.offsets) : {};
    out.preview = out.preview && typeof out.preview === 'object' ? Object.assign({}, out.preview) : {};
    out.paletteId = out.paletteId == null ? null : String(out.paletteId);
    out.paletteRole = out.paletteRole == null ? null : String(out.paletteRole);
    return Object.freeze(out);
  }
  function registerItem(def) {
    if (!def || !def.id || !def.slot || !Schema.isSlot(def.slot)) throw new Error('INVALID_CHARACTER_ITEM');
    const id = String(def.id), slot = String(def.slot);
    const item = Object.freeze({
      id:id,
      slot:slot,
      name:String(def.name || id),
      group:String(def.group || groupOf(slot)),
      rarity:String(def.rarity || 'Normal'),
      icon:def.icon || null,
      visual:normalizeVisual(def.visual),
      tags:Object.freeze(Array.isArray(def.tags) ? def.tags.map(String) : []),
      gameplayItemId:def.gameplayItemId == null ? null : String(def.gameplayItemId),
      locked:def.locked === true,
      hidden:def.hidden === true,
      defaultPaletteId:def.defaultPaletteId == null ? null : String(def.defaultPaletteId)
    });
    catalog.set(id, item);
    audit.registeredItems = catalog.size;
    return item;
  }
  function registerOutfit(def) {
    if (!def || !def.id) throw new Error('INVALID_OUTFIT');
    const sparse = {};
    Object.keys(def.slots || {}).forEach(function (slot) { if (Schema.isSlot(slot)) sparse[slot] = def.slots[slot]; });
    const paletteSparse = {};
    Object.keys(def.palettes || {}).forEach(function (slot) { if (Schema.isSlot(slot)) paletteSparse[slot] = def.palettes[slot]; });
    const item = Object.freeze({
      id:String(def.id), name:String(def.name || def.id), slots:Object.freeze(sparse), palettes:Object.freeze(paletteSparse),
      preview:def.preview || null, locked:def.locked === true, tags:Object.freeze(Array.isArray(def.tags)?def.tags.map(String):[])
    });
    outfits.set(item.id, item); audit.registeredOutfits = outfits.size; return item;
  }
  function registerPreset(def) {
    if (!def || !def.id) throw new Error('INVALID_CHARACTER_PRESET');
    const sparse = {}, paletteSparse = {};
    Object.keys(def.slots || {}).forEach(function (slot) { if (Schema.isSlot(slot)) sparse[slot] = def.slots[slot]; });
    Object.keys(def.palettes || {}).forEach(function (slot) { if (Schema.isSlot(slot)) paletteSparse[slot] = def.palettes[slot]; });
    const preset = Object.freeze({
      id:String(def.id), name:String(def.name || def.id), description:String(def.description || ''),
      slots:Object.freeze(sparse), palettes:Object.freeze(paletteSparse), locked:def.locked === true,
      tags:Object.freeze(Array.isArray(def.tags)?def.tags.map(String):[])
    });
    presets.set(preset.id, preset); audit.registeredPresets = presets.size; return preset;
  }
  function registerPalette(def) {
    if (!def || !def.id) throw new Error('INVALID_CHARACTER_PALETTE');
    const mapping = {};
    Object.keys(def.mapping || {}).forEach(function (from) {
      const source = normalizeHex(from), target = normalizeHex(def.mapping[from]);
      if (source && target) mapping[source] = target;
    });
    if (!Object.keys(mapping).length) throw new Error('EMPTY_CHARACTER_PALETTE_' + def.id);
    const allowedSlots = Array.isArray(def.slots) ? def.slots.map(String).filter(Schema.isSlot) : [];
    const palette = Object.freeze({
      id:String(def.id), name:String(def.name || def.id), mapping:Object.freeze(mapping), slots:Object.freeze(allowedSlots),
      swatch:normalizeHex(def.swatch) || Object.values(mapping)[0], tags:Object.freeze(Array.isArray(def.tags)?def.tags.map(String):[])
    });
    palettes.set(palette.id, palette); audit.registeredPalettes = palettes.size; return palette;
  }
  function groupOf(slot) { return Schema.groupOf(slot) || 'equipment'; }
  function getItem(id) { return id == null ? null : catalog.get(String(id)) || null; }
  function listItems(slot) { return Array.from(catalog.values()).filter(function (item) { return !item.hidden && (!slot || item.slot === slot); }); }
  function listOutfits() { return Array.from(outfits.values()); }
  function getPreset(id) { return id == null ? null : presets.get(String(id)) || null; }
  function listPresets() { return Array.from(presets.values()); }
  function getPalette(id) { return id == null ? null : palettes.get(String(id)) || null; }
  function listPalettes(slot) {
    const target = slot == null ? null : String(slot);
    return Array.from(palettes.values()).filter(function (palette) { return !target || !palette.slots.length || palette.slots.indexOf(target) >= 0; });
  }

  function select(slot, itemId, options) {
    slot = String(slot || '');
    const o = options || {};
    if (!Schema.isSlot(slot)) return { ok:false, error:'INVALID_SLOT' };
    const next = plainState(state);
    if (itemId != null) {
      const item = getItem(itemId);
      if (!item) return { ok:false, error:'ITEM_NOT_REGISTERED' };
      if (item.slot !== slot) return { ok:false, error:'WRONG_SLOT' };
      if (item.locked && !o.force) return { ok:false, error:'ITEM_LOCKED' };
      next.slots[slot] = item.id;
      if (item.defaultPaletteId && getPalette(item.defaultPaletteId)) next.palettes[slot] = item.defaultPaletteId;
    } else {
      if (Schema.isRequiredAppearance && Schema.isRequiredAppearance(slot)) return { ok:false, error:'REQUIRED_SLOT' };
      next.slots[slot] = null;
      next.palettes[slot] = null;
    }
    if (!o.keepOutfit && next.outfitId) {
      const activeOutfit = outfits.get(next.outfitId);
      const outfitOwnsSlot = !!(activeOutfit && Object.prototype.hasOwnProperty.call(activeOutfit.slots, slot));
      if (!activeOutfit || (outfitOwnsSlot && activeOutfit.slots[slot] !== next.slots[slot])) next.outfitId = null;
    }
    const out = commit(next, 'slot', { slot:slot, itemId:next.slots[slot] }, { skipHistory:o.skipHistory === true });
    return { ok:true, slot:slot, itemId:next.slots[slot], state:out };
  }
  function setPalette(slot, paletteId, options) {
    slot = String(slot || '');
    if (!Schema.isSlot(slot)) return { ok:false, error:'INVALID_SLOT' };
    const next = plainState(state);
    if (paletteId == null || paletteId === '') next.palettes[slot] = null;
    else {
      const palette = getPalette(paletteId);
      if (!palette) return { ok:false, error:'PALETTE_NOT_REGISTERED' };
      if (palette.slots.length && palette.slots.indexOf(slot) < 0) return { ok:false, error:'PALETTE_NOT_ALLOWED_FOR_SLOT' };
      next.palettes[slot] = palette.id;
    }
    const out = commit(next, 'palette', { slot:slot, paletteId:next.palettes[slot] }, { skipHistory:options && options.skipHistory === true });
    return { ok:true, slot:slot, paletteId:next.palettes[slot], state:out };
  }
  function applyOutfit(id, options) {
    const outfit = outfits.get(String(id || ''));
    if (!outfit) return { ok:false, error:'OUTFIT_NOT_FOUND' };
    if (outfit.locked && !(options && options.force)) return { ok:false, error:'OUTFIT_LOCKED' };
    const next = plainState(state);
    Object.keys(outfit.slots).forEach(function (slot) { if (Schema.isSlot(slot)) next.slots[slot] = outfit.slots[slot]; });
    Object.keys(outfit.palettes || {}).forEach(function (slot) { if (Schema.isSlot(slot)) next.palettes[slot] = outfit.palettes[slot]; });
    next.outfitId = outfit.id;
    const out = commit(next, 'outfit', { outfitId:outfit.id });
    return { ok:true, outfitId:outfit.id, state:out };
  }
  function applyPreset(id, options) {
    const preset = getPreset(id);
    if (!preset) return { ok:false, error:'PRESET_NOT_FOUND' };
    if (preset.locked && !(options && options.force)) return { ok:false, error:'PRESET_LOCKED' };
    const next = plainState(state);
    Object.keys(preset.slots).forEach(function (slot) { if (Schema.isSlot(slot)) next.slots[slot] = preset.slots[slot]; });
    Object.keys(preset.palettes).forEach(function (slot) { if (Schema.isSlot(slot)) next.palettes[slot] = preset.palettes[slot]; });
    next.outfitId = null;
    const out = commit(next, 'preset', { presetId:preset.id });
    return { ok:true, presetId:preset.id, state:out };
  }
  function reset() {
    const out = commit(DEFAULT_STATE, 'reset', null);
    return out;
  }
  function setMode(mode) {
    const next = plainState(state);
    next.mode = mode === 'fullBodyOverride' ? 'fullBodyOverride' : 'modular';
    commit(next, 'mode', { mode:next.mode });
    return next.mode;
  }

  function targetSlotsForRandomize(options) {
    const o = options || {};
    const groups = Array.isArray(o.groups) ? o.groups : (o.group ? [o.group] : ['appearance']);
    const slots = [];
    groups.forEach(function (group) {
      if (group === 'all') ALL_SLOTS.forEach(function (slot) { if (slots.indexOf(slot) < 0) slots.push(slot); });
      else if (Schema.slotGroups[group]) Schema.slotGroups[group].forEach(function (slot) { if (slots.indexOf(slot) < 0) slots.push(slot); });
    });
    return slots;
  }
  function randomize(options) {
    const o = options || {}, locked = new Set((o.lockedSlots || []).map(String)), rng = typeof o.rng === 'function' ? o.rng : Math.random;
    const next = plainState(state), changed = [];
    targetSlotsForRandomize(o).forEach(function (slot) {
      if (locked.has(slot)) return;
      const items = listItems(slot).filter(function (item) { return !item.locked; });
      if (items.length) {
        const item = items[Math.min(items.length - 1, Math.floor(Math.max(0,Math.min(.999999,rng())) * items.length))];
        if (next.slots[slot] !== item.id) { next.slots[slot] = item.id; changed.push(slot); }
        const availablePalettes = listPalettes(slot);
        if (availablePalettes.length) {
          const p = availablePalettes[Math.min(availablePalettes.length - 1, Math.floor(Math.max(0,Math.min(.999999,rng())) * availablePalettes.length))];
          next.palettes[slot] = p.id;
        } else if (item.defaultPaletteId) next.palettes[slot] = item.defaultPaletteId;
      }
    });
    if (!changed.length) return { ok:false, error:'NOTHING_TO_RANDOMIZE' };
    next.outfitId = null;
    const out = commit(next, 'randomize', { slots:changed.slice() });
    return { ok:true, changed:Object.freeze(changed.slice()), state:out };
  }

  function actorId(actor) { return String(actor && (actor.id || actor.playerKey) || 'local'); }
  function localActor() { try { return typeof localPlayer !== 'undefined' ? localPlayer : null; } catch (e) { return null; } }
  function stateForActor(actor) {
    const local = localActor();
    if (!actor || actor === local || actorId(actor) === actorId(local)) return state;
    return actor.characterCustomization ? normalizeState(actor.characterCustomization) : (remoteState.get(actorId(actor)) || normalizeState(DEFAULT_STATE));
  }
  function applyRemote(actor, payload) {
    if (!actor || !payload || (payload.schema !== NETWORK_SCHEMA && payload.schema !== LEGACY_NETWORK_SCHEMA)) return false;
    const normalized = normalizeState(payload);
    const current = remoteState.get(actorId(actor));
    if (current && Number(current.revision) > Number(normalized.revision)) return false;
    actor.characterCustomization = normalized;
    remoteState.set(actorId(actor), normalized);
    return true;
  }

  function syncGameplayEquipment() {
    if (!root.KeloEquipment || typeof root.KeloEquipment.getEquipped !== 'function') return 0;
    let changed = 0, items = [];
    try { items = root.KeloEquipment.getEquipped() || []; } catch (e) { return 0; }
    const next = plainState(state);
    items.forEach(function (eq) {
      if (!eq || !eq.slot) return;
      const visualSlot = Schema.visualSlotForGameplay(eq.slot);
      if (!visualSlot) return;
      const registered = Array.from(catalog.values()).find(function (item) { return item.gameplayItemId === String(eq.id || eq.templateId || ''); });
      if (registered && next.slots[visualSlot] !== registered.id) { next.slots[visualSlot] = registered.id; changed += 1; }
    });
    if (changed) commit(next, 'equipment-sync', { changed:changed }, { skipHistory:true });
    return changed;
  }

  registerItem({ id:'body_legacy_hero', slot:'body', name:'Kelo clásico', group:'appearance', tags:['legacy','base'] });
  registerItem({ id:'skin_default', slot:'skinTone', name:'Tono original', group:'appearance' });
  registerItem({ id:'face_default', slot:'face', name:'Rostro original', group:'appearance' });
  registerItem({ id:'eyes_default', slot:'eyes', name:'Ojos originales', group:'appearance' });
  registerItem({ id:'eyebrows_default', slot:'eyebrows', name:'Cejas originales', group:'appearance' });
  registerItem({ id:'nose_default', slot:'nose', name:'Nariz original', group:'appearance' });
  registerItem({ id:'mouth_default', slot:'mouth', name:'Boca original', group:'appearance' });
  registerOutfit({ id:'outfit_default', name:'Traje actual', slots:{ torso:null, legs:null, feet:null, gloves:null, armor:null, back:null } });

  function imageRuntime(source) {
    if (!source) return null;
    if (imageCache.has(source)) return imageCache.get(source);
    const rt = { image:new Image(), ready:false, failed:false, source:source };
    rt.image.decoding = 'async';
    rt.image.onload = function () {
      rt.ready = true;
      prepareWaitingPaletteVariants(source);
      try { root.dispatchEvent(new CustomEvent('kelo:character-visual-asset-ready', { detail:{ source:source } })); } catch (e) {}
    };
    rt.image.onerror = function () {
      rt.failed = true;
      if (audit.missingAssets.indexOf(source) < 0) audit.missingAssets.push(source);
    };
    rt.image.src = source;
    imageCache.set(source, rt);
    return rt;
  }
  function paletteCacheKey(source, paletteId, variantKey) { return String(source) + '|' + String(paletteId || '') + '|' + String(variantKey || ''); }
  function buildPaletteVariant(entry) {
    if (!entry || entry.building || entry.ready || entry.failed) return;
    const base = imageRuntime(entry.source), palette = getPalette(entry.paletteId);
    if (!base || !palette) { entry.failed = true; return; }
    if (!base.ready) { entry.waiting = true; return; }
    entry.building = true; entry.waiting = false;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = base.image.naturalWidth || base.image.width;
      canvas.height = base.image.naturalHeight || base.image.height;
      const g = canvas.getContext('2d', { willReadFrequently:true });
      if (!g) throw new Error('PALETTE_CANVAS_CONTEXT_UNAVAILABLE');
      g.imageSmoothingEnabled = false;
      g.drawImage(base.image, 0, 0);
      const image = g.getImageData(0, 0, canvas.width, canvas.height);
      const data = image.data, mapping = palette.mapping;
      let changed = 0;
      for (let i=0; i<data.length; i+=4) {
        if (data[i+3] === 0) continue;
        const target = mapping[hexFromRgb(data[i],data[i+1],data[i+2])];
        if (!target) continue;
        const rgb = rgbFromHex(target);
        if (!rgb) continue;
        data[i]=rgb[0]; data[i+1]=rgb[1]; data[i+2]=rgb[2]; changed += 1;
      }
      g.putImageData(image,0,0);
      entry.canvas = canvas;
      try { entry.dataUrl = canvas.toDataURL('image/png'); } catch (e) { entry.dataUrl = null; }
      entry.ready = true;
      audit.paletteBuilds += 1;
      audit.palettePixelsChanged += changed;
      audit.lastPaletteBuild = { source:entry.source, paletteId:entry.paletteId, variantKey:entry.variantKey, changed:changed };
      try { root.dispatchEvent(new CustomEvent('kelo:character-palette-ready', { detail:audit.lastPaletteBuild })); } catch (e) {}
    } catch (error) {
      entry.failed = true;
      entry.error = String(error && error.message || error);
    } finally { entry.building = false; }
  }
  function prepareWaitingPaletteVariants(source) {
    paletteImageCache.forEach(function (entry) { if (entry.source === source && entry.waiting) buildPaletteVariant(entry); });
  }
  function paletteRuntime(source, paletteId, variantKey) {
    if (!source || !paletteId || !getPalette(paletteId)) return null;
    const key = paletteCacheKey(source,paletteId,variantKey), existing = paletteImageCache.get(key);
    if (existing) { if (!existing.ready && !existing.failed) buildPaletteVariant(existing); return existing; }
    const entry = { key:key, source:String(source), paletteId:String(paletteId), variantKey:String(variantKey || ''), ready:false, failed:false, waiting:false, building:false, canvas:null, dataUrl:null };
    paletteImageCache.set(key, entry); buildPaletteVariant(entry); return entry;
  }
  function renderableImage(source, paletteId, variantKey) {
    const base = imageRuntime(source);
    if (!base || !base.ready || base.failed) return null;
    const variant = paletteRuntime(source,paletteId,variantKey);
    return variant && variant.ready && !variant.failed && variant.canvas ? variant.canvas : base.image;
  }
  function previewSource(source, paletteId, variantKey) {
    if (!source) return null;
    const variant = paletteRuntime(source,paletteId,variantKey);
    return variant && variant.ready && !variant.failed && variant.dataUrl ? variant.dataUrl : String(source);
  }

  function faceOf(actor) { return Schema.normalizeFace(actor && (actor._face || actor._visualMotion && actor._visualMotion.face) || 'down'); }
  function frameOf(actor, columns) {
    const visual = actor && actor._visualMotion;
    if (visual && Number.isFinite(Number(visual.frame))) return Math.abs(Math.floor(Number(visual.frame))) % columns;
    const moving = visual ? !!visual.on : Math.hypot(Number(actor && actor.vx)||0, Number(actor && actor.vy)||0) > 16;
    const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    return moving ? Math.floor(now/130)%columns : 0;
  }
  function presentation(actor, face) {
    if (root.KeloAnchors && typeof root.KeloAnchors.presentation === 'function') return root.KeloAnchors.presentation(actor, face);
    if (root.KELO_AVATAR_PRESENTATION && typeof root.KELO_AVATAR_PRESENTATION.get === 'function') return root.KELO_AVATAR_PRESENTATION.get(actor,face);
    const h = Math.max(72, (Number(actor && actor.radius)||20)*4.5), footY=(Number(actor && actor.y)||0)+10;
    return { footRootX:Number(actor && actor.x)||0, footRootY:footY, visualWidth:h*.62, visualHeight:h };
  }
  function offsetFor(visual, face) {
    const raw = visual.offsets && (visual.offsets[face] || visual.offsets.default) || {};
    return { x:Number(raw.x)||0, y:Number(raw.y)||0, rotation:Number(raw.rotation)||0, scale:Number(raw.scale)||1 };
  }
  function drawVisualEntry(g, actor, entry, face) {
    const item = entry && entry.item, visual = entry && entry.visual;
    if (!g || !item || !visual || !visual.source) return false;
    const source = renderableImage(visual.source, entry.paletteId, visual.paletteRole || item.id);
    if (!source) return false;
    const layout = presentation(actor, face), scaleBase=Math.max(.55,(Number(layout.visualHeight)||93)/93), off=offsetFor(visual,face);
    g.save(); g.imageSmoothingEnabled=false;
    if (visual.mode === 'sheet') {
      const iw=source.width||source.naturalWidth, ih=source.height||source.naturalHeight;
      const fw=iw/visual.columns, fh=ih/visual.rows, row=Math.max(0,Math.min(visual.rows-1,Number(visual.faceRows[face])||0)), col=frameOf(actor,visual.columns);
      const dh=(Number(layout.visualHeight)||93)*visual.heightScale*off.scale, dw=dh*(fw/fh), anchor=visual.anchor;
      const dx=(Number(layout.footRootX)||0)-dw*Number(anchor.x||.5)+off.x*scaleBase, dy=(Number(layout.footRootY)||0)-dh*Number(anchor.y==null?1:anchor.y)+off.y*scaleBase;
      g.translate(dx+dw*.5,dy+dh*.5); g.rotate((visual.rotation+off.rotation)*Math.PI/180); g.drawImage(source,col*fw,row*fh,fw,fh,-dw*.5,-dh*.5,dw,dh);
    } else {
      let socket=null;
      if (root.KeloAnchors && typeof root.KeloAnchors.get === 'function') socket=root.KeloAnchors.get(actor,visual.socket);
      if (!socket) socket={x:Number(actor&&actor.x)||0,y:Number(actor&&actor.y)||0};
      const w=visual.width*scaleBase*off.scale,h=visual.height*scaleBase*off.scale;
      g.translate(socket.x+off.x*scaleBase,socket.y+off.y*scaleBase); g.rotate((visual.rotation+off.rotation)*Math.PI/180); g.drawImage(source,-w*visual.anchor.x,-h*visual.anchor.y,w,h);
    }
    g.restore();
    audit.draws += 1;
    audit.lastDraw={ actorId:actorId(actor), itemId:item.id, slot:item.slot, face:face, paletteId:entry.paletteId || null };
    return true;
  }
  function orderedEntries(actor, section) {
    const Stack = root.KeloCharacterVisualStack;
    if (!Stack || typeof Stack.resolve !== 'function') return [];
    return Stack.resolve({ actor:actor, face:faceOf(actor), section:section });
  }
  function drawSection(g, actor, section) {
    const face=faceOf(actor);
    orderedEntries(actor,section).forEach(function(entry){ drawVisualEntry(g,actor,entry,face); });
  }
  function drawSectionWithActorTransform(g, actor, section) {
    if (!g || !actor) return;
    const transform = root.KeloAnimation && typeof root.KeloAnimation.sampleTransform === 'function' ? root.KeloAnimation.sampleTransform(actor) : null;
    const pivot = root.KeloAnchors && typeof root.KeloAnchors.get === 'function' ? root.KeloAnchors.get(actor,'foot') : { x:Number(actor.x)||0, y:Number(actor.y)||0 };
    g.save();
    if (transform && pivot) {
      g.translate(Number(transform.offsetX)||0,Number(transform.offsetY)||0);
      g.translate(Number(pivot.x)||0,Number(pivot.y)||0);
      if (Number(transform.rotation)) g.rotate(Number(transform.rotation));
      g.scale(Number(transform.scaleX)||1,Number(transform.scaleY)||1);
      g.translate(-(Number(pivot.x)||0),-(Number(pivot.y)||0));
    }
    drawSection(g,actor,section);
    g.restore();
  }
  function installRenderer() {
    if (rendererMiddlewareId) return true;
    if (!root.KeloAvatar || typeof root.KeloAvatar.use !== 'function') return false;
    rendererMiddlewareId = root.KeloAvatar.use('character-customization:modular-layers', function (actor,isSelf,next) {
      if (typeof ctx !== 'undefined' && ctx) drawSectionWithActorTransform(ctx, actor, 'back');
      const out = next();
      if (typeof ctx !== 'undefined' && ctx) drawSectionWithActorTransform(ctx, actor, 'front');
      return out;
    }, 250);
    return true;
  }

  function refreshFromState() {
    const container=localStateContainer();
    if (container && container.characterCustomization) state=normalizeState(container.characterCustomization);
    return snapshot();
  }

  function sanitizeKnownState(input, fallbackState) {
    const incoming = normalizeState(input), fallback = normalizeState(fallbackState || state), warnings = [];
    const out = plainState(fallback);
    out.mode = incoming.mode;
    out.baseAppearanceId = incoming.baseAppearanceId;
    out.outfitId = incoming.outfitId && outfits.has(incoming.outfitId) ? incoming.outfitId : null;
    ALL_SLOTS.forEach(function (slot) {
      const id = incoming.slots[slot];
      if (id == null) {
        if (!(Schema.isRequiredAppearance && Schema.isRequiredAppearance(slot))) out.slots[slot] = null;
      } else {
        const item = getItem(id);
        if (item && item.slot === slot) out.slots[slot] = item.id;
        else warnings.push('UNKNOWN_ITEM:' + slot + ':' + id);
      }
      const paletteId = incoming.palettes[slot];
      if (paletteId == null) out.palettes[slot] = null;
      else {
        const palette = getPalette(paletteId);
        if (palette && (!palette.slots.length || palette.slots.indexOf(slot)>=0)) out.palettes[slot] = palette.id;
        else warnings.push('UNKNOWN_PALETTE:' + slot + ':' + paletteId);
      }
    });
    return { state:out, warnings:warnings };
  }
  function applySnapshot(input, options) {
    const o = options || {}, prepared = o.validateIds === false ? { state:normalizeState(input), warnings:[] } : sanitizeKnownState(input,state);
    const out = commit(prepared.state, String(o.reason || 'snapshot'), { warnings:prepared.warnings }, { skipHistory:o.skipHistory === true });
    return { ok:true, warnings:Object.freeze(prepared.warnings.slice()), state:out };
  }

  function readSavedProfiles() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(SAVE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) { return {}; }
  }
  function writeSavedProfiles(profiles) {
    try { if (root.localStorage) root.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(profiles || {})); return true; } catch (e) { return false; }
  }
  function normalizeSaveSlot(slot) {
    const n = Math.floor(Number(slot));
    return n >= 1 && n <= SAVE_SLOT_COUNT ? String(n) : null;
  }
  function savedVisualState(input) {
    const s = normalizeState(input || state);
    return { version:2, mode:s.mode, baseAppearanceId:s.baseAppearanceId, outfitId:s.outfitId, slots:Object.assign({},s.slots), palettes:Object.assign({},s.palettes) };
  }
  function listSavedProfiles() {
    const store = readSavedProfiles();
    return Object.freeze(Array.from({length:SAVE_SLOT_COUNT}, function (_,i) {
      const key=String(i+1), entry=store[key];
      return Object.freeze({ slot:i+1, occupied:!!entry, name:entry?String(entry.name||('Personaje '+key)):'', updatedAt:entry?Number(entry.updatedAt)||0:0 });
    }));
  }
  function saveProfile(slot, name) {
    const key=normalizeSaveSlot(slot); if(!key)return {ok:false,error:'INVALID_SAVE_SLOT'};
    const store=readSavedProfiles();
    store[key]={ version:1, name:String(name||('Personaje '+key)).slice(0,40), updatedAt:Date.now(), state:savedVisualState(state) };
    if(!writeSavedProfiles(store))return {ok:false,error:'SAVE_STORAGE_FAILED'};
    return {ok:true,slot:Number(key),name:store[key].name,updatedAt:store[key].updatedAt};
  }
  function loadProfile(slot) {
    const key=normalizeSaveSlot(slot); if(!key)return {ok:false,error:'INVALID_SAVE_SLOT'};
    const store=readSavedProfiles(), entry=store[key]; if(!entry||!entry.state)return {ok:false,error:'SAVE_SLOT_EMPTY'};
    const prepared=sanitizeKnownState(entry.state,state);
    const out=commit(prepared.state,'load-profile',{slot:Number(key),warnings:prepared.warnings});
    return {ok:true,slot:Number(key),warnings:Object.freeze(prepared.warnings.slice()),state:out};
  }
  function deleteProfile(slot) {
    const key=normalizeSaveSlot(slot); if(!key)return {ok:false,error:'INVALID_SAVE_SLOT'};
    const store=readSavedProfiles(); if(!store[key])return {ok:false,error:'SAVE_SLOT_EMPTY'};
    delete store[key]; if(!writeSavedProfiles(store))return {ok:false,error:'SAVE_STORAGE_FAILED'}; return {ok:true,slot:Number(key)};
  }

  function bytesToBase64Url(text) {
    const bytes = new TextEncoder().encode(String(text));
    let binary=''; for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function base64UrlToText(value) {
    const normalized=String(value).replace(/-/g,'+').replace(/_/g,'/');
    const padded=normalized+'==='.slice((normalized.length+3)%4);
    const binary=atob(padded), bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function checksum(text) {
    let hash=0x811c9dc5;
    for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,0x01000193)>>>0;}
    return hash.toString(16).padStart(8,'0');
  }
  function compactVisualState(input) {
    const s=normalizeState(input||state);
    return {v:2,m:s.mode,b:s.baseAppearanceId,o:s.outfitId,s:Object.assign({},s.slots),p:Object.assign({},s.palettes)};
  }
  function expandCompactState(compact) {
    if(!compact||Number(compact.v)!==2||!compact.s||typeof compact.s!=='object')throw new Error('UNSUPPORTED_CHARACTER_CODE_VERSION');
    return normalizeState({version:2,mode:compact.m,baseAppearanceId:compact.b,outfitId:compact.o,slots:compact.s,palettes:compact.p,revision:1});
  }
  function exportCode(inputState) {
    const payload=JSON.stringify(compactVisualState(inputState||state));
    return SHARE_PREFIX+'.'+bytesToBase64Url(payload)+'.'+checksum(payload);
  }
  function decodeCode(code) {
    try {
      const parts=String(code||'').trim().split('.');
      if(parts.length!==3||parts[0]!==SHARE_PREFIX)return {ok:false,error:'INVALID_CHARACTER_CODE'};
      const payload=base64UrlToText(parts[1]);
      if(checksum(payload)!==parts[2].toLowerCase())return {ok:false,error:'CHARACTER_CODE_CHECKSUM'};
      const expanded=expandCompactState(JSON.parse(payload));
      const prepared=sanitizeKnownState(expanded,state);
      return {ok:true,state:snapshot(prepared.state),warnings:Object.freeze(prepared.warnings.slice())};
    } catch(error) { return {ok:false,error:String(error&&error.message||'INVALID_CHARACTER_CODE')}; }
  }
  function importCode(code) {
    const decoded=decodeCode(code); if(!decoded.ok)return decoded;
    const out=commit(decoded.state,'import-code',{warnings:decoded.warnings});
    audit.lastImportWarnings=decoded.warnings.slice();
    return {ok:true,warnings:decoded.warnings,state:out};
  }

  root.KeloCharacterCustomization = Object.freeze({
    version:VERSION,
    networkSchema:NETWORK_SCHEMA,
    slots:ALL_SLOTS.slice(),
    slotGroups:Schema.slotGroups,
    gameplaySlotMap:Schema.gameplayToVisual,
    faceOrder:Schema.faceOrder,
    getState:function(){return snapshot();},
    refreshFromState:refreshFromState,
    applySnapshot:applySnapshot,
    getItem:getItem,
    listItems:listItems,
    registerItem:registerItem,
    listOutfits:listOutfits,
    registerOutfit:registerOutfit,
    getPreset:getPreset,
    listPresets:listPresets,
    registerPreset:registerPreset,
    applyPreset:applyPreset,
    getPalette:getPalette,
    listPalettes:listPalettes,
    registerPalette:registerPalette,
    setPalette:setPalette,
    clearPalette:function(slot){return setPalette(slot,null);},
    select:select,
    clear:function(slot){return select(slot,null);},
    applyOutfit:applyOutfit,
    randomize:randomize,
    reset:reset,
    setMode:setMode,
    undo:undo,
    redo:redo,
    canUndo:canUndo,
    canRedo:canRedo,
    clearHistory:clearHistory,
    historySnapshot:function(){return Object.freeze({past:historyPast.length,future:historyFuture.length,limit:HISTORY_LIMIT});},
    stateForActor:function(actor){return snapshot(stateForActor(actor));},
    networkSnapshot:networkSnapshot,
    applyRemote:applyRemote,
    syncGameplayEquipment:syncGameplayEquipment,
    installRenderer:installRenderer,
    previewSource:previewSource,
    paletteRuntime:function(source,paletteId,variantKey){const rt=paletteRuntime(source,paletteId,variantKey);return rt?Object.freeze({ready:rt.ready,failed:rt.failed,dataUrl:rt.dataUrl}):null;},
    listSavedProfiles:listSavedProfiles,
    saveProfile:saveProfile,
    loadProfile:loadProfile,
    deleteProfile:deleteProfile,
    exportCode:exportCode,
    decodeCode:decodeCode,
    importCode:importCode,
    saveSlotCount:SAVE_SLOT_COUNT
  });

  persist();
  installRenderer();
  try { root.dispatchEvent(new CustomEvent('kelo:character-customization-ready', { detail:{ version:VERSION, schema:NETWORK_SCHEMA } })); } catch (e) {}
})(typeof globalThis !== 'undefined' ? globalThis : window);
