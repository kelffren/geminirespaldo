/* KELO-INDEX
 * area: STUDIO / RUNTIME DIFF
 * owns: incremental diff between compiled RuntimeWorldBundles
 * does-not-own: renderer/collider application
 * public-api: diffRuntimeBundles()
 * online: no
 */

const signature = value => JSON.stringify(value ?? null);
const byId = rows => new Map((rows || []).map(row => [String(row.id), row]));
function diffRows(previousRows,nextRows){const prev=byId(previousRows),next=byId(nextRows),upsert=[],remove=[];for(const [id,row] of next)if(!prev.has(id)||signature(prev.get(id))!==signature(row))upsert.push(row);for(const id of prev.keys())if(!next.has(id))remove.push(id);return{upsert,remove:remove.sort()};}

export function diffRuntimeBundles(previous, next) {
  const prevChunks = byId(previous?.chunks), nextChunks = byId(next?.chunks), upsertChunks = [], removeChunkIds = [];
  for (const [id, row] of nextChunks) if (!prevChunks.has(id) || signature(prevChunks.get(id)) !== signature(row)) upsertChunks.push(row);
  for (const id of prevChunks.keys()) if (!nextChunks.has(id)) removeChunkIds.push(id);

  const entityCollisionDiff=diffRows(previous?.colliders,next?.colliders),worldCollisionDiff=diffRows(previous?.worldColliders,next?.worldColliders);
  const prevDeps = new Set(previous?.dependencies || []), nextDeps = new Set(next?.dependencies || []);
  return {
    worldId: next?.worldId || previous?.worldId || null,
    upsertChunks,
    removeChunkIds: removeChunkIds.sort(),
    upsertColliders: entityCollisionDiff.upsert,
    removeColliderIds: entityCollisionDiff.remove,
    upsertWorldColliders: worldCollisionDiff.upsert,
    removeWorldColliderIds: worldCollisionDiff.remove,
    addDependencies: [...nextDeps].filter(id => !prevDeps.has(id)).sort(),
    removeDependencies: [...prevDeps].filter(id => !nextDeps.has(id)).sort()
  };
}
