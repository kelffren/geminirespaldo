/* KELO-INDEX
 * area: ENVIRONMENT / WORLD
 * owner: KELO_ENVIRONMENT_LAYERS ground content
 * keys: SURFACE GROUND GRASS CHUNK CAPITAL TEST MAP BOOT
 * purpose: suelo de césped LIVE por chunks y bootstrap temporal de la composición Capital Test V2
 * public-api: KELO_SURFACE_GROUND_AUDIT
 * consumes: KELO_TILE_REGISTRY, KELO_ENVIRONMENT_LAYERS, KELO_ATLAS_CONTRACT
 * state-owned: cache visual de chunks de césped
 * extension-points: metadata styles.surfaceGround; Capital Test es contenido temporal separado
 * online: N/A; presentación local
 * do-not: NO tocar movimiento, economía ni autoridad gameplay
 */
(function(){
'use strict';
const R=window.KELO_TILE_REGISTRY,L=window.KELO_ENVIRONMENT_LAYERS,A=window.KELO_ATLAS_CONTRACT;
if(!R||!L?.register||!A?.acquire){console.error('[Kelo surface ground] registry/layers/atlas contract missing');return;}
const style=R.styles?.surfaceGround, atlas=style&&R.atlases?.[style.asset];
if(!style||!atlas){console.error('[Kelo surface ground] surfaceGround metadata missing');return;}
const TILE=R.worldTileSize||32,CHUNK=512,COLS=atlas.columns||5,BASE=style.baseFrames||[1],DETAIL=style.detailFrames||[],MOD=Math.max(2,Number(style.detailModulo)||11),cache=new Map(),MAX=16;
let img=null,ready=false,failed=false,drawnTiles=0;
function hash(x,y,s=0){return Math.abs(((x+17+s)*73856093)^((y+29+s)*19349663))}
function frameFor(X,Y){const detail=DETAIL.length&&hash(X,Y,71)%MOD===0;const pool=detail?DETAIL:BASE;return pool[hash(X,Y,detail?191:23)%pool.length]}
function drawFrame(g,id,dx,dy){const sx=(id%COLS)*atlas.tileWidth,sy=Math.floor(id/COLS)*atlas.tileHeight;g.drawImage(img,sx,sy,atlas.tileWidth,atlas.tileHeight,dx,dy,TILE,TILE);drawnTiles++;}
function build(cx,cy){const key=cx+','+cy;if(cache.has(key))return cache.get(key);const c=document.createElement('canvas');c.width=CHUNK;c.height=CHUNK;const g=c.getContext('2d');g.imageSmoothingEnabled=false;const wx=cx*CHUNK,wy=cy*CHUNK,n=Math.ceil(CHUNK/TILE);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const X=Math.floor((wx+x*TILE)/TILE),Y=Math.floor((wy+y*TILE)/TILE);drawFrame(g,frameFor(X,Y),x*TILE,y*TILE)}cache.set(key,c);if(cache.size>MAX)cache.delete(cache.keys().next().value);return c}
function visibleBounds(){const z=window.CONFIG?.zoom||1,cam=window.camera||{x:1440,y:1520},sw=window.screenW||innerWidth,sh=window.screenH||innerHeight,ww=window.CONFIG?.worldWidth||3600,wh=window.CONFIG?.worldHeight||3200,hw=sw/(2*z)+CHUNK,hh=sh/(2*z)+CHUNK;return{minX:Math.max(0,Math.floor((cam.x-hw)/CHUNK)),maxX:Math.min(Math.ceil(ww/CHUNK)-1,Math.floor((cam.x+hw)/CHUNK)),minY:Math.max(0,Math.floor((cam.y-hh)/CHUNK)),maxY:Math.min(Math.ceil(wh/CHUNK)-1,Math.floor((cam.y+hh)/CHUNK))}}
function draw(g){if(!ready||failed||!img)return;const b=visibleBounds();for(let y=b.minY;y<=b.maxY;y++)for(let x=b.minX;x<=b.maxX;x++)g.drawImage(build(x,y),x*CHUNK,y*CHUNK);audit.chunkCacheSize=cache.size;audit.lastDrawnTiles=drawnTiles;drawnTiles=0;}
const audit=window.KELO_SURFACE_GROUND_AUDIT={version:'surface-ground-v1.0.2',mode:style.mode,ready:false,failed:false,asset:style.asset,src:atlas.src,tileCount:atlas.tileCount,baseFrameCount:BASE.length,detailFrameCount:DETAIL.length,detailModulo:MOD,worldTileSize:TILE,chunkSize:CHUNK,chunkCacheCap:MAX,chunkCacheSize:0,lastDrawnTiles:0,worldWidth:window.CONFIG?.worldWidth||3600,worldHeight:window.CONFIG?.worldHeight||3200,visibleDuringReset:true,capitalTestBoot:'v2'};
try{L.register({id:'kelo-surface-ground',phase:'ground',priority:0,required:true,visibleDuringReset:true,ready:()=>ready&&!failed,draw,ownership:'surface-ground-v1',bounds:()=>[{id:'world-surface',x:0,y:0,w:audit.worldWidth,h:audit.worldHeight}]});}catch(err){failed=true;audit.failed=true;console.error('[Kelo surface ground] layer registration failed',err);return;}
if(!A.describe(style.asset)){failed=true;audit.failed=true;console.error('[Kelo surface ground] atlas not registered',style.asset);return;}
A.acquire(style.asset).then(image=>{img=image;ready=true;audit.ready=true;try{window.dispatchEvent(new CustomEvent('kelo:surface-ground-ready'))}catch{}}).catch(err=>{failed=true;audit.failed=true;console.error('[Kelo surface ground] atlas load failed',err)});
})();

/* KELO-INDEX ENVIRONMENT/CAPITAL-TEST temporary content bootstrap: carga la composición por capas después de que KELO_ENVIRONMENT_LAYERS ya existe. */
(function(){
  if(window.KELO_CAPITAL_TEST_MAP_BOOTSTRAPPED)return;
  window.KELO_CAPITAL_TEST_MAP_BOOTSTRAPPED=true;
  const script=document.createElement('script');
  script.src='src/environment/capital-test-map.js?v=2';
  script.async=false;
  script.onerror=()=>console.error('[Kelo capital test] bootstrap load failed');
  document.head.appendChild(script);
})();
