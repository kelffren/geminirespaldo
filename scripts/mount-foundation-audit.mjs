/* KELO-INDEX
 * area: AUDIT / MOUNT FOUNDATION
 * keys: AUDIT MOUNT CATALOG ABILITY SOURCE CAST STONE HOTBAR RENDER
 * purpose: protege catálogo 20k, 3 M-slots, owner de render y cast nativo de montura sin tocar Stones
 * online: valida identidad estable de mount/source para futura autoridad server
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const mountData=require('../src/mounts/mount-ability-data.js');globalThis.KELO_MOUNT_ABILITY_DATA=mountData;
const Catalog=require('../src/mounts/mount-catalog.js');
assert.equal(Catalog.count,2);assert.equal(Catalog.get('mount.training_horse').abilityIds.length,3);assert.ok(Catalog.getMovement('movement.horse.standard').maxSpeed>320,'starter mount must be faster than walking baseline');
const base=Catalog.get('mount.training_horse');
for(let i=0;i<20000;i++)Catalog.register({...base,id:`mount.audit.${i}`,displayName:`Audit Mount ${i}`,assetBundleId:`mount.asset.audit.${i}`,tags:['audit',i%2?'odd':'even']});
assert.equal(Catalog.count,20002);assert.equal(Catalog.get('mount.audit.19999').displayName,'Audit Mount 19999');assert.equal(Catalog.query({tag:'audit'}).length,20000);assert.equal(JSON.parse(JSON.stringify(Catalog.get('mount.audit.7'))).id,'mount.audit.7');
assert.equal(Catalog.validate({...base,id:'mount.audit.bad',abilityIds:['mount_horse_gallop']}).ok,false);

const mountSystemSource=fs.readFileSync(new URL('../src/mounts/mount-system.js',import.meta.url),'utf8');
assert(!mountSystemSource.includes("s.owned['mount.training_horse']"),'mount core must not hardcode starter mount IDs');
assert(!mountSystemSource.includes("['equipment.mount.war_saddle','equipment.mount.swift_horseshoes']"),'mount core must discover starter equipment from catalog tags');
assert(mountSystemSource.includes("Catalog.query({tag:'starter'})"),'starter mount must be discovered data-first');
assert(mountSystemSource.includes("tags?.includes('starter')"),'starter equipment must be discovered data-first');

const actionBarSource=fs.readFileSync(new URL('../src/ui/mount-action-bar.js',import.meta.url),'utf8');
assert(!actionBarSource.includes('requestAnimationFrame('),'mount HUD must not create its own RAF loop');
assert(!actionBarSource.includes('cancelAnimationFrame('),'mount HUD must not own RAF lifecycle');
assert(actionBarSource.includes('KeloRender?.afterFrame'),'mount HUD must consume KeloRender.afterFrame');
assert(actionBarSource.includes('KeloRender?.unregister'),'mount HUD must unregister its render hook');

const mountChannelSource=fs.readFileSync(new URL('../src/mounts/mount-ability-channel.js',import.meta.url),'utf8');
assert(mountChannelSource.includes('KeloAbilities?.engine'),'mount channel must consume KeloAbilities owner');
assert(mountChannelSource.includes('castSource'),'mount channel must use source-native KeloAbilities cast');
assert(!mountChannelSource.includes('root.KeloAbilitySourceCast'),'mount channel must not execute through the legacy compatibility shim');
assert(!mountChannelSource.includes('hotbar.slots'),'mount channel must never borrow a Stone hotbar slot');

// Three-slot adapter sends semantic source metadata directly to KeloAbilities and never mutates Stone hotbar.
const stone0={stoneUid:'stone-real',abilityKey:'fireball',cooldown:0};const stoneSlots=[stone0,{stoneUid:'stone-2'},null,null,null];const before=stoneSlots.slice();let casts=0,lastSource=null;
globalThis.KeloMounts={isMounted:()=>true,getEquippedMountId:()=> 'mount.training_horse',getAbilityLoadout:()=>({mounted:true,mountId:'mount.training_horse',fingerprint:'mount.training_horse|1',slots:base.abilityIds.map((abilityKey,slotIndex)=>({sourceType:'mount',sourceId:'mount.training_horse',slotIndex,abilityKey}))})};
globalThis.KeloAbilities={hotbar:{slots:stoneSlots},engine:{castSource(opts){casts++;lastSource=opts;assert.equal(opts.sourceType,'mount');assert.equal(opts.sourceId,'mount.training_horse');assert.equal(opts.sourceSlot,'M1');for(let i=0;i<5;i++)assert.strictEqual(stoneSlots[i],before[i]);return{valid:true,abilityId:opts.definition.id,abilityKey:opts.definition.key,stoneUid:null,sourceType:opts.sourceType,sourceId:opts.sourceId,sourceSlot:opts.sourceSlot,sourceFingerprint:opts.sourceFingerprint};}}};
globalThis.KeloEvents={emit(){}};globalThis.KeloMountAbilityChannel=undefined;
require('../src/mounts/mount-ability-channel.js');
const Channel=globalThis.KeloMountAbilityChannel;assert.equal(Channel.slotCount,3);Channel.sync(true);assert.equal(Channel.getSnapshot().slots.length,3);const result=Channel.cast({slotIndex:0,direction:{x:1,y:0}});assert.equal(result.valid,true);assert.equal(result.sourceType,'mount');assert.equal(result.sourceSlot,'M1');assert.equal(casts,1);assert.equal(lastSource.definition.key,'mount_horse_gallop');for(let i=0;i<5;i++)assert.strictEqual(globalThis.KeloAbilities.hotbar.slots[i],before[i],'native source cast must preserve original Stone slot object');assert.equal(stoneSlots.length,5,'Stone hotbar remains exactly five slots');assert.equal(globalThis.KELO_MOUNT_ABILITY_AUDIT.nativeSourceCast,true);assert.equal(globalThis.KELO_MOUNT_ABILITY_AUDIT.legacyBridge,false);
console.log(JSON.stringify({ok:true,catalogVersion:Catalog.version,mountCount:Catalog.count,twentyK:true,exactMountAbilitySlots:3,stoneSlotsUntouched:stoneSlots.length,reusesAbilityEngine:true,nativeSourceCast:true,legacyBridge:false,starterIdsInCore:false,secondLoop:false,usesKeloRender:true},null,2));
