/* KELO-INDEX
 * area: GUARDIAN / FAILOVER
 * owner: KeloGuardianMirror (support owner under KeloGuardian)
 * keys: GUARDIAN HOT MIRROR CHECKPOINT FAILOVER TAKEOVER ACK EPOCH WEBRTC SNAPSHOT
 * purpose: replica checkpoints observados por KeloNet sobre el DataChannel Guardian y conserva una semilla reciente para relevo de Master
 * consumes: KeloGuardian + KeloNetAuthority + keloNet + KeloSimulation
 * state-owned: último checkpoint recibido, ACKs de mirrors, semilla de takeover y diagnóstico de failover
 * online: NO sustituye autoridad gameplay; prepara continuidad y reclama la lease Master únicamente por KeloGuardian/server permission
 * do-not: NO aplicar HP/economía/inventario desde checkpoint; NO segundo simulation loop; NO autoacuñar recompensas; NO declarar takeover gameplay completo
 */
(function(root){
'use strict';
if(root.KeloGuardianMirror||!root.KeloGuardian)return;
const VERSION='kelo-guardian-hot-mirror-v1';
const CHECKPOINT_MS=750,FRESH_MS=4500,CLAIM_MAX_AGE_MS=45000,CLAIM_RETRY_MS=4500,ACK_STALE_MS=7000,MAX_PEERS=24,MAX_PROJECTILES=64,MAX_HISTORY=24,MAX_CHECKPOINT_BYTES=56*1024;
let seq=0,lastBroadcastAt=0,latest=null,history=[],takeoverSeed=null,lastError=null,lastEmitKey='',claimInFlight=false,lastClaimAt=0,lostMasterSince=0,previousMaster=null;
const acks=new Map();
function finite(v,fallback){const n=Number(v);return Number.isFinite(n)?n:(fallback==null?0:fallback);}
function short(v,max=80){return String(v==null?'':v).replace(/[\u0000-\u001f]/g,'').slice(0,max);}
function safeActor(p){if(!p||typeof p!=='object')return null;return Object.freeze({id:short(p.id,80),name:short(p.name||'Kelo',24),x:finite(p.x),y:finite(p.y),face:short(p.face||p._face||'down',12),gait:short(p.gait||p._gait||'idle',16),zone:short(p.zone||'plaza',40),hp:finite(p.hp,100),maxHp:finite(p.maxHp,100),mana:finite(p.mana,100),maxMana:finite(p.maxMana,100)});}
function safeProjectile(p){if(!p||typeof p!=='object')return null;return Object.freeze({id:short(p.id,96),ownerId:short(p.ownerId||p.actorId||'',80),abilityKey:short(p.abilityKey||'',64),x:finite(p.x??p.position?.x),y:finite(p.y??p.position?.y),vx:finite(p.vx),vy:finite(p.vy),radius:Math.max(0,finite(p.radius)),serverTick:Math.max(0,Math.floor(finite(p.serverTick)))});}
function jsonBytes(value){try{return new TextEncoder().encode(JSON.stringify(value)).byteLength;}catch(_){try{return JSON.stringify(value).length;}catch(__){return Infinity;}}}
function guardianState(){try{return root.KeloGuardian.state();}catch(_){return{};}}
function transport(){try{return root.KeloGuardian.transport();}catch(_){return{};}}
function masterKey(master){return master&&master.nodeId?String(master.nodeId)+':'+String(Number(master.epoch)||0):'';}
function authoritativeTick(){return Math.max(0,Math.floor(finite(root.KELO_PVP_NET_AUDIT?.lastServerTick)));}
function buildCheckpoint(now){
  const g=guardianState(),master=g.master||{},net=root.keloNet||{},peerRows=Object.values(net.peers||{}).slice(0,MAX_PEERS).map(safeActor).filter(Boolean),projectiles=Array.isArray(net.pvpProjectiles)?net.pvpProjectiles.slice(0,MAX_PROJECTILES).map(safeProjectile).filter(Boolean):[];
  const self=(typeof root.localPlayer!=='undefined'&&root.localPlayer)?safeActor(Object.assign({id:net.id||'self'},root.localPlayer)):null;
  const checkpoint={t:'guardian:mirror_checkpoint',schema:1,seq:++seq,epoch:Number(master.epoch)||0,masterNodeId:short(master.nodeId||g.nodeId,96),generatedAt:now,source:'kelo-net-observed-v1',serverTick:authoritativeTick(),lastPvpAck:Math.max(0,Math.floor(finite(root.KeloNetAuthority?.getLastPvpAck?.()))),mode:root.KeloPvPWorld?.state?.combatEnabled?'pvp':'world',self,peers:peerRows,projectiles};
  if(jsonBytes(checkpoint)>MAX_CHECKPOINT_BYTES){checkpoint.projectiles=[];while(checkpoint.peers.length&&jsonBytes(checkpoint)>MAX_CHECKPOINT_BYTES)checkpoint.peers.pop();}
  return checkpoint;
}
function checkpointFresh(row,now=Date.now()){return !!row&&now-finite(row.receivedAt||row.generatedAt,0)<=FRESH_MS;}
function checkpointClaimable(row,now=Date.now()){return !!row&&now-finite(row.receivedAt||row.generatedAt,0)<=CLAIM_MAX_AGE_MS;}
function cleanupAcks(now){for(const [id,row] of acks)if(now-finite(row.at)>ACK_STALE_MS)acks.delete(id);}
function emit(force){
  const s=state(),key=[s.mode,s.latestSeq,s.latestServerTick,s.backupCount,s.checkpointFresh,s.failoverCandidate,s.claimInFlight,s.takeoverSeedAvailable,s.lastError||''].join('|');
  if(!force&&key===lastEmitKey)return s;lastEmitKey=key;
  try{root.dispatchEvent(new CustomEvent('kelo:guardian-mirror-state',{detail:s}));}catch(_){}return s;
}
function state(){
  const now=Date.now(),g=guardianState(),tp=transport(),fresh=checkpointFresh(latest,now),claimable=checkpointClaimable(latest,now),visible=(typeof document==='undefined'||document.visibilityState==='visible'),failoverCandidate=!!(g.enabled&&!g.masterActive&&g.masterEligible&&visible&&claimable&&(lostMasterSince>0||tp.connectedToMaster===false));
  return Object.freeze({version:VERSION,mode:!g.enabled?'off':g.masterActive?'primary':fresh?'hot-mirror':'standby',primary:g.masterActive===true,latestSeq:latest?.seq||0,latestServerTick:latest?.serverTick||0,latestCheckpointAt:latest?.receivedAt||latest?.generatedAt||null,checkpointAgeMs:latest?Math.max(0,now-finite(latest.receivedAt||latest.generatedAt)):null,checkpointFresh:fresh,checkpointClaimable:claimable,backupCount:acks.size,backupNodes:Object.freeze([...acks.keys()]),failoverCandidate,claimInFlight,takeoverSeedAvailable:!!takeoverSeed,takeoverSeedSeq:takeoverSeed?.seq||0,previousMaster:previousMaster?Object.freeze({...previousMaster}):null,authoritativeGameplay:false,lastError});
}
function acceptCheckpoint(fromNodeId,msg){
  const g=guardianState(),master=g.master;if(!msg||msg.t!=='guardian:mirror_checkpoint'||!master?.nodeId)return false;
  if(String(fromNodeId)!==String(master.nodeId))return false;
  if(Number(msg.epoch)!==Number(master.epoch))return false;
  const incomingSeq=Math.max(0,Math.floor(finite(msg.seq)));if(!incomingSeq||(latest&&incomingSeq<=Number(latest.seq)&&String(fromNodeId)===String(latest.fromNodeId)))return false;
  if(jsonBytes(msg)>MAX_CHECKPOINT_BYTES)return false;
  const receivedAt=Date.now(),row=Object.freeze({fromNodeId:String(fromNodeId),seq:incomingSeq,epoch:Number(msg.epoch)||0,masterNodeId:String(msg.masterNodeId||fromNodeId),generatedAt:finite(msg.generatedAt,receivedAt),receivedAt,source:String(msg.source||'unknown'),serverTick:Math.max(0,Math.floor(finite(msg.serverTick))),lastPvpAck:Math.max(0,Math.floor(finite(msg.lastPvpAck))),mode:String(msg.mode||'world'),self:msg.self||null,peers:Array.isArray(msg.peers)?msg.peers.slice(0,MAX_PEERS):[],projectiles:Array.isArray(msg.projectiles)?msg.projectiles.slice(0,MAX_PROJECTILES):[]});
  latest=row;history.push(row);while(history.length>MAX_HISTORY)history.shift();previousMaster={nodeId:String(fromNodeId),epoch:Number(msg.epoch)||0,lastCheckpointAt:receivedAt};lostMasterSince=0;
  root.KeloGuardian.sendToMaster({t:'guardian:mirror_ack',schema:1,seq:row.seq,serverTick:row.serverTick,epoch:row.epoch,receivedAt});emit(true);return true;
}
function acceptAck(fromNodeId,msg){
  const g=guardianState();if(!g.masterActive||!msg||msg.t!=='guardian:mirror_ack')return false;if(Number(msg.epoch)!==Number(g.master?.epoch||0))return false;
  acks.set(String(fromNodeId),{seq:Math.max(0,Math.floor(finite(msg.seq))),serverTick:Math.max(0,Math.floor(finite(msg.serverTick))),at:Date.now()});emit(true);return true;
}
function onGuardianData(event){const d=event?.detail||{},msg=d.payload||{};if(msg.t==='guardian:mirror_checkpoint')acceptCheckpoint(d.fromNodeId,msg);else if(msg.t==='guardian:mirror_ack')acceptAck(d.fromNodeId,msg);else if(msg.t==='guardian:mirror_takeover'){previousMaster={nodeId:String(d.fromNodeId||''),epoch:Number(msg.previousEpoch)||0,lastCheckpointAt:Date.now()};emit(true);}}
function broadcastCheckpoint(now){const g=guardianState();if(!g.masterActive||now-lastBroadcastAt<CHECKPOINT_MS)return;lastBroadcastAt=now;cleanupAcks(now);const checkpoint=buildCheckpoint(now);root.KeloGuardian.broadcast(checkpoint);}
async function attemptFailover(now){
  const g=guardianState(),tp=transport();if(!g.enabled||g.masterActive||!g.masterEligible||document.visibilityState!=='visible'||!checkpointClaimable(latest,now)){lostMasterSince=0;return;}
  const directGone=tp.connectedToMaster===false;if(!directGone)return;
  if(!lostMasterSince)lostMasterSince=now;if(now-lostMasterSince<3500||claimInFlight||now-lastClaimAt<CLAIM_RETRY_MS)return;
  claimInFlight=true;lastClaimAt=now;emit(true);
  try{
    const seed=latest,next=await root.KeloGuardian.startMasterHost();
    if(next?.masterActive){takeoverSeed=seed;lastError=null;const newEpoch=Number(next.master?.epoch||next.masterEpoch||0);try{root.dispatchEvent(new CustomEvent('kelo:guardian-mirror-takeover',{detail:{seed,previousMaster,masterEpoch:newEpoch,authoritativeGameplay:false}}));}catch(_){}root.KeloGuardian.broadcast({t:'guardian:mirror_takeover',schema:1,previousEpoch:Number(seed?.epoch)||0,newEpoch,seedSeq:Number(seed?.seq)||0,serverTick:Number(seed?.serverTick)||0,at:Date.now(),authoritativeGameplay:false});acks.clear();lostMasterSince=0;}
  }catch(error){const raw=String(error&&error.message||error);if(!/MASTER_BUSY|STILL_HEALTHY|409/.test(raw))lastError=raw;}finally{claimInFlight=false;emit(true);}
}
function observeGuardianState(){const g=guardianState(),m=g.master;if(g.masterActive){lostMasterSince=0;previousMaster={nodeId:g.nodeId,epoch:Number(m?.epoch||0),lastCheckpointAt:Date.now()};return emit();}if(m?.nodeId){const key=masterKey(m),prior=previousMaster&&masterKey(previousMaster);if(prior&&key!==prior&&latest)latest=null;previousMaster={nodeId:String(m.nodeId),epoch:Number(m.epoch)||0,lastCheckpointAt:latest?.receivedAt||0};}emit();}
function tick(){const now=Date.now(),g=guardianState();if(!g.enabled)return emit();if(g.masterActive)broadcastCheckpoint(now);else attemptFailover(now);cleanupAcks(now);emit();}
root.addEventListener('kelo:guardian-data',onGuardianData,{passive:true});root.addEventListener('kelo:guardian-state',observeGuardianState,{passive:true});
if(!root.KeloSimulation||typeof root.KeloSimulation.after!=='function')throw new Error('GUARDIAN_MIRROR_SIMULATION_OWNER_UNAVAILABLE');root.KeloSimulation.after('guardian:hot-mirror',tick,365);
root.KeloGuardianMirror=Object.freeze({version:VERSION,state,latestCheckpoint:()=>latest,history:()=>Object.freeze(history.slice()),takeoverSeed:()=>takeoverSeed});
root.KELO_GUARDIAN_MIRROR_AUDIT=Object.freeze({version:VERSION,owner:'KeloGuardianMirror',guardianSupport:true,checkpointTransport:'existing-kelo-guardian-datachannel',acknowledgedBackups:true,automaticMasterClaim:true,secondLoop:false,clientGameplayAuthority:false,authoritativeGameplay:false,economyAuthority:false});
emit(true);
})(typeof globalThis!=='undefined'?globalThis:window);
