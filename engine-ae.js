(function () {
  const collision=window.KELO_COLLISION;
  if(!collision||typeof collision.remove!=='function'||typeof collision.replaceOwner!=='function') throw new Error('KELO_COLLISION unavailable before engine-ae');
  const T = window.KELO_TILE || 32;
  const OX = 1024, OY = 1216;
  const BUILDING_OWNER='legacy:engine-ae-buildings';
  window._keloFrame = 0;
  const DOOR_GAP = 32;

  function removeOwnedWhere(predicate,label){
    if(!Array.isArray(obstacles))return 0;
    const removals=[];
    for(const o of obstacles){
      if(!o||!predicate(o))continue;
      const owner=String(o._keloCollisionOwner||'');const id=String(o.id||'');
      if(owner&&id)removals.push({owner,id});
      else console.warn('[engine-ae] unowned legacy collider cannot be removed safely',label,o);
    }
    for(const item of removals)collision.remove(item.owner,item.id);
    return removals.length;
  }

  removeOwnedWhere(function(o){
    return (o.x === 1150 && o.y === 1400) || (o.x === 1530 && o.y === 1400) ||
      (o.x === 1300 && o.y === 1250) || (o.x === 1300 && o.y === 1870);
  },'plaza-placeholder');

  for (const o of obstacles) if(o) o.noDraw = true;

  const buildings = [
    { id:'engine-ae-building-0', x: OX + 4 * T, y: OY + 2 * T, w: 5 * T, h: 3 * T - DOOR_GAP, noDraw: true },
    { id:'engine-ae-building-1', x: OX + 20 * T, y: OY + 5 * T, w: 4 * T, h: 3 * T - DOOR_GAP, noDraw: true },
    { id:'engine-ae-building-2', x: OX + 2 * T, y: OY + 8 * T, w: 4 * T, h: 3 * T - DOOR_GAP, noDraw: true },
    { id:'engine-ae-building-3', x: OX + 18 * T, y: OY + 14 * T, w: 5 * T, h: 3 * T - DOOR_GAP, noDraw: true, _cafe: true }
  ];

  removeOwnedWhere(function(o){
    if(o._keloCollisionOwner===BUILDING_OWNER)return false;
    return buildings.some(function(b){return Math.abs(o.x-b.x)<8&&Math.abs(o.y-b.y)<8;});
  },'building-duplicate');
  collision.replaceOwner(BUILDING_OWNER,buildings);
  window.KELO_ENGINE_AE_COLLISION_AUDIT=Object.freeze({owner:BUILDING_OWNER,count:buildings.length,mutationMode:'collision-owner-registry-v1'});

  if(!window.KeloRender) throw new Error('KeloRender unavailable before engine-ae');
  window.KeloRender.beforeFrame('engine-ae:frame-counter', function () {
    window._keloFrame = (window._keloFrame || 0) + 1;
  }, 5);
})();
