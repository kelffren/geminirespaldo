/* KELO-INDEX
 * area: WORLD / MAP FORGE / EVOLUTION / GOLDEN SEEDS
 * owner: KeloMapForge regression corpus
 * purpose: provide fixed representative seeds so evolution cannot win only on lucky random cases
 * public-api: MAP_FORGE_GOLDEN_SEEDS, getMapForgeGoldenSeeds
 * consumes: stable Map Forge recipe ids
 * state-owned: immutable test data only
 * online: N/A; evaluation data only
 * do-not: no generation logic, runtime mutation, Math.random or wall-clock values
 */
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
export const MAP_FORGE_GOLDEN_SEEDS=freeze({
  KELO_ROYAL_CAPITAL_V1:[81746291,12345,424242,29011987,771337,990001,611203,950271],
  KELO_VILLAGE_V1:[424242,224466,1009,7331,985113,611203,81746291,360021],
  KELO_FOREST_V1:[424242,13579,24680,90909,567890,120319,81746291,770077]
});
export function getMapForgeGoldenSeeds(recipeId,{limit=8}={}){
  const rows=MAP_FORGE_GOLDEN_SEEDS[String(recipeId||'')]||[];
  return Object.freeze(rows.slice(0,Math.max(1,Math.min(rows.length||1,Math.floor(Number(limit)||8)))));
}
