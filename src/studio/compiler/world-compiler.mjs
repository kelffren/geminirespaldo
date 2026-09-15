/* KELO-INDEX
 * area: STUDIO / COMPILER
 * owns: deterministic authoring -> runtime projection
 * does-not-own: renderer, UI, persistence, gameplay authority
 * public-api: createWorldCompiler()
 * online: pure output can be validated server-side
 */

const clone = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
const chunkKey = (x, y, chunkSize) => `${Math.floor(x / chunkSize)},${Math.floor(y / chunkSize)}`;
const scaleOf = value => { const n=Number(value); return Math.max(.1,Math.min(8,Number.isFinite(n)?n:1)); };
const rectOf = entity => { const s=scaleOf(entity.transform?.scale); return { x: Number(entity.transform?.x) || 0, y: Number(entity.transform?.y) || 0, w: Math.max(1, (Number(entity.bounds?.w) || 1)*s), h: Math.max(1, (Number(entity.bounds?.h) || 1)*s) }; };

function colliderRect(entityRect, collider, scale=1) {
  const local = collider?.rect;
  if (!local) return clone(entityRect);
  const s=scaleOf(scale),lw=Number(local.w),lh=Number(local.h);
  return { x: entityRect.x + (Number(local.x) || 0)*s, y: entityRect.y + (Number(local.y) || 0)*s, w: Math.max(1, Number.isFinite(lw)&&lw>0?lw*s:entityRect.w), h: Math.max(1, Number.isFinite(lh)&&lh>0?lh*s:entityRect.h) };
}
function terrainRow(key, source) {
  const [kx,ky]=String(key).split(',').map(Number), rec=typeof source==='string'?{material:source}:source||{};
  return { key:String(key), x:Number.isFinite(Number(rec.x))?Number(rec.x):(Number(kx)||0), y:Number.isFinite(Number(rec.y))?Number(rec.y):(Number(ky)||0), material:String(rec.material||''), role:rec.role==='path'?'path':'terrain' };
}

export function createWorldCompiler({ resolvePrefab = id => ({ id }) } = {}) {
  function compile(document, { onlyChunks = null } = {}) {
    const chunkSize = Math.max(64, Number(document.settings?.chunkSize) || 512);
    const allow = onlyChunks ? new Set(onlyChunks.map(x => typeof x === 'string' ? x : x.id)) : null;
    const chunks = new Map(), dynamicEntities = [], interactables = [], colliders = [], worldColliders = [], dependencies = new Set(document.dependencies || []);
    const ensureChunk = ck => { if(!chunks.has(ck))chunks.set(ck,{id:ck,staticEntities:[],dynamicEntities:[],terrainCells:[]});return chunks.get(ck); };
    for (const source of document.entities || []) {
      const entity = clone(source), rect = rectOf(entity), ck = chunkKey(rect.x, rect.y, chunkSize);
      if (allow && !allow.has(ck)) continue;
      const prefab = entity.prefabId ? resolvePrefab(entity.prefabId) : null;
      if (entity.prefabId) dependencies.add(entity.prefabId);
      const components = { ...(prefab?.components || {}), ...(entity.components || {}) };
      const runtime = { id: entity.id, prefabId: entity.prefabId || null, transform: clone(entity.transform || {}), bounds: rect, components };
      const chunk=ensureChunk(ck);
      const isDynamic = Boolean(components.animation || components.ai || components.interaction || components.spawner || components.door || components.growZone);
      (isDynamic ? chunk.dynamicEntities : chunk.staticEntities).push(runtime);
      if (isDynamic) dynamicEntities.push(runtime);
      if (components.interaction || components.container || components.craftingStation) interactables.push(runtime.id);
      if (components.collider) colliders.push({ id: runtime.id, rect: colliderRect(rect, components.collider, entity.transform?.scale), blocksMovement: components.collider.blocksMovement !== false });
    }
    for(const [key,source] of Object.entries(document.terrain||{})){
      const row=terrainRow(key,source);if(!row.material)continue;const ck=chunkKey(row.x,row.y,chunkSize);if(allow&&!allow.has(ck))continue;ensureChunk(ck).terrainCells.push(row);
    }
    for(const source of Object.values(document.navigation?.collisions||{})){
      const row=source||{},id=String(row.collisionId||row.id||'');if(!id)continue;const ck=chunkKey(Number(row.x)||0,Number(row.y)||0,chunkSize);if(allow&&!allow.has(ck))continue;
      worldColliders.push({id,rect:{x:Number(row.x)||0,y:Number(row.y)||0,w:Math.max(1,Number(row.w)||1),h:Math.max(1,Number(row.h)||1)},blocksMovement:row.blocksMovement!==false,label:String(row.label||'')});
    }
    const sortedChunks = [...chunks.values()].sort((a, b) => a.id.localeCompare(b.id));
    for (const c of sortedChunks) { c.staticEntities.sort((a, b) => a.id.localeCompare(b.id)); c.dynamicEntities.sort((a, b) => a.id.localeCompare(b.id)); c.terrainCells.sort((a,b)=>a.key.localeCompare(b.key)); }
    return { schemaVersion: 1, worldId: document.worldId, chunkSize, chunks: sortedChunks, dynamicEntityIds: dynamicEntities.map(x => x.id).sort(), interactableIds: interactables.sort(), colliders: colliders.sort((a, b) => a.id.localeCompare(b.id)), worldColliders: worldColliders.sort((a,b)=>a.id.localeCompare(b.id)), dependencies: [...dependencies].sort(), gameRules: clone(document.gameRules || {}), generatedFromRevision: clone(document.revision || null) };
  }
  return Object.freeze({ compile });
}
