import fs from 'node:fs';

const registry=fs.readFileSync('src/environment/tile-registry.js','utf8');
const contract=fs.readFileSync('src/environment/atlas-contract.js','utf8');
const world=fs.readFileSync('src/environment/world-map.js','utf8');
const manifest=JSON.parse(fs.readFileSync('src/environment/art-asset-manifest.json','utf8'));
const errors=[];

for(const token of ["kelo-atlas-contract-v1","version:'1.3.0'","maxDimension:2048","small:Object.freeze({maxDimension:256","medium:Object.freeze({maxDimension:1024","packedSprites:Object.freeze({paddingMin:1,spacingMin:1","lazy-when-district-needed","districtWarmMs:30000","optionalWarmMs:10000","imageCreation:'atlas-contract-only'","consumerRule:'acquire-by-key-never-rewrite-src'","allowSilentMissing:false","decodedTextureMB","residentDistrictAtlasCount","kelo:atlas-audit"]){
  if(!contract.includes(token))errors.push(`atlas contract missing policy token: ${token}`);
}

for(const token of ["A=window.KELO_ATLAS_CONTRACT","A.acquire(key)","A.acquire('gardensBase')","A.acquire('gardensJoins')","A.release('gardensBase')","A.release('gardensJoins')","atlasConsumerMode:'atlas-contract-managed-v2-lazy-district'","worldOwnsImageLoader:false","chunkCacheMode:'lru-v1'"]){
  if(!world.includes(token))errors.push(`world renderer missing managed-atlas token: ${token}`);
}
for(const forbidden of ['new Image()','function versionedSrc','world=191']){
  if(world.includes(forbidden))errors.push(`world renderer must not own atlas loading/cache rewrite: ${forbidden}`);
}

const productionPngs=manifest.assets.filter(a=>String(a.path||'').toLowerCase().endsWith('.png'));
for(const asset of productionPngs){
  if(!(asset.width>0&&asset.height>0))errors.push(`${asset.id}: invalid dimensions`);
  if(Math.max(asset.width,asset.height)>2048)errors.push(`${asset.id}: exceeds atlas max dimension 2048`);
  if(asset.sampling!=='nearest')errors.push(`${asset.id}: sampling must be nearest`);
  if(asset.frames?.mode==='grid'){
    if(!(asset.cellWidth>0&&asset.cellHeight>0&&asset.columns>0&&asset.rows>0))errors.push(`${asset.id}: incomplete grid metadata`);
    const expectedW=(asset.padding||0)*2+asset.columns*asset.cellWidth+Math.max(0,asset.columns-1)*(asset.spacing||0);
    const expectedH=(asset.padding||0)*2+asset.rows*asset.cellHeight+Math.max(0,asset.rows-1)*(asset.spacing||0);
    if(expectedW!==asset.width||expectedH!==asset.height)errors.push(`${asset.id}: grid/padding/spacing does not match dimensions`);
  }
  if(asset.cache?.strategy==='query'&&(!asset.cache.key||asset.cache.value===undefined))errors.push(`${asset.id}: incomplete query cache metadata`);
}

// TileRegistry is allowed to retire old visual families via resetBlank(). Audit only
// real literal sources that remain live instead of enforcing an obsolete source count.
const srcMatches=[...registry.matchAll(/src:'([^']+)'/g)].map(m=>m[1]).filter(src=>!src.startsWith('data:'));
if(srcMatches.length<1)errors.push('TileRegistry must expose at least one live versioned asset source');
for(const src of srcMatches){
  if(!/[?&](art|v)=/.test(src))errors.push(`TileRegistry asset lacks cache-busting token: ${src}`);
}

// Large standalone props are not atlases. Size budgets apply only to packed/grid or
// irregular multi-frame atlas assets; standalone 1-frame art stays governed by the
// global 2048px max-dimension rule above.
const atlasLike=productionPngs.filter(a=>a.frames?.mode==='grid'||a.frames?.mode==='irregular'||String(a.kind||'').includes('atlas'));
const giantAtlases=atlasLike.filter(a=>Math.max(a.width,a.height)>1024);
for(const asset of giantAtlases){
  if(asset.frames?.mode==='grid'&&!(asset.columns>0&&asset.rows>0))errors.push(`${asset.id}: large grid atlas missing columns/rows`);
  if(asset.frames?.mode==='irregular'&&!asset.frames?.count)errors.push(`${asset.id}: irregular atlas missing frame count`);
}

const families=new Set(productionPngs.map(a=>a.family).filter(Boolean));
if(families.size<1)errors.push('art asset manifest must declare at least one production family');

if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(JSON.stringify({policy:'kelo-atlas-contract-v1',contractVersion:'1.3.0',worldAtlasConsumer:'managed-lazy-district-v2',productionPngs:productionPngs.length,registryVersionedSources:srcMatches.length,families:families.size,largeAtlasAssets:giantAtlases.map(a=>a.id)},null,2));
