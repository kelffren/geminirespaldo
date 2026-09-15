import fs from 'node:fs';
import vm from 'node:vm';

const contractSource=fs.readFileSync('src/environment/prefab-contract.js','utf8');
const rendererSource=fs.readFileSync('src/environment/generic-prefabs.js','utf8');
const adapterSource=fs.readFileSync('src/environment/luxe-kiosk-atlas.js','utf8');
const indexSource=fs.readFileSync('index.html','utf8');

const window={KELO_TILE_REGISTRY:{version:'test-registry',styles:{architecture:{mode:'test'}},architectureAssets:{
  shop:{id:'shop',src:'shop.png',width:192,height:222,worldWidth:192,worldHeight:222,family:'architecture'},
  castleBase:{id:'castle-base',src:'castle-base.png',width:320,height:256,worldWidth:320,worldHeight:256,family:'architecture'},
  castleFront:{id:'castle-front',src:'castle-front.png',width:256,height:128,worldWidth:256,worldHeight:128,family:'architecture',frames:[{id:'roof',x:0,y:0,w:160,h:96,worldWidth:320,worldHeight:192}]}
},architecturePrefabs:{
  shop:{id:'shop-central',asset:'shop',x:100,y:200,collision:{x:120,y:370,w:140,h:40},interaction:{x:196,y:430,radius:90},occlusion:{sideInset:8,topInset:30,bottomPadding:4,clip:{xPadding:6,topPadding:20,bottomPadding:6}},districts:['central']},
  castle:{id:'castle-north',asset:'castleBase',x:700,y:400,collision:{x:740,y:610,w:240,h:46},entrance:{x:860,y:668,radius:110},doors:[{id:'main'}],shadows:[{id:'base'}],overlays:[{id:'banner'}],animation:[{id:'flag'}],render:{back:{id:'walls',asset:'castleBase'},front:{id:'roof',asset:'castleFront',frame:'roof',xOffset:0,yOffset:-48}},districts:['north']}
}}};
const context=vm.createContext({window,console});
vm.runInContext(contractSource,context,{filename:'prefab-contract.js'});
const C=window.KELO_PREFAB_CONTRACT;
if(!C)throw new Error('Prefab contract did not initialize');
if(C.version!=='1.1.0'||C.mode!=='data-driven-building-prefabs-v2'||C.prefabs.length!==2)throw new Error('Unexpected contract version/count');
const shop=C.prefabs.find(p=>p.id==='shop-central');
if(!shop||shop.renderPlan.back.length!==1||shop.renderPlan.front.length!==0||shop.renderPlan.occlusionFallback!=='clip-redraw-back-v1')throw new Error('Legacy single-raster prefab did not normalize into generic back+clip plan');
const castle=C.prefabs.find(p=>p.id==='castle-north');
if(!castle||castle.asset!=='castleBase'||castle.size.w!==320||castle.size.h!==256)throw new Error('Unknown building did not normalize from metadata');
if(castle.entrance?.x!==860||castle.doors.length!==1||castle.shadows.length!==1||castle.overlays.length!==1||castle.animation.length!==1||castle.districts[0]!=='north')throw new Error('Optional building metadata was not preserved');
if(castle.renderPlan.back.length!==1||castle.renderPlan.front.length!==1||castle.renderPlan.occlusionFallback!=='none')throw new Error('Split building render plan was not normalized');
const roof=castle.renderPlan.front[0];
if(roof.asset!=='castleFront'||roof.frame!=='roof'||roof.phase!=='props_front'||roof.source.w!==160||roof.source.h!==96||roof.size.w!==320||roof.size.h!==192||roof.offset.y!==-48)throw new Error('Front asset/frame metadata was not resolved into executable render data');
for(const key of ['renderParts','splitLayers','splitAssets','frameSelection','colliders','interactionMetadata','entrances','doors','shadows','overlays','animationFrames','occlusion','districtCompatibility'])if(C.capabilities[key]!==true)throw new Error(`Missing capability ${key}`);
if(/luxeBoutique|kelo-luxe|SHOP|Boutique/.test(rendererSource))throw new Error('Generic prefab renderer contains building-specific knowledge');
for(const token of ['part.source','part.offset','part.size','part.phase','renderPlan?.parts','clip-redraw-back-v1'])if(!rendererSource.includes(token))throw new Error(`Renderer does not consume normalized render metadata: ${token}`);
if(/new Image\(|drawImage|\.register\(\{id:[`'\"]?luxe/.test(adapterSource))throw new Error('Luxe adapter still owns rendering');

const contractLive=/src\/environment\/prefab-contract\.js\?v=[^\"']+/.test(indexSource);
const genericRendererLive=/src\/environment\/generic-prefabs\.js\?v=[^\"']+/.test(indexSource);
if(!contractLive)throw new Error('Prefab data contract is not booted in the live runtime');
if(genericRendererLive)throw new Error('generic-prefabs.js is currently classified DORMANT; update ENGINE_MAP/contracts before activating it');

console.log(JSON.stringify({ok:true,contractLive,genericRendererLive,rendererContractTested:true,mode:'live-contract+dormant-renderer'},null,2));
