/* KELO-INDEX
 * area: STUDIO / BUILTIN COMPONENTS
 * owns: creator-facing metadata for reusable Kelo capabilities
 * does-not-own: runtime implementation of inventory/forge/farming/AI/etc
 * public-api: registerKeloComponents()
 * online: values require server validation when published
 */

export function registerKeloComponents(registry) {
  if (!registry) throw new Error('STUDIO_COMPONENT_REGISTRY_REQUIRED');
  const defs = [
    { id: 'visual', category: 'visual', schema: { assetId: { type: 'asset' }, phase: { type: 'enum', values: ['props_back','props_front'] } } },
    { id: 'collider', category: 'physics', schema: { rect: { type: 'rect' }, blocksMovement: { type: 'boolean' } }, defaults: { blocksMovement: true }, runtimeSystem: 'KELO_COLLISION' },
    { id: 'interaction', category: 'gameplay', schema: { action: { type: 'string' }, radius: { type: 'number', min: 0 } } },
    { id: 'container', category: 'storage', schema: { source: { type: 'enum', values: ['personal','house','guild','public','shop','temporary','reward'] }, slots: { type: 'integer', min: 1, max: 500 } }, defaults: { source: 'house', slots: 20 }, runtimeSystem: 'inventory' },
    { id: 'craftingStation', category: 'crafting', schema: { recipeSet: { type: 'string' }, level: { type: 'integer', min: 1, max: 99 } }, defaults: { level: 1 }, runtimeSystem: 'KELO_FORGE_SYSTEM' },
    { id: 'growZone', category: 'farming', schema: { soilType: { type: 'string' }, cropWhitelist: { type: 'array', itemType: 'string' }, growthMultiplier: { type: 'number', min: 0.1, max: 10 } }, defaults: { growthMultiplier: 1 }, runtimeSystem: 'farming' },
    { id: 'door', category: 'gameplay', schema: { startsOpen: { type: 'boolean' }, autoCloseSeconds: { type: 'number', min: 0 } }, defaults: { startsOpen: false, autoCloseSeconds: 0 } },
    { id: 'lockable', category: 'gameplay', schema: { locked: { type: 'boolean' }, keyItemId: { type: 'item' } }, defaults: { locked: false } },
    { id: 'spawner', category: 'gameplay', schema: { prefabId: { type: 'prefab' }, amount: { type: 'integer', min: 1, max: 100 }, radius: { type: 'number', min: 0 }, respawnSeconds: { type: 'number', min: 0 } }, defaults: { amount: 1, radius: 0, respawnSeconds: 0 } },
    { id: 'permission', category: 'ownership', schema: { access: { type: 'enum', values: ['owner','friends','guild','everyone','admin'] } }, defaults: { access: 'owner' } },
    { id: 'persistent', category: 'state', schema: { enabled: { type: 'boolean' }, scope: { type: 'enum', values: ['player','parcel','world'] } }, defaults: { enabled: true, scope: 'world' } },
    { id: 'analyticsMarker', category: 'analytics', schema: { event: { type: 'string' } } },
    { id: 'audioEmitter', category: 'audio', schema: { assetId: { type: 'audio' }, radius: { type: 'number', min: 0 }, loop: { type: 'boolean' } }, defaults: { loop: false } }
  ];
  let added = 0;
  for (const def of defs) if (!registry.has(def.id)) { registry.register({ label: def.id.replace(/[A-Z]/g, m => ` ${m}`).replace(/^./, m => m.toUpperCase()), ...def }); added++; }
  return { added, total: registry.size() };
}
