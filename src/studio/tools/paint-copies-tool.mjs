/* KELO-INDEX
 * area: STUDIO / PAINT COPIES TOOL
 * owns: local copy-stroke preview, automatic spacing, Studio input takeover and one-history-action batch commit
 * does-not-own: camera math, renderer or authority transport
 * public-api: createPaintCopiesTool()
 * online: stroke preview is local; commit becomes one CompositeCommand mirrored by Studio authority
 */

import { createPlaceEntityCommand } from '../document/document-commands.mjs';
import { createCompositeCommand } from '../document/composite-command.mjs';

const MAX_PREVIEW_ENTITIES = 500;
const INPUT_CONTEXT = 'studio-paint-copies';
const EMPTY_PREVIEWS = Object.freeze([]);
const copy = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
function newId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `entity:${uuid || `${Date.now().toString(36)}:${Math.random().toString(36).slice(2,10)}`}`;
}
const num = value => Number(value) || 0;

export function createPaintCopiesTool(kernel) {
  if (!kernel) throw new Error('STUDIO_PAINT_COPIES_KERNEL_REQUIRED');

  let template = null;
  let stroke = null;
  let enabled = false;
  let committing = false;
  let unregisterInput = null;
  let button = null;
  let domObserver = null;
  let selectionUnsub = null;
  let sawShell = false;
  const pointers = new Set();

  const selectedEntities = () => kernel.selection.get().map(id => kernel.document.entities.find(e => String(e.id) === String(id))).filter(Boolean);
  const entitySize = row => {
    const spatial = kernel.spatial.get(row.id)?.rect;
    const scale = Math.max(.1, Number(row.transform?.scale) || 1);
    return {
      w: Math.max(1, Number(spatial?.w) || (Number(row.bounds?.w) || 1) * scale),
      h: Math.max(1, Number(spatial?.h) || (Number(row.bounds?.h) || 1) * scale)
    };
  };
  const currentSnap = () => {
    const value = globalThis.document?.querySelector?.('#kelo-studio-live [data-ext="snap"]')?.value;
    return Math.max(1, Number(value) || Number(kernel.document.settings?.tileSize) || 32);
  };
  const notify = message => {
    if (typeof globalThis.showToast === 'function') globalThis.showToast(message);
    else if (typeof console !== 'undefined') console.info('[Kelo Studio]', message);
  };

  function start({ spacing = 'auto', snap = null } = {}) {
    const rows = selectedEntities();
    if (!rows.length) throw new Error('STUDIO_PAINT_COPIES_SELECTION_REQUIRED');
    const rects = rows.map(row => {
      const size = entitySize(row);
      return { row, x: num(row.transform?.x), y: num(row.transform?.y), ...size };
    });
    const minX = Math.min(...rects.map(r => r.x));
    const minY = Math.min(...rects.map(r => r.y));
    const maxX = Math.max(...rects.map(r => r.x + r.w));
    const maxY = Math.max(...rects.map(r => r.y + r.h));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const tile = Math.max(1, Number(snap ?? kernel.document.settings?.tileSize) || 32);
    const footprint = { w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
    const autoSpacing = Math.max(tile, Math.min(footprint.w, footprint.h));
    const resolvedSpacing = spacing === 'auto' ? autoSpacing : Math.max(1, Number(spacing) || autoSpacing);

    template = {
      spacing: resolvedSpacing,
      snap: tile,
      footprint,
      rows: rects.map(({ row }) => {
        const clone = copy(row);
        if (clone.source) clone.source = { ...clone.source, authorityPlacementId: undefined };
        return {
          source: clone,
          offsetX: num(row.transform?.x) - centerX,
          offsetY: num(row.transform?.y) - centerY
        };
      })
    };
    stroke = null;
    return state();
  }

  function addStamp(x, y, snap = template?.snap || 32) {
    if (!template || !stroke) return false;
    const s = Math.max(1, Number(snap) || 1);
    const cx = Math.round(num(x) / s) * s;
    const cy = Math.round(num(y) / s) * s;
    const key = `${cx}:${cy}`;
    if (stroke.keys.has(key)) return false;
    if ((stroke.stamps + 1) * template.rows.length > MAX_PREVIEW_ENTITIES) {
      stroke.capped = true;
      return false;
    }
    stroke.keys.add(key);
    stroke.stamps++;
    for (const item of template.rows) {
      const row = copy(item.source);
      row.id = newId();
      row.transform = {
        ...(row.transform || {}),
        x: cx + item.offsetX,
        y: cy + item.offsetY
      };
      if (row.source) row.source = { ...row.source, authorityPlacementId: undefined };
      stroke.previews.push(row);
    }
    return true;
  }

  function beginAt(x, y, { snap = template?.snap || 32, spacing = template?.spacing } = {}) {
    if (!template) throw new Error('STUDIO_PAINT_COPIES_NOT_READY');
    const resolvedSpacing = Math.max(1, Number(spacing) || template.spacing || 32);
    stroke = {
      active: true,
      spacing: resolvedSpacing,
      snap: Math.max(1, Number(snap) || 1),
      lastInput: { x: num(x), y: num(y) },
      distanceUntilNext: resolvedSpacing,
      previews: [],
      keys: new Set(),
      stamps: 0,
      capped: false
    };
    addStamp(x, y, stroke.snap);
    return state();
  }

  function strokeTo(x, y, { snap = stroke?.snap || template?.snap || 32 } = {}) {
    if (!stroke?.active || !template) return null;
    const end = { x: num(x), y: num(y) };
    const start = stroke.lastInput;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0.001) return state();
    const ux = dx / length;
    const uy = dy / length;
    let travel = stroke.distanceUntilNext;
    while (travel <= length + 1e-6 && !stroke.capped) {
      addStamp(start.x + ux * travel, start.y + uy * travel, snap);
      travel += stroke.spacing;
    }
    stroke.distanceUntilNext = Math.max(0.001, travel - length);
    stroke.lastInput = end;
    return state();
  }

  function cancelStroke() { stroke = null; }
  function cancel() { stroke = null; template = null; }

  async function commit() {
    if (!stroke?.active) throw new Error('STUDIO_PAINT_COPIES_STROKE_NOT_ACTIVE');
    const rows = stroke.previews.map(copy);
    const stampCount = stroke.stamps;
    const wasCapped = stroke.capped;
    stroke = null;
    if (!rows.length) return { rows: [], stamps: 0, capped: wasCapped };
    const commands = rows.map(row => createPlaceEntityCommand(row));
    if (commands.length === 1) await kernel.execute(commands[0]);
    else await kernel.execute(createCompositeCommand(commands, {
      type: 'entity.batch.paint-copies',
      label: `Paint ${rows.length} object${rows.length === 1 ? '' : 's'}`
    }));
    kernel.selection.set(rows.map(row => row.id));
    return { rows, stamps: stampCount, capped: wasCapped };
  }

  function ensureInput() {
    if (unregisterInput) return;
    unregisterInput = kernel.input.register(INPUT_CONTEXT, {
      pointerdown: event => {
        if (!enabled) return false;
        pointers.add(event.pointerId ?? 'mouse');
        if (pointers.size > 1) { cancelStroke(); return true; }
        if (committing) return true;
        beginAt(event.worldX, event.worldY, { snap: currentSnap() });
        return true;
      },
      pointermove: event => {
        if (!enabled) return false;
        if (pointers.size > 1 || !stroke?.active || committing) return true;
        strokeTo(event.worldX, event.worldY, { snap: currentSnap() });
        return true;
      },
      pointerup: event => {
        if (!enabled) return false;
        pointers.delete(event.pointerId ?? 'mouse');
        if (pointers.size > 0 || !stroke?.active || committing) return true;
        committing = true;
        void commit().then(result => {
          if (result?.capped) notify('Paint Copies limitado a 500 objetos por trazo');
        }).catch(error => notify(error?.message || String(error))).finally(() => {
          committing = false;
          syncButton();
        });
        return true;
      },
      pointercancel: event => {
        pointers.delete(event.pointerId ?? 'mouse');
        cancelStroke();
        return enabled;
      }
    }, 1200);
  }

  function activate() {
    if (enabled) return true;
    try { start({ snap: currentSnap() }); }
    catch (error) {
      notify('Selecciona un objeto o grupo antes de usar PAINT COPIES');
      syncButton();
      return false;
    }
    ensureInput();
    kernel.input.push(INPUT_CONTEXT);
    enabled = true;
    pointers.clear();
    syncButton();
    const spacing = Math.round(template?.spacing || 0);
    notify(`Paint Copies activo · separación auto ${spacing}px`);
    return true;
  }

  function deactivate() {
    kernel.input.pop(INPUT_CONTEXT);
    pointers.clear();
    cancel();
    enabled = false;
    syncButton();
    return false;
  }

  function toggle() { return enabled ? deactivate() : activate(); }

  function syncButton() {
    if (!button?.isConnected) return;
    const nextDisabled = !enabled && selectedEntities().length === 0;
    const nextHtml = enabled ? '<span class="ks-ico">✣</span>PAINT ON' : '<span class="ks-ico">✣</span>PAINT COPIES';
    const nextPressed = enabled ? 'true' : 'false';
    const nextTitle = enabled ? 'Toca para salir de Paint Copies' : 'Pinta copias arrastrando por el mapa';
    button.classList.toggle('on', enabled);
    if (button.disabled !== nextDisabled) button.disabled = nextDisabled;
    if (button.innerHTML !== nextHtml) button.innerHTML = nextHtml;
    if (button.getAttribute('aria-pressed') !== nextPressed) button.setAttribute('aria-pressed', nextPressed);
    if (button.title !== nextTitle) button.title = nextTitle;
  }

  function installButton() {
    const document = globalThis.document;
    if (!document) return false;
    const shell = document.querySelector('#kelo-studio-live');
    if (!shell) return false;
    sawShell = true;
    const editBar = shell.querySelector('.ks-ext-edit');
    if (!editBar) return false;
    const existing = editBar.querySelector('[data-ext-paint-copies]');
    if (existing) { button = existing; syncButton(); return true; }
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.extPaintCopies = '1';
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      toggle();
    });
    editBar.appendChild(button);
    syncButton();
    return true;
  }

  function installDomBridge() {
    const document = globalThis.document;
    if (!document?.body || typeof globalThis.MutationObserver !== 'function') return;
    ensureInput();
    const onKey = event => {
      if (!document.querySelector('#kelo-studio-live')) return;
      const key = String(event.key || '').toLowerCase();
      if (enabled && key === 'escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        deactivate();
        notify('Paint Copies desactivado');
      } else if (key === 'b' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toggle();
      }
    };
    document.addEventListener('keydown', onKey, true);
    selectionUnsub = kernel.selection.onChange(syncButton);
    installButton();
    domObserver = new globalThis.MutationObserver(() => {
      const shell = document.querySelector('#kelo-studio-live');
      if (!shell && sawShell) {
        deactivate();
        domObserver?.disconnect();
        selectionUnsub?.();
        document.removeEventListener('keydown', onKey, true);
        button = null;
        return;
      }
      if (!button?.isConnected) installButton();
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
  }

  function state() {
    return {
      ready: !!template,
      enabled,
      committing,
      active: !!stroke?.active,
      spacing: template?.spacing || null,
      snap: stroke?.snap || template?.snap || null,
      footprint: template?.footprint ? { ...template.footprint } : null,
      templateCount: template?.rows.length || 0,
      stamps: stroke?.stamps || 0,
      previewCount: stroke?.previews.length || 0,
      capped: !!stroke?.capped
    };
  }

  installDomBridge();

  return Object.freeze({
    id: 'paintCopies',
    start,
    activate,
    deactivate,
    toggle,
    beginAt,
    strokeTo,
    commit,
    cancelStroke,
    cancel,
    state,
    // Safe ownership boundary for external callers that may mutate returned rows.
    getPreviews: () => stroke?.previews.map(copy) || [],
    // Renderer-only read path: no structuredClone/JSON clone in the hot frame loop.
    getPreviewRefs: () => stroke?.previews || EMPTY_PREVIEWS
  });
}
