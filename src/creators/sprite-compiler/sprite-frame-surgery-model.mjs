/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / FRAME SURGERY
 * owner: non-destructive finger-first frame repair state
 * keys: SPRITE SURGERY TOUCH PATCH HISTORY MASK RLE SELECTION BOOLEAN OVERLAY CLONE FILL CROP GHOST SNAP
 * purpose: express every manual repair as a deterministic reversible patch; original pixels remain immutable
 * public-api: createSurgeryPatch, reduceSurgeryGesture, createSurgeryHistory, autoFixSurgeryPatch,
 *             normalizeSurgeryPatch, createStroke, createOverlayPatch, serializeSurgeryPatches,
 *             selectionFromMask, runsToMask, maskToRuns, combineSelectionRuns, invertSelectionRuns, snapSurgeryPatch
 * online: N/A
 * do-not: persist content, render gameplay, mutate source pixels, invent missing anatomy
 */

const F = Object.freeze;
const clamp = (n, a, b) => Math.max(a, Math.min(b, Number(n) || 0));
const finite = (n, fallback = 0) => Number.isFinite(Number(n)) ? Number(n) : fallback;
const nullableInteger = value => value !== null && value !== undefined && value !== '' && Number.isInteger(Number(value)) ? Number(value) : null;
const clone = value => {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(clone);
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'image' || key === 'canvas' || key === 'bitmap') out[key] = item;
    else out[key] = clone(item);
  }
  return out;
};
const freezeDeep = value => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (typeof value.getContext === 'function' || typeof value.addEventListener === 'function' || ArrayBuffer.isView(value)) return value;
  for (const item of Object.values(value)) freezeDeep(item);
  return F(value);
};

export const SURGERY_TOOLS = F(['move', 'erase', 'restore', 'piece', 'compare']);
export const SURGERY_LAYERS = F(['original', 'character', 'patches', 'pieces', 'mask']);
export const SURGERY_SELECTION_OPS = F(['replace', 'add', 'subtract', 'intersect']);

export const surgeryFeatureContract = F({
  version: 'kelo-frame-surgery-v2.0.1-null-copy-safe',
  required: F([
    'one-finger-move', 'two-finger-scale', 'two-finger-rotate', 'ghost-reference',
    'align-feet', 'center-body', 'match-scale', 'finger-eraser', 'finger-restore',
    'magic-selection', 'selection-to-layer', 'import-piece', 'copy-piece-from-frame',
    'clone-brush', 'small-gap-fill', 'free-frame-crop', 'outside-crop-recovery',
    'simple-layers', 'undo-redo', 'before-after-hold', 'live-animation-preview',
    'frame-doctor-heatmap', 'auto-fix-first', 'non-destructive-patches', 'recompile-and-test',
    'exact-selection-mask', 'selection-boolean-ops', 'multi-frame-onion-skin',
    'pixel-perfect-strokes', 'relative-clone-path', 'enclosed-gap-fill',
    'pixel-snap-transforms', 'piece-visibility-lock-order', 'pointer-cancel-rollback',
    'selective-patch-backward-compatibility'
  ])
});

function normalizePoint(point = {}) {
  return F({x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1)});
}
function normalizeCrop(crop = {}) {
  return F({
    left: clamp(finite(crop.left), -0.45, 0.45),
    top: clamp(finite(crop.top), -0.45, 0.45),
    right: clamp(finite(crop.right), -0.45, 0.45),
    bottom: clamp(finite(crop.bottom), -0.45, 0.45)
  });
}
function normalizeRuns(runs = [], total = Infinity) {
  const out = [];
  for (let i = 0; i + 1 < runs.length; i += 2) {
    const start = Math.max(0, Math.floor(finite(runs[i])));
    const length = Math.max(0, Math.floor(finite(runs[i + 1])));
    if (!length || start >= total) continue;
    out.push(start, Math.min(length, Math.max(0, total - start)));
  }
  return F(out);
}
function normalizeStroke(stroke = {}) {
  return F({
    id: String(stroke.id || `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    radius: clamp(finite(stroke.radius, .045), .005, .25),
    hardness: clamp(finite(stroke.hardness, 1), .05, 1),
    pixelPerfect: stroke.pixelPerfect !== false,
    points: F((stroke.points || []).map(normalizePoint)),
    source: stroke.source ? normalizePoint(stroke.source) : null
  });
}
function normalizeOverlay(overlay = {}) {
  return F({
    id: String(overlay.id || `piece-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    name: String(overlay.name || 'PIEZA').slice(0, 48),
    kind: ['frame', 'selection', 'external'].includes(overlay.kind) ? overlay.kind : 'external',
    sourceFrame: nullableInteger(overlay.sourceFrame),
    sourceRect: overlay.sourceRect ? F({
      x: clamp(overlay.sourceRect.x, 0, 1), y: clamp(overlay.sourceRect.y, 0, 1),
      w: clamp(finite(overlay.sourceRect.w, 1), .001, 1), h: clamp(finite(overlay.sourceRect.h, 1), .001, 1)
    }) : null,
    frameRect: overlay.frameRect ? F({
      x: clamp(overlay.frameRect.x, 0, 1), y: clamp(overlay.frameRect.y, 0, 1),
      w: clamp(finite(overlay.frameRect.w, 1), .001, 1), h: clamp(finite(overlay.frameRect.h, 1), .001, 1)
    }) : null,
    x: finite(overlay.x), y: finite(overlay.y),
    scale: clamp(finite(overlay.scale, 1), .1, 4),
    rotation: clamp(finite(overlay.rotation), -Math.PI * 4, Math.PI * 4),
    opacity: clamp(finite(overlay.opacity, 1), 0, 1),
    visible: overlay.visible !== false,
    locked: !!overlay.locked,
    z: Math.floor(clamp(finite(overlay.z), -999, 999)),
    cutoutOriginal: !!overlay.cutoutOriginal,
    image: overlay.image || null,
    canvas: overlay.canvas || null,
    dataUrl: typeof overlay.dataUrl === 'string' && overlay.dataUrl.length <= 350000 ? overlay.dataUrl : null
  });
}
function normalizeSelection(selection) {
  if (!selection) return null;
  const maskWidth = Math.max(0, Math.floor(finite(selection.maskWidth)));
  const maskHeight = Math.max(0, Math.floor(finite(selection.maskHeight)));
  const total = maskWidth && maskHeight ? maskWidth * maskHeight : Infinity;
  return F({
    x: clamp(selection.x, 0, 1), y: clamp(selection.y, 0, 1),
    w: clamp(finite(selection.w, 0), 0, 1), h: clamp(finite(selection.h, 0), 0, 1),
    seedX: clamp(finite(selection.seedX, selection.x), 0, 1),
    seedY: clamp(finite(selection.seedY, selection.y), 0, 1),
    maskWidth, maskHeight, runs: normalizeRuns(selection.runs || [], total),
    operation: SURGERY_SELECTION_OPS.includes(selection.operation) ? selection.operation : 'replace'
  });
}

export function maskToRuns(mask = []) {
  const out = [];
  for (let i = 0; i < mask.length;) {
    if (!mask[i]) { i++; continue; }
    const start = i;
    while (i < mask.length && mask[i]) i++;
    out.push(start, i - start);
  }
  return F(out);
}
export function runsToMask(runs = [], length = 0) {
  const mask = new Uint8Array(Math.max(0, Math.floor(length)));
  for (let i = 0; i + 1 < runs.length; i += 2) {
    const start = Math.max(0, Math.floor(runs[i]));
    const end = Math.min(mask.length, start + Math.max(0, Math.floor(runs[i + 1])));
    for (let j = start; j < end; j++) mask[j] = 1;
  }
  return mask;
}
export function combineSelectionRuns(aRuns, bRuns, operation = 'replace', length = 0) {
  const a = runsToMask(aRuns, length), b = runsToMask(bRuns, length), out = new Uint8Array(a.length);
  for (let i = 0; i < out.length; i++) {
    if (operation === 'add') out[i] = a[i] || b[i] ? 1 : 0;
    else if (operation === 'subtract') out[i] = a[i] && !b[i] ? 1 : 0;
    else if (operation === 'intersect') out[i] = a[i] && b[i] ? 1 : 0;
    else out[i] = b[i] ? 1 : 0;
  }
  return maskToRuns(out);
}
export function invertSelectionRuns(runs, length) {
  const mask = runsToMask(runs, length);
  for (let i = 0; i < mask.length; i++) mask[i] = mask[i] ? 0 : 1;
  return maskToRuns(mask);
}
export function selectionFromMask(mask, width, height, {seedX = 0, seedY = 0, operation = 'replace'} = {}) {
  width = Math.max(1, Math.floor(width)); height = Math.max(1, Math.floor(height));
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let i = 0; i < Math.min(mask.length, width * height); i++) if (mask[i]) {
    const x = i % width, y = (i / width) | 0;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (maxX < minX || maxY < minY) return null;
  return normalizeSelection({
    x: minX / width, y: minY / height, w: (maxX - minX + 1) / width, h: (maxY - minY + 1) / height,
    seedX: clamp(seedX, 0, 1), seedY: clamp(seedY, 0, 1), maskWidth: width, maskHeight: height,
    runs: maskToRuns(mask), operation
  });
}

export function createSurgeryPatch(seed = {}) {
  return normalizeSurgeryPatch({
    scale: 1, x: 0, y: 0, rotation: 0, copyFrom: null, pixelSnap: true,
    crop: {left: 0, top: 0, right: 0, bottom: 0},
    erase: [], restore: [], clone: [], fill: [], overlays: [],
    selection: null, layerVisibility: {original: true, character: true, patches: true, pieces: true, mask: true},
    ...seed
  });
}

export function normalizeSurgeryPatch(patch = {}) {
  const layerVisibility = {};
  for (const layer of SURGERY_LAYERS) layerVisibility[layer] = patch.layerVisibility?.[layer] !== false;
  return freezeDeep({
    scale: clamp(finite(patch.scale, 1), .35, 2.5),
    x: clamp(finite(patch.x), -512, 512), y: clamp(finite(patch.y), -512, 512),
    rotation: clamp(finite(patch.rotation), -Math.PI * 4, Math.PI * 4),
    pixelSnap: patch.pixelSnap !== false,
    copyFrom: nullableInteger(patch.copyFrom),
    crop: normalizeCrop(patch.crop),
    erase: F((patch.erase || []).map(normalizeStroke)),
    restore: F((patch.restore || []).map(normalizeStroke)),
    clone: F((patch.clone || []).map(normalizeStroke)),
    fill: F((patch.fill || []).map(normalizeStroke)),
    overlays: F((patch.overlays || []).map(normalizeOverlay).sort((a,b)=>a.z-b.z)),
    selection: normalizeSelection(patch.selection),
    layerVisibility: F(layerVisibility)
  });
}

export function createStroke(points, {radius = .045, hardness = 1, source = null, id = null, pixelPerfect = true} = {}) {
  return normalizeStroke({points, radius, hardness, source, id, pixelPerfect});
}
export function createOverlayPatch(spec = {}) { return normalizeOverlay(spec); }

export function serializeSurgeryPatches(patches = {}) {
  const out = {};
  for (const [index, raw] of Object.entries(patches || {})) {
    const patch = normalizeSurgeryPatch(raw);
    const plain = clone(patch);
    plain.overlays = (plain.overlays || []).map(overlay => {
      const item = {...overlay}; delete item.image; delete item.canvas; delete item.bitmap; return item;
    });
    out[index] = plain;
  }
  return freezeDeep(out);
}

function pointerGeometry(points = []) {
  if (points.length < 2) return null;
  const [a, b] = points, dx = b.x - a.x, dy = b.y - a.y;
  return {center: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}, distance: Math.hypot(dx, dy), angle: Math.atan2(dy, dx)};
}

export function reduceSurgeryGesture(patchInput, gesture = {}) {
  const patch = clone(normalizeSurgeryPatch(patchInput)), type = gesture.type;
  if (type === 'drag') { patch.x += finite(gesture.dx); patch.y += finite(gesture.dy); }
  else if (type === 'pinch') {
    const start = pointerGeometry(gesture.start || []), current = pointerGeometry(gesture.current || []);
    if (start && current && start.distance > .001) {
      patch.scale *= current.distance / start.distance; patch.rotation += current.angle - start.angle;
      patch.x += current.center.x - start.center.x; patch.y += current.center.y - start.center.y;
    }
  } else if (type === 'crop') patch.crop = {...patch.crop, [gesture.edge]: finite(gesture.value)};
  else if (type === 'stroke') {
    const bucket = ['erase', 'restore', 'clone', 'fill'].includes(gesture.bucket) ? gesture.bucket : null;
    if (bucket) patch[bucket] = [...(patch[bucket] || []), createStroke(gesture.points || [], gesture)];
  } else if (type === 'selection') patch.selection = gesture.selection || null;
  else if (type === 'overlay-add') patch.overlays = [...(patch.overlays || []), createOverlayPatch({...gesture.overlay, z:gesture.overlay?.z ?? patch.overlays.length})];
  else if (type === 'overlay-transform') patch.overlays = (patch.overlays || []).map(item => item.id === gesture.id && !item.locked ? createOverlayPatch({...item, ...gesture.transform}) : item);
  else if (type === 'overlay-property') patch.overlays = (patch.overlays || []).map(item => item.id === gesture.id ? createOverlayPatch({...item, ...gesture.changes}) : item);
  else if (type === 'overlay-remove') patch.overlays = (patch.overlays || []).filter(item => item.id !== gesture.id);
  else if (type === 'overlay-reorder') {
    const item = patch.overlays.find(x=>x.id===gesture.id); if (item) {
      const delta = Math.sign(finite(gesture.delta));
      patch.overlays = patch.overlays.map(x=>x.id===item.id?createOverlayPatch({...x,z:x.z+delta}):x);
    }
  } else if (type === 'layer-visibility') patch.layerVisibility = {...patch.layerVisibility, [gesture.layer]: gesture.visible !== false};
  else if (type === 'pixel-snap') patch.pixelSnap = gesture.enabled !== false;
  else if (type === 'reset-transform') { patch.x = 0; patch.y = 0; patch.scale = 1; patch.rotation = 0; }
  return normalizeSurgeryPatch(patch);
}

export function snapSurgeryPatch(patchInput, {rotationStep = Math.PI / 12, scaleStep = 1 / 64} = {}) {
  const patch = clone(normalizeSurgeryPatch(patchInput));
  if (!patch.pixelSnap) return normalizeSurgeryPatch(patch);
  patch.x = Math.round(patch.x); patch.y = Math.round(patch.y);
  patch.scale = Math.max(.35, Math.min(2.5, Math.round(patch.scale / scaleStep) * scaleStep));
  patch.rotation = Math.round(patch.rotation / rotationStep) * rotationStep;
  patch.overlays = patch.overlays.map(item => createOverlayPatch({...item,
    x: Math.round(item.x), y: Math.round(item.y),
    scale: Math.round(item.scale / scaleStep) * scaleStep,
    rotation: Math.round(item.rotation / rotationStep) * rotationStep
  }));
  return normalizeSurgeryPatch(patch);
}

export function autoFixSurgeryPatch(patchInput, frame = {}, reference = {}) {
  const patch = clone(normalizeSurgeryPatch(patchInput));
  const height = Math.max(1, finite(frame.height ?? frame.h, 1)), width = Math.max(1, finite(frame.width ?? frame.w, 1));
  const refHeight = Math.max(1, finite(reference.height ?? reference.h, height)), refWidth = Math.max(1, finite(reference.width ?? reference.w, width));
  const frameFoot = finite(frame.footY ?? frame.bottom, height), refFoot = finite(reference.footY ?? reference.bottom, refHeight);
  const frameCenter = finite(frame.centerX, width / 2), refCenter = finite(reference.centerX, refWidth / 2);
  const sizeScale = clamp(Math.sqrt((refHeight * refWidth) / Math.max(1, height * width)), .6, 1.5);
  patch.scale = sizeScale; patch.x += refCenter - frameCenter * sizeScale; patch.y += refFoot - frameFoot * sizeScale; patch.rotation = 0;
  return snapSurgeryPatch(patch);
}

export function createSurgeryHistory(initialPatch = createSurgeryPatch(), {limit = 120} = {}) {
  const undoStack = [], redoStack = []; let current = normalizeSurgeryPatch(initialPatch);
  const snapshot = () => normalizeSurgeryPatch(clone(current));
  return F({
    get value() { return current; }, get canUndo() { return undoStack.length > 0; }, get canRedo() { return redoStack.length > 0; },
    commit(next) { undoStack.push(snapshot()); if (undoStack.length > Math.max(5, limit)) undoStack.shift(); current = normalizeSurgeryPatch(clone(next)); redoStack.length = 0; return current; },
    replace(next) { current = normalizeSurgeryPatch(clone(next)); return current; },
    undo() { if (!undoStack.length) return current; redoStack.push(snapshot()); current = undoStack.pop(); return current; },
    redo() { if (!redoStack.length) return current; undoStack.push(snapshot()); current = redoStack.pop(); return current; },
    clear(next = createSurgeryPatch()) { undoStack.length = 0; redoStack.length = 0; current = normalizeSurgeryPatch(next); return current; }
  });
}

export const __frameSurgeryInternals = F({clamp, finite, nullableInteger, clone, pointerGeometry, normalizeCrop, normalizeStroke, normalizeOverlay, normalizeSelection, normalizeRuns});
