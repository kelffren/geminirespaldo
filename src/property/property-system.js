/* KELO-INDEX
 * area: PROPERTY
 * keys: PARCEL PLACEMENT OWNERSHIP UNITS AUTHORITY RENDER COLLISION PREVIEW
 * hace: autoridad local reemplazable, balances por unidad, colocaciones y render dinámico de parcelas
 * online: UI solo llama request(); installRemoteAdapter permite sustituir localStorage por servidor sin cambiar UI
 * collision: publica el set property:placements mediante KELO_COLLISION; no muta obstacles
 * public-api: KELO_PROPERTY_SYSTEM.drawPlacements() reutiliza el mismo renderer para previews read-only sin mutar state
 */
(function(){
  'use strict';
  const C=window.KELO_PROPERTY_CATALOG,L=window.KELO_ENVIRONMENT_LAYERS,A=window.KELO_ATLAS_CONTRACT,K=window.KELO_COLLISION;
  if(!C||!L||typeof L.register!=='function'||!A||typeof A.acquire!=='function'){console.error('[Kelo property] catalog/layers/atlas missing');return;}
  const STORAGE='kelo_property_state_v1';
  const SCHEMA=1;
  const COLLISION_OWNER='property:placements';
  const images=new Map();
  const readyAssets=new Set();
  const listeners=new Set();
  let remoteAdapter=null,seq=1;
  const playerId=()=>String(window.keloNet?.playerKey||window.localPlayer?.id||'local_pioneer');
  const clone=v=>JSON.parse(JSON.stringify(v));
  const fresh=()=>({schema:SCHEMA,revision:0,parcels:{},balances:{},placements:[]});
  function load(){try{const raw=JSON.parse(localStorage.getItem(STORAGE)||'null');return raw&&raw.schema===SCHEMA&&raw.parcels&&raw.balances&&Array.isArray(raw.placements)?raw:fresh();}catch(e){return fresh();}}
  let state=load();
  function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(e){};listeners.forEach(fn=>{try{fn(snapshot());}catch(err){}});syncColliders();}
  function bump(){state.revision=(Number(state.revision)||0)+1;persist();}
  function id(prefix){return `${prefix}:${Date.now().toString(36)}:${(seq++).toString(36)}`;}
  function snapshot(){return clone(state);}
  function parcel(pid){return state.parcels[String(pid)]||null;}
  function owned(owner,assetId){return Math.max(0,Math.floor(Number(state.balances?.[owner]?.[assetId])||0));}
  function deployed(owner,assetId,ignorePlacementId){return state.placements.reduce((n,p)=>n+(p.ownerId===owner&&p.assetId===assetId&&p.placementId!==ignorePlacementId?1:0),0);}
  function available(owner,assetId,ignorePlacementId){return Math.max(0,owned(owner,assetId)-deployed(owner,assetId,ignorePlacementId));}
  function normalizeScale(v){const n=Number(v);return Math.max(.1,Math.min(8,Number.isFinite(n)?Math.round(n*100)/100:1));}
  function rotatedSize(t,q,scale=1){q=((Math.floor(Number(q)||0)%4)+4)%4;const s=normalizeScale(scale),w=t.width*s,h=t.height*s;return(q%2)?{w:h,h:w}:{w,h};}
  function snap(v,s){return Math.round((Number(v)||0)/s)*s;}
  function within(b,x,y,w,h){return x>=b.x&&y>=b.y&&x+w<=b.x+b.w&&y+h<=b.y+b.h;}
  function canEdit(p,owner){return !!p&&(p.kind==='world_editor'||p.ownerId===owner);}
  function currentHouseInstance(){const i=window.KELO_INSTANCES?.current?.();return i&&i.type==='house'?i:null;}
  function placementVisible(rec){const p=parcel(rec.parcelId),i=currentHouseInstance();return i?(p?.kind==='house'&&p.houseId===i.resourceId):(p?.kind!=='house');}
  function isHouseMutation(op,data){if(!['place','move','rotate','scale','remove'].includes(op))return false;let p=null;if(op==='place')p=parcel(data?.parcelId);else{const rec=state.placements.find(x=>x.placementId===data?.placementId);p=rec&&parcel(rec.parcelId);}return p?.kind==='house';}

  // KELO-INDEX PROPERTY/AUTHORITY operación única de mutación: mañana el servidor implementa la misma boca.
  async function localRequest(op,payload){
    const data=payload||{},owner=String(data.ownerId||playerId());
    if(op==='snapshot')return snapshot();
    if(op==='ensureLegacyParcel'){
      const hi=currentHouseInstance();
      if(hi){
        const pid=String(hi.parcelId||`parcel:house:${hi.resourceId}`),b=hi.config?.bounds||{x:0,y:0,w:768,h:544};
        if(!state.parcels[pid]){state.parcels[pid]={parcelId:pid,ownerId:String(hi.ownerId||owner),kind:'house',houseId:String(hi.resourceId),bounds:{x:Number(b.x)||0,y:Number(b.y)||0,w:Number(b.w)||768,h:Number(b.h)||544},district:'instance',status:'active'};bump();}
        return clone(state.parcels[pid]);
      }
      const legacy=(typeof STATE!=='undefined'&&STATE?.plot)?STATE.plot:{x:2000,y:1500,w:400,h:300};
      const pid='parcel:legacy:104';
      if(!state.parcels[pid]){state.parcels[pid]={parcelId:pid,ownerId:owner,kind:'player',bounds:{x:legacy.x,y:legacy.y,w:legacy.w,h:legacy.h},district:'central',status:'owned'};bump();}
      else if(state.parcels[pid].ownerId==='local_pioneer'&&owner!=='local_pioneer'){state.parcels[pid].ownerId=owner;bump();}
      return clone(state.parcels[pid]);
    }
    if(op==='ensureWorldEditorParcel'){
      const pid='parcel:world:editor';
      if(!state.parcels[pid]){state.parcels[pid]={parcelId:pid,ownerId:'developer',kind:'world_editor',bounds:{x:0,y:0,w:Number(CONFIG?.worldWidth)||3600,h:Number(CONFIG?.worldHeight)||3200},district:'*',status:'developer'};bump();}
      return clone(state.parcels[pid]);
    }
    if(op==='ensureHouseParcel'){
      const houseId=String(data.houseId||''),b=data.bounds||{x:0,y:0,w:768,h:544};if(!houseId)throw new Error('HOUSE_ID_REQUIRED');const pid=`parcel:house:${houseId}`;
      if(!state.parcels[pid]){state.parcels[pid]={parcelId:pid,ownerId:owner,kind:'house',houseId,bounds:{x:Number(b.x)||0,y:Number(b.y)||0,w:Number(b.w)||768,h:Number(b.h)||544},district:'instance',status:'active'};bump();}
      else{const row=state.parcels[pid];row.ownerId=owner;row.houseId=houseId;row.bounds={x:Number(b.x)||0,y:Number(b.y)||0,w:Number(b.w)||768,h:Number(b.h)||544};row.status='active';bump();}
      return clone(state.parcels[pid]);
    }
    if(op==='grantUnits'){
      if(!data.developer)throw new Error('DEVELOPER_ONLY'); const aid=String(data.assetId||''); if(!C.get(aid))throw new Error('ASSET_NOT_FOUND');
      state.balances[owner]=state.balances[owner]||{};state.balances[owner][aid]=Math.max(0,owned(owner,aid)+Math.floor(Number(data.quantity)||0));bump();return{assetId:aid,owned:owned(owner,aid),available:available(owner,aid)};
    }
    if(op==='place'){
      const p=parcel(data.parcelId),t=C.get(data.assetId);if(!p)throw new Error('PARCEL_NOT_FOUND');if(!t)throw new Error('ASSET_NOT_FOUND');if(!canEdit(p,owner))throw new Error('NOT_PARCEL_OWNER');
      const q=((Math.floor(Number(data.rotation)||0)%4)+4)%4,scale=normalizeScale(data.scale),d=rotatedSize(t,q,scale),s=Math.max(1,t.snap||C.tileSize),x=snap(data.x,s),y=snap(data.y,s);
      if(!within(p.bounds,x,y,d.w,d.h))throw new Error('OUTSIDE_PARCEL');
      if(p.kind!=='world_editor'&&available(owner,t.id)<1)throw new Error('NO_OWNED_UNITS');
      const rec={placementId:id('placement'),parcelId:p.parcelId,ownerId:owner,assetId:t.id,x,y,rotation:q,scale,layer:'property',createdAt:Date.now(),updatedAt:Date.now()};state.placements.push(rec);bump();return clone(rec);
    }
    if(op==='move'){
      const rec=state.placements.find(x=>x.placementId===data.placementId);if(!rec)throw new Error('PLACEMENT_NOT_FOUND');const p=parcel(rec.parcelId),t=C.get(rec.assetId);if(!canEdit(p,owner)&&rec.ownerId!==owner)throw new Error('NOT_PLACEMENT_OWNER');
      const d=rotatedSize(t,rec.rotation,rec.scale),s=Math.max(1,t.snap||C.tileSize),x=snap(data.x,s),y=snap(data.y,s);if(!within(p.bounds,x,y,d.w,d.h))throw new Error('OUTSIDE_PARCEL');rec.x=x;rec.y=y;rec.updatedAt=Date.now();bump();return clone(rec);
    }
    if(op==='rotate'){
      const rec=state.placements.find(x=>x.placementId===data.placementId);if(!rec)throw new Error('PLACEMENT_NOT_FOUND');const p=parcel(rec.parcelId),t=C.get(rec.assetId);if(!canEdit(p,owner)&&rec.ownerId!==owner)throw new Error('NOT_PLACEMENT_OWNER');const q=(rec.rotation+(Number(data.delta)||1)+4)%4,d=rotatedSize(t,q,rec.scale);if(!within(p.bounds,rec.x,rec.y,d.w,d.h))throw new Error('OUTSIDE_PARCEL');rec.rotation=q;rec.updatedAt=Date.now();bump();return clone(rec);
    }
    if(op==='scale'){
      const rec=state.placements.find(x=>x.placementId===data.placementId);if(!rec)throw new Error('PLACEMENT_NOT_FOUND');const p=parcel(rec.parcelId),t=C.get(rec.assetId);if(!canEdit(p,owner)&&rec.ownerId!==owner)throw new Error('NOT_PLACEMENT_OWNER');const scale=normalizeScale(data.scale),d=rotatedSize(t,rec.rotation,scale);if(!within(p.bounds,rec.x,rec.y,d.w,d.h))throw new Error('OUTSIDE_PARCEL');rec.scale=scale;rec.updatedAt=Date.now();bump();return clone(rec);
    }
    if(op==='remove'){
      const i=state.placements.findIndex(x=>x.placementId===data.placementId);if(i<0)throw new Error('PLACEMENT_NOT_FOUND');const rec=state.placements[i],p=parcel(rec.parcelId);if(!canEdit(p,owner)&&rec.ownerId!==owner)throw new Error('NOT_PLACEMENT_OWNER');state.placements.splice(i,1);bump();return clone(rec);
    }
    if(op==='replaceHouseLayout'){
      const p=parcel(data.parcelId);if(!p||p.kind!=='house')throw new Error('HOUSE_PARCEL_ONLY');if(!data.authorityRestore&&p.ownerId!==owner)throw new Error('NOT_PARCEL_OWNER');const rows=Array.isArray(data.placements)?data.placements:[];
      const safe=[];for(const raw of rows){const t=C.get(raw.assetId);if(!t)continue;const q=((Math.floor(Number(raw.rotation)||0)%4)+4)%4,scale=normalizeScale(raw.scale),d=rotatedSize(t,q,scale),x=snap(raw.x,t.snap||C.tileSize),y=snap(raw.y,t.snap||C.tileSize);if(!within(p.bounds,x,y,d.w,d.h))continue;safe.push({placementId:String(raw.placementId||id('placement')),parcelId:p.parcelId,ownerId:String(raw.ownerId||p.ownerId),assetId:t.id,x,y,rotation:q,scale,layer:'property',createdAt:Number(raw.createdAt)||Date.now(),updatedAt:Number(raw.updatedAt)||Date.now()});}
      state.placements=state.placements.filter(x=>x.parcelId!==p.parcelId).concat(safe);bump();return{count:safe.length};
    }
    if(op==='replaceLayout'){
      if(!data.developer)throw new Error('DEVELOPER_ONLY');const p=parcel(data.parcelId);if(!p||p.kind!=='world_editor')throw new Error('WORLD_EDITOR_ONLY');const rows=Array.isArray(data.placements)?data.placements:[];
      const safe=[];for(const raw of rows){const t=C.get(raw.assetId);if(!t)continue;const q=((Math.floor(Number(raw.rotation)||0)%4)+4)%4,scale=normalizeScale(raw.scale),d=rotatedSize(t,q,scale),x=snap(raw.x,t.snap),y=snap(raw.y,t.snap);if(!within(p.bounds,x,y,d.w,d.h))continue;safe.push({placementId:String(raw.placementId||id('placement')),parcelId:p.parcelId,ownerId:'developer',assetId:t.id,x,y,rotation:q,scale,layer:'property',createdAt:Number(raw.createdAt)||Date.now(),updatedAt:Date.now()});}
      state.placements=state.placements.filter(x=>x.parcelId!==p.parcelId).concat(safe);bump();return{count:safe.length};
    }
    throw new Error('UNKNOWN_PROPERTY_OPERATION');
  }
  async function request(op,payload){const data=payload||{};if(isHouseMutation(op,data)&&window.KELO_HOUSE_AUTHORITY?.request)return window.KELO_HOUSE_AUTHORITY.request(op,data);if(remoteAdapter&&typeof remoteAdapter.request==='function')return remoteAdapter.request(op,data);return localRequest(op,data);}
  function installRemoteAdapter(adapter){if(adapter&&typeof adapter.request!=='function')throw new Error('INVALID_PROPERTY_ADAPTER');remoteAdapter=adapter||null;window.KELO_PROPERTY_AUDIT.authority=remoteAdapter?'remote-adapter':'local-fallback';}
  function ingestAuthoritySnapshot(next){if(!next||next.schema!==SCHEMA||!next.parcels||!next.balances||!Array.isArray(next.placements))throw new Error('INVALID_PROPERTY_SNAPSHOT');state=clone(next);persist();return snapshot();}

  function placementBounds(rec){const t=C.get(rec.assetId);if(!t)return null;const d=rotatedSize(t,rec.rotation,rec.scale);return{x:rec.x,y:rec.y,w:d.w,h:d.h};}
  function placementForPoint(x,y,pid){const list=state.placements.filter(p=>(!pid||p.parcelId===pid)).slice().reverse();return list.find(p=>{const b=placementBounds(p);return b&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;})||null;}
  function transformedRect(rec,t,r){
    const q=((rec.rotation%4)+4)%4,s=normalizeScale(rec.scale),W=t.width*s,H=t.height*s,sr={x:r.x*s,y:r.y*s,w:r.w*s,h:r.h*s};const pts=[[sr.x,sr.y],[sr.x+sr.w,sr.y],[sr.x,sr.y+sr.h],[sr.x+sr.w,sr.y+sr.h]].map(([px,py])=>{let x=px,y=py;if(q===1){return[H-y,x];}if(q===2){return[W-x,H-y];}if(q===3){return[y,W-x];}return[x,y];});const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return{x:rec.x+Math.min(...xs),y:rec.y+Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
  }
  function syncColliders(){
    if(!K||typeof K.replaceOwner!=='function')return 0;
    const rows=[];
    for(const rec of state.placements){if(!placementVisible(rec))continue;const t=C.get(rec.assetId);if(!t?.collision)continue;const b=transformedRect(rec,t,t.collision);if(b.w>0&&b.h>0)rows.push({id:`property:${rec.placementId}`,x:b.x,y:b.y,w:b.w,h:b.h,noDraw:true,_propertyPlacementId:rec.placementId});}
    return K.replaceOwner(COLLISION_OWNER,rows);
  }

  function drawTemplate(g,t,rec,phase){
    const q=((rec.rotation%4)+4)%4,s=normalizeScale(rec.scale),d=rotatedSize(t,q,s);let drew=false;g.save();g.translate(rec.x+d.w/2,rec.y+d.h/2);g.rotate(q*Math.PI/2);g.scale(s,s);g.translate(-t.width/2,-t.height/2);
    for(const part of t.parts){if(part.phase!==phase)continue;const img=images.get(part.assetKey);if(!img||!readyAssets.has(part.assetKey))continue;const a=g.globalAlpha;g.globalAlpha=a*part.opacity;g.drawImage(img,part.source.x,part.source.y,part.source.w,part.source.h,part.offset.x,part.offset.y,part.size.w,part.size.h);g.globalAlpha=a;drew=true;}
    g.restore();return drew;
  }
  function drawPlacements(g,rows,phase='props_back'){
    if(!g||!Array.isArray(rows))return 0;let count=0;g.save();g.imageSmoothingEnabled=false;for(const rec of rows){const t=C.get(rec?.assetId);if(t&&drawTemplate(g,t,rec,phase))count++;}g.restore();return count;
  }
  function drawPhase(g,phase){drawPlacements(g,state.placements.filter(placementVisible),phase);}
  function bounds(){return state.placements.filter(placementVisible).map(p=>({id:p.placementId,...placementBounds(p)})).filter(x=>x.w>0&&x.h>0);}
  L.register({id:'property-placements-back',phase:'props_back',priority:35,required:false,ready:()=>true,draw:g=>drawPhase(g,'props_back'),ownership:'property-placement-system-v1',bounds});
  L.register({id:'property-placements-front',phase:'props_front',priority:35,required:false,ready:()=>true,draw:g=>drawPhase(g,'props_front'),ownership:'property-placement-system-v1',bounds});

  const assetKeys=new Set();C.list().forEach(t=>t.parts.forEach(p=>assetKeys.add(p.assetKey)));
  function announceAssetReady(key){try{window.dispatchEvent(new CustomEvent('kelo:property-render-assets-ready',{detail:{key}}));}catch(e){}}
  function acquire(key){if(readyAssets.has(key))return;A.acquire(key).then(img=>{images.set(key,img);readyAssets.add(key);announceAssetReady(key);}).catch(err=>console.warn('[Kelo property] asset unavailable',key,err));}
  assetKeys.forEach(acquire);C.onRegister(t=>t.parts.forEach(p=>{assetKeys.add(p.assetKey);acquire(p.assetKey);}));
  syncColliders();

  function exportLayout(pid){return{contract:'kelo-property-layout-v1',parcel:clone(parcel(pid)),placements:state.placements.filter(p=>p.parcelId===pid).map(clone)};}
  function suppressLegacyFurniture(plot){const p=state.parcels['parcel:legacy:104'];return !!p&&p.bounds.x===plot?.x&&p.bounds.y===plot?.y&&state.placements.some(x=>x.parcelId===p.parcelId);}
  if(typeof renderPlot==='function'){const legacyRenderPlot=renderPlot;renderPlot=function(plot,isOwn){if(suppressLegacyFurniture(plot))return legacyRenderPlot(Object.assign({},plot,{furniture:[]}),isOwn);return legacyRenderPlot(plot,isOwn);};}
  window.KELO_PROPERTY_SYSTEM=Object.freeze({
    version:'property-system-v1.4.0',storageMode:'local-fallback-replaceable',collisionOwner:COLLISION_OWNER,request,authorityLocalRequest:localRequest,installRemoteAdapter,ingestAuthoritySnapshot,snapshot,playerId,parcel,getOwnedUnits:(assetId,owner)=>owned(String(owner||playerId()),assetId),getDeployedUnits:(assetId,owner)=>deployed(String(owner||playerId()),assetId),getAvailableUnits:(assetId,owner)=>available(String(owner||playerId()),assetId),getPlacements:(pid)=>state.placements.filter(p=>!pid||p.parcelId===pid).map(clone),placementBounds,placementForPoint,drawPlacements,exportLayout,suppressLegacyFurniture,refreshSceneColliders:syncColliders,onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);},get ready(){return true;}
  });
  window.KELO_PROPERTY_AUDIT={version:'property-system-v1.4.0',schema:SCHEMA,authority:'local-fallback',serverReplaceable:true,collisionMode:'kelo-collision-owner-v2',collisionOwner:COLLISION_OWNER,parcelCount:Object.keys(state.parcels).length,placementCount:state.placements.length,assetCount:C.list().length,readOnlyPreviewRenderer:true};
})();