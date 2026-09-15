/* KELO-INDEX
 * area: STUDIO / DIRTY CHUNKS
 * owns: incremental invalidation bookkeeping
 * does-not-own: rendering or compilation
 * public-api: createDirtyChunkManager()
 * online: no
 */

export function createDirtyChunkManager({ chunkSize = 512 } = {}) {
  chunkSize = Math.max(64, Number(chunkSize) || 512);
  const dirty = new Map();
  const key = (x, y) => `${x},${y}`;

  function mark(cx, cy, reason = 'edit') {
    const k = key(Math.floor(cx), Math.floor(cy));
    if (!dirty.has(k)) dirty.set(k, new Set());
    dirty.get(k).add(String(reason));
    return k;
  }

  function markRect(rect, reason = 'edit') {
    const minX = Math.floor((Number(rect.x) || 0) / chunkSize), minY = Math.floor((Number(rect.y) || 0) / chunkSize);
    const maxX = Math.floor(((Number(rect.x) || 0) + Math.max(0, (Number(rect.w) || 1) - 1)) / chunkSize);
    const maxY = Math.floor(((Number(rect.y) || 0) + Math.max(0, (Number(rect.h) || 1) - 1)) / chunkSize);
    const out = [];
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) out.push(mark(x, y, reason));
    return out;
  }

  function peek() { return [...dirty].map(([id, reasons]) => ({ id, reasons: [...reasons] })); }
  function consume() { const out = peek(); dirty.clear(); return out; }
  return Object.freeze({ mark, markRect, peek, consume, clear: () => dirty.clear(), get size() { return dirty.size; }, get chunkSize() { return chunkSize; } });
}
