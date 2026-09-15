/* KELO-INDEX
 * area: STUDIO / DOCUMENT
 * owns: canonical readable authoring schema
 * does-not-own: runtime rendering, server authority, gameplay logic
 * public-api: createWorldDocument(), normalizeWorldDocument(), cloneWorldDocument()
 * online: versioned schema is safe to transport after authority validation
 */

export const WORLD_DOCUMENT_SCHEMA = 1;

const clone = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

function stableId(prefix = 'world') {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}:${uuid || `${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`}`;
}

export function createWorldDocument(overrides = {}) {
  return normalizeWorldDocument({
    schemaVersion: WORLD_DOCUMENT_SCHEMA,
    worldId: stableId('world'),
    metadata: { name: 'Untitled', description: '', tags: [] },
    settings: { tileSize: 32, chunkSize: 512 },
    layers: [], terrain: {}, entities: [], zones: [], logicGraphs: [], variables: [], gameRules: {}, navigation: {}, spawnPoints: [], objectives: [], dependencies: [], performanceBudget: {}, permissions: {}, revision: { number: 0, id: null },
    ...overrides
  });
}

export function normalizeWorldDocument(input = {}) {
  const settings = input.settings || {};
  const array = value => Array.isArray(value) ? clone(value) : [];
  return {
    schemaVersion: WORLD_DOCUMENT_SCHEMA,
    worldId: String(input.worldId || stableId('world')),
    metadata: { name: String(input.metadata?.name || 'Untitled'), description: String(input.metadata?.description || ''), tags: array(input.metadata?.tags) },
    settings: { tileSize: Math.max(1, Number(settings.tileSize) || 32), chunkSize: Math.max(64, Number(settings.chunkSize) || 512), ...clone(settings) },
    layers: array(input.layers),
    terrain: clone(input.terrain && typeof input.terrain === 'object' ? input.terrain : {}),
    entities: array(input.entities), zones: array(input.zones), logicGraphs: array(input.logicGraphs), variables: array(input.variables),
    gameRules: clone(input.gameRules && typeof input.gameRules === 'object' ? input.gameRules : {}),
    navigation: clone(input.navigation && typeof input.navigation === 'object' ? input.navigation : {}),
    spawnPoints: array(input.spawnPoints), objectives: array(input.objectives), dependencies: array(input.dependencies),
    performanceBudget: clone(input.performanceBudget && typeof input.performanceBudget === 'object' ? input.performanceBudget : {}),
    permissions: clone(input.permissions && typeof input.permissions === 'object' ? input.permissions : {}),
    revision: clone(input.revision && typeof input.revision === 'object' ? input.revision : { number: 0, id: null })
  };
}

export function cloneWorldDocument(document) { return normalizeWorldDocument(clone(document)); }
