/* KELO-INDEX
 * area: STUDIO / PLACEMENT TOOL
 * owns: local ghost preview and placement commits
 * does-not-own: pointer listeners, authority, asset rendering
 * public-api: createPlacementTool()
 * online: previews are local; commits become CommandBus commands
 */

import { createPlaceEntityCommand, createCompositeCommand } from '../document/document-commands.mjs';

function id() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `entity:${uuid || `${Date.now().toString(36)}:${Math.random().toString(36).slice(2,9)}`}`;
}

export function createPlacementTool(kernel) {
  if (!kernel) throw new Error('STUDIO_PLACEMENT_KERNEL_REQUIRED');
  let preview = null;
  const listeners = new Set();
  const emit = () => { const state = preview ? { ...preview, transform: { ...preview.transform }, bounds: { ...preview.bounds } } : null; for (const fn of listeners) { try { fn(state); } catch {} } };

  function start(prefabId, { rotation = 0, overrides = {} } = {}) {
    const prefab = kernel.prefabs.resolve(prefabId);
    if (!prefab) throw new Error(`STUDIO_PREFAB_UNKNOWN:${prefabId}`);
    preview = { id: id(), prefabId: String(prefabId), transform: { x: 0, y: 0, rotation: Number(rotation) || 0 }, bounds: { ...prefab.bounds }, components: { ...(overrides.components || {}) } };
    emit(); return preview;
  }

  function move(x, y, { snap = 32 } = {}) {
    if (!preview) return null;
    const s = Math.max(1, Number(snap) || 1);
    const nextX = Math.round((Number(x) || 0) / s) * s;
    const nextY = Math.round((Number(y) || 0) / s) * s;
    if (preview.transform.x === nextX && preview.transform.y === nextY) return { ...preview, transform: { ...preview.transform } };
    preview.transform.x = nextX;
    preview.transform.y = nextY;
    emit(); return { ...preview, transform: { ...preview.transform } };
  }

  function rotate(delta = 90) { if (!preview) return null; preview.transform.rotation = ((Number(preview.transform.rotation) || 0) + Number(delta || 0)) % 360; emit(); return preview.transform.rotation; }
  function cancel() { preview = null; emit(); }
  async function commit() {
    if (!preview) throw new Error('STUDIO_PLACEMENT_NOT_ACTIVE');
    const row = { ...preview, transform: { ...preview.transform }, bounds: { ...preview.bounds }, components: { ...preview.components } };
    await kernel.execute(createPlaceEntityCommand(row));
    kernel.selection.set(row.id);
    preview = null; emit(); return row;
  }
  async function commitBatch(rows,{label='Place build segment'}={}){
    const list=(rows||[]).map(row=>({ ...row, id:String(row?.id||id()), transform:{...(row?.transform||{})}, bounds:{...(row?.bounds||{})}, components:{...(row?.components||{})} }));
    if(!list.length)return [];
    const commands=list.map(createPlaceEntityCommand);
    await kernel.execute(createCompositeCommand(commands,{type:'entity.place.batch',label}));
    kernel.selection.set(list.map(row=>row.id));
    preview=null;emit();return list;
  }

  return Object.freeze({ id: 'placement', start, move, rotate, cancel, commit, commitBatch, getPreview: () => preview ? { ...preview, transform: { ...preview.transform }, bounds: { ...preview.bounds } } : null, onPreview(fn) { if (typeof fn !== 'function') return () => {}; listeners.add(fn); return () => listeners.delete(fn); } });
}
