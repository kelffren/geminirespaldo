/* KELO-INDEX
 * area: SERVER / NETWORK
 * owner: Kelo server authority + server/pvp-authority.js for PvP simulation
 * keys: WEBSOCKET AUTHORITY INPUT INTENT FIXED TIMESTEP RECONCILIATION PVP TITLES COMMERCE FORGE AOI SPATIAL GRID HYSTERESIS PERFORMANCE IDENTITY SUPABASE AVATAR HEALTH READINESS HEARTBEAT SHUTDOWN GUARDIAN NOTIFICATION
 * purpose: autoridad server-side; PvP acepta inputs/intents y todas las salidas de estado/presentación se filtran por zone + AOI por viewer; notificaciones globales se autorizan con roles/permisos Supabase
 * online: pose sigue para mundo social; dentro de PvP la posición, dash, cooldown, mana, hits, HP, CC, muerte y kills nacen del fixed-step server; hello resuelve identidad Supabase y avatar persistido cuando existe
 * do-not: NO broadcast global periódico de actores, NO daño/posición PvP declarados por cliente, NO confiar accountId/characterId/avatar URL/permisos enviados por cliente, NO segundo servidor HTTP paralelo
 */
'use strict';
const http = require('http');
const { WebSocketServer } = require('ws');
const { createNobilityService, safePlayerId } = require('./nobility-store');
const { createPlayerEconomyStore } = require('./player-economy-store');
const { createForgeService } = require('./forge-store');
const { createCommerceService } = require('./commerce-store');
const { createTitleService } = require('./title-store');
const { createPvpAuthority, FIXED_DT, SNAPSHOT_HZ } = require('./pvp-authority');
const { createOnlineIdentityStore } = require('./online-identity-store');
const { createAvatarSyncStore } = require('./avatar-sync-store');
const { createGuardianCoordinator } = require('./guardian-coordinator');

const PORT=Number(process.env.PORT||2567),MAX=32,WORLD={w:3600,h:3200};
const AOI_CELL=512,AOI_RADIUS=1350,AOI_HYSTERESIS=180,MAX_WS_PAYLOAD=64*1024,HEARTBEAT_MS=30000;
const STARTED_AT=Date.now();
let shuttingDown=false;
const VISUAL_EVENT_ALLOWLIST=new Set(['CAST_CONFIRMED','PROJECTILE_SPAWNED','PROJECTILE_HIT','PROJECTILE_EXPIRED','ABILITY_IMPACT','STATUS_APPLIED','STATUS_REMOVED','SHIELD_APPLIED','SHIELD_BROKEN','DASH_STARTED','DASH_ENDED','TRAP_PLACED','TRAP_ARMED','TRAP_TRIGGERED','TRAP_EXPIRED','DEATH']);
const NOTIFICATION_TYPE_ALLOWLIST=new Set(['admin','invasion','route','boss','market','pvp','property','system','info']);
const NOTIFICATION_PRIORITY_ALLOWLIST=new Set(['normal','info','world','important','critical']);
const NOTIFICATION_ROLE_ALLOWLIST=new Set(['admin','owner','developer','superadmin']);
const players=new Map();let seq=1;
const identity=createOnlineIdentityStore({supabaseUrl:process.env.SUPABASE_URL,supabaseServerKey:process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY,requireAuth:process.env.KELO_REQUIRE_AUTH==='1'});
const guardian=createGuardianCoordinator({identity});
const avatarSync=createAvatarSyncStore({supabaseUrl:process.env.SUPABASE_URL,supabaseApiKey:process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY});
const economy=createPlayerEconomyStore({supabaseUrl:process.env.SUPABASE_URL,supabaseServiceKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
const nobility=createNobilityService({supabaseUrl:process.env.SUPABASE_URL,supabaseServiceKey:process.env.SUPABASE_SERVICE_ROLE_KEY});
const forge=createForgeService({supabaseUrl:process.env.SUPABASE_URL,supabaseServiceKey:process.env.SUPABASE_SERVICE_ROLE_KEY,economyStore:economy});
const titles=createTitleService({supabaseUrl:process.env.SUPABASE_URL,supabaseServiceKey:process.env.SUPABASE_SERVICE_ROLE_KEY,enableSupabase:process.env.KELO_TITLES_SUPABASE==='1',tableName:process.env.KELO_TITLES_TABLE||'title_players'});
function connectionsForPlayerKey(playerKey){const rows=[];players.forEach(p=>{if(p.playerKey===String(playerKey))rows.push(p)});return rows;}
const commerce=createCommerceService({economyStore:economy,resolvePlayerName:playerKey=>connectionsForPlayerKey(playerKey)[0]?.name||String(playerKey),isPlayerOnline:playerKey=>connectionsForPlayerKey(playerKey).length>0});
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function shortId(value,max){return value==null?null:String(value).replace(/[^a-zA-Z0-9_:\-.]/g,'').slice(0,max||96);}
function safeText(value,max,fallback){const out=String(value==null?'':value).trim().slice(0,max||256);return out||String(fallback||'');}
function safeVec(value){if(!value||!Number.isFinite(Number(value.x))||!Number.isFinite(Number(value.y)))return null;return{x:clamp(Number(value.x),-256,WORLD.w+256),y:clamp(Number(value.y),-256,WORLD.h+256)};}
function safeDirection(value){if(!value||!Number.isFinite(Number(value.x))||!Number.isFinite(Number(value.y)))return null;const x=Number(value.x),y=Number(value.y),len=Math.hypot(x,y);if(!len||len>1000)return null;return{x:Number((x/len).toFixed(5)),y:Number((y/len).toFixed(5))};}
function send(ws,obj){if(ws&&ws.readyState===1)ws.send(JSON.stringify(obj));}
function serializePlayer(p){return{id:p.id,playerKey:p.playerKey,name:p.name,x:p.x,y:p.y,face:p.face,gait:p.gait,zone:p.zone,hp:Number.isFinite(p.hp)?p.hp:100,maxHp:Number.isFinite(p.maxHp)?p.maxHp:100,mana:Number.isFinite(Number(p.mana))?Number(p.mana):100,maxMana:Number.isFinite(Number(p.maxMana))?Number(p.maxMana):100,nobilityRank:p.nobilityRank||'none',nobilityPower:p.nobilityPower||0,equippedTitleId:p.equippedTitleId||null,armorScore:p.armorScore||0,auraRank:p.auraRank||0,averageQuality:p.averageQuality||0,averageGrade:p.averageGrade||0,equipmentSummary:Array.isArray(p.equipmentSummary)?p.equipmentSummary:[],avatarManifest:p.avatarManifest||null};}
function publicState(){const out={};players.forEach((p,id)=>{out[id]=serializePlayer(p)});return out;}
function cellKey(zone,x,y){return String(zone||'plaza')+'|'+Math.floor((Number(x)||0)/AOI_CELL)+'|'+Math.floor((Number(y)||0)/AOI_CELL);}
function buildSpatialIndex(){const index=new Map();players.forEach(p=>{const key=cellKey(p.zone,p.x,p.y);if(!index.has(key))index.set(key,[]);index.get(key).push(p)});return index;}
function candidatePlayers(viewer,index){const out=new Set(),zone=String(viewer.zone||'plaza'),cx=Math.floor((Number(viewer.x)||0)/AOI_CELL),cy=Math.floor((Number(viewer.y)||0)/AOI_CELL),cells=Math.ceil((AOI_RADIUS+AOI_HYSTERESIS)/AOI_CELL);for(let dx=-cells;dx<=cells;dx++)for(let dy=-cells;dy<=cells;dy++){const rows=index.get(zone+'|'+(cx+dx)+'|'+(cy+dy));if(rows)rows.forEach(p=>out.add(p));}out.add(viewer);return out;}
function relevantTo(viewer,target,wasRelevant){if(!viewer||!target)return false;if(viewer.id===target.id)return true;if(viewer.zone !== target.zone)return false;const radius=AOI_RADIUS+(wasRelevant?AOI_HYSTERESIS:0),dx=(Number(viewer.x)||0)-(Number(target.x)||0),dy=(Number(viewer.y)||0)-(Number(target.y)||0);return dx*dx+dy*dy<=radius*radius;}
function publicStateFor(viewer,index){const spatial=index||buildSpatialIndex(),previous=viewer._aoiRelevant instanceof Set?viewer._aoiRelevant:new Set(),next=new Set(),out={};candidatePlayers(viewer,spatial).forEach(target=>{const was=previous.has(target.id);if(!relevantTo(viewer,target,was))return;next.add(target.id);out[target.id]=serializePlayer(target)});viewer._aoiRelevant=next;return out;}
function sendRelevantStates(){if(!players.size)return;const index=buildSpatialIndex(),serverTime=Date.now();players.forEach(viewer=>send(viewer.ws,{t:'state',players:publicStateFor(viewer,index),serverTime,source:'server-aoi-v1'}));}
function sendRelevantJoin(actor){const index=buildSpatialIndex();players.forEach(viewer=>{if(viewer===actor)return;const was=viewer._aoiRelevant instanceof Set&&viewer._aoiRelevant.has(actor.id);if(relevantTo(viewer,actor,was))send(viewer.ws,{t:'join',player:serializePlayer(actor),serverTime:Date.now(),source:'server-aoi-v1'})});}
function sendRelevantLeave(actor){players.forEach(viewer=>{if(viewer===actor)return;const known=viewer._aoiRelevant instanceof Set&&viewer._aoiRelevant.has(actor.id);if(known){viewer._aoiRelevant.delete(actor.id);send(viewer.ws,{t:'leave',id:actor.id,serverTime:Date.now(),source:'server-aoi-v1'})}});}
function sendRelevantEvent(obj,actor,except){players.forEach(viewer=>{if(viewer===except)return;const targetId=obj&&obj.meta&&obj.meta.targetActorId,target=targetId&&players.get(targetId);const was=viewer._aoiRelevant instanceof Set&&viewer._aoiRelevant.has(actor.id);if(relevantTo(viewer,actor,was)||(target&&viewer.id===target.id))send(viewer.ws,obj)});}
function notifyCommerce(playerKeys,reason,exceptPlayerKey){[...new Set((playerKeys||[]).filter(Boolean).map(String))].forEach(playerKey=>{if(playerKey===exceptPlayerKey)return;const snapshot=commerce.snapshot(playerKey);connectionsForPlayerKey(playerKey).forEach(p=>send(p.ws,{t:'commerce:event',reason:reason||null,snapshot,source:'server-authoritative'}))});}
function canPublishWorldNotification(me){const permissions=new Set(Array.isArray(me&&me.permissions)?me.permissions.map(x=>String(x).toLowerCase()):[]),roles=new Set(Array.isArray(me&&me.roles)?me.roles.map(x=>String(x).toLowerCase()):[]);return !!(me&&me.accountId&&me.authSource==='supabase-auth-rls'&&(permissions.has('world.publish')||permissions.has('admin.issue')||[...roles].some(role=>NOTIFICATION_ROLE_ALLOWLIST.has(role))));}
function sanitizeNotificationAction(raw){const a=raw&&typeof raw==='object'?raw:null;if(!a||String(a.event||'')!=='world:focus-location')return null;const p=a.payload&&typeof a.payload==='object'?a.payload:{},point=safeVec({x:p.x,y:p.y});return{label:safeText(a.label,24,'VER MAPA'),event:'world:focus-location',payload:{mapId:shortId(p.mapId,80),zoneId:shortId(p.zoneId,80),cityId:shortId(p.cityId,80),x:point?point.x:null,y:point?point.y:null,reason:shortId(p.reason,80)}};}
function sanitizeWorldNotification(raw,me){const n=raw&&typeof raw==='object'?raw:{},target=n.target&&typeof n.target==='object'?n.target:{scope:n.target||'all'},scope=String(target.scope||'all').toLowerCase();if(!['all','global','server'].includes(scope))throw new Error('WORLD_NOTIFICATION_TARGET_NOT_ALLOWED');const type=String(n.type||'admin').toLowerCase(),priority=String(n.priority||'important').toLowerCase(),createdAt=Date.now(),requestedExpiry=Number(n.expiresAt),expiresAt=Number.isFinite(requestedExpiry)&&requestedExpiry>createdAt?Math.min(requestedExpiry,createdAt+7*24*60*60*1000):null;return{id:shortId(n.id,96)||('kwn:'+createdAt.toString(36)+':'+Math.random().toString(36).slice(2,8)),type:NOTIFICATION_TYPE_ALLOWLIST.has(type)?type:'admin',icon:safeText(n.icon,12,''),category:safeText(n.category,40,'ADMIN'),title:safeText(n.title,100,'KELO WORLD'),message:safeText(n.message,600,''),priority:NOTIFICATION_PRIORITY_ALLOWLIST.has(priority)?priority:'important',target:{scope:'all',id:null},action:sanitizeNotificationAction(n.action),createdAt,expiresAt,source:'admin-server',read:false,channel:'in_game',meta:{publishedBy:me.characterId||me.playerKey||null}};}
function publishWorldNotification(me,raw){if(!canPublishWorldNotification(me))throw new Error('WORLD_NOTIFICATION_FORBIDDEN');const now=Date.now();if(now-Number(me._lastWorldNotificationAt||0)<1200)throw new Error('WORLD_NOTIFICATION_RATE_LIMIT');const notification=sanitizeWorldNotification(raw,me);if(!notification.message&&!notification.title)throw new Error('WORLD_NOTIFICATION_EMPTY');me._lastWorldNotificationAt=now;let delivered=0;players.forEach(viewer=>{if(viewer.ws&&viewer.ws.readyState===1){send(viewer.ws,{t:'commerce:event',kind:'world-notification',notification,source:'server-authoritative'});delivered++;}});return{ok:true,notificationId:notification.id,delivered};}
function sanitizeVisualContext(raw){const c=raw&&typeof raw==='object'?raw:{},gp=c.gameplay&&typeof c.gameplay==='object'?c.gameplay:{},visual=c.visual&&typeof c.visual==='object'?c.visual:{};return{castId:shortId(c.castId,96),abilityId:Number.isSafeInteger(Number(c.abilityId))?clamp(Number(c.abilityId),0,100000):null,abilityKey:shortId(c.abilityKey,64),origin:safeVec(c.origin),target:safeVec(c.target),direction:safeDirection(c.direction),gameplay:{speed:Number.isFinite(Number(gp.speed))?clamp(Number(gp.speed),0,5000):0,range:Number.isFinite(Number(gp.range))?clamp(Number(gp.range),0,5000):0,radius:Number.isFinite(Number(gp.radius))?clamp(Number(gp.radius),0,1000):0},visual:{scale:Number.isFinite(Number(visual.scale))?clamp(Number(visual.scale),.05,8):1,seed:Number.isFinite(Number(visual.seed))?(Number(visual.seed)>>>0):0,variant:shortId(visual.variant,64)},projectileId:shortId(c.projectileId,96),statusId:shortId(c.statusId,96),trapId:shortId(c.trapId,96),confirmed:true};}
function sanitizeVisualMeta(raw){const m=raw&&typeof raw==='object'?raw:{},targetActorId=shortId(m.targetActorId,80);return{status:shortId(m.status,40),duration:Number.isFinite(Number(m.duration))?clamp(Number(m.duration),0,120):null,targetActorId:targetActorId&&players.has(targetActorId)?targetActorId:null,amount:Number.isFinite(Number(m.amount))?clamp(Number(m.amount),-1000000,1000000):null,reason:shortId(m.reason,80)};}
function protocolError(ws,requestId,code,message){send(ws,{t:'error',requestId:requestId||null,code,message:message||code});}
async function refreshNobility(me,requestId){const snapshot=await nobility.snapshot(me.playerKey,me.name);me.nobilityRank=snapshot.rank.id;me.nobilityPower=snapshot.rank.power;send(me.ws,{t:'nobility:snapshot',requestId:requestId||null,snapshot});return snapshot;}
async function refreshTitles(me,requestId){const snapshot=await titles.snapshot(me.playerKey);me.equippedTitleId=snapshot.equippedTitleId||null;send(me.ws,{t:'titles:snapshot',requestId:requestId||null,snapshot});return snapshot;}
async function refreshForge(me,requestId){const snapshot=await forge.snapshot(me.playerKey);me.armorScore=snapshot.armorScore;me.auraRank=snapshot.auraRank;me.averageQuality=snapshot.averageQuality;me.averageGrade=snapshot.averageGrade;me.equipmentSummary=snapshot.equipmentSummary;send(me.ws,{t:'forge:snapshot',requestId:requestId||null,snapshot,source:forge.source});return snapshot;}
async function refreshAvatar(me,accessToken,requestId){if(!me.characterId||!accessToken){me.avatarManifest=null;return null;}me._avatarAccessToken=String(accessToken);me.avatarManifest=await avatarSync.resolve(me.characterId,me._avatarAccessToken);send(me.ws,{t:'avatar:refreshed',requestId:requestId||null,avatarManifest:me.avatarManifest,characterId:me.characterId,source:'server-authoritative'});return me.avatarManifest;}
async function recordConfirmedKill(killerConnectionId,victimConnectionId,context){const killer=players.get(String(killerConnectionId||'')),victim=players.get(String(victimConnectionId||''));if(!killer||!victim||!killer.playerKey||!victim.playerKey)return{counted:false,reason:'PLAYER_NOT_CONNECTED'};const result=await titles.recordConfirmedKill(killer.playerKey,victim.playerKey,context);killer.equippedTitleId=result.snapshot.equippedTitleId||null;send(killer.ws,{t:'titles:snapshot',requestId:null,snapshot:result.snapshot,newUnlocks:result.newUnlocks||[]});if(result.counted)sendRelevantStates();return result;}
const pvp=createPvpAuthority({onKill:(killer,victim,context)=>recordConfirmedKill(killer.id,victim.id,Object.assign({mode:'pvp',serverConfirmed:true},context||{}))});
function pvpSnapshotFor(viewer,snapshot,events,index){const playersOut={},visible=new Set();candidatePlayers(viewer,index).forEach(target=>{const row=snapshot.players&&snapshot.players[target.id],was=viewer._aoiRelevant instanceof Set&&viewer._aoiRelevant.has(target.id);if(row&&relevantTo(viewer,target,was)){playersOut[target.id]=row;visible.add(target.id)}});if(snapshot.players&&snapshot.players[viewer.id]){playersOut[viewer.id]=snapshot.players[viewer.id];visible.add(viewer.id)}const projectiles=(snapshot.projectiles||[]).filter(projectile=>{const ownerId=projectile.ownerId||projectile.actorId||projectile.playerId;if(ownerId&&visible.has(ownerId))return true;const x=Number(projectile.x??projectile.position?.x),y=Number(projectile.y??projectile.position?.y);if(!Number.isFinite(x)||!Number.isFinite(y))return false;const dx=x-(Number(viewer.x)||0),dy=y-(Number(viewer.y)||0);return dx*dx+dy*dy<=AOI_RADIUS*AOI_RADIUS});const eventList=(events||[]).filter(ev=>!ev||(!ev.actorId&&!ev.targetId)||visible.has(ev.actorId)||visible.has(ev.targetId)||ev.targetId===viewer.id);return{...snapshot,players:playersOut,projectiles,events:eventList};}
function sendPvpSnapshots(snapshot,events){const index=buildSpatialIndex();players.forEach(viewer=>{if(!(viewer.zone==='pvp'||viewer._pvpActive))return;send(viewer.ws,{t:'pvp:snapshot',...pvpSnapshotFor(viewer,snapshot,events,index),source:'server-authoritative-aoi'})});}
function healthPayload(){return{ok:true,service:'kelo-world-server',version:'server-runtime-v3-world-notifications',uptimeMs:Date.now()-STARTED_AT,connections:players.size,shuttingDown,identity:identity.audit(),avatarSync:avatarSync.audit(),pvp:pvp.audit(),guardian:guardian.audit(),worldNotifications:{serverAuthorized:true,singleSocket:true},serverTime:Date.now()};}

const httpServer=http.createServer(async(req,res)=>{
  if(await guardian.handleHttp(req,res))return;
  const path=String(req.url||'/').split('?')[0];
  if(path==='/healthz'||path==='/readyz'){
    const ready=!shuttingDown,status=path==='/readyz'&&!ready?503:200;
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify({...healthPayload(),ready}));
    return;
  }
  res.writeHead(404,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify({ok:false,error:'NOT_FOUND'}));
});
const wss=new WebSocketServer({server:httpServer,maxPayload:MAX_WS_PAYLOAD,perMessageDeflate:false});
wss.keloServerHooks=Object.freeze({recordConfirmedOpenWorldKill:recordConfirmedKill,pvpAuthority:pvp,aoi:Object.freeze({cell:AOI_CELL,radius:AOI_RADIUS,hysteresis:AOI_HYSTERESIS}),identityAuthority:identity,avatarSyncAuthority:avatarSync,guardianCoordinator:guardian,health:healthPayload});
httpServer.listen(PORT,'0.0.0.0',()=>console.log(`Kelo room ws://0.0.0.0:${PORT} · fixed PvP ${Math.round(1/FIXED_DT)}Hz · snapshots ${SNAPSHOT_HZ}Hz · AOI ${AOI_RADIUS}px · maxPayload ${MAX_WS_PAYLOAD} · Identity ${identity.source}${identity.requireAuth?' required':' transition'} · Avatar ${avatarSync.configured?'ready':'local'} · Guardian ${guardian.version} · Nobleza ${nobility.source} · Titles ${titles.source} · Forge ${forge.source} · Commerce ${commerce.version}`));

wss.on('connection',ws=>{
  if(shuttingDown){ws.close(1012,'server restarting');return;}
  if(players.size>=MAX){ws.close(1013,'room full');return;}
  ws.isAlive=true;ws.on('pong',()=>{ws.isAlive=true;});
  const id='p'+seq++,me={id,ws,playerKey:null,accountId:null,characterId:null,authSource:'pending',roles:[],permissions:[],name:'Kelo',x:1400,y:1600,vx:0,vy:0,face:'down',gait:'idle',zone:'plaza',hp:100,maxHp:100,mana:100,maxMana:100,nobilityRank:'none',nobilityPower:0,equippedTitleId:null,armorScore:0,auraRank:0,averageQuality:0,averageGrade:0,equipmentSummary:[],avatarManifest:null,_avatarAccessToken:null,_aoiRelevant:new Set(),_lastWorldNotificationAt:0};
  players.set(id,me);pvp.register(me);send(ws,{t:'welcome',id,players:publicStateFor(me),nobilitySource:nobility.source,titleSource:titles.source,forgeSource:forge.source,commerceSource:'server-authoritative',identityAuthority:identity.audit(),avatarSyncAuthority:avatarSync.audit(),pvpAuthority:pvp.audit(),serverTime:Date.now(),aoi:{cell:AOI_CELL,radius:AOI_RADIUS,hysteresis:AOI_HYSTERESIS}});sendRelevantJoin(me);
  ws.on('message',async buf=>{
    let msg;try{msg=JSON.parse(String(buf))}catch(_){return;}
    try{
      if(msg.t==='hello'){
        const resolved=await identity.resolve({accessToken:msg.accessToken,characterId:msg.characterId,name:msg.name});
        if(resolved.authenticated){
          me.accountId=resolved.accountId;me.characterId=resolved.characterId;me.authSource=resolved.source;me.roles=Array.isArray(resolved.roles)?resolved.roles.map(String):[];me.permissions=Array.isArray(resolved.permissions)?resolved.permissions.map(String):[];me.name=resolved.name;me.playerKey=resolved.playerKey;await refreshAvatar(me,msg.accessToken,null);
        }else{
          if(typeof msg.name==='string'&&msg.name.trim())me.name=msg.name.trim().slice(0,24);
          me.playerKey=safePlayerId(msg.playerKey);me.accountId=null;me.characterId=null;me.authSource=resolved.source;me.roles=[];me.permissions=[];me.avatarManifest=null;me._avatarAccessToken=null;
        }
        economy.ensure(me.playerKey);await nobility.ensurePlayer(me.playerKey,me.name);await titles.ensurePlayer(me.playerKey);await forge.ensurePlayer(me.playerKey);
        send(ws,{t:'identity',playerKey:me.playerKey,accountId:me.accountId,characterId:me.characterId,authSource:me.authSource});
        await refreshNobility(me,msg.requestId);await refreshTitles(me,msg.requestId);await refreshForge(me,msg.requestId);send(ws,{t:'commerce:event',reason:'hello',snapshot:commerce.snapshot(me.playerKey),source:'server-authoritative'});sendRelevantStates();return;
      }
      if(msg.t==='pose'){
        if(me.zone==='pvp'||me._pvpActive)return;
        if(Number.isFinite(msg.x))me.x=clamp(msg.x,20,WORLD.w-20);if(Number.isFinite(msg.y))me.y=clamp(msg.y,20,WORLD.h-20);if(['up','down','left','right'].includes(msg.face))me.face=msg.face;if(['idle','walk','run'].includes(msg.gait))me.gait=msg.gait;if(['plaza','cafe','open-world','market'].includes(msg.zone))me.zone=msg.zone;return;
      }
      if(!me.playerKey){protocolError(ws,msg.requestId,'IDENTITY_REQUIRED','Envía hello antes de usar sistemas autoritativos.');return;}
      if(msg.t==='avatar:refresh'){
        const resolved=await identity.resolve({accessToken:msg.accessToken,characterId:msg.characterId,name:me.name});
        if(!resolved.authenticated)throw new Error('AUTH_TOKEN_REQUIRED');
        if(me.accountId&&me.accountId!==resolved.accountId)throw new Error('CHARACTER_NOT_OWNED');
        me.accountId=resolved.accountId;me.characterId=resolved.characterId;me.authSource=resolved.source;me.roles=Array.isArray(resolved.roles)?resolved.roles.map(String):[];me.permissions=Array.isArray(resolved.permissions)?resolved.permissions.map(String):[];me.name=resolved.name;me.playerKey=resolved.playerKey;
        await refreshAvatar(me,msg.accessToken,msg.requestId);sendRelevantStates();return;
      }
      if(msg.t==='pvp:input'){
        const result=pvp.ingest(me,msg.intent&&typeof msg.intent==='object'?msg.intent:msg,Date.now());
        if(!result.ok)send(ws,{t:'pvp:reject',sequence:msg.intent&&msg.intent.sequence||msg.sequence||null,code:result.reason,ackSequence:result.ackSequence||me._pvpAck||0,source:'server-authoritative'});
        return;
      }
      if(msg.t==='visual:event'){if(!VISUAL_EVENT_ALLOWLIST.has(msg.name)){protocolError(ws,msg.requestId,'INVALID_VISUAL_EVENT','Evento visual no permitido.');return;}const event={t:'visual:event',name:msg.name,actorId:me.id,context:sanitizeVisualContext(msg.context),meta:sanitizeVisualMeta(msg.meta),serverTime:Date.now(),source:'server-visual-relay-v2-aoi'};sendRelevantEvent(event,me,me);return;}
      if(msg.t==='commerce:request'){const op=String(msg.op||'').slice(0,64),payload=msg.payload&&typeof msg.payload==='object'?msg.payload:{};if(op==='world_notification'){const result=publishWorldNotification(me,payload.notification);send(ws,{t:'commerce:result',requestId:msg.requestId||null,...result,source:'server-authoritative'});return;}const result=await commerce.handle(me.playerKey,op,payload,msg.requestId),notifyIds=Array.isArray(result.notifyPlayerIds)?result.notifyPlayerIds.slice():[],response={...result};delete response.notifyPlayerIds;send(ws,{t:'commerce:result',requestId:msg.requestId||null,...response,source:'server-authoritative'});notifyCommerce(notifyIds,op,me.playerKey);return;}
      if(msg.t==='nobility:get'){await refreshNobility(me,msg.requestId);return;}
      if(msg.t==='nobility:donate'){const currency=msg.currency==='kc'?'kc':msg.currency==='gold'?'gold':null,amount=Math.floor(Number(msg.amount));if(!currency||!Number.isSafeInteger(amount)||amount<=0){protocolError(ws,msg.requestId,'INVALID_DONATION','Donación inválida.');return;}const result=await nobility.donate(me.playerKey,me.name,currency,amount);me.nobilityRank=result.snapshot.rank.id;me.nobilityPower=result.snapshot.rank.power;send(ws,{t:'nobility:donated',requestId:msg.requestId||null,donationAdded:result.donationAdded,snapshot:result.snapshot});sendRelevantStates();return;}
      if(msg.t==='titles:get'){await refreshTitles(me,msg.requestId);return;}
      if(msg.t==='titles:equip'){const snapshot=await titles.equip(me.playerKey,msg.titleId);me.equippedTitleId=snapshot.equippedTitleId||null;send(ws,{t:'titles:equipped',requestId:msg.requestId||null,snapshot});sendRelevantStates();return;}
      if(msg.t==='titles:unequip'){const snapshot=await titles.unequip(me.playerKey);me.equippedTitleId=null;send(ws,{t:'titles:unequipped',requestId:msg.requestId||null,snapshot});sendRelevantStates();return;}
      if(msg.t==='combat:resolve'){const result=await nobility.resolveDamage(me.playerKey,me.name,msg.baseDamage);send(ws,{t:'combat:resolved',requestId:msg.requestId||null,...result,projectionOnly:true});return;}
      if(msg.t==='forge:get'){await refreshForge(me,msg.requestId);return;}
      if(msg.t==='forge:attempt'){const result=await forge.attempt(me.playerKey,{itemId:msg.itemId,forgeType:msg.forgeType,materialLevel:msg.materialLevel,crystals:msg.crystals});me.armorScore=result.armorScore;me.auraRank=result.auraRank;me.averageQuality=result.averageQuality;me.averageGrade=result.averageGrade;me.equipmentSummary=result.equipmentSummary;send(ws,{t:'forge:result',requestId:msg.requestId||null,...result,source:'server-authoritative'});send(ws,{t:'commerce:event',reason:'forge:attempt',snapshot:commerce.snapshot(me.playerKey),source:'server-authoritative'});sendRelevantStates();return;}
      if(msg.t==='forge:combine'){const snapshot=await forge.combine(me.playerKey,msg.materialId);me.armorScore=snapshot.armorScore;me.auraRank=snapshot.auraRank;me.averageQuality=snapshot.averageQuality;me.averageGrade=snapshot.averageGrade;me.equipmentSummary=snapshot.equipmentSummary;send(ws,{t:'forge:combined',requestId:msg.requestId||null,snapshot});return;}
    }catch(err){const raw=String(err&&err.message||err),known=['INSUFFICIENT_GOLD','INSUFFICIENT_KC','INVALID_AMOUNT','INVALID_CURRENCY','ITEM_NOT_OWNED','INVALID_FORGE_TYPE','INVALID_TIER','MAX_TIER','INVALID_MATERIAL_LEVEL','TOO_MANY_CRYSTALS','INVALID_CRYSTAL','MATERIAL_REQUIRED','CRYSTAL_REQUIRED','INVALID_MATERIAL','MAX_MATERIAL_LEVEL','NEED_SIX','INVALID_VISUAL_EVENT','UNKNOWN_TITLE','TITLE_LOCKED','INVALID_PLAYER_ID','UNKNOWN_COMMERCE_OPERATION','SUPABASE_NOT_CONFIGURED','AUTH_TOKEN_REQUIRED','INVALID_AUTH_USER','CHARACTER_REQUIRED','INVALID_CHARACTER_ID','CHARACTER_NOT_OWNED','WORLD_NOTIFICATION_FORBIDDEN','WORLD_NOTIFICATION_RATE_LIMIT','WORLD_NOTIFICATION_TARGET_NOT_ALLOWED','WORLD_NOTIFICATION_EMPTY'],code=known.find(k=>raw.includes(k))||'SERVER_ERROR';console.error('protocol error',msg&&msg.t,raw);protocolError(ws,msg&&msg.requestId,code,code);}
  });
  ws.on('close',()=>{const playerKey=me.playerKey;pvp.unregister(me);sendRelevantLeave(me);players.delete(id);if(playerKey&&!connectionsForPlayerKey(playerKey).length){const result=commerce.disconnect(playerKey);notifyCommerce(result.notifyPlayerIds||[],'disconnect',playerKey);}});
});

let fixedTick=0;
const simulationTimer=setInterval(()=>{
  const now=Date.now();pvp.step(FIXED_DT,now);fixedTick++;
  if(fixedTick%Math.max(1,Math.round((1/FIXED_DT)/SNAPSHOT_HZ))===0&&players.size){const snapshot=pvp.snapshot(now),events=pvp.consumeEvents();sendPvpSnapshots(snapshot,events);}
  if(fixedTick%6===0&&players.size)sendRelevantStates();
},1000/60);
const heartbeatTimer=setInterval(()=>{
  guardian.sweep(Date.now());
  wss.clients.forEach(ws=>{
    if(ws.isAlive===false){ws.terminate();return;}
    ws.isAlive=false;try{ws.ping();}catch(_){ws.terminate();}
  });
},HEARTBEAT_MS);

function shutdown(signal){
  if(shuttingDown)return;
  shuttingDown=true;
  console.log(`Kelo server shutdown ${signal} · connections ${players.size}`);
  clearInterval(simulationTimer);clearInterval(heartbeatTimer);
  wss.clients.forEach(ws=>{try{ws.close(1012,'server restarting');}catch(_){}});
  const force=setTimeout(()=>process.exit(0),8000);force.unref();
  wss.close(()=>httpServer.close(()=>process.exit(0)));
}
process.once('SIGTERM',()=>shutdown('SIGTERM'));
process.once('SIGINT',()=>shutdown('SIGINT'));