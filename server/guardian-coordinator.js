/* KELO-INDEX
 * area: SERVER / GUARDIAN
 * owner: Kelo Guardian Coordinator
 * keys: GUARDIAN DONATION HOST LEASE MASTER REGION SCHEDULER RELAY ASSET COMPUTE MIRROR REWARD PROOF HEARTBEAT AUTH
 * purpose: coordina nodos Guardian autenticados, capacidad regional, asignaciones verificables y unidades de servicio sin ceder autoridad económica al cliente
 * online: el servidor central conserva autoridad; Guardian solo ejecuta workloads con lease explícita y las recompensas nacen de pruebas/observaciones server-side
 * do-not: NO confiar métricas/recompensas declaradas por cliente; NO mover economía/PvP al nodo sin protocolo de verificación; NO acuñar KC aquí
 */
'use strict';

const NODE_RE=/^[A-Za-z0-9:_-]{8,96}$/;
const PLATFORM=new Set(['ios','android','desktop','web']);
const DEVICE_CLASS=new Set(['phone','tablet','desktop','unknown']);
const VISIBILITY=new Set(['visible','hidden','prerender','unknown']);
const EFFECTIVE_TYPE=new Set(['slow-2g','2g','3g','4g','unknown']);
const WORKLOAD_TYPES=new Set(['primary-host','hot-mirror','relay','asset-seeder','compute-worker','witness']);
const WORKLOAD_COST=Object.freeze({'primary-host':1,'hot-mirror':.65,'relay':.4,'asset-seeder':.25,'compute-worker':.8,witness:.15});
const GUARDIAN_RANKS=Object.freeze([
  Object.freeze({id:'helper',minUnits:0,multiplier:1}),
  Object.freeze({id:'guardian',minUnits:1000,multiplier:1.25}),
  Object.freeze({id:'sentinel',minUnits:10000,multiplier:1.5}),
  Object.freeze({id:'warden',minUnits:50000,multiplier:2}),
  Object.freeze({id:'pillar-of-kelo',minUnits:250000,multiplier:3})
]);
const PROOF_RATES=Object.freeze({
  availability_seconds:.002,
  host_seconds:.2,
  mirror_seconds:.1,
  relay_megabytes:.5,
  asset_megabytes:.25,
  compute_seconds:.15
});

function clamp(n,min,max,fallback){n=Number(n);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function bool(v){return v===true;}
function short(v,max){return String(v==null?'':v).replace(/[^A-Za-z0-9._:-]/g,'').slice(0,max||64);}
function normalizeRegion(value){return short(String(value||'global').toLowerCase(),48)||'global';}
function normalizeNodeId(value){const id=String(value||'').trim();if(!NODE_RE.test(id))throw new Error('GUARDIAN_NODE_ID_INVALID');return id;}
function rankFor(units){const value=Math.max(0,Number(units)||0);let rank=GUARDIAN_RANKS[0];for(const candidate of GUARDIAN_RANKS)if(value>=candidate.minUnits)rank=candidate;return rank;}
function sanitizeCapabilities(raw={}){
  const platform=PLATFORM.has(String(raw.platform))?String(raw.platform):'web';
  const deviceClass=DEVICE_CLASS.has(String(raw.deviceClass))?String(raw.deviceClass):'unknown';
  const visibility=VISIBILITY.has(String(raw.visibility))?String(raw.visibility):'unknown';
  const effectiveType=EFFECTIVE_TYPE.has(String(raw.effectiveType))?String(raw.effectiveType):'unknown';
  return Object.freeze({
    platform,deviceClass,visibility,effectiveType,
    online:raw.online!==false,
    webrtc:bool(raw.webrtc),serviceWorker:bool(raw.serviceWorker),saveData:bool(raw.saveData),touch:bool(raw.touch),
    cores:Math.round(clamp(raw.cores,1,64,1)),memoryGb:clamp(raw.memoryGb,0,128,0),
    batteryLevel:raw.batteryLevel==null?null:clamp(raw.batteryLevel,0,1,null),charging:raw.charging==null?null:bool(raw.charging),
    networkType:short(raw.networkType||'unknown',24)||'unknown',screenClass:short(raw.screenClass||'unknown',24)||'unknown'
  });
}
function sanitizePreferences(raw={}){
  return Object.freeze({
    idleDonation:raw.idleDonation!==false,wifiOnly:raw.wifiOnly!==false,chargingOnly:bool(raw.chargingOnly),
    allowAssets:raw.allowAssets!==false,allowRelay:raw.allowRelay!==false,allowCompute:bool(raw.allowCompute),
    maxUploadMbps:clamp(raw.maxUploadMbps,1,200,10),storageMb:Math.round(clamp(raw.storageMb,64,102400,512))
  });
}
function sanitizeObservation(raw={},at=Date.now()){
  const rttByRegion={};
  if(raw.rttByRegion&&typeof raw.rttByRegion==='object'){
    for(const [key,value] of Object.entries(raw.rttByRegion).slice(0,16))rttByRegion[normalizeRegion(key)]=clamp(value,0,2000,2000);
  }
  return Object.freeze({
    region:normalizeRegion(raw.region),
    rttMs:clamp(raw.rttMs,0,2000,null),
    packetLossPct:clamp(raw.packetLossPct,0,100,0),
    uploadMbps:clamp(raw.uploadMbps,0,10000,0),
    cpuLoad:clamp(raw.cpuLoad,0,1,null),
    tickHz:clamp(raw.tickHz,0,240,null),
    connections:Math.round(clamp(raw.connections,0,100000,0)),
    rttByRegion:Object.freeze(rttByRegion),
    observedAt:Number(at)||Date.now(),
    source:short(raw.source||'server-observer',48)||'server-observer'
  });
}
function recommendedRoles(capabilities,preferences){
  const out=['witness-ready'];
  if(preferences.allowAssets)out.push('asset-seeder-ready');
  if(preferences.allowRelay&&capabilities.webrtc)out.push('relay-ready');
  if(preferences.allowCompute&&capabilities.cores>=4&&capabilities.visibility==='visible')out.push('compute-candidate');
  if(capabilities.webrtc&&capabilities.cores>=4&&capabilities.visibility==='visible'&&!capabilities.saveData)out.push('host-ready');
  return Object.freeze(out);
}
function errorCode(error){const raw=String(error&&error.message||error);const known=['AUTH_TOKEN_REQUIRED','ACCOUNT_BANNED','ACCOUNT_SUSPENDED','GUARDIAN_NODE_ID_INVALID','GUARDIAN_NODE_NOT_ENABLED','GUARDIAN_MASTER_PERMISSION_DENIED','GUARDIAN_FOREGROUND_REQUIRED','GUARDIAN_MASTER_BUSY','GUARDIAN_BODY_TOO_LARGE','GUARDIAN_INVALID_JSON'];return known.find(code=>raw.includes(code))||'GUARDIAN_SERVER_ERROR';}
function json(res,status,payload){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(payload));}
function cors(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
  res.setHeader('Access-Control-Max-Age','600');
  if(req.method==='OPTIONS'){res.statusCode=204;res.end();return true;}return false;
}
function readJson(req,maxBytes=32768){
  return new Promise((resolve,reject)=>{
    let size=0,body='',settled=false;
    req.setEncoding('utf8');
    req.on('data',chunk=>{if(settled)return;size+=Buffer.byteLength(chunk);if(size>maxBytes){settled=true;reject(new Error('GUARDIAN_BODY_TOO_LARGE'));return;}body+=chunk;});
    req.on('end',()=>{if(settled)return;if(!body){resolve({});return;}try{resolve(JSON.parse(body));}catch(_){reject(new Error('GUARDIAN_INVALID_JSON'));}});
    req.on('error',error=>{if(!settled)reject(error);});
  });
}
function bearer(req){const value=String(req.headers.authorization||'');const match=/^Bearer\s+(.+)$/i.exec(value);return match?match[1].trim():'';}

function createGuardianCoordinator(options={}){
  const identity=options.identity;if(!identity)throw new Error('GUARDIAN_IDENTITY_REQUIRED');
  const now=typeof options.now==='function'?options.now:Date.now;
  const STALE_MS=Math.max(15000,Number(options.staleMs)||45000);
  const MASTER_LEASE_MS=Math.max(10000,Number(options.masterLeaseMs)||25000);
  const WORKLOAD_LEASE_MS=Math.max(10000,Number(options.workloadLeaseMs)||30000);
  const nodes=new Map(),regionalDemand=new Map(),workloads=new Map();
  let epoch=0,workloadEpoch=0,masterLease=null;

  function masterEligible(actor){
    const roles=new Set(Array.isArray(actor?.roles)?actor.roles.map(String):[]),permissions=new Set(Array.isArray(actor?.permissions)?actor.permissions.map(String):[]);
    return roles.has('admin')||permissions.has('guardian.master_host')||permissions.has('guardian.master-host');
  }
  function nodeKey(accountId,nodeId){return String(accountId)+':'+String(nodeId);}
  function resolveNode(ref){if(!ref)return null;if(typeof ref==='string')return nodes.get(ref)||null;const id=normalizeNodeId(ref.nodeId),key=nodeKey(ref.accountId,id);return nodes.get(key)||null;}
  function fresh(node,at=now()){return !!node&&at-node.lastHeartbeatAt<=STALE_MS;}
  function serviceState(node){
    if(!node.service)node.service={verifiedUnits:0,rewardedUnits:0,usefulSeconds:0,availabilitySeconds:0,bytesRelayed:0,bytesAssets:0,proofCount:0,workloadsCompleted:0};
    const rank=rankFor(node.service.verifiedUnits);
    return Object.freeze({...node.service,rank:Object.freeze({...rank}),currencySettlementReady:false});
  }
  function sweepLeaseOnly(at){if(masterLease&&masterLease.expiresAt<=at){const prior=nodes.get(masterLease.nodeKey);if(prior&&prior.role==='master-host')prior.role='donor-ready';masterLease=null;}}
  function sweepWorkloads(at){
    for(const [id,workload] of workloads){if(workload.expiresAt>at)continue;const node=nodes.get(workload.nodeKey);if(node&&Array.isArray(node.assignments))node.assignments=node.assignments.filter(row=>row.id!==id);workloads.delete(id);}
  }
  function networkSummary(at=now()){
    sweepLeaseOnly(at);sweepWorkloads(at);
    let active=0,ios=0,relayReady=0,assetReady=0,computeReady=0,hostReady=0,assigned=0;
    const assignedByType={};
    for(const node of nodes.values()){
      if(!fresh(node,at))continue;active++;
      if(node.capabilities.platform==='ios')ios++;
      if(node.recommendedRoles.includes('relay-ready'))relayReady++;
      if(node.recommendedRoles.includes('asset-seeder-ready'))assetReady++;
      if(node.recommendedRoles.includes('compute-candidate'))computeReady++;
      if(node.recommendedRoles.includes('host-ready'))hostReady++;
      for(const row of node.assignments||[]){assigned++;assignedByType[row.type]=(assignedByType[row.type]||0)+1;}
    }
    const demand={};for(const [region,pressure] of regionalDemand)demand[region]=pressure;
    return Object.freeze({activeNodes:active,iosNodes:ios,relayReady,assetReady,computeReady,hostReady,assignedWorkloads:assigned,assignedByType:Object.freeze(assignedByType),regionalDemand:Object.freeze(demand),masterActive:!!masterLease,masterEpoch:masterLease?.epoch||0});
  }
  function sweep(at=now()){
    for(const [key,node] of nodes){if(!fresh(node,at)){for(const row of node.assignments||[])workloads.delete(row.id);nodes.delete(key);}}
    sweepLeaseOnly(at);sweepWorkloads(at);return networkSummary(at);
  }
  function publicAssignment(row){return Object.freeze({id:row.id,type:row.type,region:row.region,purpose:row.purpose,expiresAt:row.expiresAt,epoch:row.epoch});}
  function publicObservation(obs){if(!obs)return null;return Object.freeze({region:obs.region,rttMs:obs.rttMs,packetLossPct:obs.packetLossPct,uploadMbps:obs.uploadMbps,cpuLoad:obs.cpuLoad,tickHz:obs.tickHz,connections:obs.connections,observedAt:obs.observedAt,source:obs.source});}
  function publicNode(node){if(!node)return null;return Object.freeze({nodeId:node.nodeId,enabled:true,role:node.role,recommendedRoles:node.recommendedRoles,capabilities:node.capabilities,preferences:node.preferences,lastHeartbeatAt:node.lastHeartbeatAt,region:node.observation?.region||'unknown',quality:publicObservation(node.observation),assignments:Object.freeze((node.assignments||[]).map(publicAssignment)),service:serviceState(node),masterLeaseExpiresAt:masterLease?.nodeKey===node.key?masterLease.expiresAt:null,masterEpoch:masterLease?.nodeKey===node.key?masterLease.epoch:null});}
  function payload(actor,node,at=now()){sweep(at);return Object.freeze({ok:true,source:'guardian-coordinator-v2',serverTime:at,masterEligible:masterEligible(actor),node:publicNode(node),network:networkSummary(at),rewardPolicy:Object.freeze({proofRequired:true,clientMayMint:false,ranks:GUARDIAN_RANKS})});}
  function ensureNodeState(node){if(!Array.isArray(node.assignments))node.assignments=[];serviceState(node);return node;}
  function enable(actor,input={}){
    const at=now(),nodeId=normalizeNodeId(input.nodeId),key=nodeKey(actor.accountId,nodeId),capabilities=sanitizeCapabilities(input.capabilities),preferences=sanitizePreferences(input.preferences),existing=nodes.get(key);
    const node=ensureNodeState(existing||{key,nodeId,accountId:actor.accountId,createdAt:at});
    node.capabilities=capabilities;node.preferences=preferences;node.recommendedRoles=recommendedRoles(capabilities,preferences);node.lastHeartbeatAt=at;node.role=masterLease?.nodeKey===key?'master-host':'donor-ready';nodes.set(key,node);return payload(actor,node,at);
  }
  function heartbeat(actor,input={}){
    const at=now(),nodeId=normalizeNodeId(input.nodeId),key=nodeKey(actor.accountId,nodeId),node=nodes.get(key);if(!node)throw new Error('GUARDIAN_NODE_NOT_ENABLED');
    if(input.capabilities)node.capabilities=sanitizeCapabilities(input.capabilities);if(input.preferences)node.preferences=sanitizePreferences(input.preferences);node.recommendedRoles=recommendedRoles(node.capabilities,node.preferences);node.lastHeartbeatAt=at;
    if(masterLease?.nodeKey===key){if(node.capabilities.visibility==='visible'){masterLease.expiresAt=at+MASTER_LEASE_MS;node.role='master-host';}else{masterLease=null;node.role='donor-ready';}}
    return payload(actor,node,at);
  }
  function disable(actor,input={}){
    const at=now(),nodeId=normalizeNodeId(input.nodeId),key=nodeKey(actor.accountId,nodeId),node=nodes.get(key);if(node)for(const row of node.assignments||[])workloads.delete(row.id);nodes.delete(key);if(masterLease?.nodeKey===key)masterLease=null;return payload(actor,null,at);
  }
  function status(actor,input={}){const at=now(),nodeId=normalizeNodeId(input.nodeId),node=nodes.get(nodeKey(actor.accountId,nodeId));return payload(actor,node,at);}
  function startMaster(actor,input={}){
    if(!masterEligible(actor))throw new Error('GUARDIAN_MASTER_PERMISSION_DENIED');
    const at=now(),nodeId=normalizeNodeId(input.nodeId),key=nodeKey(actor.accountId,nodeId);let node=nodes.get(key);if(!node){enable(actor,input);node=nodes.get(key);}
    if(!node)throw new Error('GUARDIAN_NODE_NOT_ENABLED');if(node.capabilities.visibility!=='visible')throw new Error('GUARDIAN_FOREGROUND_REQUIRED');
    sweep(at);if(masterLease&&masterLease.nodeKey!==key&&masterLease.accountId!==actor.accountId)throw new Error('GUARDIAN_MASTER_BUSY');
    if(masterLease&&masterLease.nodeKey!==key){const previous=nodes.get(masterLease.nodeKey);if(previous)previous.role='donor-ready';}
    masterLease={nodeKey:key,accountId:actor.accountId,nodeId,epoch:++epoch,startedAt:at,expiresAt:at+MASTER_LEASE_MS};node.role='master-host';node.lastHeartbeatAt=at;return payload(actor,node,at);
  }
  function stopMaster(actor,input={}){
    if(!masterEligible(actor))throw new Error('GUARDIAN_MASTER_PERMISSION_DENIED');
    const at=now(),nodeId=normalizeNodeId(input.nodeId),key=nodeKey(actor.accountId,nodeId),node=nodes.get(key);if(masterLease?.nodeKey===key)masterLease=null;if(node)node.role='donor-ready';return payload(actor,node,at);
  }

  // KELO-INDEX GUARDIAN/OBSERVATION: solo procesos confiables del server deben alimentar mediciones que influyen scheduling/recompensas.
  function observe(ref,raw={}){const node=resolveNode(ref);if(!node)throw new Error('GUARDIAN_NODE_NOT_ENABLED');node.observation=sanitizeObservation(raw,now());return publicObservation(node.observation);}
  function setRegionalDemand(region,pressure){region=normalizeRegion(region);pressure=clamp(pressure,0,1,0);if(pressure<=0)regionalDemand.delete(region);else regionalDemand.set(region,pressure);return Object.freeze({region,pressure,multiplier:Number((1+pressure*.75).toFixed(4))});}
  function demandMultiplier(region){const pressure=regionalDemand.get(normalizeRegion(region))||0;return 1+pressure*.75;}
  function workloadCapability(type,node){
    if(type==='relay')return node.recommendedRoles.includes('relay-ready');
    if(type==='asset-seeder')return node.recommendedRoles.includes('asset-seeder-ready');
    if(type==='compute-worker')return node.recommendedRoles.includes('compute-candidate');
    if(type==='primary-host'||type==='hot-mirror')return node.recommendedRoles.includes('host-ready');
    return node.recommendedRoles.includes('witness-ready');
  }
  function loadWeight(node){return(node.assignments||[]).reduce((sum,row)=>sum+(WORKLOAD_COST[row.type]||.2),0)+(masterLease?.nodeKey===node.key?1:0);}
  function candidateScore(node,input,at){
    const type=String(input.type||''),region=normalizeRegion(input.region),obs=node.observation||{},cost=WORKLOAD_COST[type]||.2;
    if(!fresh(node,at)||!workloadCapability(type,node)||loadWeight(node)+cost>1.001)return null;
    let score=100-loadWeight(node)*55;
    if(node.capabilities.visibility==='visible')score+=8;if(node.capabilities.charging===true)score+=5;if(node.capabilities.saveData)score-=25;
    score+=Math.min(20,node.capabilities.cores*1.5)+Math.min(12,node.capabilities.memoryGb||0);
    if(obs.region===region)score+=30;
    const rr=obs.rttByRegion&&obs.rttByRegion[region],rtt=Number.isFinite(rr)?rr:obs.region===region?obs.rttMs:null;
    if(Number.isFinite(rtt))score+=clamp(42-rtt*.35,-35,42,0);
    if(Number.isFinite(obs.packetLossPct))score-=obs.packetLossPct*4;
    if(Number.isFinite(obs.cpuLoad))score+=(1-obs.cpuLoad)*30;
    if(Number.isFinite(obs.tickHz))score+=obs.tickHz>=58?12:obs.tickHz<50?-18:0;
    if(type==='relay'||type==='asset-seeder')score+=Math.min(45,(Number(obs.uploadMbps)||0)*.7)+Math.min(20,node.preferences.maxUploadMbps*.25);
    if(type==='primary-host'||type==='hot-mirror'||type==='compute-worker')score+=(1-(Number(obs.cpuLoad)||.35))*25;
    return Number(score.toFixed(3));
  }
  function planWorkload(input={}){
    const type=String(input.type||'');if(!WORKLOAD_TYPES.has(type))throw new Error('GUARDIAN_WORKLOAD_TYPE_INVALID');const at=now(),region=normalizeRegion(input.region),limit=Math.round(clamp(input.limit,1,8,3)),exclude=new Set((input.excludeNodeKeys||[]).map(String)),rows=[];sweep(at);
    for(const node of nodes.values()){if(exclude.has(node.key))continue;const score=candidateScore(node,{...input,type,region},at);if(score==null)continue;rows.push({nodeKey:node.key,nodeId:node.nodeId,accountId:node.accountId,score,region:node.observation?.region||'unknown',rttMs:node.observation?.rttByRegion?.[region]??node.observation?.rttMs??null,load:Number(loadWeight(node).toFixed(3))});}
    rows.sort((a,b)=>b.score-a.score||String(a.nodeKey).localeCompare(String(b.nodeKey)));return Object.freeze({type,region,candidates:Object.freeze(rows.slice(0,limit).map(row=>Object.freeze(row))),demandMultiplier:Number(demandMultiplier(region).toFixed(4))});
  }
  function assignWorkload(input={}){
    const plan=planWorkload(input),candidate=plan.candidates[0];if(!candidate)return Object.freeze({ok:false,reason:'NO_GUARDIAN_CAPACITY',plan});const node=nodes.get(candidate.nodeKey),at=now(),leaseMs=Math.max(10000,Number(input.leaseMs)||WORKLOAD_LEASE_MS),id='gw_'+(++workloadEpoch)+'_'+short(input.type,24),row={id,nodeKey:node.key,type:plan.type,region:plan.region,purpose:short(input.purpose||'useful-service',64)||'useful-service',epoch:workloadEpoch,assignedAt:at,expiresAt:at+leaseMs};node.assignments.push(row);workloads.set(id,row);return Object.freeze({ok:true,assignment:publicAssignment(row),node:publicNode(node),plan});
  }
  function acknowledgeWorkload(ref,workloadId,rawObservation){const node=resolveNode(ref);if(!node)throw new Error('GUARDIAN_NODE_NOT_ENABLED');const row=workloads.get(String(workloadId||''));if(!row||row.nodeKey!==node.key)throw new Error('GUARDIAN_WORKLOAD_NOT_ASSIGNED');if(rawObservation)observe(ref,rawObservation);row.expiresAt=now()+WORKLOAD_LEASE_MS;return publicAssignment(row);}
  function releaseWorkload(workloadId){const row=workloads.get(String(workloadId||''));if(!row)return false;const node=nodes.get(row.nodeKey);if(node){node.assignments=node.assignments.filter(item=>item.id!==row.id);serviceState(node);node.service.workloadsCompleted++;}workloads.delete(row.id);return true;}
  function planSupport(input={}){
    const region=normalizeRegion(input.region),primaryKey=String(input.primaryNodeKey||''),exclude=primaryKey?[primaryKey]:[],cpu=clamp(input.cpuLoad,0,1,0),upload=clamp(input.uploadPressure,0,1,0),loss=clamp(input.packetLossPct,0,100,0),tick=clamp(input.tickHz,0,240,60),regional=clamp(input.regionalPressure,0,1,0),needs=[];
    if(upload>=.75||loss>=3)needs.push(Object.freeze({reason:'NETWORK_PRESSURE',plan:planWorkload({type:'relay',region,limit:2,excludeNodeKeys:exclude})}));
    if(cpu>=.8||tick<55)needs.push(Object.freeze({reason:'SIMULATION_PRESSURE',plan:planWorkload({type:'primary-host',region,limit:2,excludeNodeKeys:exclude})}),Object.freeze({reason:'FAILOVER_SAFETY',plan:planWorkload({type:'hot-mirror',region,limit:2,excludeNodeKeys:exclude})}));
    if(regional>=.7)needs.push(Object.freeze({reason:'REGIONAL_LATENCY',plan:planWorkload({type:'primary-host',region,limit:3,excludeNodeKeys:exclude})}));
    return Object.freeze({region,needs:Object.freeze(needs)});
  }

  // KELO-INDEX GUARDIAN/PROOF: solo código server-side llama esta API; no existe endpoint cliente para autoadjudicarse unidades/KC.
  function recordVerifiedContribution(ref,proof={}){
    const node=resolveNode(ref);if(!node||!fresh(node,now()))throw new Error('GUARDIAN_NODE_NOT_ENABLED');const type=String(proof.type||''),rate=PROOF_RATES[type];if(!rate)throw new Error('GUARDIAN_PROOF_TYPE_INVALID');
    let quantity=0;if(type.endsWith('_seconds'))quantity=clamp(proof.seconds,0,3600,0);else quantity=clamp(proof.megabytes,0,10240,0);if(quantity<=0)throw new Error('GUARDIAN_PROOF_EMPTY');
    const rawUnits=quantity*rate,region=normalizeRegion(proof.region||node.observation?.region),demand=type==='availability_seconds'?1:demandMultiplier(region),service=serviceState(node),rank=rankFor(service.verifiedUnits+rawUnits),rewarded=rawUnits*demand*rank.multiplier;
    node.service.verifiedUnits=Number((service.verifiedUnits+rawUnits).toFixed(6));node.service.rewardedUnits=Number((service.rewardedUnits+rewarded).toFixed(6));node.service.proofCount++;
    if(type==='availability_seconds')node.service.availabilitySeconds+=quantity;else if(type==='host_seconds'||type==='mirror_seconds'||type==='compute_seconds')node.service.usefulSeconds+=quantity;
    if(type==='relay_megabytes')node.service.bytesRelayed+=quantity*1024*1024;if(type==='asset_megabytes')node.service.bytesAssets+=quantity*1024*1024;
    return Object.freeze({accepted:true,type,quantity,region,rawUnits:Number(rawUnits.toFixed(6)),demandMultiplier:Number(demand.toFixed(4)),rank:Object.freeze({...rank}),weightedUnits:Number(rewarded.toFixed(6)),service:serviceState(node),kcMinted:0});
  }

  async function authenticate(req){
    const token=bearer(req);if(!token)throw new Error('AUTH_TOKEN_REQUIRED');const user=await identity.verifyAccessToken(token),access=await identity.getAccountAccess(token);if(access.status==='banned')throw new Error('ACCOUNT_BANNED');if(access.status==='suspended')throw new Error('ACCOUNT_SUSPENDED');return{accountId:user.id,roles:access.roles||[],permissions:access.permissions||[]};
  }
  async function handleHttp(req,res){
    const url=new URL(String(req.url||'/'),'http://guardian.local');if(!url.pathname.startsWith('/api/guardian'))return false;if(cors(req,res))return true;
    try{
      const actor=await authenticate(req);let body={};if(req.method==='POST')body=await readJson(req);
      let result;
      if(req.method==='GET'&&url.pathname==='/api/guardian/status')result=status(actor,{nodeId:url.searchParams.get('nodeId')});
      else if(req.method==='POST'&&url.pathname==='/api/guardian/enable')result=enable(actor,body);
      else if(req.method==='POST'&&url.pathname==='/api/guardian/heartbeat')result=heartbeat(actor,body);
      else if(req.method==='POST'&&url.pathname==='/api/guardian/disable')result=disable(actor,body);
      else if(req.method==='POST'&&url.pathname==='/api/guardian/master/start')result=startMaster(actor,body);
      else if(req.method==='POST'&&url.pathname==='/api/guardian/master/stop')result=stopMaster(actor,body);
      else{json(res,404,{ok:false,error:'GUARDIAN_NOT_FOUND'});return true;}
      json(res,200,result);return true;
    }catch(error){const code=errorCode(error),status=code==='AUTH_TOKEN_REQUIRED'?401:code==='GUARDIAN_MASTER_PERMISSION_DENIED'?403:code==='GUARDIAN_MASTER_BUSY'?409:code==='GUARDIAN_SERVER_ERROR'?500:400;json(res,status,{ok:false,error:code});return true;}
  }
  function audit(){const at=now();sweep(at);const summary=networkSummary(at);return Object.freeze({version:'guardian-coordinator-v2',activeNodes:summary.activeNodes,masterActive:!!masterLease,masterEpoch:masterLease?.epoch||0,activeWorkloads:workloads.size,regionsWithDemand:regionalDemand.size,masterLeaseMs:MASTER_LEASE_MS,workloadLeaseMs:WORKLOAD_LEASE_MS,staleMs:STALE_MS,serverAuthorityPreserved:true,rewardMetricsClientTrusted:false,kcMintAuthority:false,regionalScheduling:true,usefulServiceProof:true});}
  return Object.freeze({version:'guardian-coordinator-v2',enable,heartbeat,disable,status,startMaster,stopMaster,sweep,handleHttp,audit,observe,setRegionalDemand,planWorkload,assignWorkload,acknowledgeWorkload,releaseWorkload,planSupport,recordVerifiedContribution});
}

module.exports={createGuardianCoordinator,sanitizeCapabilities,sanitizePreferences,sanitizeObservation,recommendedRoles,rankFor,GUARDIAN_RANKS,PROOF_RATES};
