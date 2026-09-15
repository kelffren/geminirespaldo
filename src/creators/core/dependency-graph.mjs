/* KELO-INDEX
 * area: CREATORS / DEPENDENCIES
 * owner: Creator dependency metadata graph
 * owns: requires/usedBy edges and safe-delete guard
 * does-not-own: runtime registries, loading or publishing policy
 * reused-by: all asset-producing workspaces
 */
export function createCreatorDependencyGraph() {
  const requiresMap=new Map(), usedByMap=new Map();
  const ensure=(map,key)=>{key=String(key);if(!map.has(key))map.set(key,new Set());return map.get(key);};
  function add(assetId, dependencyId){assetId=String(assetId);dependencyId=String(dependencyId);if(!assetId||!dependencyId||assetId===dependencyId)throw new Error('CREATOR_DEPENDENCY_INVALID');ensure(requiresMap,assetId).add(dependencyId);ensure(usedByMap,dependencyId).add(assetId);return true;}
  function remove(assetId,dependencyId){assetId=String(assetId);dependencyId=String(dependencyId);requiresMap.get(assetId)?.delete(dependencyId);usedByMap.get(dependencyId)?.delete(assetId);return true;}
  function requires(assetId){return [...(requiresMap.get(String(assetId))||[])];}
  function usedBy(assetId){return [...(usedByMap.get(String(assetId))||[])];}
  function canDelete(assetId){return usedBy(assetId).length===0;}
  function assertCanDelete(assetId){const refs=usedBy(assetId);if(refs.length)throw new Error(`CREATOR_DEPENDENCY_IN_USE:${String(assetId)}:${refs.join(',')}`);return true;}
  function clearAsset(assetId){assetId=String(assetId);assertCanDelete(assetId);for(const dep of requires(assetId))remove(assetId,dep);requiresMap.delete(assetId);usedByMap.delete(assetId);}
  return Object.freeze({add,remove,requires,usedBy,canDelete,assertCanDelete,clearAsset});
}
