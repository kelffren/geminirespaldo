/* KELO-INDEX
 * area: WORLD BUILDER
 * keys: COLLISION BIND PLACEMENT FOOTPRINT MOVE REMOVE ONLINE
 * hace: cada prop tiene una colisión hija; al mover/recoger se actualiza o se borra
 * online: solo request(); mapa local de ids
 */
(function(){
  'use strict';
  if(window.KELO_BUILDER_COLLISION_BIND)return;
  const STORE='kelo-builder-col-bind-v1';
  const TILE=32;
  let map={};
  let wrapped=false;
  try{map=JSON.parse(localStorage.getItem(STORE)||'{}')||{};}catch(e){map={};}
  function save(){try{localStorage.setItem(STORE,JSON.stringify(map));}catch(e){}}
  function actor(){return String(window.keloNet?.playerKey||window.KELO_ADMIN_KEYS?.playerId?.()||'local_pioneer');}
  function template(assetId){return window.KELO_PROPERTY_CATALOG?.get?.(assetId)||null;}
  function box(assetId,x,y,rot){
    const t=template(assetId)||{};
    const fp=t.footprint||{x:0,y:0,w:t.width||TILE,h:Math.max(16,(t.height||TILE)*0.28)};
    const w=Number(fp.w)||TILE,h=Number(fp.h)||16;
    const ox=Number(fp.x)||0,oy=Number(fp.y)||Math.max(0,(t.height||h)-h);
    const q=(Number(rot)||0)%4;
    if(q%2)return{x:Number(x)+oy,y:Number(y)+ox,w:h,h:w};
    return{x:Number(x)+ox,y:Number(y)+oy,w:w,h:h};
  }
  function idOf(out){return out?.collisionId||out?.id||out?.collision?.collisionId||null;}
  function placeId(out,payload){return out?.placementId||out?.placement?.placementId||payload?.placementId||null;}

  async function attach(placementId,assetId,x,y,rot){
    if(!placementId||map[placementId])return map[placementId]||null;
    const b=box(assetId,x,y,rot);
    const E=window.KELO_WORLD_EDIT||window.KELO_WORLD_BUILDER;
    const req=E?.request;if(!req)return null;
    try{
      const col=await req.call(E,E===window.KELO_WORLD_BUILDER?'world-builder:collision-create':'world:collision:create',Object.assign({actorId:actor()},b));
      const cid=idOf(col);
      if(cid){map[placementId]=cid;save();}
      return cid||null;
    }catch(e){return null;}
  }
  async function follow(placementId,assetId,x,y,rot){
    const cid=map[placementId];if(!cid)return attach(placementId,assetId,x,y,rot);
    const b=box(assetId,x,y,rot);
    const E=window.KELO_WORLD_EDIT||window.KELO_WORLD_BUILDER;
    const req=E?.request;if(!req)return cid;
    try{
      if(E===window.KELO_WORLD_BUILDER)await req.call(E,'world-builder:collision-move',Object.assign({actorId:actor(),collisionId:cid},b));
      else await req.call(E,'world:collision:update',Object.assign({actorId:actor(),collisionId:cid},b));
    }catch(e){}
    return cid;
  }
  async function detach(placementId){
    const cid=map[placementId];if(!cid)return;
    const E=window.KELO_WORLD_EDIT||window.KELO_WORLD_BUILDER;
    const req=E?.request;
    try{
      if(E===window.KELO_WORLD_BUILDER)await req.call(E,'world-builder:collision-remove',{actorId:actor(),collisionId:cid});
      else await req.call(E,'world:collision:remove',{actorId:actor(),collisionId:cid});
    }catch(e){}
    delete map[placementId];save();
  }

  function wrap(){
    const E=window.KELO_WORLD_EDIT;if(!E?.request||E.__colBound)return;
    const raw=E.request.bind(E);
    async function request(op,payload){
      const data=payload||{};
      const out=await raw(op,data);
      if(data.skipAutoCollision)return out;
      try{
        if(op==='world:placement:create'){
          const pid=placeId(out,data);
          await attach(pid,data.assetId,data.x,data.y,data.rotation||0);
        }
        if(op==='world:placement:move'){
          const rec=out?.placement||out;
          await follow(data.placementId,rec?.assetId,data.x,data.y,rec?.rotation||0);
        }
        if(op==='world:placement:rotate'){
          const rec=out?.placement||out;
          if(rec)await follow(data.placementId,rec.assetId,rec.x,rec.y,rec.rotation||0);
        }
        if(op==='world:placement:remove')await detach(data.placementId);
      }catch(e){}
      return out;
    }
    window.KELO_WORLD_EDIT=Object.assign({},E,{request,__colBound:true});
    wrapped=true;
  }
  function wrapProp(){
    const S=window.KELO_PROPERTY_SYSTEM;if(!S?.request||S.__colBound)return;
    const raw=S.request.bind(S);
    async function request(op,payload){
      const data=payload||{};
      const out=await raw(op,data);
      if(data.skipAutoCollision)return out;
      try{
        if(op==='place')await attach(out?.placementId,data.assetId,data.x,data.y,data.rotation||0);
        if(op==='move')await follow(data.placementId,out?.assetId,data.x,data.y,out?.rotation||0);
        if(op==='rotate')await follow(data.placementId,out?.assetId,out?.x,out?.y,out?.rotation||0);
        if(op==='remove')await detach(data.placementId);
      }catch(e){}
      return out;
    }
    window.KELO_PROPERTY_SYSTEM=Object.assign({},S,{request,__colBound:true});
  }

  const t=setInterval(()=>{wrap();wrapProp();},150);
  setTimeout(()=>clearInterval(t),20000);
  window.KELO_BUILDER_COLLISION_BIND=Object.freeze({
    version:'builder-col-bind-v1.0.0',
    map:()=>Object.assign({},map),
    attach,follow,detach
  });
})();
