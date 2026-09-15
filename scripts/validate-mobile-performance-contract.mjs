import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const contract=read('src/environment/mobile-performance-contract.js');
const hd=read('engine-h.js');
const world=read('src/environment/world-map.js');
const atlas=read('src/environment/atlas-contract.js');
const index=read('index.html');
const errors=[];
for(const token of ["kelo-mobile-art-performance-v1","VERSION='1.0.0'","dprCap:lowMemory?1.5:2","chunkCacheCap:lowMemory?8:12","decodedTextureMB:lowMemory?24:40","residentDistrictAtlases:lowMemory?4:6","canvasMegapixels:lowMemory?0.9:1.5"]){if(!contract.includes(token))errors.push('contract missing '+token)}
for(const token of ['KELO_MOBILE_PERFORMANCE_CONTRACT','mobilePerformanceContractVersion'])if(!hd.includes(token))errors.push('HiDPI renderer missing '+token);
if(hd.includes('const dprCap = 3;'))errors.push('hardcoded DPR cap reintroduced');
for(const token of ['P=window.KELO_MOBILE_PERFORMANCE_CONTRACT','P.budgets.chunkCacheCap','P.budgets.chunkCullMarginChunks','chunkCacheCap:MAX','chunkCacheSize:0',"version:'world-v1.27-performance'","chunkCacheMode:'lru-v1'","atlasConsumerMode:'atlas-contract-managed-v2-lazy-district'"])if(!world.includes(token))errors.push('world missing '+token);
if(/MAX\s*=\s*24/.test(world))errors.push('hardcoded chunk cache cap reintroduced');
for(const token of ['decodedTextureMB','residentDistrictAtlasCount','kelo:atlas-audit',"version:'1.3.0'"])if(!atlas.includes(token))errors.push('atlas telemetry/lifecycle missing '+token);
const perfPos=index.indexOf('src/environment/mobile-performance-contract.js?v=1'),hdPos=index.indexOf('engine-h.js?v=151');
if(perfPos<0||hdPos<0||perfPos>hdPos)errors.push('mobile contract must load before engine-h');
if(!index.includes('src/environment/atlas-contract.js?v=4'))errors.push('atlas cache key not bumped');
if(!index.includes('src/environment/world-map.js?v=terrain-191'))errors.push('world cache key not bumped');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(JSON.stringify({contract:'1.0.0',policy:'kelo-mobile-art-performance-v1',dpr:'contract',chunks:'lru-contract',atlasMemory:'warm-lifecycle-telemetry',districtAssets:'lazy',bootstrap:'ordered'},null,2));
