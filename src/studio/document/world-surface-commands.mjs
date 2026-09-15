/* KELO-INDEX
 * area: STUDIO / SURFACE COMMANDS
 * owns: reversible terrain/path cell and world-collision authoring mutations
 * does-not-own: renderer, gameplay physics, authority transport or brush UI
 * public-api: createSetSurfaceCellCommand(), createCreateWorldCollisionCommand(), createMoveWorldCollisionCommand(), createRemoveWorldCollisionCommand()
 * online: serialize() carries exact before/after state so authority undo/redo stays deterministic
 */

const copy = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
const positive = (value, fallback = 1) => Math.max(1, Number(value) || fallback);
const snap = (value, size) => Math.floor(Math.max(0, Number(value) || 0) / size) * size;
const cellKey = (x, y) => `${Math.floor(Number(x) || 0)},${Math.floor(Number(y) || 0)}`;
const collisionMap = document => {
  document.navigation = document.navigation && typeof document.navigation === 'object' ? document.navigation : {};
  document.navigation.collisions = document.navigation.collisions && typeof document.navigation.collisions === 'object' ? document.navigation.collisions : {};
  return document.navigation.collisions;
};

export function createSetSurfaceCellCommand({ x, y, material = null, role = 'terrain', erase = false, tileSize = 32 } = {}) {
  const size = positive(tileSize, 32), sx = snap(x, size), sy = snap(y, size), key = cellKey(sx, sy);
  const after = erase ? null : { x: sx, y: sy, material: String(material || ''), role: role === 'path' ? 'path' : 'terrain' };
  if (!erase && !after.material) throw new Error('STUDIO_SURFACE_MATERIAL_REQUIRED');
  let before;
  return {
    type: 'surface.cell',
    label: erase ? `Clear ${key}` : `${after.role === 'path' ? 'Path' : 'Terrain'} ${after.material} ${key}`,
    execute({ document }) {
      if (before === undefined) before = copy(document.terrain?.[key] ?? null);
      document.terrain = document.terrain && typeof document.terrain === 'object' ? document.terrain : {};
      if (after) document.terrain[key] = copy(after); else delete document.terrain[key];
    },
    undo({ document }) {
      document.terrain = document.terrain && typeof document.terrain === 'object' ? document.terrain : {};
      if (before) document.terrain[key] = copy(before); else delete document.terrain[key];
    },
    serialize: () => ({ type: 'surface.cell', key, x: sx, y: sy, tileSize: size, before: copy(before ?? null), after: copy(after) }),
    affectedRects: () => [{ x: sx, y: sy, w: size, h: size }]
  };
}

export function createCreateWorldCollisionCommand(collision = {}) {
  const id = String(collision.collisionId || collision.id || '');
  if (!id) throw new Error('STUDIO_COLLISION_ID_REQUIRED');
  const row = {
    collisionId: id,
    x: Math.max(0, Number(collision.x) || 0),
    y: Math.max(0, Number(collision.y) || 0),
    w: positive(collision.w, 32),
    h: positive(collision.h, 32),
    label: String(collision.label || 'Studio Collision')
  };
  return {
    type: 'collision.create', label: `Create collision ${id}`,
    execute({ document }) { const map = collisionMap(document); if (map[id]) throw new Error('STUDIO_COLLISION_ALREADY_EXISTS'); map[id] = copy(row); },
    undo({ document }) { delete collisionMap(document)[id]; },
    serialize: () => ({ type: 'collision.create', collision: copy(row) }),
    affectedRects: () => [{ x: row.x, y: row.y, w: row.w, h: row.h }]
  };
}

export function createMoveWorldCollisionCommand(id, to = {}) {
  id = String(id || ''); if (!id) throw new Error('STUDIO_COLLISION_ID_REQUIRED');
  const target = { x: Math.max(0, Number(to.x) || 0), y: Math.max(0, Number(to.y) || 0), w: positive(to.w, 32), h: positive(to.h, 32) };
  let from = null;
  return {
    type: 'collision.move', label: `Move collision ${id}`,
    execute({ document }) { const row = collisionMap(document)[id]; if (!row) throw new Error('STUDIO_COLLISION_NOT_FOUND'); if (!from) from = { x: row.x, y: row.y, w: row.w, h: row.h }; Object.assign(row, copy(target)); },
    undo({ document }) { const row = collisionMap(document)[id]; if (row && from) Object.assign(row, copy(from)); },
    serialize: () => ({ type: 'collision.move', id, from: copy(from), to: copy(target) }),
    affectedRects: () => [from && { ...from }, { ...target }].filter(Boolean)
  };
}

export function createRemoveWorldCollisionCommand(id) {
  id = String(id || ''); if (!id) throw new Error('STUDIO_COLLISION_ID_REQUIRED');
  let removed = null;
  return {
    type: 'collision.remove', label: `Remove collision ${id}`,
    execute({ document }) { const map = collisionMap(document), row = map[id]; if (!row) throw new Error('STUDIO_COLLISION_NOT_FOUND'); removed = copy(row); delete map[id]; },
    undo({ document }) { if (removed) collisionMap(document)[id] = copy(removed); },
    serialize: () => ({ type: 'collision.remove', id, collision: copy(removed) }),
    affectedRects: () => removed ? [{ x: removed.x, y: removed.y, w: removed.w, h: removed.h }] : []
  };
}
