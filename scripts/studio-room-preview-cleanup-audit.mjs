import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudioOverlayRenderer, resolveRoomPreviewGroups } from '../src/studio/render/studio-overlay-renderer.mjs';

const roomId='room:audit-preview';
const walls=[];
for(let i=0;i<2;i++){
  walls.push({prefabId:'wall',transform:{x:i*64,y:-8,rotation:0},bounds:{w:64,h:16},components:{buildingPiece:{type:'wall',roomGenerated:true,roomId,roomEdge:'top',roomIndex:i}}});
  walls.push({prefabId:'wall',transform:{x:i*64,y:120,rotation:0},bounds:{w:64,h:16},components:{buildingPiece:{type:'wall',roomGenerated:true,roomId,roomEdge:'bottom',roomIndex:i}}});
  walls.push({prefabId:'wall',transform:{x:-32,y:32+i*64,rotation:90},bounds:{w:64,h:16},components:{buildingPiece:{type:'wall',roomGenerated:true,roomId,roomEdge:'left',roomIndex:i}}});
  walls.push({prefabId:'wall',transform:{x:96,y:32+i*64,rotation:90},bounds:{w:64,h:16},components:{buildingPiece:{type:'wall',roomGenerated:true,roomId,roomEdge:'right',roomIndex:i}}});
}
const floors=[];
for(let row=0;row<4;row++)for(let col=0;col<4;col++)floors.push({
  prefabId:'floor',transform:{x:col*32,y:row*32,rotation:0},bounds:{w:32,h:32},
  components:{buildingPiece:{type:'floor',roomGenerated:true,roomInterior:true,roomId,roomFloorCol:col,roomFloorRow:row}}
});
const rows=[...walls,...floors];
const groups=resolveRoomPreviewGroups(rows);
assert.equal(groups.walls.length,8,'ROOM preview grouping must preserve all wall modules');
assert.equal(groups.floors.length,16,'ROOM preview grouping must preserve all floor tiles');
assert.equal(groups.other.length,0,'semantic ROOM rows must not fall through to generic preview chrome');
assert.deepEqual(groups.floorBounds,{x:0,y:0,w:128,h:128},'floor tiles must collapse to one exact interior guide boundary');

function render(previews){
  let assets=0,strokes=0,fills=0,dashes=0;
  const kernel={selection:{get:()=>[]},spatial:{get:()=>null}};
  const tools={quickBuild:{getDragPreviews:()=>[]},roomBuild:{getPreviews:()=>previews,getMeasurement:()=>null}};
  const assetPreview={drawAsset:()=>{assets++;return true;}};
  const ctx={
    globalAlpha:1,save(){},restore(){},setLineDash(){dashes++;},strokeRect(){strokes++;},fillRect(){fills++;},beginPath(){},arc(){},fill(){},stroke(){},moveTo(){},lineTo(){},translate(){},rotate(){},fillText(){},measureText(){return{width:80};}
  };
  createStudioOverlayRenderer({kernel,tools,assetPreview}).draw(ctx);
  return{assets,strokes,fills,dashes};
}

const dense=render(rows);
assert.equal(dense.assets,24,'decluttering must not hide any wall or floor asset preview');
assert.equal(dense.strokes,9,'8 wall outlines + 1 floor boundary must replace 24 per-piece outlines');
assert.equal(dense.fills,0,'successful asset previews must not add placeholder fill noise');
const oldStrokeCount=rows.length;
const reduction=(oldStrokeCount-dense.strokes)/oldStrokeCount;
assert.ok(reduction>=0.625,'fixture must reduce ROOM guide rectangles by at least 62.5%');

const wallsOnly=render(walls);
assert.equal(wallsOnly.assets,8,'walls-only fallback must still draw every wall');
assert.equal(wallsOnly.strokes,8,'walls-only ROOM must retain one guide per wall and add no phantom floor boundary');

const source=fs.readFileSync(new URL('../src/studio/render/studio-overlay-renderer.mjs',import.meta.url),'utf8');
assert.match(source,/drawRoomBuildDrag/,'ROOM must use its dedicated low-noise preview renderer');
assert.match(source,/outline:false/,'ROOM floor tiles must render without per-tile outline chrome');
assert.doesNotMatch(source,/KELO_WORLD_EDIT|kernel\.execute\s*\(/,'preview cleanup must remain transient and must not bypass authority');

console.log(JSON.stringify({ok:true,phase:'5.9',improvement:'room-preview-declutter',assetsVisible:dense.assets,oldGuideRects:oldStrokeCount,newGuideRects:dense.strokes,guideReductionPercent:Math.round(reduction*1000)/10,floorTiles:16,floorGuideRects:1,wallGuideRects:8,wallsOnlyFallback:true,documentMutation:false,authorityBypass:false},null,2));
