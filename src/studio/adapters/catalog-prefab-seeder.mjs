/* KELO-INDEX
 * area: STUDIO / PREFAB ADAPTER
 * owns: one-way seeding of existing PropertyCatalog templates into Studio PrefabRegistry
 * does-not-own: source catalog, asset loading, gameplay
 * public-api: seedCatalogPrefabs()
 * online: no
 */

export function seedCatalogPrefabs({ prefabRegistry, assetCatalog } = {}) {
  if (!prefabRegistry || !assetCatalog) throw new Error('STUDIO_CATALOG_SEED_DEPENDENCY_MISSING');
  let added = 0;
  for (const template of assetCatalog.list() || []) {
    if (!template?.id || prefabRegistry.has(template.id)) continue;
    const components = { visual: { source: 'property-catalog', parts: template.parts || [] } };
    if (template.collision) components.collider = { rect: template.collision, blocksMovement: true };
    prefabRegistry.register({
      id: template.id,
      version: 1,
      label: template.label || template.id,
      category: template.category || 'general',
      bounds: { w: template.width || 32, h: template.height || 32 },
      components,
      dependencies: [...new Set((template.parts || []).map(part => part.assetKey).filter(Boolean))]
    });
    added++;
  }
  return { added, total: prefabRegistry.size() };
}
