/* KELO-INDEX
 * area: AUDIT / ABILITY SOURCE CAST
 * keys: AUDIT ABILITY SOURCE CAST STONE WEAPON MOUNT HOTBAR AUTHORITY PERFORMANCE LIFECYCLE
 * purpose: demuestra que KeloAbilities castea fuentes no-Stone por su API nativa sin sustituir los 5 slots Stone y conserva sleep/wake del runtime
 * online: valida identidad semántica sourceType/sourceId/sourceSlot/sourceFingerprint apta para autoridad server futura
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const abilityDef={id:9001,key:'audit_source_dash',name:'Audit Source Dash',icon:'◆',tier:'Common',targeting:{type:'direction',range:180},delivery:{type:'dash',distance:120,duration:.18},resource:{cost:7},cooldown:4,effects:[],visuals:{color:'#fff'}};
const stoneDef={id:1,key:'fireball',name:'Fireball',icon:'◆',tier:'Common',targeting:{type:'direction',range:300},delivery:{type:'projectile',speed:300,radius:6,maxDistance:300},resource:{cost:5},cooldown:2,effects:[],visuals:{color:'#fff'}};
const stone={uid:'stone-real',stoneUid:'stone-real',abilityId:1,abilityKey:'fireball',tier:'Common',name:'Fireball'};
const snapshot={fingerprint:'stone-fingerprint',slots:[{stoneUid:'stone-real'},null,null,null,null]};
const events=[];
const simulationHooks=new Map(),renderHooks=new Map();
const documentStub={readyState:'complete',getElementById(){return null;},createElement(){return{style:{},dataset:{},addEventListener(){},appendChild(){},querySelector(){return null;},querySelectorAll(){return[];}};},body:{appendChild(){}}};
const context={
 console,Date,Math,Map,Set,Object,Array,Number,String,JSON,Promise,setTimeout,clearTimeout,
 STATE:{equipped:[stone],inventory:[],gold:0,fusionMastery:0,fusionXp:0},
 localPlayer:{id:'audit-player',playerKey:'audit-player',x:100,y:100,radius:16,hp:100,mana:100,maxMana:100},
 simulatedPlayers:new Map(),obstacles:[],CONFIG:{worldWidth:1000,worldHeight:1000,zoom:1},
 document:documentStub,screenW:390,screenH:844,camera:{x:100,y:100},
 addEventListener(){},dispatchEvent(){return true;},saveState(){},showToast(){},
 KeloEvents:{emit(name,payload){events.push({name,payload});}},
 KeloStones:{
  LOADOUT_SIZE:5,SCHEMA_VERSION:4,
  exportLoadout(){return snapshot;},normalizeStone(value){return value;},resolveAbility(value){return value?.abilityKey==='fireball'?stoneDef:null;},abilityByKey(key){return key==='fireball'?stoneDef:null;},
  migrateState(){return{migrated:0,quarantined:0,rekeyed:0,overflow:0};},createStarterSet(){return[stone];},createFromLegacy(){return stone;},createAbilityStone(){return stone;},stoneSummary(){return null;},projectLoadout(){return[stone,null,null,null,null];},canFuse(){return{valid:false,reason:'NEED_THREE'};},tierRank(){return 0;},validateLoadoutSnapshot(){return{valid:true};}
 },
 KELO_COLLISION:{upsert(){},remove(){},clearOwner(){},segmentAabbHitT(){return null;}},
 KeloEffectEngine:{apply(){return{ok:true};}},KeloHitResolver:{sweptCircle(){return{hit:false};}},KeloDamageResolver:{},
 KeloSimulation:{after(id,fn){simulationHooks.set(id,fn);return id;},setEnabled(id,enabled){const hook=simulationHooks.get(id);if(hook)hook.enabled=enabled;return true;}},
 KeloRender:{afterFrame(id,fn){renderHooks.set(id,fn);return id;},setEnabled(id,enabled){const hook=renderHooks.get(id);if(hook)hook.enabled=enabled;return true;}},
 KeloStatusEffects:{isActionBlocked(){return false;},has(){return false;}},
 window:null
};
context.window=context;
vm.createContext(context);
const source=fs.readFileSync(new URL('../src/abilities/kelo-ability-boot.js',import.meta.url),'utf8');
vm.runInContext(source,context,{filename:'kelo-ability-boot.js'});
const A=context.KeloAbilities;
assert(A?.engine?.castSource,'KeloAbilities.engine.castSource must exist');
assert(A?.engine?.predictSource,'KeloAbilities.engine.predictSource must exist');
assert.equal(A.hotbar.slots.length,5,'Stone hotbar remains exactly five slots');
const before=A.hotbar.slots.slice();
const manaBefore=context.localPlayer.mana;
let result=A.engine.castSource({sourceType:'equipment',sourceId:'weapon.audit',sourceSlot:'Q',sourceFingerprint:'weapon.audit|Q',definition:abilityDef,request:{slotIndex:0,direction:{x:1,y:0}}});
assert.equal(result.valid,true);assert.equal(result.sourceType,'equipment');assert.equal(result.sourceId,'weapon.audit');assert.equal(result.sourceSlot,'Q');assert.equal(result.stoneUid,null);assert.equal(context.localPlayer.mana,manaBefore-7,'native source cast must reuse KeloAbilities resource validation/cost');
for(let i=0;i<5;i++)assert.strictEqual(A.hotbar.slots[i],before[i],'source cast must preserve exact Stone hotbar object at slot '+i);
assert(events.filter(e=>e.name==='KELO_ABILITY_SOURCE_CAST').length===1,'native runtime must publish one global semantic source event');
const manaAfterCast=context.localPlayer.mana;
result=A.engine.predictSource({sourceType:'mount',sourceId:'mount.audit',sourceSlot:'M1',sourceFingerprint:'mount.audit|M1',definition:abilityDef,request:{slotIndex:0,direction:{x:1,y:0}}});
assert.equal(result.valid,true);assert.equal(result.predicted,true);assert.equal(context.localPlayer.mana,manaAfterCast,'prediction must not spend mana');
for(let i=0;i<5;i++)assert.strictEqual(A.hotbar.slots[i],before[i],'prediction must preserve exact Stone hotbar object at slot '+i);
assert.equal(A.engine.castSource({sourceType:'stone',sourceId:'fake',definition:abilityDef,request:{direction:{x:1,y:0}}}).reason,'INVALID_SOURCE','Stone must keep using the Stone owner/hotbar path');
assert.equal(A.engine.castSource({sourceType:'equipment',sourceId:'',definition:abilityDef,request:{direction:{x:1,y:0}}}).reason,'INVALID_SOURCE');
const shim=fs.readFileSync(new URL('../src/abilities/ability-source-cast.js',import.meta.url),'utf8');
assert(shim.includes('castSource'),'compatibility shim must delegate to native owner');
assert(!shim.includes('hotbar.slots['),'compatibility shim must never borrow a Stone hotbar slot');
assert(context.KELO_STONE_AUDIT.nativeSourceCast===true);assert(context.KELO_STONE_AUDIT.sourceHotbarMutation===false);
assert(context.KELO_STONE_AUDIT.sleepWake===true,'source-native runtime must preserve Performance Foundation sleep/wake');
console.log('KELO_ABILITY_SOURCE_NATIVE_AUDIT=PASS');
console.log(JSON.stringify({ok:true,stoneSlots:A.hotbar.slots.length,stoneReferencesPreserved:true,nativeSourceCast:true,nativePredictSource:true,sharedManaCost:true,semanticEvents:true,legacyBridge:false,sleepWake:true},null,2));
