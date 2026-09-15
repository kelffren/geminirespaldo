import fs from 'node:fs/promises';

const file='src/creators/creator-entry.mjs';
const source=await fs.readFile(file,'utf8');
const fail=message=>{throw new Error(`[world-editor-creator-boot-isolation] ${message}`);};

const spriteImports=[
  'sprite-ability-visual-ui.mjs',
  'sprite-ability-manual-cutter.mjs',
  'sprite-ability-repair-studio.mjs',
  'sprite-ability-repair-touch.mjs',
  'sprite-ability-irregular-import.mjs',
  'sprite-ability-loose-import.mjs',
  'sprite-ability-event-lab.mjs',
  'sprite-ability-easy-ui.mjs'
];

if(!source.includes('async function ensureSpriteAbilityExtensions()'))fail('lazy Sprite Ability extension gate is missing');
if(!source.includes("if(id==='sprite-ability')await ensureSpriteAbilityExtensions();"))fail('Sprite Ability extensions are not scoped to the Sprite Ability workspace');

const gateStart=source.indexOf('async function ensureSpriteAbilityExtensions()');
const platformStart=source.indexOf('const permission=',gateStart);
if(gateStart<0||platformStart<0)fail('could not isolate lazy extension gate');
const gate=source.slice(gateStart,platformStart);

for(const specifier of spriteImports){
  const all=[...source.matchAll(new RegExp(specifier.replaceAll('.','\\.'),'g'))];
  if(all.length!==1)fail(`${specifier} must have exactly one import reference; found ${all.length}`);
  if(!gate.includes(specifier))fail(`${specifier} escaped the lazy Sprite Ability gate`);
}

const bootPrefix=source.slice(source.indexOf('export async function bootKeloCreators'),gateStart);
if(/sprite-ability-(visual-ui|manual-cutter|repair-studio|repair-touch|irregular-import|loose-import|event-lab|easy-ui)\.mjs/.test(bootPrefix)){
  fail('World/Creator boot still imports Sprite Ability extensions before the lazy gate');
}

if(!source.includes("world-workspace.mjs?v=world-bridge-20260915-22"))fail('World workspace cache-bust is behind the live bridge build');

console.log(JSON.stringify({ok:true,file,lazySpriteAbilityImports:spriteImports.length,worldBootExcluded:true,workspaceBuild:'world-bridge-20260915-22'}));
