/* KELO-INDEX
 * area: WORLD / MAP FORGE / EVOLUTION / CHAMPION
 * owner: KeloMapForge champion data registry
 * purpose: store only evolution overrides that have passed golden-seed gates and review
 * public-api: MAP_FORGE_CHAMPION_OVERRIDES
 * consumes: Map Forge recipe ids
 * state-owned: immutable approved override data only
 * online: base-world recipe data only; server/runtime deltas remain separate
 * do-not: no generator logic, runtime writes or auto-merge authority
 */
export const MAP_FORGE_CHAMPION_OVERRIDES=Object.freeze({
  KELO_ROYAL_CAPITAL_V1:Object.freeze({
    revision:23,
    genes:Object.freeze({
      'road.curvature':0.34,
      'road.arterialWidth':98,
      'road.collectorWidth':72,
      'style.decoration':0.60,
      'landmark.fountain.keepClearRadius':210
    })
  })
});