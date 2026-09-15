import fs from 'node:fs';
import vm from 'node:vm';

const contractSource=fs.readFileSync('src/environment/terrain-contract.js','utf8');
const worldSource=fs.readFileSync('src/environment/world-map.js','utf8');
const sandbox={window:{},console};
vm.runInNewContext(contractSource,sandbox,{filename:'terrain-contract.js'});

const api=sandbox.window.KELO_DISTRICT_VISUAL_PROFILES;
const terrain=sandbox.window.KELO_TERRAIN_CONTRACT;
const requiredIds=['central','rural','arena','commerce','gardens'];
const requiredFields=['id','name','kind','bounds','terrainProfile','groundFamilies','transitionFamilies','pathFamilies','vegetationFamilies','propFamilies','architectureFamilies','landmarkFamilies','palette','density','variation','decorationRules','placementRules'];
const fail=(message)=>{throw new Error(message)};
if(!api||!terrain)fail('district/terrain contract did not initialize');
if(api.version!=='1.2.0')fail(`unexpected district profile version ${api.version}`);
if(terrain.districtVisualProfileVersion!==api.version)fail('terrain/profile version parity failed');
if(api.districts.length!==requiredIds.length)fail('derived district bounds count mismatch');
for(const id of requiredIds){
  const p=api.get(id);if(!p)fail(`missing profile ${id}`);
  for(const field of requiredFields)if(p[field]===undefined||p[field]===null)fail(`${id} missing ${field}`);
  const b=p.bounds;if(!Number.isFinite(b.x)||!Number.isFinite(b.y)||!Number.isFinite(b.w)||!Number.isFinite(b.h)||b.w<=0||b.h<=0)fail(`${id} invalid bounds`);
  if(!terrain.profiles[p.terrainProfile])fail(`${id} references missing terrain profile ${p.terrainProfile}`);
}
const central=api.get('central'),rural=api.get('rural'),gardens=api.get('gardens');
if(central.palette===gardens.palette||central.density===gardens.density||central.variation===gardens.variation)fail('central/gardens are not materially distinct');
if(rural.palette===gardens.palette||rural.density===gardens.density)fail('rural/gardens are not materially distinct');
if(gardens.tileOverlayProvider!=='garden-compositions-v1')fail('gardens overlay provider is not profile-owned');
if(!worldSource.includes('const DISTRICTS=TERRAIN.districts'))fail('world renderer does not source district bounds from contract');
if(!worldSource.includes('TERRAIN.districtVisualProfileFor'))fail('world renderer does not consume visual profiles');
if(/d\?\.id\s*===|district\s*===|districtId\s*===/.test(worldSource))fail('district-specific renderer branch detected');
if(/const\s+DISTRICTS\s*=\s*Object\.freeze\s*\(\s*\[/.test(worldSource))fail('hardcoded district array returned to world renderer');
console.log(`District Visual Profiles OK: ${requiredIds.length} profiles; central/rural/gardens materially distinct; renderer consumes contract without district-id branches.`);
