/* KELO-INDEX
 * area: TEST / MAP FORGE / STUDIO HANDOFF
 * owner: Map Forge Studio handoff contract audit
 * purpose: prove deterministic normalized preview + authority exterior handoff without direct LIVE mutation or parallel renderers
 * online: validates replaceable KELO_WORLD_EDIT import boundary
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {generateBestOf} from '../src/world/map-forge/map-forge-core.mjs';
import {getMapForgeRecipe} from '../src/world/map-forge/map-forge-recipes.mjs';
import {mapDefinitionToWorldDraftSnapshot,mapForgeDocumentMetadata} from '../src/studio/adapters/map-forge-draft-importer.mjs';

const recipe=getMapForgeRecipe('KELO_ROYAL_CAPITAL_V1');
const run=generateBestOf(recipe,{seed:48291,count:4,assetCatalogVersion:'handoff-ci'});
const map=run.best;
assert(map?.validation?.valid,'best Royal Capital candidate must be valid');
const a=mapDefinitionToWorldDraftSnapshot(map),b=mapDefinitionToWorldDraftSnapshot(map);
assert.deepEqual(a,b,'projection must be deterministic');
const rows=Object.values(a.cells);
assert(rows.length>5000,`city draft should contain real terrain cells; got ${rows.length}`);
assert(rows.some(x=>x.role==='path'),'generated roads must become editable path cells');
assert(rows.some(x=>x.role==='terrain'),'generated terrain must become editable terrain cells');
assert(rows.every(x=>x.material==='grass'||x.material==='marble'),'projection must emit only current runtime materials');
assert.equal(a.worldId,'world:kelo-main');

const mockTemplates=[
  {id:'imperial:fuente-justicia',label:'Fuente de la Justicia',family:'fountain',category:'architecture',width:128,height:128,collision:{x:0,y:64,w:128,h:64},placeable:true},
  {id:'imperial:kiosco',label:'Kiosco Imperial',family:'market',category:'architecture',width:160,height:160,collision:null,placeable:true},
  {id:'imperial:arbol-florido-blanco',label:'Árbol Florido Blanco',family:'tree',category:'nature',width:128,height:128,collision:{x:24,y:88,w:80,h:40},placeable:true},
  {id:'imperial:farola',label:'Farola Imperial',family:'lamp',category:'decor',width:64,height:96,collision:{x:16,y:64,w:32,h:32},placeable:true},
  {id:'imperial:banco',label:'Banco Imperial',family:'bench',category:'decor',width:128,height:96,collision:{x:0,y:64,w:128,h:32},placeable:true},
  {id:'imperial:jardinera-curva',label:'Jardinera Imperial Curva',family:'flower garden',category:'decor',width:160,height:160,collision:{x:0,y:96,w:160,h:64},placeable:true},
  {id:'imperial:topiario',label:'Topiario Imperial',family:'bush',category:'nature',width:96,height:96,collision:{x:16,y:64,w:64,h:32},placeable:true},
  {id:'imperial:puente',label:'Puente Imperial',family:'harbor bridge',category:'architecture',width:160,height:128,collision:null,placeable:true},
  {id:'imperial:obelisco',label:'Obelisco Imperial',family:'tower monument',category:'architecture',width:96,height:128,collision:{x:0,y:80,w:96,h:48},placeable:true}
];
const mockCatalog={version:'mock-property-catalog-v1',list:()=>mockTemplates,get:id=>mockTemplates.find(x=>x.id===id)||null};
const templateById=new Map(mockTemplates.map(x=>[x.id,x]));
const visual=mapDefinitionToWorldDraftSnapshot(map,{assetCatalog:mockCatalog});
assert(visual.placements.length>0,'semantic Map Forge landmarks/decorations must project into Property placements for exterior preview');
assert(visual.placements.some(x=>x.assetId==='imperial:fuente-justicia'),'central fountain landmark must become a real exterior Property placement');
assert(visual.placements.some(x=>x.assetId==='imperial:farola'),'generated lamp decorations must become a real exterior Property placement');
assert(visual.placements.every(x=>Number.isFinite(x.x)&&Number.isFinite(x.y)&&x.x>=0&&x.y>=0),'derived placements must stay inside world coordinates');

const placementRect=p=>{const t=templateById.get(p.assetId);assert(t,`missing mock template ${p.assetId}`);const q=((p.rotation%4)+4)%4;return{x:p.x,y:p.y,w:q%2?t.height:t.width,h:q%2?t.width:t.height};};
const placementCollisionRect=p=>{const t=templateById.get(p.assetId);assert(t,`missing mock template ${p.assetId}`);if(!t.collision)return null;const visualRect=placementRect(p),q=((p.rotation%4)+4)%4,{x,y,w,h}=t.collision;let local;if(q===1)local={x:t.height-(y+h),y:x,w:h,h:w};else if(q===2)local={x:t.width-(x+w),y:t.height-(y+h),w,h};else if(q===3)local={x:y,y:t.width-(x+w),w:h,h:w};else local={x,y,w,h};return{x:visualRect.x+local.x,y:visualRect.y+local.y,w:local.w,h:local.h};};
const rectOverlap=(x,y,pad=0)=>x.x<y.x+y.w+pad&&x.x+x.w+pad>y.x&&x.y<y.y+y.h+pad&&x.y+x.h+pad>y.y;
const pathCellsFor=(r,cellRows=rows)=>r?cellRows.filter(cell=>cell.role==='path'&&cell.x<r.x+r.w+4&&cell.x+32>r.x-4&&cell.y<r.y+r.h+4&&cell.y+32>r.y-4):[];
const visualDecor=visual.placements.filter(p=>p.placementId.startsWith('map-forge:decoration:'));
for(const p of visualDecor){
  const r=placementRect(p),collision=placementCollisionRect(p);
  assert(!map.blocks.some(block=>rectOverlap(r,block.bounds,8)),`real Property visual footprint ${p.placementId} must not overlap a buildable block`);
  if(collision)assert.equal(pathCellsFor(collision).length,0,`real Property collision footprint ${p.placementId} must not cover navigable path cells`);
}
for(let i=0;i<visualDecor.length;i++)for(let j=i+1;j<visualDecor.length;j++)assert(!rectOverlap(placementRect(visualDecor[i]),placementRect(visualDecor[j]),8),`derived decor footprints must not visually stack: ${visualDecor[i].placementId} / ${visualDecor[j].placementId}`);

const injected=JSON.parse(JSON.stringify(map));
const block=injected.blocks[0];
assert(block?.bounds,'fixed-seed regression needs a buildable block');
injected.decorations.push({id:'reg:block-footprint',district:block.district||injected.districts[0].id,family:'flower',x:block.bounds.x-20,y:block.bounds.y+block.bounds.h/2,rotation:0,scale:1});
const road=injected.roads[0],roadPoint=road.polyline[Math.floor(road.polyline.length/2)];
injected.decorations.push({id:'reg:path-footprint',district:injected.districts[0].id,family:'bench',x:roadPoint.x,y:roadPoint.y,rotation:0,scale:1});
const injectedVisual=mapDefinitionToWorldDraftSnapshot(injected,{assetCatalog:mockCatalog});
assert(!injectedVisual.placements.some(p=>p.placementId==='map-forge:decoration:reg:block-footprint'),'fixed-seed block-edge decoration whose rendered asset crosses the block must be culled');
assert(!injectedVisual.placements.some(p=>p.placementId==='map-forge:decoration:reg:path-footprint'),'fixed-seed decoration whose physical collision base crosses the path must be culled');

const overhang=JSON.parse(JSON.stringify(map));
overhang.blocks=[];
overhang.landmarks=[];
overhang.decorations=[{id:'reg:lamp-overhang',district:overhang.districts[0].id,family:'lamp',x:600,y:700,rotation:0,scale:1}];
overhang.roads=[{id:'reg:horizontal-road',class:'local',width:112,polyline:[{x:400,y:600},{x:800,y:600}]}];
const overhangVisual=mapDefinitionToWorldDraftSnapshot(overhang,{assetCatalog:mockCatalog});
const lamp=overhangVisual.placements.find(p=>p.placementId==='map-forge:decoration:reg:lamp-overhang');
assert(lamp,'street lamp must survive when only its non-colliding artwork overhangs the road');
const overhangRows=Object.values(overhangVisual.cells),lampVisualRect=placementRect(lamp),lampCollisionRect=placementCollisionRect(lamp);
assert(pathCellsFor(lampVisualRect,overhangRows).length>0,'regression fixture must prove the lamp artwork actually overhangs path pixels');
assert.equal(pathCellsFor(lampCollisionRect,overhangRows).length,0,'regression fixture must keep the lamp physical base clear of navigable path pixels');

const meta=mapForgeDocumentMetadata(map);
assert(meta.tags.includes('map-forge')&&meta.tags.some(x=>x.startsWith('seed:'))&&meta.tags.some(x=>x.startsWith('layout:')));
const importer=fs.readFileSync('src/studio/adapters/map-forge-draft-importer.mjs','utf8');
const world=fs.readFileSync('src/creators/workspaces/world-workspace.mjs','utf8');
const mapWorkspace=fs.readFileSync('src/creators/workspaces/map-forge-workspace.mjs','utf8');
const entry=fs.readFileSync('src/creators/creator-entry.mjs','utf8');
const hub=fs.readFileSync('src/creators/ui/creator-hub.mjs','utf8');
const ui=fs.readFileSync('src/creators/ui/map-forge-workspace.mjs','utf8');
const builder=fs.readFileSync('src/environment/world-builder-system.js','utf8');
const property=fs.readFileSync('src/property/property-system.js','utf8');
const index=fs.readFileSync('index.html','utf8');

assert(importer.includes("world:draft:create")&&importer.includes('forceNew:true')&&importer.includes("world:draft:import"),'handoff must use World authority draft boundary');
assert(importer.includes('root.KELO_PROPERTY_CATALOG'),'semantic visual projection must reuse the LIVE Property catalog owner');
assert(importer.includes('rotatedTemplateSize')&&importer.includes('rotatedCollisionRect')&&importer.includes('rectHitsPath'),'exterior projection must distinguish the real rotated Property collision footprint from visual overhang');
for(const bad of['KELO_COLLISION.replaceOwner','KELO_WORLD_RENDERER=','KELO_PROPERTY_SYSTEM.request','obstacles.push'])assert(!importer.includes(bad),`direct LIVE mutation forbidden in importer: ${bad}`);
assert(world.includes('importMapForgeIntoWorldDraft')&&world.includes('openKeloStudioLive'),'World workspace must remain final consumer');
assert(world.includes('previewOnly')&&world.includes("world:preview:enter"),'generated exterior preview must use the existing World authority preview boundary');
assert(world.includes('entered?.viewSnapshot')&&world.includes('MAP_FORGE_PREVIEW_RUNTIME_PROJECTION_MISSING'),'exterior handoff must verify authority snapshot and runtime projection before success');
assert(world.includes('root.KeloCamera.focus')&&world.includes("source:'map-forge-exterior-preview'"),'exterior preview must focus through KeloCamera owner');
assert(mapWorkspace.includes('options={}')&&mapWorkspace.includes('...options'),'Map Forge workspace must forward handoff mode without creating another authority');
assert(entry.includes('registerMapForgeWorkspace')&&entry.includes('openWorkspace,...context'),'Creators must register Map Forge and inject generic workspace routing');
assert(hub.includes("['map-forge','Map Forge','active']"),'Creator Hub must expose Map Forge');

assert(ui.includes('mapDefinitionToWorldDraftSnapshot'),'Map Forge preview must consume the same normalized snapshot projection as exterior handoff');
assert(ui.includes('KELO_WORLD_BUILDER?.renderSnapshotPreview'),'Map Forge preview must reuse World Builder renderer capability');
assert(!ui.includes('TERRAIN_COLORS'),'diagram-only terrain color preview must not remain the default renderer');
assert(ui.includes('VER EN MAPA EXTERIOR')&&ui.includes('ABRIR EN WORLD EDITOR')&&ui.includes('createMapForgeWorkerClient'),'Map Forge UI must preserve generator, editor and exterior actions');
assert(ui.includes('VOLVER A MAP FORGE')&&ui.includes("world:preview:exit"),'exterior preview must provide a reversible return path without regeneration');
assert(ui.includes('WeakMap()')&&ui.includes('previewCache'),'normalized candidate preview snapshots must be cached per generated candidate');
assert(ui.includes("KeloInputLocks.release")&&ui.includes('releaseInput()'),'detaching Map Forge must release its input claim');
const exteriorStart=ui.indexOf('async function handoffExterior');
const detachAt=ui.indexOf('detachWorkspace();',exteriorStart);
const awaitAt=ui.indexOf('await onOpenWorld',exteriorStart);
assert(exteriorStart>=0&&detachAt>exteriorStart&&awaitAt>detachAt,'Map Forge fullscreen shell must detach before awaiting exterior handoff');
assert(ui.slice(exteriorStart,awaitAt).includes('busy=true'),'double-tap guard must be armed before detaching the shell');
assert(ui.includes('resumeWorkspace();status.textContent'),'failed exterior handoff must restore the same Map Forge session');

assert(builder.includes('renderSnapshotPreview'),'World Builder owner must expose read-only normalized snapshot preview rendering');
assert(builder.includes('window.KELO_PROPERTY_SYSTEM')&&builder.includes('.drawPlacements'),'World Builder preview must reuse Property renderer for snapshot placements');
assert(builder.includes('SURFACE_ATLAS_KEY')&&builder.includes('surfaceGround'),'World Builder must reuse the approved live ground atlas when legacy terrain atlases are retired');
assert(builder.includes('atlasUsable')&&builder.includes('retiredVisual'),'retired/reset terrain atlases must not silently draw transparent tiles');
assert(property.includes('function drawPlacements')&&property.includes('drawPlacements,exportLayout'),'Property owner must expose one read-only placement renderer instead of duplicating template drawing');
assert(property.includes('kelo:property-render-assets-ready'),'preview must redraw when real Property assets finish loading');
for(const bad of['obstacles.push','KELO_WORLD_RENDERER='])assert(!property.includes(bad),`Property preview capability must not add forbidden ownership writes: ${bad}`);

assert(index.includes('src/property/property-system.js')&&index.includes('src/environment/world-builder-system.js'),'runtime must still load the existing Property and World Builder owners');

console.log(JSON.stringify({ok:true,seed:map.metadata.seed,score:map.quality.total,cells:rows.length,paths:rows.filter(x=>x.role==='path').length,terrain:rows.filter(x=>x.role==='terrain').length,placements:visual.placements.length,decorPlacements:visualDecor.length,layoutHash:map.metadata.layoutHash,realPreview:true,footprintClearance:true,visualOverhangAllowed:true,reversibleExteriorPreview:true,cameraOwner:'KeloCamera'},null,2));
