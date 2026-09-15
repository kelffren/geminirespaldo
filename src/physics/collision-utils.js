/* KELO-INDEX
 * area: PHYSICS / COLLISION
 * owner: KELO_COLLISION
 * keys: GEOMETRY COLLIDER OWNERSHIP LIFECYCLE LEGACY VIEW
 * purpose: primitives de colisión + registro único owner->colliders; obstacles queda como vista legacy
 * public-api: resolveCircleAABB, segmentAabbHitT, attachLegacyObstacleArray, replaceOwner, upsert, remove, clearOwner, ownerSnapshot
 * reuse: cada sistema publica su set de colliders por owner; no mutar obstacles directamente
 * do-not: NO crear arrays paralelos de colisión ni borrar colliders ajenos
 */
(function(root,factory){
  const api=factory();
  if(root) root.KELO_COLLISION=api;
  if(typeof module==='object'&&module.exports) module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const ownerBuckets=new Map();
  let legacyArray=null;
  let sequence=1;

  function resolveCircleAABB(cx,cy,r,box){
    const closestX=Math.max(box.x,Math.min(cx,box.x+box.w));
    const closestY=Math.max(box.y,Math.min(cy,box.y+box.h));
    const distX=cx-closestX,distY=cy-closestY,distSq=distX*distX+distY*distY;
    if(distSq<r*r&&distSq>0){
      const dist=Math.sqrt(distSq),overlap=r-dist;
      return{collided:true,pushX:(distX/dist)*overlap,pushY:(distY/dist)*overlap};
    }
    if(distSq===0){
      const left=cx-box.x,right=box.x+box.w-cx,top=cy-box.y,bottom=box.y+box.h-cy;
      const min=Math.min(left,right,top,bottom);
      if(min===left)return{collided:true,pushX:-(left+r),pushY:0};
      if(min===right)return{collided:true,pushX:right+r,pushY:0};
      if(min===top)return{collided:true,pushX:0,pushY:-(top+r)};
      return{collided:true,pushX:0,pushY:bottom+r};
    }
    return{collided:false,pushX:0,pushY:0};
  }

  function segmentAabbHitT(x0,y0,x1,y1,box,padding){
    const p=Math.max(0,Number(padding)||0);
    const minX=box.x-p,maxX=box.x+box.w+p,minY=box.y-p,maxY=box.y+box.h+p;
    const dx=x1-x0,dy=y1-y0;
    let tMin=0,tMax=1;
    function axis(origin,delta,min,max){
      if(Math.abs(delta)<1e-12)return origin>=min&&origin<=max;
      let a=(min-origin)/delta,b=(max-origin)/delta;
      if(a>b){const tmp=a;a=b;b=tmp;}
      tMin=Math.max(tMin,a);tMax=Math.min(tMax,b);
      return tMin<=tMax;
    }
    if(!axis(x0,dx,minX,maxX)||!axis(y0,dy,minY,maxY))return null;
    return tMin>=0&&tMin<=1?tMin:null;
  }

  function ownerId(value){
    const id=String(value||'').trim();
    if(!id)throw new Error('KELO_COLLISION_OWNER_REQUIRED');
    return id;
  }

  function colliderId(raw,index){
    const id=String(raw?.collisionId||raw?.id||`collider-${index??sequence++}`);
    if(!id)throw new Error('KELO_COLLISION_ID_REQUIRED');
    return id;
  }

  function normalize(owner,raw,index){
    if(!raw||typeof raw!=='object')throw new Error('KELO_COLLISION_INVALID_COLLIDER');
    const x=Number(raw.x),y=Number(raw.y),w=Number(raw.w),h=Number(raw.h);
    if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(w)||!Number.isFinite(h)||w<0||h<0)throw new Error('KELO_COLLISION_INVALID_RECT');
    const id=colliderId(raw,index);
    return Object.assign({},raw,{id,x,y,w,h,_keloCollisionOwner:owner,_keloCollisionKey:`${owner}:${id}`});
  }

  function bucket(owner,create){
    owner=ownerId(owner);
    let b=ownerBuckets.get(owner);
    if(!b&&create){b=new Map();ownerBuckets.set(owner,b);}
    return b||null;
  }

  function syncOwner(owner){
    owner=ownerId(owner);
    if(!legacyArray)return;
    for(let i=legacyArray.length-1;i>=0;i--)if(legacyArray[i]?._keloCollisionOwner===owner)legacyArray.splice(i,1);
    const b=ownerBuckets.get(owner);
    if(!b)return;
    for(const rec of b.values())legacyArray.push(rec);
  }

  function attachLegacyObstacleArray(array,options){
    if(!Array.isArray(array))throw new Error('KELO_COLLISION_LEGACY_ARRAY_REQUIRED');
    if(legacyArray&&legacyArray!==array)throw new Error('KELO_COLLISION_LEGACY_ARRAY_ALREADY_ATTACHED');
    legacyArray=array;
    const adopt=options?.adoptExistingOwner;
    if(adopt){
      const owner=ownerId(adopt),b=bucket(owner,true);
      for(let i=0;i<legacyArray.length;i++){
        const raw=legacyArray[i];
        if(!raw||raw._keloCollisionOwner)continue;
        const rec=normalize(owner,raw,i);
        Object.assign(raw,rec);
        b.set(rec.id,raw);
      }
    }
    for(const owner of ownerBuckets.keys())syncOwner(owner);
    return legacyArray;
  }

  function replaceOwner(owner,colliders){
    owner=ownerId(owner);
    const list=Array.isArray(colliders)?colliders:[];
    const b=new Map();
    list.forEach((raw,index)=>{const rec=normalize(owner,raw,index);b.set(rec.id,rec);});
    ownerBuckets.set(owner,b);
    syncOwner(owner);
    return b.size;
  }

  function upsert(owner,raw){
    owner=ownerId(owner);
    const b=bucket(owner,true),rec=normalize(owner,raw,b.size);
    b.set(rec.id,rec);syncOwner(owner);return rec.id;
  }

  function remove(owner,id){
    owner=ownerId(owner);id=String(id||'');
    const b=ownerBuckets.get(owner);if(!b)return false;
    const removed=b.delete(id);if(!b.size)ownerBuckets.delete(owner);syncOwner(owner);return removed;
  }

  function clearOwner(owner){
    owner=ownerId(owner);const had=ownerBuckets.delete(owner);syncOwner(owner);return had;
  }

  function ownerSnapshot(owner){
    if(owner!=null){const id=ownerId(owner),b=ownerBuckets.get(id);return{owner:id,count:b?b.size:0,ids:b?Array.from(b.keys()):[]};}
    const owners={};let total=0;
    for(const [id,b] of ownerBuckets){owners[id]=b.size;total+=b.size;}
    return{version:'collision-owner-v2.0.0',legacyAttached:!!legacyArray,ownerCount:ownerBuckets.size,total,owners};
  }

  return Object.freeze({
    version:'collision-owner-v2.0.0',
    resolveCircleAABB,segmentAabbHitT,
    attachLegacyObstacleArray,replaceOwner,upsert,remove,clearOwner,ownerSnapshot
  });
});