/* KELO-INDEX
 * area: CORE / UPDATE
 * owner: KeloUpdater
 * keys: UPDATE INSTANT DELTA COMMIT COMPARE HTTP CACHE IPHONE SAFARI
 * purpose: make updates feel instant by downloading only files changed between installed and deployed commits and warming Safari HTTP cache before reload
 * public-api: KeloUpdater.check/prepareUpdate/applyUpdate/evaluateNetwork/setGameplayBusy/setNetworkPriority/getState
 * state-owned: updater metadata + one staged build in sessionStorage
 * do-not: NO repo-wide tree walk, NO mandatory Service Worker, NO full critical redownload when compare succeeds, NO downloads during active gameplay
 */
(function initKeloUpdaterV4(global){
'use strict';
if(global.KeloUpdater)return;

const VERSION='kelo-updater-v4-instant-delta';
const STORAGE_KEY='kelo.world.updater.installedBuild.v1';
const STAGE_KEY='kelo.world.updater.stage.v4';
const PENDING_KEY='kelo.world.updater.pendingBuild.v4';
const BUILD_RE=/^[0-9a-f]{7,64}$/i;
const COMPARE_API='https://api.github.com/repos/kelffren/gemini/compare/';
const VERSION_TIMEOUT_MS=3500;
const FETCH_TIMEOUT_MS=12000;
const COMPARE_TIMEOUT_MS=8000;
const STAGE_TTL_MS=10*60*1000;
const RETRY_MS=450;
const MAX_CONCURRENCY=6;
const IOS=/iPhone|iPad|iPod/i.test(navigator.userAgent||'');
const baseUrl=new URL('./',document.baseURI);
const indexUrl=new URL('index.html',baseUrl);
const versionUrl=new URL('version.json',baseUrl);
let activePrepare=null;
let generation=0;
let manualBusy=false;
const controllers=new Set();

const state={
  version:VERSION,status:'booting',installedBuild:normalize(readLocal(STORAGE_KEY)),deployedBuild:null,availableBuild:null,
  serviceWorkerReady:false,lastError:null,stage:emptyStage(),network:{online:navigator.onLine!==false,effectiveType:null,downlinkMbps:null},
  metrics:{compareMs:null,indexMs:null,downloadMs:null,timeToReadyMs:null,mode:null}
};

function normalize(v){v=String(v||'').trim();return BUILD_RE.test(v)?v.toLowerCase():null;}
function readLocal(k){try{return localStorage.getItem(k);}catch(_){return null;}}
function writeLocal(k,v){try{localStorage.setItem(k,v);}catch(_){} }
function readSession(k){try{return sessionStorage.getItem(k);}catch(_){return null;}}
function writeSession(k,v){try{sessionStorage.setItem(k,v);}catch(_){} }
function removeSession(k){try{sessionStorage.removeItem(k);}catch(_){} }
function emptyStage(){return {build:null,status:'idle',total:0,completed:0,percent:0,currentUrl:null,deltaFiles:0,downloadedBytes:0,mode:null,readyAt:null};}
function emit(name,detail){try{global.dispatchEvent(new CustomEvent('kelo:update:'+name,{detail:Object.assign({},getState(),detail||{})}));}catch(_){} }
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function busy(){
  if(manualBusy||navigator.onLine===false||document.visibilityState==='hidden'||global.KELO_COMBAT_ENABLED===true)return true;
  try{if(global.KeloArena&&typeof global.KeloArena.isActive==='function'&&global.KeloArena.isActive())return true;}catch(_){}
  try{if(typeof input!=='undefined'&&input&&(input.active||Math.abs(Number(input.normX)||0)>.02||Math.abs(Number(input.normY)||0)>.02))return true;}catch(_){}
  return false;
}
function abortDownloads(){controllers.forEach(c=>{try{c.abort();}catch(_){}});controllers.clear();}
function getConnection(){const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection||null;return {effectiveType:c&&c.effectiveType||null,downlinkMbps:c&&Number.isFinite(Number(c.downlink))?Number(c.downlink):null};}
function getState(){return Object.freeze({version:VERSION,status:state.status,installedBuild:state.installedBuild,deployedBuild:state.deployedBuild,availableBuild:state.availableBuild,serviceWorkerReady:false,gameplayBusy:busy(),stage:Object.assign({},state.stage),network:Object.assign({},state.network),metrics:Object.assign({},state.metrics),lastError:state.lastError});}
async function timedFetch(url,options,timeoutMs){const c=new AbortController();controllers.add(c);const t=setTimeout(()=>c.abort(),timeoutMs||FETCH_TIMEOUT_MS);try{return await fetch(url,Object.assign({},options||{},{signal:c.signal}));}finally{clearTimeout(t);controllers.delete(c);}}
function writeInstalled(build){const b=normalize(build);if(!b)return;state.installedBuild=b;writeLocal(STORAGE_KEY,b);}
function writeStage(stage){try{writeSession(STAGE_KEY,JSON.stringify(stage));}catch(_){} }
function readStage(){try{const raw=readSession(STAGE_KEY);if(!raw)return null;const s=JSON.parse(raw);if(!s||!normalize(s.build)||!s.readyAt||Date.now()-Number(s.readyAt)>STAGE_TTL_MS)return null;return s;}catch(_){return null;}}
function clearStage(){removeSession(STAGE_KEY);state.stage=emptyStage();}
function repoPath(url){try{const u=new URL(url,baseUrl);if(u.origin!==baseUrl.origin||!u.pathname.startsWith(baseUrl.pathname))return null;return decodeURIComponent(u.pathname.slice(baseUrl.pathname.length).replace(/^\/+/,''))||'index.html';}catch(_){return null;}}
function stageable(url){try{const u=new URL(url,baseUrl);return u.origin===baseUrl.origin&&u.pathname.startsWith(baseUrl.pathname)&&u.pathname!==versionUrl.pathname;}catch(_){return false;}}
function currentCriticalUrls(){const set=new Set();document.querySelectorAll('script[src],link[href]').forEach(n=>{const raw=n.getAttribute('src')||n.getAttribute('href');if(!raw)return;try{const u=new URL(raw,baseUrl);u.hash='';set.add(u.href);}catch(_){}});return set;}
function parseCritical(html){const parsed=new DOMParser().parseFromString(html,'text/html'),map=new Map();
  function add(raw,source){if(!raw||!stageable(raw))return;const u=new URL(raw,baseUrl);u.hash='';const path=repoPath(u.href);if(!path||path==='index.html'||path==='version.json')return;if(!map.has(u.href))map.set(u.href,{url:u.href,path,source});}
  parsed.querySelectorAll('script[src]').forEach(n=>add(n.getAttribute('src'),'index'));
  parsed.querySelectorAll('link[href]').forEach(n=>{const rel=String(n.getAttribute('rel')||'').toLowerCase();if(/stylesheet|preload|modulepreload|manifest|icon/.test(rel))add(n.getAttribute('href'),'index');});
  return Array.from(map.values());
}
function sessionResources(){const out=new Map();try{performance.getEntriesByType('resource').forEach(e=>{const name=e&&e.name;if(!name||!stageable(name)||!/\.(?:js|mjs|css|woff2?|ttf|otf)(?:[?#].*)?$/i.test(name))return;const path=repoPath(name);if(path)out.set(path,{url:name,path,source:'session'});});}catch(_){}return out;}
async function fetchDeployedBuild(){const u=new URL(versionUrl.href);u.searchParams.set('_kelo_v4',Date.now().toString(36));const r=await timedFetch(u.href,{cache:'no-store',credentials:'same-origin',priority:'low'},VERSION_TIMEOUT_MS);if(!r.ok)throw new Error('version_http_'+r.status);const j=await r.json(),b=normalize(j&&j.sha);if(!b)throw new Error('version_missing_sha');return b;}
async function fetchCompare(base,head){const started=performance.now(),u=COMPARE_API+encodeURIComponent(base)+'...'+encodeURIComponent(head);try{const r=await timedFetch(u,{cache:'no-store',headers:{accept:'application/vnd.github+json'},priority:'low'},COMPARE_TIMEOUT_MS);if(!r.ok)throw new Error('compare_http_'+r.status);const j=await r.json();const files=Array.isArray(j&&j.files)?j.files:null;if(!files||files.length>=300)return {ok:false,reason:'compare_too_large',files:[]};state.metrics.compareMs=Math.round(performance.now()-started);return {ok:true,status:j.status||null,files};}catch(error){state.metrics.compareMs=Math.round(performance.now()-started);return {ok:false,reason:String(error&&error.message||error),files:[]};}}
async function fetchNextIndex(build){const started=performance.now(),u=new URL(indexUrl.href);u.searchParams.set('_kelo_stage',build);u.searchParams.set('_kelo_nonce',Date.now().toString(36));const r=await timedFetch(u.href,{cache:'reload',credentials:'same-origin',priority:'high'},FETCH_TIMEOUT_MS);if(!r.ok)throw new Error('index_http_'+r.status);const html=await r.text();state.metrics.indexMs=Math.round(performance.now()-started);return html;}
function changedPathSet(compare){const set=new Set();for(const f of compare.files||[]){if(f&&f.filename)set.add(String(f.filename));if(f&&f.previous_filename)set.add(String(f.previous_filename));}return set;}
function buildPlan(html,compare){const current=currentCriticalUrls(),critical=parseCritical(html),session=sessionResources(),changed=changedPathSet(compare),fallback=!compare.ok,byUrl=new Map();
  for(const e of critical){const exactAlready=current.has(e.url);if(fallback||changed.has(e.path)||!exactAlready)byUrl.set(e.url,e);}
  if(!fallback){for(const path of changed){const e=session.get(path);if(e&&!byUrl.has(e.url))byUrl.set(e.url,e);}}
  const list=Array.from(byUrl.values());return {list,mode:fallback?'critical-fallback':'commit-delta',changedCount:changed.size,criticalCount:critical.length};}
async function waitSafe(gen){while(busy()){if(gen!==generation)throw new Error('stage_cancelled');await sleep(RETRY_MS);}if(gen!==generation)throw new Error('stage_cancelled');}
async function warmOne(entry,build,gen){await waitSafe(gen);const started=performance.now();const r=await timedFetch(entry.url,{cache:'reload',credentials:'same-origin',priority:'high'},FETCH_TIMEOUT_MS);if(!r.ok)throw new Error('asset_http_'+r.status+':'+entry.path);const clone=r.clone();let bytes=0;try{const b=await r.arrayBuffer();bytes=b.byteLength;}catch(_){}
  /* Safari reload reads HTTP cache directly. CacheStorage is only a backup on non-iOS. */
  if(!IOS&&'caches'in global){try{const c=await caches.open('kelo-update-stage-v4-'+build);await c.put(entry.url,clone);}catch(_){} }
  return {bytes,ms:Math.round(performance.now()-started)};}
async function warmIndexExact(build,gen){await waitSafe(gen);const r=await timedFetch(indexUrl.href,{cache:'reload',credentials:'same-origin',priority:'high'},FETCH_TIMEOUT_MS);if(!r.ok)throw new Error('index_warm_http_'+r.status);if(!IOS&&'caches'in global){try{const c=await caches.open('kelo-update-stage-v4-'+build);await c.put(indexUrl.href,r.clone());}catch(_){} }try{await r.arrayBuffer();}catch(_){} }
async function runPool(entries,build,gen){let cursor=0,completed=0,bytes=0;const started=performance.now();const conn=getConnection();state.network=Object.assign({online:navigator.onLine!==false},conn);let concurrency=MAX_CONCURRENCY;if(conn.downlinkMbps!=null&&conn.downlinkMbps<2)concurrency=2;else if(conn.downlinkMbps!=null&&conn.downlinkMbps<5)concurrency=4;concurrency=Math.max(1,Math.min(concurrency,entries.length||1));
  async function worker(){while(true){const i=cursor++;if(i>=entries.length)return;const e=entries[i],result=await warmOne(e,build,gen);bytes+=result.bytes;completed++;state.stage.completed=completed;state.stage.percent=entries.length?Math.round(completed/entries.length*100):100;state.stage.currentUrl=e.url;state.stage.downloadedBytes=bytes;emit('staging-progress',{build,completed,total:entries.length,percent:state.stage.percent,currentUrl:e.url,downloadedBytes:bytes});}}
  await Promise.all(Array.from({length:concurrency},()=>worker()));state.metrics.downloadMs=Math.round(performance.now()-started);return {bytes,concurrency};}
async function prepareUpdate(build,options){const target=normalize(build||state.availableBuild||state.deployedBuild);if(!target)throw new Error('no_update_build');if(target===state.installedBuild)return getState();const saved=readStage();if(saved&&saved.build===target){state.status='ready';state.stage=Object.assign(emptyStage(),saved,{status:'ready',percent:100});return getState();}if(activePrepare&&state.stage.build===target)return activePrepare;
  const gen=++generation,started=performance.now();state.status='preparing';state.lastError=null;state.stage=Object.assign(emptyStage(),{build:target,status:'planning'});emit('staging',{build:target,mode:'instant-delta'});
  activePrepare=(async()=>{await waitSafe(gen);const base=state.installedBuild;const [html,compare]=await Promise.all([fetchNextIndex(target),base?fetchCompare(base,target):Promise.resolve({ok:false,reason:'no_base',files:[]})]);if(gen!==generation)throw new Error('stage_cancelled');const plan=buildPlan(html,compare);state.metrics.mode=plan.mode;state.stage.mode=plan.mode;state.stage.total=plan.list.length;state.stage.deltaFiles=plan.list.length;state.stage.status='downloading';emit('delta-plan',{build:target,mode:plan.mode,files:plan.list.length,changedPaths:plan.changedCount,criticalFiles:plan.criticalCount,compareReason:compare.reason||null});const result=await runPool(plan.list,target,gen);await warmIndexExact(target,gen);if(gen!==generation)throw new Error('stage_cancelled');const readyAt=Date.now();state.status='ready';state.stage=Object.assign(state.stage,{status:'ready',completed:plan.list.length,percent:100,currentUrl:null,downloadedBytes:result.bytes,readyAt});state.metrics.timeToReadyMs=Math.round(performance.now()-started);writeStage({build:target,status:'ready',total:plan.list.length,completed:plan.list.length,percent:100,deltaFiles:plan.list.length,downloadedBytes:result.bytes,mode:plan.mode,readyAt});emit('staged',{build:target,mode:plan.mode,files:plan.list.length,downloadedBytes:result.bytes,timeToReadyMs:state.metrics.timeToReadyMs,compareMs:state.metrics.compareMs,indexMs:state.metrics.indexMs,downloadMs:state.metrics.downloadMs});return getState();})().catch(error=>{if(String(error&&error.message||error)==='stage_cancelled')return getState();state.status='available';state.stage.status=busy()?'paused':'error';state.lastError=String(error&&error.message||error);emit('staging-error',{build:target,error:state.lastError});return getState();}).finally(()=>{activePrepare=null;});return activePrepare;}
async function check(options){if(busy()&&!(options&&options.force))return getState();const previous=state.status;state.status='checking';state.lastError=null;emit('checking',{});try{const deployed=await fetchDeployedBuild();state.deployedBuild=deployed;const pending=normalize(readSession(PENDING_KEY));if(pending&&pending===deployed){writeInstalled(deployed);removeSession(PENDING_KEY);clearStage();state.availableBuild=null;state.status='current';emit('current',{build:deployed,applied:true});return getState();}if(!state.installedBuild){writeInstalled(deployed);state.status='current';state.availableBuild=null;emit('current',{build:deployed,firstInstall:true});return getState();}if(state.installedBuild!==deployed){state.availableBuild=deployed;state.status=previous==='ready'&&state.stage.build===deployed?'ready':'available';emit('available',{build:deployed});if(state.status!=='ready')prepareUpdate(deployed).catch(()=>{});}else{state.availableBuild=null;state.status='current';clearStage();emit('current',{build:deployed});}}catch(error){state.status=previous==='ready'?'ready':'error';state.lastError=String(error&&error.message||error);emit('error',{error:state.lastError});}return getState();}
async function applyUpdate(){if(busy())throw new Error('update_blocked_gameplay');if(!state.availableBuild)await check({force:true});const target=normalize(state.availableBuild||state.deployedBuild);if(!target)throw new Error('no_update_build');const saved=readStage();if(!saved||saved.build!==target)await prepareUpdate(target,{foreground:true});const ready=readStage();if(!ready||ready.build!==target)throw new Error('update_not_ready');writeSession(PENDING_KEY,target);state.status='applying';emit('applying',{build:target,mode:'warm-http-cache'});const next=new URL(global.location.href);next.searchParams.delete('kelo_update');next.searchParams.delete('kelo_update_nonce');global.location.replace(next.href);}
async function evaluateNetwork(){const c=getConnection();state.network={online:navigator.onLine!==false,effectiveType:c.effectiveType,downlinkMbps:c.downlinkMbps};return Object.freeze(Object.assign({},state.network,{allow:!busy()}));}
function setGameplayBusy(v,source){manualBusy=!!v;if(manualBusy){generation++;abortDownloads();if(state.stage.status==='planning'||state.stage.status==='downloading')state.stage.status='paused';}emit('network-priority',{busy:manualBusy,source:String(source||'manual')});return getState();}
function setNetworkPriority(priority,source){const p=String(priority||'').toLowerCase();return setGameplayBusy(p==='critical'||p==='gameplay'||p==='combat',source||'priority-api');}

state.network=Object.assign({online:navigator.onLine!==false},getConnection());
global.KeloUpdater=Object.freeze({version:VERSION,check,prepareUpdate,applyUpdate,evaluateNetwork,setGameplayBusy,setNetworkPriority,getState});
global.addEventListener('kelo:network-priority',e=>{const d=e&&e.detail||{};if(typeof d.busy==='boolean')setGameplayBusy(d.busy,d.source||'event');else if(d.priority)setNetworkPriority(d.priority,d.source||'event');});
global.addEventListener('online',()=>{state.network.online=true;if(!busy())check().catch(()=>{});});
global.addEventListener('offline',()=>{state.network.online=false;abortDownloads();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!busy())check().catch(()=>{});});
check({force:true}).catch(error=>{state.status='error';state.lastError=String(error&&error.message||error);emit('error',{error:state.lastError});});
})(window);
