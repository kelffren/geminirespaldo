/* KELO-INDEX
 * area: WORLD BUILDER
 * keys: ADMIN KEY WORLD EDIT TERRAIN PATH COLLISION PROPERTY RUNTIME VIEW AUTHORITY OFFLINE ONLINE READY AUTOTILE PREVIEW
 * hace: renderer/runtime efímero de overrides del mundo; NO persiste ni decide Draft/Publish
 * online: toda mutación se delega a KELO_WORLD_EDIT.request(); el runtime solo ingiere la vista autorizada
 * collision: publica world-builder:collisions en KELO_COLLISION; sync por revisión/escena, no por frame
 * public-api: renderSnapshotPreview() pinta un snapshot normalizado read-only reutilizando terreno + Property renderer
 */
(function(){
'use strict';
if(window.KELO_WORLD_BUILDER)return;

const VERSION='world-builder-v2.3.0';
const SCHEMA=2;
const TILE=Number(window.KELO_TILE_REGISTRY?.worldTileSize)||32;
const R=window.KELO_TILE_REGISTRY;
const TERRAIN=window.KELO_TERRAIN_CONTRACT;
const A=window.KELO_ATLAS_CONTRACT;
const K=window.KELO_COLLISION;
const COLLISION_OWNER='world-builder:collisions';
const MATERIALS=Object.freeze(Object.keys(TERRAIN?.materials||{}));
const SURFACE_ATLAS_KEY=String(R?.styles?.surfaceGround?.asset||'');
let rendererInstalled=false;
let colliderSyncKey='';
const listeners=new Set();
const atlasImages=new Map();
const atlasPromises=new Map();
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const cellKey=(x,y)=>`${Math.floor(Number(x)||0)},${Math.floor(Number(y)||0)}`;

let state={
  schema:SCHEMA,
  revision:0,
  cells:{},
  collisions:{},
  updatedAt:0,
  view:{kind:'boot',id:null,worldId:'world:kelo-main',publishedRevisionId:null}
};

function snapshot(){return clone(state);}
function cells(){return Object.values(state.cells||{});}
function collisions(){return Object.values(state.collisions||{});}
function notify(){for(const fn of listeners){try{fn(snapshot());}catch(e){}}}
function ingestViewSnapshot(next,meta={}){
  const src=next||{};
  state={
    schema:SCHEMA,
    revision:Number(meta.revisionVersion??src.revisionVersion??state.revision??0),
    cells:clone(src.cells&&typeof src.cells==='object'?src.cells:{}),
    collisions:clone(src.collisions&&typeof src.collisions==='object'?src.collisions:{}),
    updatedAt:Date.now(),
    view:Object.assign({kind:'published',id:null,worldId:'world:kelo-main',publishedRevisionId:null},clone(meta||{}))
  };
  syncColliders(true);notify();return snapshot();
}
function collisionAt(x,y){return collisions().slice().reverse().find(c=>x>=c.x&&x<=c.x+c.w&&y>=c.y&&y<=c.y+c.h)||null;}
function validMaterial(id){return MATERIALS.includes(String(id||''));}

async function request(op,payload={}){
  const E=window.KELO_WORLD_EDIT;
  if(op==='world-builder:snapshot'||op==='world-builder:export')return snapshot();
  if(!E?.request)throw new Error('WORLD_EDIT_AUTHORITY_NOT_READY');
  if(op==='world-builder:paint')return E.request('world:tile:paint',{
    actorId:payload.actorId,x:payload.x,y:payload.y,brushSize:payload.brushSize,
    material:payload.material,role:payload.role
  });
  if(op==='world-builder:erase-terrain')return E.request('world:tile:clear',{
    actorId:payload.actorId,x:payload.x,y:payload.y,brushSize:payload.brushSize
  });
  if(op==='world-builder:collision-create')return E.request('world:collision:create',payload);
  if(op==='world-builder:collision-move')return E.request('world:collision:update',payload);
  if(op==='world-builder:collision-remove')return E.request('world:collision:remove',payload);
  if(op==='world-builder:clear-draft')return E.request('world:draft:clear-overrides',payload);
  if(op==='world-builder:import'){
    return E.request('world:draft:import',{
      actorId:payload.actorId,
      snapshot:{
        worldId:'world:kelo-main',
        cells:payload.snapshot?.cells||{},
        collisions:payload.snapshot?.collisions||{},
        placements:window.KELO_PROPERTY_SYSTEM?.getPlacements?.('parcel:world:editor')||[]
      }
    });
  }
  throw new Error('UNKNOWN_WORLD_BUILDER_OPERATION');
}

function loadScriptOnce(id,src){
  if(document.getElementById(id))return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');s.id=id;s.src=src;
    s.onload=()=>resolve();s.onerror=()=>reject(new Error(`WORLD_EDIT_SCRIPT_LOAD_FAILED:${src}`));
    document.head.appendChild(s);
  });
}
async function loadAuthorityStack(){
  if(window.KELO_WORLD_EDIT)return true;
  await loadScriptOnce('kelo-world-draft-store-loader','src/world/world-draft-store.js?v=1');
  await loadScriptOnce('kelo-world-revision-system-loader','src/world/world-revision-system.js?v=1');
  await loadScriptOnce('kelo-local-world-edit-authority-loader','src/world/authorities/local-world-edit-authority.js?v=1');
  await loadScriptOnce('kelo-remote-world-edit-authority-loader','src/world/authorities/remote-world-edit-authority.js?v=1');
  await loadScriptOnce('kelo-world-edit-authority-loader','src/world/world-edit-authority.js?v=1');
  return true;
}

function isMainWorld(){const i=window.KELO_INSTANCES?.current?.();return !(i&&i.type&&i.type!=='world');}
function materialColor(id){return id==='marble'?'#e7dcc2':'#71bf54';}
function hash(x,y,s=0){return Math.abs(((Math.floor(x/TILE)+17+s)*73856093)^((Math.floor(y/TILE)+29+s)*19349663));}
function atlasMeta(key){return R?.atlases?.[key]||null;}
function atlasUsable(meta){const src=String(meta?.src||'');return !!meta&&meta.retiredVisual!==true&&!!src&&!src.startsWith('data:')&&!src.includes('#kelo-reset');}
function atlasOrigin(meta,id){const tw=Number(meta?.tileWidth)||TILE,th=Number(meta?.tileHeight)||TILE,cols=Number(meta?.columns)||Math.max(1,Math.floor((Number(meta?.width)||tw)/tw));return{x:(id%cols)*tw,y:Math.floor(id/cols)*th,w:tw,h:th};}
function announceRenderAsset(key){try{window.dispatchEvent(new CustomEvent('kelo:world-builder-render-assets-ready',{detail:{key}}));}catch(e){}}
function acquireAtlas(key){
  if(!key||atlasImages.has(key)||atlasPromises.has(key)||!A?.acquire)return;
  const p=Promise.resolve(A.acquire(key)).then(img=>{if(img)atlasImages.set(key,img);atlasPromises.delete(key);announceRenderAsset(key);}).catch(()=>atlasPromises.delete(key));
  atlasPromises.set(key,p);
}
function neighborMask(rec,sourceCells=state.cells){
  const m=rec.material,has=(dx,dy)=>{const n=sourceCells?.[cellKey(rec.x+dx*TILE,rec.y+dy*TILE)];return n&&n.material===m;};
  return (has(0,-1)?1:0)|(has(1,0)?2:0)|(has(0,1)?4:0)|(has(-1,0)?8:0);
}
function drawAtlasMaterial(g,rec,sourceCells){
  const def=TERRAIN?.materials?.[rec.material],meta=atlasMeta(def?.atlas),pool=R?.families?.[def?.family]||[];
  if(!def?.atlas||!atlasUsable(meta)||!pool.length)return false;
  const img=atlasImages.get(def.atlas);if(!img){acquireAtlas(def.atlas);return false;}
  const mask=neighborMask(rec,sourceCells),id=pool.length>=16?pool[mask%pool.length]:pool[(hash(rec.x,rec.y)+mask)%pool.length],s=atlasOrigin(meta,id);
  g.drawImage(img,s.x,s.y,s.w,s.h,rec.x,rec.y,TILE,TILE);return true;
}
function drawSurfaceGrass(g,rec){
  if(rec.material!=='grass'||!SURFACE_ATLAS_KEY)return false;
  const meta=atlasMeta(SURFACE_ATLAS_KEY),img=atlasImages.get(SURFACE_ATLAS_KEY),style=R?.styles?.surfaceGround;
  if(!atlasUsable(meta))return false;if(!img){acquireAtlas(SURFACE_ATLAS_KEY);return false;}
  const base=Array.isArray(style?.baseFrames)&&style.baseFrames.length?style.baseFrames:[0],detail=Array.isArray(style?.detailFrames)?style.detailFrames:[],mod=Math.max(2,Number(style?.detailModulo)||11),useDetail=detail.length&&hash(rec.x,rec.y,71)%mod===0,pool=useDetail?detail:base,id=pool[hash(rec.x,rec.y,useDetail?191:23)%pool.length],s=atlasOrigin(meta,id);
  g.drawImage(img,s.x,s.y,s.w,s.h,rec.x,rec.y,TILE,TILE);return true;
}
function drawMaterialFallback(g,rec){
  g.fillStyle=materialColor(rec.material);g.fillRect(rec.x,rec.y,TILE,TILE);
  if(rec.material==='marble'){
    g.strokeStyle='rgba(134,110,69,.22)';g.lineWidth=1;g.strokeRect(rec.x+.5,rec.y+.5,TILE-1,TILE-1);
    if(hash(rec.x,rec.y,37)%5===0){g.fillStyle='rgba(255,250,225,.2)';g.fillRect(rec.x+4,rec.y+4,TILE-8,2);}
  }
}
function drawCell(g,rec,sourceCells=state.cells){
  if(!validMaterial(rec.material))return false;
  if(drawAtlasMaterial(g,rec,sourceCells))return true;
  if(drawSurfaceGrass(g,rec))return true;
  drawMaterialFallback(g,rec);return true;
}
function drawTerrain(g,sourceCells=state.cells){
  if(!isMainWorld())return 0;
  const list=Object.values(sourceCells||{});if(!list.length)return 0;
  g.save();g.imageSmoothingEnabled=false;for(const rec of list)drawCell(g,rec,sourceCells);g.restore();return list.length;
}
function previewBounds(snapshotValue,requested){
  const raw=requested||{},rx=Number(raw.x),ry=Number(raw.y),rw=Number(raw.w),rh=Number(raw.h);
  if(Number.isFinite(rx)&&Number.isFinite(ry)&&Number.isFinite(rw)&&Number.isFinite(rh)&&rw>0&&rh>0)return{x:rx,y:ry,w:rw,h:rh};
  const rows=Object.values(snapshotValue?.cells||{});if(rows.length){const xs=rows.map(x=>Number(x.x)||0),ys=rows.map(x=>Number(x.y)||0),minX=Math.min(...xs),minY=Math.min(...ys),maxX=Math.max(...xs)+TILE,maxY=Math.max(...ys)+TILE;return{x:minX,y:minY,w:Math.max(TILE,maxX-minX),h:Math.max(TILE,maxY-minY)};}
  return{x:0,y:0,w:Number(window.CONFIG?.worldWidth)||3600,h:Number(window.CONFIG?.worldHeight)||3200};
}
function renderSnapshotPreview(previewCanvas,viewSnapshot,{bounds=null,padding=16}={}){
  if(!previewCanvas?.getContext)throw new Error('WORLD_BUILDER_PREVIEW_CANVAS_REQUIRED');
  const g=previewCanvas.getContext('2d');if(!g)throw new Error('WORLD_BUILDER_PREVIEW_CONTEXT_REQUIRED');
  const view=previewCanvas.ownerDocument?.defaultView||window,rect=previewCanvas.getBoundingClientRect(),dpr=Math.min(2,Number(view.devicePixelRatio)||1),cssW=Math.max(1,rect.width||previewCanvas.clientWidth||390),cssH=Math.max(1,rect.height||previewCanvas.clientHeight||390),pixelW=Math.max(1,Math.round(cssW*dpr)),pixelH=Math.max(1,Math.round(cssH*dpr));
  if(previewCanvas.width!==pixelW||previewCanvas.height!==pixelH){previewCanvas.width=pixelW;previewCanvas.height=pixelH;}
  g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,cssW,cssH);g.fillStyle='#071018';g.fillRect(0,0,cssW,cssH);
  const src=viewSnapshot||{},b=previewBounds(src,bounds),pad=Math.max(6,Math.min(Number(padding)||16,Math.min(cssW,cssH)*.15)),scale=Math.min((cssW-pad*2)/b.w,(cssH-pad*2)/b.h);
  if(!Number.isFinite(scale)||scale<=0)return Object.freeze({cells:0,placements:0,bounds:b,scale:0});
  const ox=(cssW-b.w*scale)/2-b.x*scale,oy=(cssH-b.h*scale)/2-b.y*scale,sourceCells=src.cells&&typeof src.cells==='object'?src.cells:{},placements=Array.isArray(src.placements)?src.placements:[];
  g.save();g.translate(ox,oy);g.scale(scale,scale);g.beginPath();g.rect(b.x,b.y,b.w,b.h);g.clip();g.fillStyle='#183321';g.fillRect(b.x,b.y,b.w,b.h);drawTerrain(g,sourceCells);
  const property=window.KELO_PROPERTY_SYSTEM;let drawnPlacements=0;if(property?.drawPlacements){drawnPlacements+=property.drawPlacements(g,placements,'props_back');drawnPlacements+=property.drawPlacements(g,placements,'props_front');}
  g.restore();g.strokeStyle='#d8bc6770';g.lineWidth=1;g.strokeRect((cssW-b.w*scale)/2,(cssH-b.h*scale)/2,b.w*scale,b.h*scale);
  return Object.freeze({cells:Object.keys(sourceCells).length,placements,drawnPlacements,bounds:b,scale});
}
function syncColliders(force){
  if(!K||typeof K.replaceOwner!=='function')return 0;
  const main=isMainWorld();
  const scene=main?'world':String(window.KELO_INSTANCES?.current?.()?.instanceId||'instance');
  const key=`${scene}:${state.revision}:${state.updatedAt}:${Object.keys(state.collisions||{}).length}`;
  if(!force&&key===colliderSyncKey)return K.ownerSnapshot(COLLISION_OWNER).count;
  const rows=main?collisions().map(c=>({id:`world-builder:${c.collisionId}`,x:c.x,y:c.y,w:c.w,h:c.h,noDraw:true,_worldBuilderCollisionId:c.collisionId})):[];
  const count=K.replaceOwner(COLLISION_OWNER,rows);
  colliderSyncKey=key;
  try{window.KELO_PROPERTY_SYSTEM?.refreshSceneColliders?.();}catch(e){}
  return count;
}
function drawRegisteredLayer(id,g){
  const layer=window.KELO_ENVIRONMENT_LAYERS?.layers?.find?.(x=>x.id===id);
  if(!layer||typeof layer.draw!=='function')return false;
  try{if(layer.ready&&!layer.ready())return false;layer.draw(g);return true;}catch(e){return false;}
}
function drawPropertyFallback(g,phase,base){
  if(!isMainWorld()||base?.decorationReset!==true)return;
  drawRegisteredLayer(phase==='back'?'property-placements-back':'property-placements-front',g);
}
function drawGuides(g){
  const ui=window.KELO_WORLD_BUILDER_UI,guide=ui?.guideState?.();
  if(!guide?.open||!isMainWorld())return;
  g.save();g.lineWidth=2;
  if(guide.layer==='collision'){
    g.fillStyle='rgba(255,90,90,.16)';g.strokeStyle='rgba(255,120,120,.95)';
    for(const c of collisions()){g.fillRect(c.x,c.y,c.w,c.h);g.strokeRect(c.x,c.y,c.w,c.h);}
  }
  if(guide.cursor){
    g.strokeStyle='#fff0b0';g.setLineDash([6,4]);g.strokeRect(guide.cursor.x,guide.cursor.y,guide.cursor.w||TILE,guide.cursor.h||TILE);g.setLineDash([]);
  }
  g.restore();
}
function installRenderer(){
  if(rendererInstalled)return;
  const base=window.KELO_WORLD_RENDERER;
  if(!base||typeof base.draw!=='function'){setTimeout(installRenderer,120);return;}
  rendererInstalled=true;
  window.KELO_WORLD_RENDERER=Object.freeze({
    draw(g){const ok=base.draw(g);drawTerrain(g);return ok!==false;},
    drawPreActors(g){const r=typeof base.drawPreActors==='function'?base.drawPreActors(g):true;drawPropertyFallback(g,'back',base);syncColliders(false);drawGuides(g);return r;},
    drawPostActors(g){const r=typeof base.drawPostActors==='function'?base.drawPostActors(g):true;drawPropertyFallback(g,'front',base);return r;},
    districts:base.districts,
    chunkSize:base.chunkSize,
    get ready(){return base.ready!==false;},
    environmentLayerStack:base.environmentLayerStack,
    preActorLayerStack:true,
    postActorLayerStack:true,
    decorationReset:base.decorationReset,
    worldBuilderOverlay:true
  });
}
function boot(){
  loadAuthorityStack().catch(err=>console.error('[Kelo world edit] authority stack failed',err));
  for(const id of MATERIALS){const key=TERRAIN?.materials?.[id]?.atlas;if(key)acquireAtlas(key);}
  if(SURFACE_ATLAS_KEY)acquireAtlas(SURFACE_ATLAS_KEY);
  installRenderer();syncColliders(true);
}

window.KELO_WORLD_BUILDER=Object.freeze({
  version:VERSION,
  schema:SCHEMA,
  tileSize:TILE,
  materials:Object.freeze(MATERIALS.slice()),
  collisionOwner:COLLISION_OWNER,
  request,
  ingestViewSnapshot,
  renderSnapshotPreview,
  snapshot,
  cells:()=>clone(cells()),
  collisions:()=>clone(collisions()),
  collisionAt:(x,y)=>clone(collisionAt(x,y)),
  onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);},
  authoritySource:()=>{
    const src=window.KELO_WORLD_EDIT?.authoritySource?.();
    return src==='remote'?'remote-adapter':src==='local'?'local-draft':'runtime-only';
  },
  isMainWorld
});
window.KELO_WORLD_BUILDER_AUDIT=Object.freeze({
  version:VERSION,
  authorityReplaceable:true,
  versionedDraft:true,
  terrainOverrides:true,
  autotile4bit:true,
  pathOverrides:true,
  collisionLayer:true,
  collisionMode:'kelo-collision-owner-v2',
  collisionOwner:COLLISION_OWNER,
  colliderDirtySync:true,
  propertyReuse:true,
  propertyResetFallback:true,
  rendererOverlay:true,
  snapshotPreviewRenderer:true,
  previewUsesPropertyRenderer:true,
  realSurfaceFallback:SURFACE_ATLAS_KEY||null,
  persistentStorage:false,
  mutationsViaWorldEdit:true,
  runtimeOnly:true
});
if(document.readyState==='complete')setTimeout(boot,0);else window.addEventListener('load',boot,{once:true});
})();