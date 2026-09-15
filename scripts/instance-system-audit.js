const fs=require('fs');
const assert=require('assert');
const files=[
  'src/instances/instance-system.js',
  'src/instances/instance-runtime-bridge.js',
  'src/instances/house-instance.js',
  'src/instances/property-house-bridge.js',
  'src/ui/house-instance-ui.js',
  'src/property/property-system.js',
  'index.html'
];
for(const f of files)assert(fs.existsSync(f),`missing ${f}`);
const instance=fs.readFileSync('src/instances/instance-system.js','utf8');
const house=fs.readFileSync('src/instances/house-instance.js','utf8');
const property=fs.readFileSync('src/property/property-system.js','utf8');
const index=fs.readFileSync('index.html','utf8');
for(const token of ['CREATING','LOADING','ACTIVE','IDLE','SHUTTING_DOWN','DESTROYED','getOrCreateInstance','destroyInstance','KELO_SCENE_CONTEXT'])assert(instance.includes(token),`instance contract missing ${token}`);
for(const token of ['kelo_house_snapshots_v1','house:enter','house:leave','permission:update','HOUSE_PERMISSION_DENIED','installAuthorityAdapter','installPersistenceAdapter'])assert(house.includes(token),`house contract missing ${token}`);
for(const token of ['ensureHouseParcel','replaceHouseLayout','authorityLocalRequest','isHouseMutation','placementVisible'])assert(property.includes(token),`property bridge missing ${token}`);
const order=['src/property/property-system.js','src/instances/instance-system.js','src/instances/instance-runtime-bridge.js','src/instances/house-instance.js','src/instances/property-house-bridge.js','src/ui/house-instance-ui.js'];
let last=-1;for(const path of order){const at=index.indexOf(path);assert(at>last,`bad live load order ${path}`);last=at;}
assert(!index.includes('src/ui/property-editor.js?'),'property-editor is currently DORMANT and must not be required by house instance boot');
assert(fs.existsSync('docs/INSTANCE_SYSTEM_MEMORY.md'),'instance memory missing');
console.log(JSON.stringify({ok:true,files:files.length,lifecycle:true,authority:true,persistence:true,propertyReuse:true,loadOrder:true,propertyEditorDependency:false},null,2));
