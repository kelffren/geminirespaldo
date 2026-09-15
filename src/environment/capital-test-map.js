/* KELO-INDEX
 * area: ENVIRONMENT / WORLD
 * owner: KELO_WORLD_RENDERER via KELO_ENVIRONMENT_LAYERS
 * keys: CAPITAL TEST MAP PLAZA ASSET COMPOSITION OCCLUSION MOBILE
 * purpose: Capital Test V2 compuesta únicamente con assets reales individuales del repo
 * public-api: KELO_CAPITAL_TEST_MAP_AUDIT
 * consumes: KELO_ENVIRONMENT_LAYERS, KELO_ATLAS_CONTRACT, KELO_TILE_REGISTRY
 * state-owned: solo readiness visual local de los assets de esta composición
 * extension-points: PLACEMENTS data-driven; futuros distritos deben migrar a contracts de contenido
 * reuse: prueba visual temporal; no crea renderer paralelo ni autoridad gameplay
 * online: N/A; presentación local, sin estado compartido ni economía
 * do-not: NO envolver render, NO tocar posición del jugador, NO escribir obstacles, NO usar spritesheets enteros como mapa
 */
(function(){
'use strict';
const L=window.KELO_ENVIRONMENT_LAYERS,A=window.KELO_ATLAS_CONTRACT,R=window.KELO_TILE_REGISTRY;
if(!L?.register||!A?.register||!A?.acquire||!R?.atlases?.plazaNature){console.error('[Kelo capital test] environment layers / atlas contract / registry missing');return;}

const ASSETS=Object.freeze({
  compass:Object.freeze({id:'capital-v2-compass',src:'assets/world/imperial-plaza/rosa-de-los-vientos.png?art=602',width:1254,height:1254}),
  planter:Object.freeze({id:'capital-v2-planter',src:'assets/world/imperial-plaza/jardinera-imperial-curva.png?art=604',width:1254,height:1254}),
  kiosk:Object.freeze({id:'capital-v2-kiosk',src:'assets/world/imperial-plaza/kiosco-imperial.png?art=608',width:1254,height:1254}),
  lamp:Object.freeze({id:'capital-v2-lamp',src:'assets/world/imperial-plaza/farola-monumental.png?art=613',width:1122,height:1402}),
  bench:Object.freeze({id:'capital-v2-bench',src:'assets/world/imperial-plaza/banco-imperial.png?art=615',width:1448,height:1086})
});
const NATURE=R.atlases.plazaNature;
const PLAZA=Object.freeze({x:1080,y:1160,w:720,h:720});

const CAPITAL_TREES=Object.freeze([
  Object.freeze({id:'capital-tree-nw-a',frame:'tree_large',x:930,y:1160,w:132,h:176,baseY:1336}),
  Object.freeze({id:'capital-tree-nw-b',frame:'tree_pink',x:1004,y:1058,w:126,h:160,baseY:1218}),
  Object.freeze({id:'capital-tree-ne-a',frame:'tree_large',x:1818,y:1158,w:132,h:176,baseY:1334}),
  Object.freeze({id:'capital-tree-ne-b',frame:'tree_cypress',x:1750,y:1035,w:82,h:210,baseY:1245}),
  Object.freeze({id:'capital-tree-sw-a',frame:'tree_medium',x:936,y:1740,w:126,h:170,baseY:1910}),
  Object.freeze({id:'capital-tree-sw-b',frame:'tree_pink',x:1012,y:1830,w:128,h:160,baseY:1990}),
  Object.freeze({id:'capital-tree-se-a',frame:'tree_large',x:1810,y:1734,w:132,h:176,baseY:1910}),
  Object.freeze({id:'capital-tree-se-b',frame:'tree_small',x:1742,y:1832,w:106,h:142,baseY:1974})
]);

const BACK_PROPS=Object.freeze([
  Object.freeze({id:'lamp-nw',asset:'lamp',x:1112,y:1210,w:92,h:116}),
  Object.freeze({id:'lamp-ne',asset:'lamp',x:1678,y:1210,w:92,h:116}),
  Object.freeze({id:'lamp-sw',asset:'lamp',x:1112,y:1720,w:92,h:116}),
  Object.freeze({id:'lamp-se',asset:'lamp',x:1678,y:1720,w:92,h:116}),
  Object.freeze({id:'bench-west',asset:'bench',x:1130,y:1460,w:146,h:110}),
  Object.freeze({id:'bench-east',asset:'bench',x:1604,y:1460,w:146,h:110}),
  Object.freeze({id:'planter-nw',asset:'planter',x:1200,y:1250,w:150,h:150}),
  Object.freeze({id:'planter-ne',asset:'planter',x:1530,y:1250,w:150,h:150}),
  Object.freeze({id:'planter-sw',asset:'planter',x:1200,y:1630,w:150,h:150}),
  Object.freeze({id:'planter-se',asset:'planter',x:1530,y:1630,w:150,h:150}),
  Object.freeze({id:'market-kiosk-east',asset:'kiosk',x:1760,y:1390,w:250,h:250})
]);

const images=Object.create(null);
let natureImg=null,ready=false,failed=false;
const audit=window.KELO_CAPITAL_TEST_MAP_AUDIT={
  version:'capital-test-map-v2.0.0',ready:false,failed:false,mode:'individual-asset-composition-v2',
  plazaBounds:PLAZA,treeCount:CAPITAL_TREES.length,propCount:BACK_PROPS.length,assetKeys:Object.freeze(Object.keys(ASSETS)),
  layers:Object.freeze(['paths_floors','props_back','props_front']),usesRealAssets:true,usesWholeSpritesheetAsMap:false,
  rendererWrapper:false,collisionWrites:false,visibleDuringReset:true,lastFrontOccluderCount:0
};

function registerAssets(){
  for(const [key,asset] of Object.entries(ASSETS)){
    const atlasKey='capitalV2:'+key;
    if(!A.describe(atlasKey))A.register(atlasKey,asset,{role:'optional'});
  }
}
function frameRect(name){const f=NATURE.frames?.[name];return f?{x:Number(f.x)||0,y:Number(f.y)||0,w:Number(f.w)||0,h:Number(f.h)||0}:null;}
function drawTree(g,p){if(!natureImg)return false;const s=frameRect(p.frame);if(!s||!(s.w>0&&s.h>0))return false;g.drawImage(natureImg,s.x,s.y,s.w,s.h,p.x,p.y,p.w,p.h);return true;}
function drawAsset(g,key,p){const img=images[key];if(!img)return false;g.drawImage(img,0,0,img.naturalWidth,img.naturalHeight,p.x,p.y,p.w,p.h);return true;}
function drawFloor(g){if(!ready||failed)return;g.save();g.imageSmoothingEnabled=false;drawAsset(g,'compass',PLAZA);g.restore();}
function drawBack(g){if(!ready||failed)return;g.save();g.imageSmoothingEnabled=false;for(const t of CAPITAL_TREES)drawTree(g,t);for(const p of BACK_PROPS)drawAsset(g,p.asset,p);g.restore();}
function actorOverlapsTree(actor,p){if(!actor)return false;const r=Math.max(18,Number(actor.radius)||20);return actor.x+r>p.x&&actor.x-r<p.x+p.w&&actor.y+r>p.y&&actor.y-r<p.y+p.h;}
function drawFront(g){
  if(!ready||failed||!natureImg)return;
  const actors=[];if(typeof localPlayer!=='undefined'&&localPlayer)actors.push(localPlayer);if(typeof simulatedPlayers!=='undefined'&&Array.isArray(simulatedPlayers))actors.push(...simulatedPlayers);
  let count=0;g.save();g.imageSmoothingEnabled=false;
  for(const p of CAPITAL_TREES){const occlude=actors.some(actor=>actorOverlapsTree(actor,p)&&(Number(actor.y)||0)<p.baseY);if(occlude&&drawTree(g,p))count++;}
  g.restore();audit.lastFrontOccluderCount=count;
}
function backBounds(){return [...CAPITAL_TREES,...BACK_PROPS].map(p=>({id:p.id,x:p.x,y:p.y,w:p.w,h:p.h}));}

try{
  L.register({id:'capital-test-plaza-floor',phase:'paths_floors',priority:6,required:true,visibleDuringReset:true,ready:()=>ready&&!failed,draw:drawFloor,ownership:'capital-test-map-v2',bounds:()=>[{id:'capital-test-plaza',...PLAZA}]});
  L.register({id:'capital-test-trees-back',phase:'props_back',priority:6,required:true,visibleDuringReset:true,ready:()=>ready&&!failed,draw:drawBack,ownership:'capital-test-map-v2',bounds:backBounds});
  L.register({id:'capital-test-trees-front',phase:'props_front',priority:6,required:true,visibleDuringReset:true,ready:()=>ready&&!failed,draw:drawFront,ownership:'capital-test-map-v2',bounds:()=>CAPITAL_TREES.map(p=>({id:p.id,x:p.x,y:p.y,w:p.w,h:p.h}))});
}catch(err){failed=true;audit.failed=true;console.error('[Kelo capital test] layer registration failed',err);return;}

registerAssets();
Promise.all([
  ...Object.keys(ASSETS).map(key=>A.acquire('capitalV2:'+key).then(img=>{images[key]=img;})),
  A.acquire('plazaNature').then(img=>{natureImg=img;})
]).then(()=>{
  ready=true;audit.ready=true;
  try{window.dispatchEvent(new CustomEvent('kelo:capital-test-map-ready',{detail:{version:audit.version}}));}catch{}
}).catch(err=>{failed=true;audit.failed=true;console.error('[Kelo capital test] asset load failed',err);});
})();
