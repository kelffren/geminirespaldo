/* KELO-INDEX
 * area: STUDIO / COLLISION TOOL
 * owns: collision create/select/move/remove previews and confirmed Commands
 * does-not-own: gameplay collision resolution or obstacle projection
 * public-api: createCollisionTool()
 * online: previews stay local; confirmed operations mirror through KELO_WORLD_EDIT
 */

import { createCreateWorldCollisionCommand, createMoveWorldCollisionCommand, createRemoveWorldCollisionCommand } from '../document/world-surface-commands.mjs';

const snap = (value, size) => Math.floor(Math.max(0, Number(value) || 0) / size) * size;
const snapNearest = (value, size) => Math.round(Math.max(0, Number(value) || 0) / size) * size;
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const newId = () => `studio-collision:${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}:${Math.random().toString(36).slice(2,9)}`}`;

export function createCollisionTool(kernel) {
  if (!kernel) throw new Error('STUDIO_COLLISION_KERNEL_REQUIRED');
  let preview = null, selectedId = null, action = null, visible = false, grabOffset = { x: 0, y: 0 }, defaultSize = { w: 64, h: 64 };
  const tileSize = () => Math.max(1, Number(kernel.document.settings?.tileSize) || 32);
  const collisions = () => Object.values(kernel.document.navigation?.collisions || {});
  const byId = id => kernel.document.navigation?.collisions?.[String(id)] || null;
  function hitTest(x, y) {
    const rows = collisions().slice().reverse();
    return rows.find(c => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) || null;
  }
  function setVisible(next) { visible = !!next; if (!visible) cancel(); return visible; }
  function setDefaultSize(w, h) { const t = tileSize(); defaultSize = { w: Math.max(t, Math.ceil((Number(w) || t) / t) * t), h: Math.max(t, Math.ceil((Number(h) || t) / t) * t) }; return { ...defaultSize }; }
  function selectPoint(x, y) { const row = hitTest(x, y); selectedId = row?.collisionId || null; return row ? clone(row) : null; }
  function beginAt(x, y) {
    const row = selectPoint(x, y), t = tileSize();
    if (row) {
      action = 'move';
      grabOffset = { x: (Number(x) || 0) - (Number(row.x) || 0), y: (Number(y) || 0) - (Number(row.y) || 0) };
      preview = { ...clone(row), x: snap(row.x, t), y: snap(row.y, t) };
    } else {
      action = 'create'; selectedId = newId(); grabOffset = { x: 0, y: 0 };
      preview = { collisionId: selectedId, x: snap(x, t), y: snap(y, t), w: defaultSize.w, h: defaultSize.h, label: 'Studio Collision' };
    }
    return clone(preview);
  }
  function move(x, y) {
    if (!preview) return null;
    const t = tileSize(), ox = action === 'move' ? grabOffset.x : 0, oy = action === 'move' ? grabOffset.y : 0;
    const snapMove = action === 'move' ? snapNearest : snap;
    preview.x = snapMove((Number(x) || 0) - ox, t);
    preview.y = snapMove((Number(y) || 0) - oy, t);
    return clone(preview);
  }
  async function commit() {
    if (!preview || !action) return null;
    const row = clone(preview); let result = null;
    if (action === 'create') result = await kernel.execute(createCreateWorldCollisionCommand(row));
    else if (action === 'move') result = await kernel.execute(createMoveWorldCollisionCommand(row.collisionId, row));
    action = null; preview = null; grabOffset = { x: 0, y: 0 }; selectedId = row.collisionId; return result;
  }
  async function removeSelected() { if (!selectedId || !byId(selectedId)) return null; const id = selectedId; const result = await kernel.execute(createRemoveWorldCollisionCommand(id)); selectedId = null; preview = null; action = null; grabOffset = { x: 0, y: 0 }; return result; }
  function cancel() { preview = null; action = null; grabOffset = { x: 0, y: 0 }; }
  return Object.freeze({ id: 'collision', setVisible, setDefaultSize, selectPoint, beginAt, move, commit, removeSelected, cancel, hitTest: (x,y)=>clone(hitTest(x,y)), getPreview: ()=>clone(preview), getSelected: ()=>clone(byId(selectedId)), get selectedId(){return selectedId;}, get visible(){return visible;}, list: ()=>clone(collisions()) });
}
