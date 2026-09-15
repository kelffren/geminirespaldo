import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={window:{KELO_RURAL_NATURE_ATLAS:{width:256,height:128,tiles:{},treeFamilies:{}}},console};
vm.createContext(context);
for(const file of ['src/environment/terrain-contract.js','src/environment/generated/arboleskelo1-atlas.js','src/environment/tile-registry.js']){
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}
const C=context.window.KELO_TERRAIN_CONTRACT;
const R=context.window.KELO_TILE_REGISTRY;
assert(C&&R,'terrain contract and TileRegistry must load');
assert.equal(C.tileSize,R.worldTileSize,'terrain tile size must match TileRegistry');
assert.equal(C.topology,'edge-bitmask-4-v1');
assert.equal(Object.keys(C.sideBits).join(','),'top,right,bottom,left');
assert.equal(Object.values(C.sideBits).join(','),'1,2,4,8');

for(const [id,m] of Object.entries(C.materials)){
  assert.equal(m.id,id,`material ${id} id mismatch`);
  assert(R.atlases[m.atlas],`material ${id} references missing atlas ${m.atlas}`);
  assert(Array.isArray(R.families[m.family])&&R.families[m.family].length,`material ${id} references missing family ${m.family}`);
  if(m.detailAtlas) assert(R.atlases[m.detailAtlas],`material ${id} missing detail atlas ${m.detailAtlas}`);
  if(m.detailFamily) assert(Array.isArray(R.families[m.detailFamily])&&R.families[m.detailFamily].length,`material ${id} missing detail family ${m.detailFamily}`);
  if(m.accentFamily) assert(Array.isArray(R.families[m.accentFamily])&&R.families[m.accentFamily].length,`material ${id} missing accent family ${m.accentFamily}`);
}

for(const [id,set] of Object.entries(C.transitions)){
  assert(C.materials[set.owner],`transition ${id} owner missing`);
  assert(C.materials[set.neighbour],`transition ${id} neighbour missing`);
  const atlas=R.atlases[set.atlas];
  assert(atlas,`transition ${id} atlas missing`);
  const frames=[];
  for(let mask=0;mask<16;mask++){
    const frame=set.frameByMask[mask];
    assert(Number.isInteger(frame),`transition ${id} mask ${mask} missing frame`);
    const cols=atlas.columns||Math.floor(atlas.width/C.tileSize);
    const rows=Math.floor(atlas.height/C.tileSize);
    assert(frame>=0&&frame<cols*rows,`transition ${id} mask ${mask} frame ${frame} outside atlas`);
    frames.push(frame);
  }
  assert.equal(new Set(frames).size,16,`transition ${id} should provide one authored frame per 4-neighbour mask`);
}

for(const [id,p] of Object.entries(C.profiles)){
  assert(C.materials[p.baseTerrain],`profile ${id} baseTerrain missing`);
  assert(C.materials[p.pathTerrain],`profile ${id} pathTerrain missing`);
}

const declaredKeys=C.collectAtlasKeys();
assert.equal(declaredKeys.sort().join(','),Array.from(C.requiredAtlasKeys).sort().join(','),'required atlas keys must derive from material/transition metadata');
const syntheticMaterials={...C.materials,stone:{id:'stone',atlas:'stoneAtlas',family:'stoneTiles'}};
const syntheticTransitions={...C.transitions,stone_to_grass:{id:'stone_to_grass',owner:'stone',neighbour:'grass',atlas:'stoneEdges'}};
const syntheticKeys=C.collectAtlasKeys(syntheticMaterials,syntheticTransitions);
assert(syntheticKeys.includes('stoneAtlas'),'new terrain atlas must be discovered from metadata');
assert(syntheticKeys.includes('stoneEdges'),'new transition atlas must be discovered from metadata');

const world=fs.readFileSync('src/environment/world-map.js','utf8');
assert(world.includes("terrainRendererMode:'contract-driven-materials-v2'"),'world renderer must advertise dynamic terrain contract mode');
assert(world.includes('TERRAIN.materials[key]'),'world renderer must resolve materials from contract data');
assert(world.includes('Object.values(TERRAIN.transitions)'),'world renderer must enumerate transition sets generically');
assert(world.includes('function terrainAtlasKeys()'),'world renderer must discover atlas dependencies from contract data');
assert(world.includes('for(const key of TERRAIN_ATLAS_KEYS)'),'world renderer must load discovered terrain atlases generically');
assert(!world.includes('R.atlases.plaza'),'world renderer must not bind the plaza atlas directly');
assert(!world.includes('R.atlases.transitions'),'world renderer must not bind the transition atlas directly');
assert(!world.includes('R.atlases.grassVariation'),'world renderer must not bind the grass atlas directly');
assert(!world.includes('R.atlases.marbleVariation'),'world renderer must not bind the marble detail atlas directly');
assert(!world.includes('TM=R.transitionMasks'),'legacy TileRegistry transition mask binding must not return');
assert(!world.includes('function roadMask('),'legacy marble-specific roadMask must not return');

const index=fs.readFileSync('index.html','utf8');
assert(index.indexOf('terrain-contract.js')<index.indexOf('world-map.js'),'terrain contract must load before world renderer');
assert(index.indexOf('generated/arboleskelo1-atlas.js')<index.indexOf('tile-registry.js'),'tree atlas metadata must load before TileRegistry');
console.log('PASS terrain contract',C.version,Object.keys(C.materials).length,'materials',Object.keys(C.transitions).length,'transition sets',Object.keys(C.profiles).length,'profiles','synthetic extension OK');
