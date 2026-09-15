import assert from 'node:assert/strict';
import {buildSpriteManifest,KELO_TREE_ASSET_POOLS} from '../src/world/map-forge/map-forge-sprite-manifest.mjs';

const base={
  landmarks:[],scenePrefabs:[],roads:[],
  districts:[
    {id:'woods',kind:'forest'},
    {id:'farm',kind:'farm'},
    {id:'ruins',kind:'ruins'},
    {id:'winter',kind:'forest'}
  ],
  terrain:{cells:[
    {district:'woods',material:'forest'},
    {district:'farm',material:'grass'},
    {district:'ruins',material:'dark_terrain'},
    {district:'winter',material:'snow'}
  ]},
  decorations:[
    {id:'dec:woods:1',district:'woods',family:'tree',x:100,y:120,rotation:0,scale:1},
    {id:'dec:woods:2',district:'woods',family:'tree',x:260,y:180,rotation:0,scale:1},
    {id:'dec:farm:1',district:'farm',family:'tree',x:500,y:220,rotation:0,scale:1},
    {id:'dec:ruins:1',district:'ruins',family:'tree',x:760,y:260,rotation:0,scale:1},
    {id:'dec:winter:1',district:'winter',family:'tree',x:920,y:320,rotation:0,scale:1}
  ]
};

const first=buildSpriteManifest(base,{seed:7331});
const second=buildSpriteManifest(base,{seed:7331});
assert.deepEqual(first.decorations,second.decorations,'same seed/data must bind the same assets');
assert.deepEqual(first.spriteManifest.instanceBindings,second.spriteManifest.instanceBindings,'bindings must be deterministic');
assert.equal(first.spriteManifest.version,'map-forge-sprite-manifest-v2');

const byId=new Map(first.decorations.map(row=>[row.id,row]));
assert.ok(KELO_TREE_ASSET_POOLS.forest.includes(byId.get('dec:woods:1').assetRef));
assert.ok(KELO_TREE_ASSET_POOLS.forest.includes(byId.get('dec:woods:2').assetRef));
assert.ok(KELO_TREE_ASSET_POOLS.farm.includes(byId.get('dec:farm:1').assetRef));
assert.ok(KELO_TREE_ASSET_POOLS.ruins.includes(byId.get('dec:ruins:1').assetRef));
assert.equal(byId.get('dec:winter:1').assetRef,'tree:pine-snow');
assert.equal(first.spriteManifest.instanceBindings.length,5);
assert.ok(first.spriteManifest.instanceBindings.every(row=>row.assetId.startsWith('tree:')));

const allTrees=new Set(Object.values(KELO_TREE_ASSET_POOLS).flat());
for(const required of [
  'tree:oak-round-green','tree:pine-tall-evergreen','tree:oak-broad-green','tree:cherry-blossom-pink',
  'tree:oak-autumn-orange','tree:birch-green','tree:willow-weeping','tree:apple-red','tree:oak-dense-dark',
  'tree:pine-snow','tree:dead-gnarled','tree:canopy-light-green'
])assert.ok(allTrees.has(required),`missing Kelo tree asset ${required}`);

console.log('PASS map-forge deterministic Kelo tree asset binding');
