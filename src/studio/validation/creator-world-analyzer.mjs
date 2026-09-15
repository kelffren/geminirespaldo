/* KELO-INDEX
 * area: STUDIO / CREATOR MAP HEALTH
 * owns: creator-facing structural validation and transparent map counts
 * does-not-own: publish approval or invented performance limits
 * public-api: analyzeCreatorWorld()
 * online: local advisory; server publish validator remains canonical
 */

export function analyzeCreatorWorld({document,prefabs}={}){
  if(!document)throw new Error('STUDIO_ANALYZER_DOCUMENT_REQUIRED');
  const errors=[],warnings=[],ids=new Set(),chunkSize=Math.max(64,Number(document.settings?.chunkSize)||512),chunks=new Map();
  const componentCounts={interactive:0,animated:0,ai:0,particles:0};
  const entities=Array.isArray(document.entities)?document.entities:[];
  for(const [index,e] of entities.entries()){
    const id=String(e?.id||'');
    if(!id)errors.push({code:'ENTITY_ID_MISSING',message:`Objeto #${index+1} no tiene ID.`});
    else if(ids.has(id))errors.push({code:'ENTITY_ID_DUPLICATE',message:`ID duplicado: ${id}`});else ids.add(id);
    if(!e?.prefabId)errors.push({code:'PREFAB_MISSING',message:`${id||`Objeto #${index+1}`} no tiene prefab.`});
    else if(prefabs?.has&&!prefabs.has(e.prefabId))warnings.push({code:'PREFAB_UNRESOLVED',message:`${id}: prefab ${e.prefabId} no está en el registro local.`});
    const x=Number(e?.transform?.x),y=Number(e?.transform?.y);if(!Number.isFinite(x)||!Number.isFinite(y))errors.push({code:'POSITION_INVALID',message:`${id||`Objeto #${index+1}`} tiene posición inválida.`});
    const key=`${Math.floor((Number.isFinite(x)?x:0)/chunkSize)},${Math.floor((Number.isFinite(y)?y:0)/chunkSize)}`;chunks.set(key,(chunks.get(key)||0)+1);
    const c=e?.components||{};if(c.interaction||c.container||c.craftingStation||c.door)componentCounts.interactive++;if(c.animation||c.animated)componentCounts.animated++;if(c.ai||c.npc||c.spawner)componentCounts.ai++;if(c.particles||c.particleEmitter)componentCounts.particles++;
  }
  const collisions=Object.values(document.navigation?.collisions||{});for(const c of collisions){if(!(Number(c?.w)>0&&Number(c?.h)>0))errors.push({code:'COLLISION_INVALID',message:`Colisión ${c?.collisionId||c?.id||'?'} tiene tamaño inválido.`});}
  const terrainCount=Object.keys(document.terrain||{}).length;
  const budget=document.performanceBudget&&typeof document.performanceBudget==='object'?document.performanceBudget:{};
  const budgetChecks=[];for(const [key,value] of Object.entries({objects:entities.length,interactive:componentCounts.interactive,animated:componentCounts.animated,ai:componentCounts.ai,particles:componentCounts.particles})){const limit=Number(budget[key]);if(Number.isFinite(limit)&&limit>0){const used=Number(value)||0;budgetChecks.push({key,used,limit,ratio:used/limit});if(used>limit)errors.push({code:'BUDGET_EXCEEDED',message:`${key}: ${used}/${limit} supera el presupuesto configurado.`});else if(used>limit*.85)warnings.push({code:'BUDGET_NEAR_LIMIT',message:`${key}: ${used}/${limit} está cerca del límite.`});}}
  return Object.freeze({ok:errors.length===0,errors,warnings,counts:{objects:entities.length,surface:terrainCount,collisions:collisions.length,chunks:chunks.size,...componentCounts},performance:{measured:budgetChecks.length>0,budgets:budgetChecks,notice:budgetChecks.length?'Comparado con el presupuesto configurado del proyecto.':'Sin presupuesto medido configurado: se muestran conteos, no una puntuación inventada.'}});
}
