/* KELO-INDEX
 * area: STUDIO / SELECTION
 * owns: ordered editor selection state
 * does-not-own: hit testing or visual rendering
 * public-api: createSelectionManager()
 * online: local-only transient state
 */

export function createSelectionManager() {
  const ids = [];
  const listeners = new Set();
  const emit = () => { const value = ids.slice(); for (const fn of listeners) { try { fn(value); } catch {} } };
  function set(next) { ids.length = 0; for (const id of Array.isArray(next) ? next : [next]) if (id != null && !ids.includes(String(id))) ids.push(String(id)); emit(); return ids.slice(); }
  function add(id) { id = String(id); if (!ids.includes(id)) { ids.push(id); emit(); } return ids.slice(); }
  function remove(id) { const i = ids.indexOf(String(id)); if (i >= 0) { ids.splice(i, 1); emit(); } return ids.slice(); }
  function clear() { if (ids.length) { ids.length = 0; emit(); } }
  return Object.freeze({ set, add, remove, clear, has: id => ids.includes(String(id)), get: () => ids.slice(), onChange(fn) { if (typeof fn !== 'function') return () => {}; listeners.add(fn); return () => listeners.delete(fn); } });
}
