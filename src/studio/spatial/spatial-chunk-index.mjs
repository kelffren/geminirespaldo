/* KELO-INDEX
 * area: STUDIO / SPATIAL
 * owns: chunk-based lookup for entities/colliders/zones/selection
 * does-not-own: collision resolution or rendering
 * public-api: createSpatialChunkIndex()
 * online: no
 */

export function createSpatialChunkIndex({ chunkSize = 512 } = {}) {
  chunkSize = Math.max(64, Number(chunkSize) || 512);
  const entries = new Map();
  const buckets = new Map();
  let lastQuery = Object.freeze({ bucketsScanned: 0, membershipChecks: 0, uniqueCandidates: 0, results: 0 });

  const key = (x, y) => `${x},${y}`;
  const rangeFor = r => ({ minX: Math.floor(r.x / chunkSize), minY: Math.floor(r.y / chunkSize), maxX: Math.floor((r.x + Math.max(0, r.w - 1)) / chunkSize), maxY: Math.floor((r.y + Math.max(0, r.h - 1)) / chunkSize) });
  const keysFor = r => { const q = rangeFor(r); const out = []; for (let y = q.minY; y <= q.maxY; y++) for (let x = q.minX; x <= q.maxX; x++) out.push(key(x, y)); return out; };

  function remove(id) {
    id = String(id); const old = entries.get(id); if (!old) return false;
    for (const k of old.__chunks) { const bucket = buckets.get(k); bucket?.delete(id); if (bucket?.size === 0) buckets.delete(k); }
    entries.delete(id); return true;
  }

  function upsert(entry) {
    if (!entry?.id || !entry.rect) throw new Error('STUDIO_SPATIAL_INVALID_ENTRY');
    const id = String(entry.id); remove(id);
    const rect = { x: Number(entry.rect.x) || 0, y: Number(entry.rect.y) || 0, w: Math.max(1, Number(entry.rect.w) || 1), h: Math.max(1, Number(entry.rect.h) || 1) };
    const chunks = keysFor(rect); const row = { ...entry, id, rect, __chunks: chunks };
    entries.set(id, row);
    for (const k of chunks) { if (!buckets.has(k)) buckets.set(k, new Set()); buckets.get(k).add(id); }
    return row;
  }

  function queryRect(rect, { category } = {}) {
    const q = rangeFor(rect), seen = new Set(), out = [];
    const rx = Number(rect.x) || 0, ry = Number(rect.y) || 0, rw = Math.max(1, Number(rect.w) || 1), rh = Math.max(1, Number(rect.h) || 1), x2 = rx + rw, y2 = ry + rh;
    let bucketsScanned = 0, membershipChecks = 0;
    for (let cy = q.minY; cy <= q.maxY; cy++) for (let cx = q.minX; cx <= q.maxX; cx++) {
      bucketsScanned++;
      const bucket = buckets.get(key(cx, cy));
      if (!bucket) continue;
      for (const id of bucket) {
        membershipChecks++;
        if (seen.has(id)) continue;
        seen.add(id);
        const e = entries.get(id);
        if (e && (!category || e.category === category) && e.rect.x < x2 && e.rect.x + e.rect.w > rx && e.rect.y < y2 && e.rect.y + e.rect.h > ry) out.push(e);
      }
    }
    lastQuery = Object.freeze({ bucketsScanned, membershipChecks, uniqueCandidates: seen.size, results: out.length });
    return out;
  }

  function queryPoint(x, y, options) { return queryRect({ x, y, w: 1, h: 1 }, options); }
  function clear() { entries.clear(); buckets.clear(); lastQuery = Object.freeze({ bucketsScanned: 0, membershipChecks: 0, uniqueCandidates: 0, results: 0 }); }

  return Object.freeze({
    upsert, remove, queryRect, queryPoint, clear,
    get: id => entries.get(String(id)) || null,
    get chunkSize() { return chunkSize; },
    stats: () => ({ entries: entries.size, buckets: buckets.size, lastQuery: { ...lastQuery } })
  });
}
