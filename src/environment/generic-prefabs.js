(function(){
  'use strict';
  const C=window.KELO_PREFAB_CONTRACT;
  const L=window.KELO_ENVIRONMENT_LAYERS;
  const A=window.KELO_ATLAS_CONTRACT;
  const collision=window.KELO_COLLISION;
  const COLLISION_OWNER='environment:generic-prefabs';
  if(!C||!L||typeof L.register!=='function'||!A||typeof A.acquire!=='function'||!collision||typeof collision.replaceOwner!=='function'){
    console.error('[Kelo generic prefabs] contract/layer stack/atlas/collision owner missing');return;
  }

  const images=new Map(),readyAssets=new Set();let failed=false,installed=false;
  const audit=window.KELO_PREFAB_AUDIT={version:'generic-prefabs-v1.4',contractVersion:C.version,ready:false,failed:false,
    rendererMode:'data-driven-prefabs-v2',resourceMode:'atlas-contract-managed-v1',prefabCount:C.prefabs.length,assetCount:Object.keys(C.assets).length,
    decorationReset:window.KELO_WORLD_DECORATION_RESET===true,registeredColliderCount:0,collisionOwner:COLLISION_OWNER,backDrawCount:0,frontDrawCount:0,frontOcclusionDrawCount:0,layerCount:0,
    renderPartCount:C.prefabs.reduce((n,p)=>n+(p.renderPlan?.parts?.length||0),0),bootstrapMode:'collision-owner-immediate-v1'};

  function geometry(p){return{x:p.position.x,y:p.position.y,w:p.size.w,h:p.size.h};}
  function partGeometry(p,part){return{x:p.position.x+part.offset.x,y:p.position.y+part.offset.y,w:part.size.w,h:part.size.h};}
  function drawPart(g,p,part){
    if(window.KELO_WORLD_DECORATION_RESET===true)return false;
    const img=images.get(part.asset);if(!img||!readyAssets.has(part.asset))return false;
    const d=partGeometry(p,part),s=part.source;
    const prev=g.globalAlpha;g.globalAlpha=prev*part.opacity;
    g.drawImage(img,s.x,s.y,s.w,s.h,d.x,d.y,d.w,d.h);
    g.globalAlpha=prev;return true;
  }
  function actorList(){const out=[];if(typeof localPlayer!=='undefined'&&localPlayer)out.push(localPlayer);if(typeof simulatedPlayers!=='undefined'&&Array.isArray(simulatedPlayers))out.push(...simulatedPlayers);if(typeof isPvPActive!=='undefined'&&isPvPActive&&typeof arenaPvP!=='undefined'&&arenaPvP?.rival)out.push(arenaPvP.rival);return out;}
  function actorBehind(p,actor){
    const o=p.occlusion,c=p.collider,b=p.visualBounds,r=actor?.radius||20;if(!o||!actor)return false;
    const bottom=c?c.y+c.h:b.y+b.h;
    return actor.x+r>b.x+(o.sideInset||0)&&actor.x-r<b.x+b.w-(o.sideInset||0)&&actor.y>b.y+(o.topInset||0)&&actor.y<bottom+(o.bottomPadding||0);
  }
  function drawPhaseParts(g,p,phase){if(window.KELO_WORLD_DECORATION_RESET===true)return 0;let count=0;for(const part of p.renderPlan?.parts||[])if(part.phase===phase&&drawPart(g,p,part))count++;return count;}
  function drawBack(g){if(failed||window.KELO_WORLD_DECORATION_RESET===true)return;let count=0;g.save();g.imageSmoothingEnabled=false;for(const p of C.prefabs)count+=drawPhaseParts(g,p,'props_back');g.restore();audit.backDrawCount=count;}
  function drawFront(g){
    if(failed||window.KELO_WORLD_DECORATION_RESET===true)return;let front=0,clips=0;g.save();g.imageSmoothingEnabled=false;
    for(const p of C.prefabs){
      front+=drawPhaseParts(g,p,'props_front');
      if(p.renderPlan?.occlusionFallback!=='clip-redraw-back-v1')continue;
      const clip=p.occlusion?.clip;if(!clip)continue;
      for(const actor of actorList()){
        if(!actorBehind(p,actor))continue;const r=actor.radius||20;g.save();g.beginPath();g.rect(actor.x-r-(clip.xPadding||0),actor.y-r-(clip.topPadding||0),r*2+(clip.xPadding||0)*2,r*2+(clip.topPadding||0)+(clip.bottomPadding||0));g.clip();
        for(const part of p.renderPlan?.back||[])if(drawPart(g,p,part))clips++;
        g.restore();
      }
    }
    g.restore();audit.frontDrawCount=front;audit.frontOcclusionDrawCount=clips;
  }
  function bounds(){return window.KELO_WORLD_DECORATION_RESET===true?[]:C.prefabs.map(p=>({id:p.id,...p.visualBounds}));}
  function registerColliders(){
    if(window.KELO_WORLD_DECORATION_RESET===true){collision.clearOwner(COLLISION_OWNER);audit.registeredColliderCount=0;return 0;}
    const colliders=[];
    for(const p of C.prefabs){
      const c=p.collider;if(!c)continue;
      colliders.push({id:p.id,x:c.x,y:c.y,w:c.w,h:c.h,noDraw:c.noDraw!==false,_genericPrefabCollision:true,_genericPrefabCollisionFor:p.id});
    }
    collision.replaceOwner(COLLISION_OWNER,colliders);
    audit.registeredColliderCount=collision.ownerSnapshot(COLLISION_OWNER).count;
    return audit.registeredColliderCount;
  }
  function installLayers(){
    if(installed)return true;
    for(const [key,group] of Object.entries(C.layerGroups||{})){
      const ps=C.prefabs.filter(p=>p.layerGroup===key);if(!ps.length)continue;
      const priority=Math.max(group.priority||0,...ps.map(p=>p.priority||0));
      if(group.back){L.register({id:`${group.id}-back`,phase:group.back.phase,priority,required:true,ready:()=>audit.ready,draw:drawBack,ownership:group.ownership,bounds});audit.layerCount++;}
      if(group.front){L.register({id:`${group.id}-front`,phase:group.front.phase,priority,required:true,ready:()=>audit.ready,draw:drawFront,ownership:group.ownership,bounds});audit.layerCount++;}
    }
    installed=true;registerColliders();return true;
  }
  function getEntry(key){const p=C.prefabs.find(x=>x.key===key||x.id===key);if(!p)return null;return Object.freeze({key:p.key,prefab:p,asset:C.assets[p.asset],geometry:Object.freeze(geometry(p)),renderPlan:p.renderPlan,isOccluding(actor){return actorBehind(p,actor);},get ready(){return readyAssets.has(p.asset);},get failed(){return failed;}});}

  window.KELO_PREFAB_RENDERER=Object.freeze({version:'generic-prefabs-v1.4',mode:'data-driven-prefabs-v2',resourceMode:'atlas-contract-managed-v1',collisionOwner:COLLISION_OWNER,getEntry,ensureColliders:registerColliders,get ready(){return audit.ready&&!audit.failed;},get failed(){return audit.failed;}});
  const entries=Object.entries(C.assets).filter(([,a])=>a?.src);
  if(!entries.length)audit.ready=true;
  for(const [id] of entries){
    A.acquire(id).then(img=>{images.set(id,img);readyAssets.add(id);if(readyAssets.size===entries.length)audit.ready=true;}).catch(err=>{failed=true;audit.failed=true;console.error('[Kelo generic prefabs] managed asset load failed',id,err);});
  }

  try{installLayers();}catch(err){failed=true;audit.failed=true;console.error('[Kelo generic prefabs] install failed',err);}
})();