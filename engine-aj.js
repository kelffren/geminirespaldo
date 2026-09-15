(function () {
  // Solo limpia obstáculos duplicados. El anti-jitter bloqueaba el movimiento.
  const collision=window.KELO_COLLISION;
  if(!collision||typeof collision.remove!=='function') throw new Error('KELO_COLLISION unavailable before engine-aj');
  const seen = {};
  const removals=[];
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    const k = Math.round(o.x) + ':' + Math.round(o.y);
    if (seen[k]) {
      const owner=String(o?._keloCollisionOwner||'');const id=String(o?.id||'');
      if(owner&&id)removals.push({owner,id});
      else console.warn('[engine-aj] duplicate collider has no owner/id; leaving it untouched',o);
    } else seen[k] = true;
  }
  for(const item of removals)collision.remove(item.owner,item.id);
  window.KELO_ENGINE_AJ_COLLISION_AUDIT=Object.freeze({removed:removals.length,mutationMode:'collision-owner-registry-v1'});
})();
