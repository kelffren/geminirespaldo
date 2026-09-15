/* KELO-INDEX
 * area: CHARACTERS
 * owner: KeloCharacterVisualPresets
 * keys: VISUAL PRESETS SPRITESHEET SOCKET WEAPON PALETTE ASSET CONTRACT REUSABLE
 * purpose: fabrica descriptores visuales y paletas reutilizables para contenido modular de personaje
 * public-api: source/sheet/socket/weapon/palette + assetContract
 * consumes: datos declarativos de ContentPacks
 * state-owned: ninguno; factories puras
 * extension-points: nuevas familias visuales reutilizan el mismo contrato en vez de inventar loaders
 * reuse: ropa, cara, pelo, armas, accesorios, cosméticos y futuros content packs
 * legacy: assets antiguos 4x4 siguen válidos mientras conserven proporción/anchors del contrato
 * do-not: NO registrar items, NO dibujar, NO decidir stats/gameplay
 * online: descriptores contienen IDs/metadatos visuales; nunca autoridad
 */
(function (root) {
  'use strict';

  const VERSION = 'character-visual-presets-v2.0.0';
  const DEFAULT_FACE_ROWS = Object.freeze({ down:0, left:1, right:2, up:3 });
  const ASSET_CONTRACT = Object.freeze({
    version:'kelo-character-asset-v1',
    canonicalSheet:Object.freeze({ width:512, height:768, columns:4, rows:4 }),
    canonicalFrame:Object.freeze({ width:128, height:192, aspect:2/3 }),
    faceRows:DEFAULT_FACE_ROWS,
    frameColumns:Object.freeze({ idle:0, walk1:1, walk2:2, walk3:3 }),
    anchor:Object.freeze({ x:0.5, y:1 }),
    alpha:'real-transparency',
    sampling:'pixelated',
    naming:'<slot>-<family>-<variant>.svg|png',
    cacheBust:'?v=<content-version>',
    rule:'same 4x4 grid, 2:3 frame ratio and normalized foot-root alignment for every modular sheet'
  });

  function clone(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(clone);
    const out = {};
    Object.keys(value).forEach(function (key) { out[key] = clone(value[key]); });
    return out;
  }

  function source(base, file, version) {
    const prefix = String(base || '');
    const name = String(file || '');
    const suffix = version == null ? '' : '?v=' + encodeURIComponent(String(version));
    return prefix + name + suffix;
  }

  function paletteMeta(o) {
    return {
      paletteId:o.paletteId == null ? null : String(o.paletteId),
      paletteRole:o.paletteRole == null ? null : String(o.paletteRole)
    };
  }

  function sheet(src, options) {
    const o = options || {};
    return Object.assign({
      mode:'sheet',
      source:String(src || ''),
      columns:Math.max(1, Math.floor(Number(o.columns) || ASSET_CONTRACT.canonicalSheet.columns)),
      rows:Math.max(1, Math.floor(Number(o.rows) || ASSET_CONTRACT.canonicalSheet.rows)),
      faceRows:Object.assign({}, DEFAULT_FACE_ROWS, o.faceRows || {}),
      anchor:Object.assign({}, ASSET_CONTRACT.anchor, o.anchor || {}),
      heightScale:Number(o.heightScale) || 1,
      rotation:Number(o.rotation) || 0,
      offsets:clone(o.offsets || {}),
      layer:String(o.layer || 'front'),
      preview:Object.assign({ kind:'actor-sheet' }, clone(o.preview || {}))
    }, paletteMeta(o));
  }

  function socket(src, socketName, options) {
    const o = options || {};
    return Object.assign({
      mode:'socket',
      source:String(src || ''),
      socket:String(socketName || o.socket || 'center'),
      layer:String(o.layer || 'front'),
      width:Number(o.width) || 28,
      height:Number(o.height) || 28,
      anchor:Object.assign({ x:0.5, y:1 }, o.anchor || {}),
      rotation:Number(o.rotation) || 0,
      offsets:clone(o.offsets || {}),
      preview:Object.assign({ kind:'socket', leftPercent:50, bottomPercent:20, widthPercent:24 }, clone(o.preview || {}))
    }, paletteMeta(o));
  }

  function weapon(src, options) {
    const o = options || {};
    return socket(src, 'weapon', {
      layer:o.layer || 'front',
      width:Number(o.width) || 58,
      height:Number(o.height) || 58,
      anchor:Object.assign({ x:0.5, y:0.88 }, o.anchor || {}),
      rotation:Number(o.rotation) || 0,
      offsets:Object.assign({
        down:{ x:2, y:7, rotation:180 },
        up:{ x:-2, y:-5, rotation:0 },
        left:{ x:-7, y:0, rotation:-90 },
        right:{ x:7, y:0, rotation:90 }
      }, clone(o.offsets || {})),
      preview:Object.assign({ kind:'socket', leftPercent:66, bottomPercent:22, widthPercent:27, rotationDeg:180, anchorX:0.5, anchorY:0.88 }, clone(o.preview || {})),
      paletteId:o.paletteId,
      paletteRole:o.paletteRole
    });
  }

  function palette(id, name, mapping, slots, options) {
    const o = options || {};
    const colors = {};
    Object.keys(mapping || {}).forEach(function (from) { colors[String(from)] = String(mapping[from]); });
    return {
      id:String(id || ''),
      name:String(name || id || ''),
      mapping:colors,
      slots:Array.isArray(slots) ? slots.map(String) : [],
      tags:Array.isArray(o.tags) ? o.tags.map(String) : [],
      swatch:String(o.swatch || Object.values(colors)[0] || '#888888')
    };
  }

  root.KeloCharacterVisualPresets = Object.freeze({
    version:VERSION,
    assetContract:ASSET_CONTRACT,
    defaultFaceRows:DEFAULT_FACE_ROWS,
    source:source,
    sheet:sheet,
    socket:socket,
    weapon:weapon,
    palette:palette
  });

  root.KELO_CHARACTER_VISUAL_PRESETS_AUDIT = Object.freeze({
    version:VERSION,
    ready:true,
    pureData:true,
    responsivePreviewMetadata:true,
    assetContractVersion:ASSET_CONTRACT.version,
    canonicalSheet:ASSET_CONTRACT.canonicalSheet,
    canonicalFrame:ASSET_CONTRACT.canonicalFrame,
    paletteDescriptors:true,
    factories:Object.freeze(['source','sheet','socket','weapon','palette'])
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
