/* KELO-INDEX
 * area: WORLD / MAP FORGE / SPRITE MANIFEST
 * owner: KeloMapForge deterministic generator core
 * purpose: derive the exact semantic sprite requirements and scene assembly plan for a generated MapDefinition
 * public-api: buildSpriteManifest(), hasApprovedDecorationSprite()
 * consumes: generated Map Forge candidate parts
 * state-owned: none
 * do-not: no DOM, renderer, catalog mutation, network or Math.random
 */
import {seed32} from './map-forge-prng.mjs';

const uniq=values=>[...new Set((values||[]).filter(Boolean))].sort();

export const KELO_TREE_ASSET_POOLS=Object.freeze({
  temperate:Object.freeze([
    'tree:oak-round-green','tree:pine-tall-evergreen','tree:oak-broad-green','tree:cherry-blossom-pink','tree:oak-autumn-orange',
    'tree:birch-green','tree:willow-weeping','tree:apple-red','tree:oak-dense-dark','tree:canopy-light-green'
  ]),
  forest:Object.freeze([
    'tree:oak-round-green','tree:pine-tall-evergreen','tree:oak-broad-green','tree:birch-green','tree:willow-weeping','tree:oak-dense-dark','tree:canopy-light-green'
  ]),
  farm:Object.freeze(['tree:apple-red','tree:birch-green','tree:canopy-light-green','tree:oak-round-green']),
  ornamental:Object.freeze(['tree:cherry-blossom-pink','tree:oak-autumn-orange','tree:canopy-light-green','tree:oak-round-green']),
  snow:Object.freeze(['tree:pine-snow']),
  ruins:Object.freeze(['tree:dead-gnarled','tree:oak-dense-dark'])
});
const ALL_TREE_ASSETS=Object.freeze(uniq(Object.values(KELO_TREE_ASSET_POOLS).flat()));

const DECORATION_SPECS=Object.freeze({
  tree:Object.freeze({label:'Árbol',orientation:'upright',assetCandidates:ALL_TREE_ASSETS,promptHint:'árbol 2D pixel art top-down/3-quarter, tronco centrado, copa legible, fondo transparente'}),
  bush:Object.freeze({label:'Arbusto / topiario',orientation:'upright',assetCandidates:Object.freeze(['imperial:topiario']),promptHint:'arbusto o topiario 2D pixel art, silueta limpia, fondo transparente'}),
  flower:Object.freeze({label:'Jardinera / flores',orientation:'upright',assetCandidates:Object.freeze(['imperial:jardinera-floral','imperial:jardinera-curva']),promptHint:'jardinera floral 2D pixel art, vista top-down/3-quarter, fondo transparente'}),
  rock:Object.freeze({label:'Roca',orientation:'upright',assetCandidates:Object.freeze([]),promptHint:'roca decorativa 2D pixel art, lectura clara a escala de juego, fondo transparente'}),
  lamp:Object.freeze({label:'Farola',orientation:'upright',assetCandidates:Object.freeze(['imperial:farola','imperial:farola-monumental']),promptHint:'farola 2D pixel art vertical, base visible, fondo transparente'}),
  bench:Object.freeze({label:'Banco',orientation:'directional',assetCandidates:Object.freeze(['imperial:banco']),promptHint:'banco 2D pixel art, vista 3-quarter, orientación frontal consistente, fondo transparente'}),
  market_prop:Object.freeze({label:'Puesto / carrito de mercado',orientation:'directional',assetCandidates:Object.freeze(['imperial:carrito-mercado']),promptHint:'puesto o carrito de mercado 2D pixel art, vista 3-quarter, fondo transparente'}),
  crate:Object.freeze({label:'Caja',orientation:'upright',assetCandidates:Object.freeze([]),promptHint:'caja de madera 2D pixel art, vista top-down/3-quarter, fondo transparente'}),
  barrel:Object.freeze({label:'Barril',orientation:'upright',assetCandidates:Object.freeze([]),promptHint:'barril 2D pixel art, vista 3-quarter, fondo transparente'})
});

const LANDMARK_SPECS=Object.freeze({
  central_fountain:Object.freeze({label:'Fuente central',assetCandidates:Object.freeze(['imperial:fuente-justicia','imperial:fuente-astral','imperial:fuente-leones']),promptHint:'fuente monumental 2D pixel art top-down/3-quarter, plaza imperial, fondo transparente'}),
  main_market:Object.freeze({label:'Mercado principal',assetCandidates:Object.freeze(['imperial:kiosco']),promptHint:'mercado o kiosco principal 2D pixel art, fachada orientada al camino, fondo transparente'}),
  small_market:Object.freeze({label:'Mercado pequeño',assetCandidates:Object.freeze(['imperial:kiosco']),promptHint:'kiosco de mercado compacto 2D pixel art, fachada orientada al camino, fondo transparente'}),
  ancient_tree:Object.freeze({label:'Árbol ancestral',assetCandidates:Object.freeze(['tree:oak-dense-dark','tree:oak-broad-green','tree:willow-weeping','imperial:arbol-florido-blanco','imperial:arbol-florido-azul']),promptHint:'árbol ancestral gigante 2D pixel art, punto focal, fondo transparente'}),
  mysterious_tower:Object.freeze({label:'Torre misteriosa',assetCandidates:Object.freeze(['imperial:obelisco']),promptHint:'torre o monumento misterioso 2D pixel art, punto focal vertical, fondo transparente'}),
  bridge:Object.freeze({label:'Puente',assetCandidates:Object.freeze(['imperial:puente']),promptHint:'puente 2D pixel art top-down/3-quarter, extremos conectables a camino, fondo transparente'}),
  castle:Object.freeze({label:'Castillo',assetCandidates:Object.freeze([]),promptHint:'castillo 2D pixel art top-down/3-quarter, fachada principal clara hacia el camino, fondo transparente'}),
  windmill:Object.freeze({label:'Molino',assetCandidates:Object.freeze([]),promptHint:'molino rural 2D pixel art 3-quarter, entrada clara, fondo transparente'}),
  barn:Object.freeze({label:'Granero',assetCandidates:Object.freeze([]),promptHint:'granero rural 2D pixel art 3-quarter, entrada clara, fondo transparente'}),
  mine_entrance:Object.freeze({label:'Entrada de mina',assetCandidates:Object.freeze([]),promptHint:'entrada de mina 2D pixel art, boca frontal legible y conectable a camino, fondo transparente'})
});

function spriteRecord(key,{kind,semantic,label,orientation='upright',assetCandidates=[],promptHint='sprite 2D pixel art, fondo transparente'}={}){return{key,kind,semantic,label:label||semantic,orientation,assetCandidates:[...assetCandidates],usageCount:0,districts:[],sceneIds:[],roles:[],instanceIds:[],generation:{format:'png',background:'transparent',promptHint}};}
function ensure(records,key,spec){let row=records.get(key);if(!row){row=spriteRecord(key,spec);records.set(key,row);}return row;}
function addUsage(row,{district=null,sceneId=null,role=null,instanceId=null}={}){row.usageCount++;if(district)row.districts.push(district);if(sceneId)row.sceneIds.push(sceneId);if(role)row.roles.push(role);if(instanceId)row.instanceIds.push(instanceId);}
function finalize(row){return{...row,districts:uniq(row.districts),sceneIds:uniq(row.sceneIds),roles:uniq(row.roles),instanceIds:uniq(row.instanceIds),needsGeneration:row.assetCandidates.length===0};}
function sceneMembership(parts){const byDecoration=new Map(),byLandmark=new Map();for(const scene of parts.scenePrefabs||[]){if(scene.landmarkId)byLandmark.set(scene.landmarkId,scene.id);for(const member of scene.members||[])if(member.decorationId)byDecoration.set(member.decorationId,{sceneId:scene.id,role:member.role});}return{byDecoration,byLandmark};}
function landmarkSpec(type){const spec=LANDMARK_SPECS[type]||{};return{kind:'landmark',semantic:type,label:spec.label||String(type||'Landmark'),orientation:'directional',assetCandidates:spec.assetCandidates||[],promptHint:spec.promptHint||`${String(type||'landmark').replaceAll('_',' ')} 2D pixel art top-down/3-quarter, fachada o frente claramente definido, fondo transparente`};}
function decorationSpec(family){const spec=DECORATION_SPECS[family]||{};return{kind:'decoration',semantic:family,label:spec.label||String(family||'Decoración'),orientation:spec.orientation||'upright',assetCandidates:spec.assetCandidates||[],promptHint:spec.promptHint||`${String(family||'prop').replaceAll('_',' ')} 2D pixel art, fondo transparente`};}
function districtKind(parts,id){return String((parts.districts||[]).find(row=>row.id===id)?.kind||'default').toLowerCase();}
function districtHasSnow(parts,id){const cells=(parts.terrain?.cells||[]).filter(row=>!id||row.district===id);return cells.some(row=>String(row.material||'').toLowerCase()==='snow');}
function treePoolFor(decoration,parts,context){
  const biome=String(context?.biome||'').toLowerCase(),kind=districtKind(parts,decoration?.district);
  if(biome.includes('snow')||biome.includes('tundra')||biome.includes('winter')||districtHasSnow(parts,decoration?.district))return KELO_TREE_ASSET_POOLS.snow;
  if(kind==='ruins'||kind==='mine')return KELO_TREE_ASSET_POOLS.ruins;
  if(kind==='farm')return KELO_TREE_ASSET_POOLS.farm;
  if(kind==='forest')return KELO_TREE_ASSET_POOLS.forest;
  if(kind==='plaza'||kind==='royal'||kind==='commerce')return KELO_TREE_ASSET_POOLS.ornamental;
  return KELO_TREE_ASSET_POOLS.temperate;
}
function candidatesForDecoration(decoration,parts,context){return decoration?.family==='tree'?treePoolFor(decoration,parts,context):decorationSpec(decoration?.family).assetCandidates;}
function chooseAsset(candidates,decoration,context){
  if(!candidates?.length)return null;
  const key=`${context?.seed??0}|${decoration?.id||'dec'}|${decoration?.district||'none'}|${decoration?.family||'unknown'}|${Number(decoration?.x)||0}|${Number(decoration?.y)||0}`;
  return candidates[seed32(key)%candidates.length];
}

export function hasApprovedDecorationSprite(family){return (DECORATION_SPECS[String(family||'')]?.assetCandidates?.length||0)>0;}

export function buildSpriteManifest(parts,context={}){
  const records=new Map(),membership=sceneMembership(parts),instanceBindings=[];
  const boundDecorations=(parts.decorations||[]).map(decoration=>{
    const candidates=candidatesForDecoration(decoration,parts,context),assetRef=chooseAsset(candidates,decoration,context);
    if(assetRef)instanceBindings.push({instanceId:decoration.id,spriteKey:`decoration:${decoration.family||'unknown'}`,assetId:assetRef,district:decoration.district||null,family:decoration.family||'unknown'});
    return assetRef?{...decoration,assetRef}:{...decoration};
  });
  const bindingByInstance=new Map(instanceBindings.map(row=>[row.instanceId,row]));
  for(const landmark of parts.landmarks||[]){const key=`landmark:${landmark.type||landmark.role||'unknown'}`,spec=landmarkSpec(landmark.type||landmark.role||'unknown'),row=ensure(records,key,spec);addUsage(row,{district:landmark.district,sceneId:membership.byLandmark.get(landmark.id),role:'scene-anchor',instanceId:landmark.id});}
  for(const decoration of boundDecorations){const key=`decoration:${decoration.family||'unknown'}`,spec=decorationSpec(decoration.family||'unknown'),row=ensure(records,key,spec),scene=membership.byDecoration.get(decoration.id);addUsage(row,{district:decoration.district,sceneId:scene?.sceneId,role:scene?.role,instanceId:decoration.id});}
  const sprites=[...records.values()].map(finalize).sort((a,b)=>b.usageCount-a.usageCount||a.key.localeCompare(b.key));
  const byKey=new Map(sprites.map(row=>[row.key,row]));
  const sceneBuildPlan=(parts.scenePrefabs||[]).map(scene=>{
    const landmark=(parts.landmarks||[]).find(row=>row.id===scene.landmarkId),requirements=[];
    if(landmark)requirements.push({role:'scene-anchor',spriteKey:`landmark:${landmark.type||landmark.role||'unknown'}`,instanceId:landmark.id});
    for(const member of scene.members||[]){const binding=bindingByInstance.get(member.decorationId);requirements.push({role:member.role,spriteKey:`decoration:${member.family||'unknown'}`,instanceId:member.decorationId,...(binding?.assetId?{assetId:binding.assetId}:{})});}
    const spriteKeys=uniq(requirements.map(row=>row.spriteKey)),needsGeneration=spriteKeys.filter(key=>byKey.get(key)?.needsGeneration);
    return{sceneId:scene.id,prefabId:scene.prefabId,sceneType:scene.sceneType||'landmark',kit:scene.kit,district:scene.district,anchor:scene.anchor,rotation:Number(scene.rotation)||0,connector:(scene.connectors||[])[0]||null,memberCount:Number(scene.memberCount)||requirements.length,readyForAssembly:requirements.length>=2&&!!(scene.connectors||[]).length,spriteKeys,needsGeneration,requirements};
  });
  const tileMaterials=uniq([...(parts.terrain?.cells||[]).map(row=>row.material),...(parts.roads||[]).map(row=>row.material)]);
  const totalInstances=sprites.reduce((sum,row)=>sum+row.usageCount,0),needsGeneration=sprites.filter(row=>row.needsGeneration);
  return{decorations:boundDecorations,spriteManifest:{version:'map-forge-sprite-manifest-v2',uniqueSprites:sprites.length,totalInstances,readyAssetTypes:sprites.length-needsGeneration.length,needsGenerationTypes:needsGeneration.length,tileMaterials,sprites,instanceBindings,generationQueue:needsGeneration.map(row=>({spriteKey:row.key,label:row.label,usageCount:row.usageCount,districts:row.districts,sceneIds:row.sceneIds,generation:row.generation}))},sceneBuildPlan};
}
