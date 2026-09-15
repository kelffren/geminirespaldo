import fs from 'node:fs';

// CI/LIVE guard: authored Gardens metadata must survive the renderer's real navigation and landmark masks.
const worldSource=fs.readFileSync('src/environment/world-map.js','utf8');
const compositionSource=fs.readFileSync('src/environment/gardens-compositions.js','utf8');
const TILE=32;

function extractFrozenArray(source,name,nextMarker){
  const start=`const ${name}=Object.freeze(`;
  const a=source.indexOf(start);
  if(a<0)throw new Error(`Missing ${name}`);
  const bodyStart=a+start.length;
  const b=source.indexOf(nextMarker,bodyStart);
  if(b<0)throw new Error(`Missing end marker for ${name}`);
  let raw=source.slice(bodyStart,b).trim();
  if(raw.endsWith(';'))raw=raw.slice(0,-1).trim();
  if(raw.endsWith(')'))raw=raw.slice(0,-1).trim();
  return Function(`return (${raw})`)();
}

const ROADS=extractFrozenArray(worldSource,'ROADS','\nconst PADS=');
const PADS=extractFrozenArray(worldSource,'PADS','\nconst GARDEN_PATHS=');
const GARDEN_PATHS=extractFrozenArray(worldSource,'GARDEN_PATHS','\nconst GARDEN_PATH_CUTS=');
const GARDEN_PATH_CUTS=extractFrozenArray(worldSource,'GARDEN_PATH_CUTS','\nfunction inside');
const C=extractFrozenArray(compositionSource,'C','\nconst FIXED=');
const FIXED=extractFrozenArray(compositionSource,'FIXED','\nconst declaredCellCount');

function inside(x,y,r){return x>=r.x&&y>=r.y&&x<r.x+r.w&&y<r.y+r.h}
function gardenPath(x,y){return GARDEN_PATHS.some(r=>inside(x,y,r))&&!GARDEN_PATH_CUTS.some(r=>inside(x,y,r))}
function road(x,y){return ROADS.some(r=>inside(x,y,r))||PADS.some(r=>inside(x,y,r))||gardenPath(x,y)}
function landmarkBlocked(lx,ly){return lx>=20&&lx<=24&&ly>=9&&ly<=12}

const declared=[];
for(const comp of C)for(const cell of comp.cells||[])declared.push({source:comp.id,cell});
for(const cell of FIXED)declared.push({source:'fixed',cell});

const seen=new Map(),duplicates=[],conflicts=[];
for(const entry of declared){
  const [lx,ly,tile]=entry.cell;
  const key=`${lx},${ly}`;
  if(seen.has(key))duplicates.push({key,first:seen.get(key),second:entry.source});
  else seen.set(key,entry.source);
  const wx=(lx+33)*TILE+TILE/2,wy=(ly+67)*TILE+TILE/2;
  const onRoad=road(wx,wy),inLandmarkClearance=landmarkBlocked(lx,ly);
  if(onRoad||inLandmarkClearance)conflicts.push({source:entry.source,lx,ly,tile,onRoad,inLandmarkClearance});
}

const report={
  mode:'declared-renderable-mask-validator-v1',
  declaredCellCount:declared.length,
  renderableCellCount:declared.length-conflicts.length,
  conflictCount:conflicts.length,
  duplicateCount:duplicates.length,
  conflicts,
  duplicates
};
console.log(JSON.stringify(report,null,2));
if(declared.length!==41)throw new Error(`Expected 41 Gardens declarations, found ${declared.length}`);
if(conflicts.length)throw new Error(`Gardens declarations masked by road/landmark policy: ${JSON.stringify(conflicts)}`);
if(duplicates.length)throw new Error(`Gardens declarations overlap each other: ${JSON.stringify(duplicates)}`);
