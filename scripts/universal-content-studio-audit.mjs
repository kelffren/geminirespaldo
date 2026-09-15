import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planUniversalContentRows } from '../src/creators/importers/universal-content-importer.mjs';
import { createRuntimeContentRegistry } from '../src/creators/content/runtime-content-registry.mjs';
import { createSupabaseCreatorContentRepository } from '../src/creators/content/supabase-content-repository.mjs';

const fakeFiles=[{name:'white-tree.png'},{name:'royal-armor.webp'}];
const plan=planUniversalContentRows([
  {type:'world',id:'white-tree',name:'White Tree',file:'white-tree.png',world_w:'128',world_h:'160',collision:'trunk',tags:'nature|royal'},
  {type:'armor',id:'royal-armor',name:'Royal Armor',file:'royal-armor.webp',slot:'chest',profiles:'appearance.character.standard',rarity:'legendary'}
],{files:fakeFiles});
assert.equal(plan.rowCount,2);assert.equal(plan.readyCount,2);assert.equal(plan.jobs[1].draft.contentType,'equipment');assert.equal(plan.jobs[0].draft.assetRefs[0].role,'primary');

const atlas=[],templates=[],appearanceItems=[];
const root={
  KELO_ATLAS_CONTRACT:{register:(key,def)=>{atlas.push({key,def});return def;}},
  KELO_PROPERTY_CATALOG:{registerTemplate:def=>{templates.push(def);return def;}},
  KeloAppearance:{listProfiles:()=>[{id:'appearance.character.standard',targetType:'character',slots:['chest','hair']}],getItem:()=>null,registerItem:def=>{appearanceItems.push(def);return def;}},
  dispatchEvent(){}
};
const registry=createRuntimeContentRegistry({root});
const world=registry.register({contentId:'content:test:world:white-tree@r1-a',stableKey:'content:test:world:white-tree',revision:1,contentType:'world',displayName:'White Tree',tags:['nature'],payload:{worldWidth:128,worldHeight:160,collisionMode:'trunk',renderPhase:'world'},assets:[{role:'primary',assetId:'creator:test:white-tree@r1-a',runtimeUrl:'data:image/png;base64,AA==',pixelWidth:256,pixelHeight:256,contentHash:'a'.repeat(64)}],contentHash:'a'.repeat(64)});
assert.equal(world.activation.status,'active');assert.equal(world.activation.owner,'KELO_PROPERTY_CATALOG');assert.equal(atlas.length,1);assert.equal(templates.length,1);assert.equal(atlas[0].def.src,'data:image/png;base64,AA==');
const armor=registry.register({contentId:'content:test:equipment:royal-armor@r1-b',stableKey:'content:test:equipment:royal-armor',revision:1,contentType:'equipment',displayName:'Royal Armor',payload:{slotId:'chest',targetType:'character',compatibleProfiles:['appearance.character.standard'],rarity:'legendary'},assets:[{role:'primary',assetId:'creator:test:armor@r1-b'}],contentHash:'b'.repeat(64)});
assert.equal(armor.activation.status,'active');assert.equal(appearanceItems.length,1);assert.equal(appearanceItems[0].slotId,'chest');

const payload=Buffer.from(JSON.stringify({sub:'11111111-1111-1111-1111-111111111111'})).toString('base64url');const token=`x.${payload}.x`,calls=[];
const repo=createSupabaseCreatorContentRepository({url:'https://example.supabase.co',publishableKey:'sb_publishable_test',getAccessToken:()=>token,fetchImpl:async(url,opts={})=>{calls.push({url,opts});return{ok:true,status:200,text:async()=>JSON.stringify({ok:true})};}});
assert.equal(repo.userId(),'11111111-1111-1111-1111-111111111111');await repo.rpc('test_rpc',{hello:'world'});assert.match(calls[0].url,/\/rest\/v1\/rpc\/test_rpc$/);assert.equal(calls[0].opts.headers.Authorization,`Bearer ${token}`);

const migration=fs.readFileSync('supabase/migrations/20260910024046_universal_content_registry.sql','utf8');
for(const needle of ['content_definitions','content_definition_revisions','content_asset_bindings','content_review_requests','content_publications','register_content_revision','content:global:published'])assert.ok(migration.includes(needle),`missing ${needle}`);
const idempotent=fs.readFileSync('supabase/migrations/20260910032354_universal_content_idempotent_reimport.sql','utf8');
for(const needle of ['on conflict (owner_user_id, slug) do update','metadata = public.asset_families.metadata || excluded.metadata','returning * into v_row'])assert.ok(idempotent.includes(needle),`idempotent reimport contract missing ${needle}`);
const entry=fs.readFileSync('src/creators/creator-entry.mjs','utf8'),hub=fs.readFileSync('src/creators/ui/creator-hub.mjs','utf8'),ui=fs.readFileSync('src/creators/ui/content-studio-workspace.mjs','utf8'),config=fs.readFileSync('src/online/kelo-supabase-public-config.mjs','utf8');
assert.ok(entry.includes('registerContentStudioWorkspace'));assert.ok(hub.includes("['content-studio','Content Studio','active']"));assert.ok(ui.includes('.xlsx'));assert.ok(ui.includes('multiple:true'));assert.ok(!/sb_secret_|SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s]/.test(config));
console.log('Universal Content Studio audit: OK');
