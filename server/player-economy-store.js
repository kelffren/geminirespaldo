'use strict';
/* KELO-INDEX
 * area: SERVER / ECONOMY
 * owner: PlayerEconomyStore
 * keys: GOLD INVENTORY EQUIPMENT TRANSACTION CHECKPOINT AUTHORITY PERSISTENCE EDGE SNAPSHOT
 * purpose: única fuente autoritativa server-side para saldo/propiedad; añade hidratación y flush durable sin cambiar APIs consumidoras
 * reuse: Forge, Commerce y futuros Auction/Gift/Repair deben compartir este mismo store
 * do-not: NO crear otro Map de gold/inventory dentro de features consumidoras, NO bloquear mutaciones por latencia de DB
 */
const {createServerStateBridge}=require('./server-state-bridge');
const VERSION='player-economy-store-v1.1.0';
const DEFAULT_SLOTS=['weapon','helmet','chest','gloves','boots','accessory','necklace','ring','belt'];
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

function seedPlayer(id){
  const equipment={};
  DEFAULT_SLOTS.forEach(slot=>{equipment['eq_'+slot]={id:'eq_'+slot,owner:id,templateId:'starter_'+slot,name:'Equipo '+slot,slot,itemLevel:1,quality:1,grade:1,equipped:true,baseStats:{attack:0,defense:0,hp:0},specialStats:{attackPct:0,defensePct:0,hpPct:0}};});
  const inventory={};['ruby','sapphire','emerald','forge_crystal'].forEach(f=>{for(let l=1;l<=4;l++)inventory[f+'_'+l]=l===1?18:0;});
  return{id:String(id),gold:500000,equipment,inventory,items:[],reservations:{},history:[],commerceHistory:[],commerceRevision:1,commerceMigrated:false};
}
function replaceRecord(target,snapshot){Object.keys(target).forEach(k=>delete target[k]);Object.assign(target,clone(snapshot));return target;}
function normalizeRecord(p,id){
  p.id=String(id);if(!p.equipment||typeof p.equipment!=='object')p.equipment={};if(!p.inventory||typeof p.inventory!=='object')p.inventory={};if(!Array.isArray(p.items))p.items=[];if(!p.reservations||typeof p.reservations!=='object')p.reservations={};if(!Array.isArray(p.history))p.history=[];if(!Array.isArray(p.commerceHistory))p.commerceHistory=[];if(!Number.isFinite(Number(p.commerceRevision)))p.commerceRevision=1;if(typeof p.commerceMigrated!=='boolean')p.commerceMigrated=false;return p;
}

function createPlayerEconomyStore(opts={}){
  const players=opts.players instanceof Map?opts.players:new Map();
  const bridge=opts.persistenceBridge||createServerStateBridge(opts);
  const source=bridge.configured?'supabase-edge-snapshot':(opts.supabaseUrl&&opts.supabaseServiceKey?'supabase-prepared':'ram-authoritative');
  const hydrated=new Set(),hydrating=new Map(),flushTimers=new Map(),proxyByRaw=new WeakMap();
  let persistenceLoads=0,persistenceSaves=0,persistenceFailures=0,lastPersistenceError=null,lastPersistenceAt=0;
  function ensureRaw(id){const key=String(id||'').trim();if(!key)throw new Error('INVALID_PLAYER_ID');if(!players.has(key))players.set(key,seedPlayer(key));return normalizeRecord(players.get(key),key);}
  function scheduleFlush(id){
    const key=String(id);if(!bridge.configured||!hydrated.has(key))return;
    clearTimeout(flushTimers.get(key));const timer=setTimeout(()=>{flushTimers.delete(key);flush(key).catch(()=>{});},300);if(typeof timer.unref==='function')timer.unref();flushTimers.set(key,timer);
  }
  function proxify(value,id){
    if(!value||typeof value!=='object')return value;if(proxyByRaw.has(value))return proxyByRaw.get(value);
    const proxy=new Proxy(value,{get(target,prop,receiver){return proxify(Reflect.get(target,prop,receiver),id);},set(target,prop,next,receiver){const changed=Reflect.get(target,prop,receiver)!==next;const ok=Reflect.set(target,prop,next,receiver);if(changed)scheduleFlush(id);return ok;},deleteProperty(target,prop){const had=Object.prototype.hasOwnProperty.call(target,prop),ok=Reflect.deleteProperty(target,prop);if(had)scheduleFlush(id);return ok;}});
    proxyByRaw.set(value,proxy);return proxy;
  }
  function ensure(id){const key=String(id||'').trim();return proxify(ensureRaw(key),key);}
  async function hydrate(id){
    const key=String(id||'').trim();ensureRaw(key);if(!bridge.configured||hydrated.has(key))return ensure(key);if(hydrating.has(key))return hydrating.get(key);
    const promise=(async()=>{try{persistenceLoads++;const snapshot=await bridge.load(key),saved=snapshot&&snapshot.payload&&snapshot.payload.economy;if(saved&&typeof saved==='object'&&String(saved.id||key)===key)replaceRecord(ensureRaw(key),normalizeRecord(clone(saved),key));hydrated.add(key);lastPersistenceError=null;lastPersistenceAt=Date.now();if(!saved)await flush(key);return ensure(key);}catch(error){persistenceFailures++;lastPersistenceError=String(error&&error.message||error);return ensure(key);}finally{hydrating.delete(key);}})();
    hydrating.set(key,promise);return promise;
  }
  async function flush(id){
    const key=String(id||'').trim();if(!bridge.configured)return false;try{persistenceSaves++;await bridge.save(key,{economy:clone(ensureRaw(key))});hydrated.add(key);lastPersistenceError=null;lastPersistenceAt=Date.now();return true;}catch(error){persistenceFailures++;lastPersistenceError=String(error&&error.message||error);throw error;}
  }
  async function flushMany(ids){const unique=[...new Set((Array.isArray(ids)?ids:[ids]).filter(Boolean).map(String))];return Promise.allSettled(unique.map(flush));}
  function checkpoint(ids){const unique=[...new Set((Array.isArray(ids)?ids:[ids]).filter(Boolean).map(String))],records={};unique.forEach(id=>{records[id]=clone(ensureRaw(id));});return{version:VERSION,ids:unique,records};}
  function restore(cp){if(!cp||!Array.isArray(cp.ids)||!cp.records)throw new Error('INVALID_ECONOMY_CHECKPOINT');cp.ids.forEach(id=>replaceRecord(ensureRaw(id),cp.records[id]));return true;}
  async function transaction(ids,fn){if(typeof fn!=='function')throw new Error('TRANSACTION_CALLBACK_REQUIRED');const cp=checkpoint(ids);try{const result=await fn(...cp.ids.map(ensure));scheduleFlush(cp.ids[0]);cp.ids.slice(1).forEach(scheduleFlush);return result;}catch(err){restore(cp);throw err;}}
  function snapshot(id){return clone(ensureRaw(id));}
  function auditPlayer(id){const p=ensureRaw(id),ids=[];Object.values(p.equipment||{}).forEach(x=>{if(x?.id)ids.push(String(x.id));});(p.items||[]).forEach(x=>{if(x?.id)ids.push(String(x.id));});const duplicates=ids.filter((x,i)=>ids.indexOf(x)!==i);return{ok:duplicates.length===0,duplicates:[...new Set(duplicates)],gold:Number(p.gold)||0,itemInstances:(p.items||[]).length,equipmentInstances:Object.keys(p.equipment||{}).length};}
  function auditPersistence(){return{source,configured:bridge.configured,hydrated:hydrated.size,pendingFlushes:flushTimers.size,loads:persistenceLoads,saves:persistenceSaves,failures:persistenceFailures,lastError:lastPersistenceError,lastPersistenceAt,bridge:bridge.audit()};}
  return Object.freeze({version:VERSION,source,ensure,hydrate,flush,flushMany,snapshot,checkpoint,restore,transaction,auditPlayer,auditPersistence,_debugPlayer:ensure,_players:players,_bridge:bridge});
}
module.exports={VERSION,DEFAULT_SLOTS,seedPlayer,createPlayerEconomyStore};
