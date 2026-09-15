import fs from 'node:fs';
import vm from 'node:vm';

const read=p=>fs.readFileSync(p,'utf8');
const files=[
  'src/environment/prop-contract.js',
  'src/environment/generic-props.js',
  'src/environment/environment-layer-stack.js',
  'src/physics/collision-utils.js',
  'index.html'
];
for(const f of files){
  if(!fs.existsSync(f))throw new Error(`missing ${f}`);
  if(f.endsWith('.js'))new vm.Script(read(f),{filename:f});
}

const contractSrc=read('src/environment/prop-contract.js');
for(const token of [
  'family:','asset:','frame:','position:','anchor:','visualBounds:','footprint:',
  'collider:','layers:','priority:','district:','occlusion:','layerGroups','layerGroup:',
  'sources','ruralFarmBoundary','buildRuralFarmBoundary','instances:function()'
])if(!contractSrc.includes(token))throw new Error(`prop contract missing ${token}`);
if(!/version:'1\.\d+\.\d+'/.test(contractSrc)||!contractSrc.includes("mode:'generic-prop-contract-v"))throw new Error('prop contract does not expose a versioned generic contract');
if(contractSrc.includes("renderMode:'immediate'"))throw new Error('prop contract reintroduced immediate rendering');

const genericSrc=read('src/environment/generic-props.js');
for(const token of [
  'C.layerGroups','group.back.phase','group.front.phase','group.ownership','group.priority',
  'propsFor(groupKey)','sourcePropsFor(groupKey)','source.instances()','imageSmoothingEnabled=false',
  'p.occlusion','drawInstances','isAssetReady','dynamicSourceCount','backDrawCountByGroup',
  "COLLISION_OWNER='environment:generic-props'",'K.replaceOwner(COLLISION_OWNER,rows)'
])if(!genericSrc.includes(token))throw new Error(`generic renderer missing ${token}`);
if(/\bobstacles\s*\.\s*(?:push|splice|pop|shift|unshift)\s*\(/.test(genericSrc))throw new Error('generic props mutates legacy obstacles directly');
if(genericSrc.includes("if(p.family==='tree')")||genericSrc.includes("if(p.asset==='plazaNature')")||genericSrc.includes("if(p.asset==='ruralProps')"))throw new Error('generic renderer contains prop-specific branch');

const stack=read('src/environment/environment-layer-stack.js');
if(!stack.includes('props_back')||!stack.includes('drawPreActors'))throw new Error('formal props_back pre-actor phase missing');
if(!stack.includes('props_front')||!stack.includes('drawPostActors'))throw new Error('formal props_front post-actor phase missing');

const collision=read('src/physics/collision-utils.js');
for(const token of ['replaceOwner','clearOwner','ownerSnapshot'])if(!collision.includes(token))throw new Error(`collision owner API missing ${token}`);

const html=read('index.html');
const stackAt=html.indexOf('src/environment/environment-layer-stack.js?');
const contractAt=html.indexOf('src/environment/prop-contract.js?');
const genericAt=html.indexOf('src/environment/generic-props.js?');
if(stackAt<0||contractAt<0||genericAt<0||!(stackAt<contractAt&&contractAt<genericAt))throw new Error('formal prop bootstrap is missing or out of order');
if(html.includes('src/environment/plaza-nature.js?')||html.includes('src/environment/rural-ground.js?'))throw new Error('retired specialized prop renderers were reintroduced into LIVE boot');

console.log(JSON.stringify({
  ok:true,
  contract:'versioned-generic-props',
  layerStack:true,
  collisionOwner:'environment:generic-props',
  directObstacleWrites:false,
  specializedLiveRenderers:false
},null,2));
