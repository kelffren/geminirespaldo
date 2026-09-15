/* KELO-INDEX
 * area: INSTANCES
 * keys: INSTANCE MANAGER LIFECYCLE SCENE OFFLINE ONLINE READY
 * hace: administra instancias lógicas reutilizables sin acoplarlas al transporte
 * online: la misma API puede delegar creación/join/leave a un director de instancias remoto
 */
(function(){
  'use strict';
  const STATUS=Object.freeze({CREATING:'CREATING',LOADING:'LOADING',ACTIVE:'ACTIVE',IDLE:'IDLE',SHUTTING_DOWN:'SHUTTING_DOWN',DESTROYED:'DESTROYED'});
  const types=new Map(),active=new Map(),listeners=new Set(),idleTimers=new Map();
  let currentId=null,seq=1;
  const context={zoneType:'world',currentInstanceId:null,instanceType:null,resourceId:null};
  const clone=v=>JSON.parse(JSON.stringify(v));
  const now=()=>Date.now();
  const cleanParticipant=p=>({id:String(p?.id||p||'local_pioneer'),role:String(p?.role||'visitor')});
  function emit(event,instance){const payload={event,instance:publicInstance(instance),context:clone(context)};listeners.forEach(fn=>{try{fn(payload);}catch(err){console.error('[Kelo instances] listener',err);}});try{window.dispatchEvent(new CustomEvent('kelo:instance',{detail:payload}));}catch(e){}}
  function publicInstance(i){if(!i)return null;return{instanceId:i.instanceId,type:i.type,resourceId:i.resourceId,ownerId:i.ownerId,status:i.status,revision:i.revision,createdAt:i.createdAt,lastActiveAt:i.lastActiveAt,authoritySource:i.authoritySource,maxPlayers:i.maxPlayers,parcelId:i.parcelId||null,config:clone(i.config||{}),permissions:clone(i.permissions||{}),participants:Array.from(i.participants.values()).map(clone)};}
  function setContext(i){currentId=i?.instanceId||null;context.zoneType=i?'instance':'world';context.currentInstanceId=i?.instanceId||null;context.instanceType=i?.type||null;context.resourceId=i?.resourceId||null;try{window.dispatchEvent(new CustomEvent('kelo:scenechange',{detail:clone(context)}));}catch(e){}}
  function makeId(type,resourceId){return `instance:${String(type)}:${String(resourceId)}`;}
  function registerType(type,factory){type=String(type||'').trim();if(!type||!factory||typeof factory.create!=='function')throw new Error('INVALID_INSTANCE_TYPE');types.set(type,factory);return type;}
  function getInstance(id){return active.get(String(id))||null;}
  async function createInstance(opts){opts=opts||{};const type=String(opts.type||''),resourceId=String(opts.resourceId||'');if(!type||!resourceId)throw new Error('INSTANCE_ID_REQUIRED');const factory=types.get(type);if(!factory)throw new Error('INSTANCE_TYPE_NOT_REGISTERED');const instanceId=String(opts.instanceId||makeId(type,resourceId));if(active.has(instanceId))return active.get(instanceId);
    const base={instanceId,type,resourceId,ownerId:String(opts.ownerId||''),status:STATUS.CREATING,revision:0,createdAt:now(),lastActiveAt:now(),authoritySource:String(opts.authoritySource||'local'),maxPlayers:Math.max(1,Number(opts.maxPlayers)||8),config:clone(opts.config||{}),permissions:{},participants:new Map(),runtimeState:{},parcelId:null,_factory:factory};active.set(instanceId,base);emit('creating',base);
    base.status=STATUS.LOADING;emit('loading',base);
    try{const extra=await factory.create({instanceId,type,resourceId,ownerId:base.ownerId,config:clone(base.config),options:opts});if(extra&&typeof extra==='object')Object.assign(base,extra);base.participants=base.participants instanceof Map?base.participants:new Map();base.maxPlayers=Math.max(1,Number(base.maxPlayers)||8);base.status=STATUS.ACTIVE;base.lastActiveAt=now();emit('created',base);return base;}catch(err){base.status=STATUS.DESTROYED;active.delete(instanceId);emit('create-error',base);throw err;}
  }
  async function getOrCreateInstance(opts){const id=String(opts?.instanceId||makeId(opts?.type,opts?.resourceId));return active.get(id)||createInstance(opts);}
  function cancelIdle(id){const t=idleTimers.get(id);if(t){clearTimeout(t);idleTimers.delete(id);}}
  async function joinInstance(instanceId,participant){const i=getInstance(instanceId);if(!i)throw new Error('INSTANCE_NOT_FOUND');cancelIdle(i.instanceId);const p=cleanParticipant(participant);if(!i.participants.has(p.id)&&i.participants.size>=i.maxPlayers)throw new Error('INSTANCE_FULL');i.participants.set(p.id,p);i.status=STATUS.ACTIVE;i.lastActiveAt=now();i.revision=(Number(i.revision)||0)+1;if(typeof i.onJoin==='function')await i.onJoin(p,i);emit('join',i);return publicInstance(i);}
  async function leaveInstance(instanceId,participantId,opts){const i=getInstance(instanceId);if(!i)return null;const pid=String(participantId||'');if(pid&&i.participants.has(pid)){const p=i.participants.get(pid);i.participants.delete(pid);if(typeof i.onLeave==='function')await i.onLeave(p,i);}i.lastActiveAt=now();i.revision=(Number(i.revision)||0)+1;if(!i.participants.size){i.status=STATUS.IDLE;emit('idle',i);const ttl=Math.max(0,Number(opts?.idleTTL??i.config?.idleTTL??120000));if(ttl===0)await destroyInstance(i.instanceId,{reason:'idle'});else{cancelIdle(i.instanceId);idleTimers.set(i.instanceId,setTimeout(()=>destroyInstance(i.instanceId,{reason:'idle'}).catch(console.error),ttl));}}else emit('leave',i);return publicInstance(i);}
  async function destroyInstance(instanceId,opts){const i=getInstance(instanceId);if(!i)return false;cancelIdle(i.instanceId);i.status=STATUS.SHUTTING_DOWN;emit('shutting-down',i);try{if(typeof i.onDestroy==='function')await i.onDestroy(i,opts||{});}finally{i.status=STATUS.DESTROYED;active.delete(i.instanceId);if(currentId===i.instanceId)setContext(null);emit('destroyed',i);}return true;}
  async function enter(type,resourceId,participant,opts){opts=opts||{};const p=cleanParticipant(participant);const i=await getOrCreateInstance({type,resourceId,ownerId:opts.ownerId||p.id,maxPlayers:opts.maxPlayers,config:opts.config,authoritySource:opts.authoritySource||'local'});await joinInstance(i.instanceId,p);setContext(i);if(typeof i.onEnter==='function')await i.onEnter(p,i);emit('enter',i);return publicInstance(i);}
  async function leaveCurrent(participantId,opts){const i=currentId?getInstance(currentId):null;if(!i){setContext(null);return null;}const pid=String(participantId||Array.from(i.participants.keys())[0]||'');if(typeof i.onExit==='function')await i.onExit(pid,i);setContext(null);return leaveInstance(i.instanceId,pid,opts||{});}
  function serializeInstance(instanceId){const i=getInstance(instanceId);if(!i)return null;return{schema:1,...publicInstance(i),runtimeState:clone(i.runtimeState||{})};}
  function getActiveInstances(){return Array.from(active.values()).map(publicInstance);}
  function current(){return currentId?publicInstance(getInstance(currentId)):null;}
  const api={version:'instance-system-v1.0.0',STATUS,registerType,makeId,createInstance,getInstance:(id)=>publicInstance(getInstance(id)),getOrCreateInstance:async o=>publicInstance(await getOrCreateInstance(o)),joinInstance,leaveInstance,destroyInstance,serializeInstance,getActiveInstances,current,enter,leaveCurrent,onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);},_getRuntime:id=>getInstance(id)};
  window.KELO_INSTANCES=Object.freeze(api);
  window.KELO_SCENE_CONTEXT=Object.freeze({version:'scene-context-v1.0.0',current:()=>clone(context),isWorld:()=>context.zoneType==='world',isInstance:(type)=>context.zoneType==='instance'&&(!type||context.instanceType===type)});
  window.KELO_INSTANCE_AUDIT={version:'instance-system-v1.0.0',offline:true,serverReplaceable:true,types:0,active:0};
})();