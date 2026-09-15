/* KELO-INDEX
 * area: CHARACTERS
 * owner: KeloCharacterContentPacks
 * keys: CONTENT PACK REGISTRY MODULAR ITEMS OUTFITS PRESETS PALETTES REUSABLE
 * purpose: registra paquetes declarativos de piezas, outfits, presets y paletas sobre CharacterCustomization
 * public-api: KeloCharacterContentPacks.define/flush/has/isRegistered/list
 * consumes: KeloCharacterCustomization
 * state-owned: definiciones de packs + IDs ya registrados
 * extension-points: cualquier pack futuro declara data; no crea loaders propios
 * reuse: apariencia, ropa, equipo, cosméticos y contenido premium
 * legacy: packs v1 sin palettes/presets siguen registrando normalmente
 * do-not: NO tocar stats, inventario ni autoridad; NO usar polling/watchdogs
 * online: registra IDs/metadatos visuales; ownership final puede validarlo servidor
 */
(function (root) {
  'use strict';

  const VERSION = 'character-content-packs-v2.0.0';
  const packs = new Map();
  const registered = new Set();
  let readyListenerInstalled = false;

  const audit = root.KELO_CHARACTER_CONTENT_PACKS_AUDIT = {
    version:VERSION,
    ready:true,
    defined:0,
    registered:0,
    itemCount:0,
    outfitCount:0,
    presetCount:0,
    paletteCount:0,
    polling:false,
    lastPack:null,
    errors:[]
  };

  function api() { return root.KeloCharacterCustomization || null; }
  function freezePack(input) {
    if (!input || !input.id) throw new Error('INVALID_CHARACTER_CONTENT_PACK');
    return Object.freeze({
      id:String(input.id),
      version:String(input.version || '1'),
      items:Object.freeze((input.items || []).slice()),
      outfits:Object.freeze((input.outfits || []).slice()),
      presets:Object.freeze((input.presets || []).slice()),
      palettes:Object.freeze((input.palettes || []).slice()),
      tags:Object.freeze((input.tags || []).map(String))
    });
  }

  function registerPack(pack) {
    const A = api();
    if (!A || !pack || registered.has(pack.id)) return false;
    try {
      pack.palettes.forEach(function (def) {
        if (!def || !def.id) throw new Error('INVALID_CHARACTER_PACK_PALETTE_' + pack.id);
        if (!A.getPalette(def.id)) A.registerPalette(def);
      });
      pack.items.forEach(function (def) {
        if (!def || !def.id) throw new Error('INVALID_CHARACTER_PACK_ITEM_' + pack.id);
        if (!A.getItem(def.id)) A.registerItem(def);
      });
      pack.outfits.forEach(function (def) {
        if (!def || !def.id) throw new Error('INVALID_CHARACTER_PACK_OUTFIT_' + pack.id);
        const exists = A.listOutfits().some(function (item) { return item.id === String(def.id); });
        if (!exists) A.registerOutfit(def);
      });
      pack.presets.forEach(function (def) {
        if (!def || !def.id) throw new Error('INVALID_CHARACTER_PACK_PRESET_' + pack.id);
        if (!A.getPreset(def.id)) A.registerPreset(def);
      });
      registered.add(pack.id);
      audit.registered = registered.size;
      audit.itemCount += pack.items.length;
      audit.outfitCount += pack.outfits.length;
      audit.presetCount += pack.presets.length;
      audit.paletteCount += pack.palettes.length;
      audit.lastPack = pack.id;
      try { root.dispatchEvent(new CustomEvent('kelo:character-content-pack-ready', { detail:{ id:pack.id, version:pack.version } })); } catch (e) {}
      return true;
    } catch (error) {
      const message = String(error && error.message || error);
      if (audit.errors.indexOf(message) < 0) audit.errors.push(message);
      return false;
    }
  }

  function flush() {
    if (!api()) return false;
    let changed = false;
    packs.forEach(function (pack) { if (registerPack(pack)) changed = true; });
    return changed;
  }

  function ensureReadyListener() {
    if (readyListenerInstalled) return;
    readyListenerInstalled = true;
    root.addEventListener('kelo:character-customization-ready', flush, { once:true });
  }

  function define(input) {
    const pack = freezePack(input);
    const existing = packs.get(pack.id);
    if (existing) return existing;
    packs.set(pack.id, pack);
    audit.defined = packs.size;
    if (!registerPack(pack)) ensureReadyListener();
    return pack;
  }

  ensureReadyListener();
  root.KeloCharacterContentPacks = Object.freeze({
    version:VERSION,
    define:define,
    flush:flush,
    has:function (id) { return packs.has(String(id)); },
    isRegistered:function (id) { return registered.has(String(id)); },
    list:function () { return Array.from(packs.values()); }
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
