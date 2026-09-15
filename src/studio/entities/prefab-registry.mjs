/* KELO-INDEX
 * area: STUDIO / PREFABS
 * owns: reusable prefab definitions, inheritance and instance override resolution
 * does-not-own: asset loading, gameplay systems, persistence
 * public-api: createPrefabRegistry()
 * online: published prefab definitions must be server-approved/versioned later
 */

const copy = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

function mergeComponents(base = {}, own = {}) {
  const out = copy(base) || {};
  for (const [id, value] of Object.entries(own || {})) out[id] = { ...(out[id] || {}), ...copy(value) };
  return out;
}

export function createPrefabRegistry() {
  const prefabs = new Map();

  function register(raw) {
    if (!raw?.id) throw new Error('STUDIO_PREFAB_ID_REQUIRED');
    const id = String(raw.id);
    if (prefabs.has(id)) throw new Error(`STUDIO_PREFAB_DUPLICATE:${id}`);
    const row = Object.freeze({
      id,
      version: Math.max(1, Number(raw.version) || 1),
      label: String(raw.label || id),
      category: String(raw.category || 'general'),
      parentId: raw.parentId ? String(raw.parentId) : null,
      bounds: Object.freeze(copy(raw.bounds || { w: 32, h: 32 })),
      components: Object.freeze(copy(raw.components || {})),
      children: Object.freeze(copy(Array.isArray(raw.children) ? raw.children : [])),
      dependencies: Object.freeze(copy(Array.isArray(raw.dependencies) ? raw.dependencies : []))
    });
    prefabs.set(id, row);
    return row;
  }

  function resolve(id, overrides = {}, seen = new Set()) {
    id = String(id);
    const row = prefabs.get(id);
    if (!row) return null;
    if (seen.has(id)) throw new Error(`STUDIO_PREFAB_CYCLE:${id}`);
    seen.add(id);
    const parent = row.parentId ? resolve(row.parentId, {}, seen) : null;
    seen.delete(id);
    return {
      id: row.id,
      version: row.version,
      label: row.label,
      category: row.category,
      bounds: { ...(parent?.bounds || {}), ...copy(row.bounds), ...copy(overrides.bounds || {}) },
      components: mergeComponents(mergeComponents(parent?.components, row.components), overrides.components),
      children: [...(parent?.children || []), ...copy(row.children)],
      dependencies: [...new Set([...(parent?.dependencies || []), ...row.dependencies])]
    };
  }

  return Object.freeze({ register, resolve, get: id => prefabs.get(String(id)) || null, has: id => prefabs.has(String(id)), list: () => [...prefabs.values()], size: () => prefabs.size });
}
