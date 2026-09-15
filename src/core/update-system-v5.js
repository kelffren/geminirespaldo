/* KELO-INDEX
 * area: CORE / UPDATE
 * owner: KeloUpdater
 * keys: UPDATE INSTANT DELTA VERIFY WORKER HOTSET CDN CONSISTENCY HEALTH COMMIT IPHONE SAFARI
 * purpose: download only changed files, verify exact commit bytes off-main-thread, learn frequently used modules, warm Safari HTTP cache, and commit an update only after healthy boot
 * public-api: KeloUpdater.check/prepareUpdate/applyUpdate/evaluateNetwork/setGameplayBusy/setNetworkPriority/getState/clearBlockedBuild
 * state-owned: updater metadata, short-lived staged build metadata, predictive hotset, update health shield
 * do-not: NO repo-wide tree walk, NO mandatory Service Worker, NO update-code execution during verification, NO downloads during active gameplay
 */
(function initKeloUpdaterV5(global){
'use strict';
if(global.KeloUpdater)return;

const VERSION='kelo-updater-v5.1-verified-predictive';
const STORAGE_KEY='kelo.world.updater.installedBuild.v1';
const LAST_GOOD_KEY='kelo.world.updater.lastGoodBuild.v5';
const STAGE_KEY='kelo.world.updater.stage.v5';
const PENDING_KEY='kelo.world.updater.pendingBuild.v5';
const BLOCKED_KEY='kelo.world.updater.blockedBuild.v5';
const HOTSET_KEY='kelo.world.updater.hotset.v1';
const COMPARE_CACHE_PREFIX='kelo.world.updater.compare.v5.';
const BUILD_RE=/^[0-9a-f]{7,64}$/i;
const BLOB_RE=/^[0-9a-f]{40,64}$/i;
const COMPARE_API='https://api.github.com/repos/kelffren/gemini/compare/';
const VERIFY_WORKER='src/core/update-verifier-worker.js?v=1';
const VERSION_TIMEOUT_MS=3500;
const FETCH_TIMEOUT_MS=12000;
const COMPARE_TIMEOUT_MS=8000;
const VERIFY_TIMEOUT_MS=8000;
const STAGE_TTL_MS=10*60*1000;
const COMPARE_TTL_MS=10*60*1000;
const HINT_TTL_MS=15000;
const RETRY_MS=450;
const CONSISTENCY_DELAYS=[0,180,450,950,1800];
const MAX_CONCURRENCY=6;
const HOTSET_LIMIT=80;
const HOTSET_PREWARM_LIMIT=24;
const HEALTH_SETTLE_MS=900;
const MAX_HEALTH_ATTEMPTS=2;
const IOS=/iPhone|iPad|iPod/i.test(navigator.userAgent||'');
const baseUrl=new URL('./',document.baseURI);
const indexUrl=new URL('index.html',baseUrl);
const versionUrl=new URL('version.json',baseUrl);
let activePrepare=null;
let generation=0;
let manualBusy=false;
let verifierWorker=null;
let verifierSeq=0;
let healthArmed=false;
const verifierPending=new Map();
const controllers=new Set();

const state={
  version:VERSION,status:'booting',installedBuild:normalize(readLocal(STORAGE_KEY)),deployedBuild:null,availableBuild:null,
  serviceWorkerReady:false,lastError:null,stage:emptyStage(),network:{online:navigator.onLine!==false,effectiveType:null,downlinkMbps:null},
  metrics:{compareMs:null,indexMs:null,downloadMs:null,timeToReadyMs:null,mode:null,verifiedFiles:0,syntaxChecked:0,hotsetHits:0,consistencyRetries:0,compareCacheHit:false,healthAttempts:0,hintUsed:false,earlyBootErrors:0}
};

function normalize(v){v=String(v||'').trim();return BUILD_RE.test(v)?v.toLowerCase():null;}
function normalizeBlob(v){v=String(v||'').trim();return BLOB_RE.test(v)?v.toLowerCase():null;}
function readLocal(k){try{return localStorage.getItem(k);}catch(_){return null;}}
function writeLocal(k,v){try{localStorage.setItem(k,v);}catch(_){} }
function removeLocal(k){try{localStorage.removeItem(k);}catch(_){} }
function readSession(k){try{return sessionStorage.getItem(k);}catch(_){return null;}}
function writeSession(k,v){try{sessionStorage.setItem(k,v);}catch(_){} }
function removeSession(k){try{sessionStorage.removeItem(k);}catch(_){} }
function readJson(raw){try{return raw?JSON.parse(raw):null;}catch(_){return null;}}
function emptyStage(){return {build:null,status:'idle',total:0,completed:0,percent:0,currentUrl:null,deltaFiles:0,downloadedBytes:0,mode:null,readyAt:null,verified:false};}
function emit(name,detail){try{global.dispatchEvent(new CustomEvent('kelo:update:'+name,{detail:Object.assign({},getState(),detail||{})}));}catch(_){} }
function sleep(ms){return new Promise(r=>setTimeout(r,Math.max(0,Number(ms)||0)));}
function busy(){
  if(manualBusy||navigator.onLine===false||document.visibilityState==='hidden'||global.KELO_COMBAT_ENABLED===true)return true;
  try{if(global.KeloArena&&typeof global.KeloArena.isActive==='function'&&global.KeloArena.isActive())return true;}catch(_){}
  try{if(typeof input!=='undefined'&&input&&(input.active||Math.abs(Number(input.normX)||0)>.02||Math.abs(Number(input.normY)||0)>.02))return true;}catch(_){}
  try{const d=global.KELO_MODULE_LOADER?.diagnostics?.();if(d&&Array.isArray(d.inflight)&&d.inflight.length)return true;}catch(_){}
  return false;
}
function abortDownloads(){controllers.forEach(c=>{try{c.abort();}catch(_){}});controllers.clear();}
function getConnection(){const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection||null;return {effectiveType:c&&c.effectiveType||null,downlinkMbps:c&&Number.isFinite(Number(c.downlink))?Number(c.downlink):null};}
function getState(){return Object.freeze({version:VERSION,status:state.status,installedBuild:state.installedBuild,deployedBuild:state.deployedBuild,availableBuild:state.availableBuild,serviceWorkerReady:false,gameplayBusy:busy(),stage:Object.assign({},state.stage),network:Object.assign({},state.network),metrics:Object.assign({},state.metrics),blockedBuild:readBlocked()?.build||null,lastGoodBuild:normalize(readLocal(LAST_GOOD_KEY)),lastError:state.lastError});}
async function timedFetch(url,options,timeoutMs){const c=new AbortController();controllers.add(c);const t=setTimeout(()=>c.abort(),timeoutMs||FETCH_TIMEOUT_MS);try{return await fetch(url,Object.assign({},options||{},{signal:c.signal}));}finally{clearTimeout(t);controllers.delete(c);}}
function writeInstalled(build){const b=normalize(build);if(!b)return;state.installedBuild=b;writeLocal(STORAGE_KEY,b);writeLocal(LAST_GOOD_KEY,b);}
function writeStage(stage){writeSession(STAGE_KEY,JSON.stringify(stage));}
function readStage(){const s=readJson(readSession(STAGE_KEY));if(!s||!normalize(s.build)||!s.readyAt||Date.now()-Number(s.readyAt)>STAGE_TTL_MS)return null;return s;}
function clearStage(){removeSession(STAGE_KEY);state.stage=emptyStage();}
function readPending(){const raw=readSession(PENDING_KEY);if(!raw)return null;const parsed=readJson(raw);if(parsed&&normalize(parsed.build))return parsed;const legacy=normalize(raw);return legacy?{build:legacy,previous:state.installedBuild,attempts:0,startedAt:Date.now()}:null;}
function writePending(p){writeSession(PENDING_KEY,JSON.stringify(p));}
function readBlocked(){const b=readJson(readLocal(BLOCKED_KEY));return b&&normalize(b.build)?b:null;}
function blockBuild(build,reason){const b=normalize(build);if(!b)return;writeLocal(BLOCKED_KEY,JSON.stringify({build:b,reason:String(reason||'health-failed'),at:Date.now()}));emit('blocked',{build:b,reason:String(reason||'health-failed')});}
function clearBlockedBuild(){removeLocal(BLOCKED_KEY);if(state.status==='blocked')state.status='available';return getState();}
function repoPath(url){try{const u=new URL(url,baseUrl);if(u.origin!==baseUrl.origin||!u.pathname.startsWith(baseUrl.pathname))return null;return decodeURIComponent(u.pathname.slice(baseUrl.pathname.length).replace(/^\/+/,''))||'index.html';}catch(_){return null;}}
function stageable(url){try{const u=new URL(url,baseUrl);return u.origin===baseUrl.origin&&u.pathname.startsWith(baseUrl.pathname)&&u.pathname!==versionUrl.pathname;}catch(_){return false;}}
function currentCriticalUrls(){const set=new Set();document.querySelectorAll('script[src],link[href]').forEach(n=>{const raw=n.getAttribute('src')||n.getAttribute('href');if(!raw)return;try{const u=new URL(raw,baseUrl);u.hash='';set.add(u.href);}catch(_){}});return set;}
function parseCritical(html){const parsed=new DOMParser().parseFromString(html,'text/html'),map=new Map();
  function add(raw,source,classic){if(!raw||!stageable(raw))return;const u=new URL(raw,baseUrl);u.hash='';const path=repoPath(u.href);if(!path||path==='index.html'||path==='version.json')return;if(!map.has(u.href))map.set(u.href,{url:u.href,path,source,classic:classic===true});}
  parsed.querySelectorAll('script[src]').forEach(n=>add(n.getAttribute('src'),'index',String(n.getAttribute('type')||'').toLowerCase()!=='module'));
  parsed.querySelectorAll('link[href]').forEach(n=>{const rel=String(n.getAttribute('rel')||'').toLowerCase();if(/stylesheet|preload|modulepreload|manifest|icon/.test(rel))add(n.getAttribute('href'),'index',false);});
  return Array.from(map.values());
}
function sessionResources(){const out=new Map();try{performance.getEntriesByType('resource').forEach(e=>{const name=e&&e.name;if(!name||!stageable(name)||!/\.(?:js|mjs|css|json|woff2?|ttf|otf)(?:[?#].*)?$/i.test(name))return;const path=repoPath(name);if(path)out.set(path,{url:name,path,source:'session',classic:false});});}catch(_){}return out;}
function readHotset(){const h=readJson(readLocal(HOTSET_KEY));return h&&Array.isArray(h.items)?h.items:[];}
function learnHotset(){
  const previous=new Map(readHotset().map(x=>[x.path,x]));const now=Date.now();
  for(const e of sessionResources().values()){const old=previous.get(e.path)||{path:e.path,url:e.url,hits:0,lastSeen:0};old.url=e.url;old.hits=Math.min(999,Number(old.hits||0)+1);old.lastSeen=now;previous.set(e.path,old);}
  const items=Array.from(previous.values()).sort((a,b)=>(Number(b.hits)||0)-(Number(a.hits)||0)||(Number(b.lastSeen)||0)-(Number(a.lastSeen)||0)).slice(0,HOTSET_LIMIT);
  writeLocal(HOTSET_KEY,JSON.stringify({version:1,updatedAt:now,items}));return items;
}
function hotsetResources(){const out=new Map();for(const h of readHotset().slice(0,HOTSET_PREWARM_LIMIT)){if(h&&h.path&&h.url&&stageable(h.url))out.set(h.path,{url:h.url,path:h.path,source:'hotset',classic:false});}return out;}
function compareCacheKey(base,head){return COMPARE_CACHE_PREFIX+String(base).slice(0,16)+'.'+String(head).slice(0,16);}
function compactFiles(files){return (files||[]).map(f=>({filename:f&&f.filename||null,previous_filename:f&&f.previous_filename||null,status:f&&f.status||null,sha:normalizeBlob(f&&f.sha)})).filter(f=>f.filename);}
function hintedBuild(){try{const h=global.__KELO_UPDATE_HINT__,b=normalize(h&&h.deployedBuild),at=Number(h&&h.detectedAt)||0;if(b&&Date.now()-at<=HINT_TTL_MS){state.metrics.hintUsed=true;return b;}}catch(_){}state.metrics.hintUsed=false;return null;}
async function fetchDeployedBuild(){const hinted=hintedBuild();if(hinted)return hinted;const u=new URL(versionUrl.href);u.searchParams.set('_kelo_v5',Date.now().toString(36));const r=await timedFetch(u.href,{cache:'no-cache',credentials:'same-origin',priority:'low'},VERSION_TIMEOUT_MS);if(!r.ok)throw new Error('version_http_'+r.status);const j=await r.json(),b=normalize(j&&j.sha);if(!b)throw new Error('version_missing_sha');return b;}
async function fetchCompare(base,head){
  const key=compareCacheKey(base,head),cached=readJson(readSession(key));
  if(cached&&Date.now()-Number(cached.at||0)<COMPARE_TTL_MS&&Array.isArray(cached.files)){state.metrics.compareCacheHit=true;return {ok:true,status:cached.status||null,files:cached.files,cacheHit:true};}
  const started=performance.now(),u=COMPARE_API+encodeURIComponent(base)+'...'+encodeURIComponent(head);state.metrics.compareCacheHit=false;
  try{const r=await timedFetch(u,{cache:'no-cache',headers:{accept:'application/vnd.github+json'},priority:'low'},COMPARE_TIMEOUT_MS);if(!r.ok)throw new Error('compare_http_'+r.status);const j=await r.json();const files=Array.isArray(j&&j.files)?j.files:null;if(!files||files.length>=300)return {ok:false,reason:'compare_too_large',files:[]};const compact=compactFiles(files);writeSession(key,JSON.stringify({at:Date.now(),status:j.status||null,files:compact}));state.metrics.compareMs=Math.round(performance.now()-started);return {ok:true,status:j.status||null,files:compact};}catch(error){state.metrics.compareMs=Math.round(performance.now()-started);return {ok:false,reason:String(error&&error.message||error),files:[]};}
}
function changeMap(compare){const map=new Map();for(const f of compare.files||[]){if(!f||!f.filename)continue;map.set(String(f.filename),f);if(f.previous_filename)map.set(String(f.previous_filename),Object.assign({},f,{status:'removed-alias',sha:null}));}return map;}
function expectedSha(compare,path){const f=changeMap(compare).get(path);return f&&f.status!=='removed'&&f.status!=='removed-alias'?normalizeBlob(f.sha):null;}
function changedPaths(compare){const map=changeMap(compare),set=new Set();for(const [path,f] of map){if(f&&f.status!=='removed'&&f.status!=='removed-alias')set.add(path);}return set;}
function getVerifier(){
  if(verifierWorker)return verifierWorker;if(typeof Worker!=='function')return null;
  try{verifierWorker=new Worker(new URL(VERIFY_WORKER,document.baseURI).href);verifierWorker.onmessage=function(event){const d=event&&event.data||{},p=verifierPending.get(d.id);if(!p)return;verifierPending.delete(d.id);clearTimeout(p.timer);p.resolve(d);};verifierWorker.onerror=function(){for(const [id,p] of verifierPending){clearTimeout(p.timer);p.reject(new Error('verify_worker_error'));verifierPending.delete(id);}try{verifierWorker.terminate();}catch(_){}verifierWorker=null;};return verifierWorker;}catch(_){return null;}
}
function verifyBuffer(buffer,meta,transfer){
  const worker=getVerifier();if(!worker)return Promise.resolve({ok:true,hashOk:null,syntaxStatus:'unsupported',sha:null,unverified:true});
  const id=++verifierSeq;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{verifierPending.delete(id);reject(new Error('verify_timeout'));},VERIFY_TIMEOUT_MS);verifierPending.set(id,{resolve,reject,timer});const payload={id,buffer,expectedSha:meta&&meta.expectedSha||null,path:meta&&meta.path||null,checkSyntax:!!(meta&&meta.checkSyntax)};try{worker.postMessage(payload,transfer?[buffer]:[]);}catch(error){clearTimeout(timer);verifierPending.delete(id);reject(error);}});
}
async function fetchIndexBuffer(build){const started=performance.now(),u=new URL(indexUrl.href);u.searchParams.set('_kelo_stage',build);u.searchParams.set('_kelo_nonce',Date.now().toString(36));const r=await timedFetch(u.href,{cache:'reload',credentials:'same-origin',priority:'high'},FETCH_TIMEOUT_MS);if(!r.ok)throw new Error('index_http_'+r.status);const buffer=await r.arrayBuffer();state.metrics.indexMs=Math.round(performance.now()-started);return buffer;}
async function fetchVerifiedIndex(build,compare){const sha=expectedSha(compare,'index.html');for(let attempt=0;attempt<CONSISTENCY_DELAYS.length;attempt++){if(CONSISTENCY_DELAYS[attempt])await sleep(CONSISTENCY_DELAYS[attempt]);const buffer=await fetchIndexBuffer(build);if(!sha)return {buffer,verified:true,required:false};const result=await verifyBuffer(buffer.slice(0),{expectedSha:sha,path:'index.html',checkSyntax:false},true);if(result.ok&&result.hashOk!==false){state.metrics.verifiedFiles++;return {buffer,verified:true,required:true};}state.metrics.consistencyRetries++;emit('consistency-wait',{build,path:'index.html',attempt:attempt+1,expectedSha:sha,actualSha:result.sha||null});}throw new Error('cdn_consistency_timeout:index.html');}
function buildPlan(html,compare){
  const current=currentCriticalUrls(),critical=parseCritical(html),session=sessionResources(),hot=hotsetResources(),changes=changedPaths(compare),map=changeMap(compare),fallback=!compare.ok,byUrl=new Map();let hotsetHits=0;
  function put(e){if(!e||!e.url||!e.path)return;const f=map.get(e.path);if(f&&(f.status==='removed'||f.status==='removed-alias'))return;byUrl.set(e.url,Object.assign({},e,{expectedSha:f?normalizeBlob(f.sha):null}));}
  for(const e of critical){const exactAlready=current.has(e.url);if(fallback||changes.has(e.path)||!exactAlready)put(e);}
  if(!fallback){for(const path of changes){const s=session.get(path);if(s)put(s);const h=hot.get(path);if(h){put(h);hotsetHits++;}}}
  state.metrics.hotsetHits=hotsetHits;const list=Array.from(byUrl.values());return {list,mode:fallback?'critical-fallback':'verified-commit-delta',changedCount:changes.size,criticalCount:critical.length,hotsetHits};
}
async function waitSafe(gen){while(busy()){if(gen!==generation)throw new Error('stage_cancelled');await sleep(RETRY_MS);}if(gen!==generation)throw new Error('stage_cancelled');}
async function fetchWarmResponse(entry){const r=await timedFetch(entry.url,{cache:'reload',credentials:'same-origin',priority:'high'},FETCH_TIMEOUT_MS);if(!r.ok)throw new Error('asset_http_'+r.status+':'+entry.path);return r;}
async function warmOne(entry,build,gen){
  await waitSafe(gen);const started=performance.now();let last=null;
  for(let attempt=0;attempt<CONSISTENCY_DELAYS.length;attempt++){
    if(CONSISTENCY_DELAYS[attempt])await sleep(CONSISTENCY_DELAYS[attempt]);await waitSafe(gen);const r=await fetchWarmResponse(entry);const cacheClone=!IOS&&'caches'in global?r.clone():null;const buffer=await r.arrayBuffer();const bytes=buffer.byteLength;
    let verify={ok:true,hashOk:null,syntaxStatus:'unsupported',unverified:true};
    if(entry.expectedSha){verify=await verifyBuffer(buffer,{expectedSha:entry.expectedSha,path:entry.path,checkSyntax:entry.classic===true},true);if(verify.syntaxStatus==='ok')state.metrics.syntaxChecked++;if(verify.ok&&verify.hashOk!==false)state.metrics.verifiedFiles++;}
    if(!entry.expectedSha||verify.ok){if(cacheClone){try{const c=await caches.open('kelo-update-stage-v5-'+build);await c.put(entry.url,cacheClone);}catch(_){} }return {bytes,ms:Math.round(performance.now()-started),verified:!!entry.expectedSha,syntaxStatus:verify.syntaxStatus||'skipped'};}
    last=verify;state.metrics.consistencyRetries++;emit('consistency-wait',{build,path:entry.path,attempt:attempt+1,expectedSha:entry.expectedSha,actualSha:verify.sha||null,syntaxStatus:verify.syntaxStatus||null});
    if(verify.syntaxStatus==='error')throw new Error('update_syntax_invalid:'+entry.path+':'+String(verify.syntaxError||'unknown'));
  }
  throw new Error('cdn_consistency_timeout:'+entry.path+':'+String(last&&last.sha||'unknown'));
}
async function warmIndexExact(build,compare,gen){
  const sha=expectedSha(compare,'index.html');await waitSafe(gen);
  for(let attempt=0;attempt<CONSISTENCY_DELAYS.length;attempt++){
    if(CONSISTENCY_DELAYS[attempt])await sleep(CONSISTENCY_DELAYS[attempt]);const r=await timedFetch(indexUrl.href,{cache:'reload',credentials:'same-origin',priority:'high'},FETCH_TIMEOUT_MS);if(!r.ok)throw new Error('index_warm_http_'+r.status);const cacheClone=!IOS&&'caches'in global?r.clone():null;const buffer=await r.arrayBuffer();let ok=true;
    if(sha){const v=await verifyBuffer(buffer,{expectedSha:sha,path:'index.html',checkSyntax:false},true);ok=v.ok&&v.hashOk!==false;if(ok)state.metrics.verifiedFiles++;else{state.metrics.consistencyRetries++;emit('consistency-wait',{build,path:'index.html',attempt:attempt+1,expectedSha:sha,actualSha:v.sha||null});}}
    if(ok){if(cacheClone){try{const c=await caches.open('kelo-update-stage-v5-'+build);await c.put(indexUrl.href,cacheClone);}catch(_){} }return true;}
  }
  throw new Error('cdn_consistency_timeout:index.html');
}
async function runPool(entries,build,gen){let cursor=0,completed=0,bytes=0;const started=performance.now();const conn=getConnection();state.network=Object.assign({online:navigator.onLine!==false},conn);let concurrency=MAX_CONCURRENCY;if(conn.downlinkMbps!=null&&conn.downlinkMbps<2)concurrency=2;else if(conn.downlinkMbps!=null&&conn.downlinkMbps<5)concurrency=4;concurrency=Math.max(1,Math.min(concurrency,entries.length||1));
  async function worker(){while(true){const i=cursor++;if(i>=entries.length)return;const e=entries[i],result=await warmOne(e,build,gen);bytes+=result.bytes;completed++;state.stage.completed=completed;state.stage.percent=entries.length?Math.round(completed/entries.length*100):100;state.stage.currentUrl=e.url;state.stage.downloadedBytes=bytes;emit('staging-progress',{build,completed,total:entries.length,percent:state.stage.percent,currentUrl:e.url,downloadedBytes:bytes,verifiedFiles:state.metrics.verifiedFiles,hotsetHits:state.metrics.hotsetHits});}}
  await Promise.all(Array.from({length:concurrency},()=>worker()));state.metrics.downloadMs=Math.round(performance.now()-started);return {bytes,concurrency};
}
async function prepareUpdate(build,options){
  const target=normalize(build||state.availableBuild||state.deployedBuild);if(!target)throw new Error('no_update_build');if(target===state.installedBuild)return getState();const blocked=readBlocked();if(blocked&&blocked.build===target&&!(options&&options.force))throw new Error('update_build_blocked');const saved=readStage();if(saved&&saved.build===target){state.status='ready';state.stage=Object.assign(emptyStage(),saved,{status:'ready',percent:100});return getState();}if(activePrepare&&state.stage.build===target)return activePrepare;
  const gen=++generation,started=performance.now();state.status='preparing';state.lastError=null;state.metrics.verifiedFiles=0;state.metrics.syntaxChecked=0;state.metrics.hotsetHits=0;state.metrics.consistencyRetries=0;state.stage=Object.assign(emptyStage(),{build:target,status:'planning'});emit('staging',{build:target,mode:'verified-predictive'});
  activePrepare=(async()=>{await waitSafe(gen);const base=state.installedBuild;const comparePromise=base?fetchCompare(base,target):Promise.resolve({ok:false,reason:'no_base',files:[]});const firstIndexPromise=fetchIndexBuffer(target);const [compare,firstIndex]=await Promise.all([comparePromise,firstIndexPromise]);if(gen!==generation)throw new Error('stage_cancelled');let indexBuffer=firstIndex;const indexSha=expectedSha(compare,'index.html');let indexVerified=!indexSha;if(indexSha){const v=await verifyBuffer(indexBuffer.slice(0),{expectedSha:indexSha,path:'index.html',checkSyntax:false},true);if(v.ok&&v.hashOk!==false){indexVerified=true;state.metrics.verifiedFiles++;}else{state.metrics.consistencyRetries++;const fixed=await fetchVerifiedIndex(target,compare);indexBuffer=fixed.buffer;indexVerified=fixed.verified;}}
    const html=new TextDecoder().decode(indexBuffer),plan=buildPlan(html,compare);state.metrics.mode=plan.mode;state.stage.mode=plan.mode;state.stage.total=plan.list.length;state.stage.deltaFiles=plan.list.length;state.stage.status='downloading';emit('delta-plan',{build:target,mode:plan.mode,files:plan.list.length,changedPaths:plan.changedCount,criticalFiles:plan.criticalCount,hotsetHits:plan.hotsetHits,compareReason:compare.reason||null,indexVerified});const result=await runPool(plan.list,target,gen);await warmIndexExact(target,compare,gen);if(gen!==generation)throw new Error('stage_cancelled');const readyAt=Date.now(),fullyVerified=compare.ok&&plan.list.every(e=>!!e.expectedSha)&&indexVerified;state.status='ready';state.stage=Object.assign(state.stage,{status:'ready',completed:plan.list.length,percent:100,currentUrl:null,downloadedBytes:result.bytes,readyAt,verified:fullyVerified});state.metrics.timeToReadyMs=Math.round(performance.now()-started);writeStage({build:target,status:'ready',total:plan.list.length,completed:plan.list.length,percent:100,deltaFiles:plan.list.length,downloadedBytes:result.bytes,mode:plan.mode,readyAt,verified:fullyVerified,hotsetHits:plan.hotsetHits});emit('staged',{build:target,mode:plan.mode,files:plan.list.length,downloadedBytes:result.bytes,timeToReadyMs:state.metrics.timeToReadyMs,compareMs:state.metrics.compareMs,indexMs:state.metrics.indexMs,downloadMs:state.metrics.downloadMs,verifiedFiles:state.metrics.verifiedFiles,syntaxChecked:state.metrics.syntaxChecked,hotsetHits:state.metrics.hotsetHits,consistencyRetries:state.metrics.consistencyRetries,verified:fullyVerified,hintUsed:state.metrics.hintUsed});return getState();})().catch(error=>{if(String(error&&error.message||error)==='stage_cancelled')return getState();state.status='available';state.stage.status=busy()?'paused':'error';state.lastError=String(error&&error.message||error);emit('staging-error',{build:target,error:state.lastError});return getState();}).finally(()=>{activePrepare=null;});return activePrepare;
}
function twoFrames(){return new Promise(resolve=>{if(typeof requestAnimationFrame!=='function'){setTimeout(resolve,34);return;}requestAnimationFrame(()=>requestAnimationFrame(resolve));});}
function earlyHealthSnapshot(){try{return global.__KELO_UPDATE_EARLY_HEALTH__||null;}catch(_){return null;}}
function stopEarlyHealth(){try{const h=earlyHealthSnapshot();if(h&&typeof h.stop==='function')h.stop();}catch(_){} }
function armHealthCommit(pending,deployed){
  if(healthArmed)return;healthArmed=true;const p=Object.assign({},pending),target=normalize(p.build);p.attempts=Number(p.attempts||0)+1;state.metrics.healthAttempts=p.attempts;writePending(p);const early=earlyHealthSnapshot(),earlyFatal=early&&Array.isArray(early.errors)?early.errors.length:0;state.metrics.earlyBootErrors=earlyFatal;let fatal=0;const onError=()=>{fatal++;};global.addEventListener('error',onError);global.addEventListener('unhandledrejection',onError);
  const finish=async()=>{try{await twoFrames();await sleep(HEALTH_SETTLE_MS);if(!global.__keloBootReady)throw new Error('boot_ready_missing');if(earlyFatal>0)throw new Error('early_boot_errors_'+earlyFatal);if(fatal>0)throw new Error('post_boot_errors_'+fatal);if(target!==normalize(deployed))throw new Error('deployed_changed_during_health');writeInstalled(target);removeSession(PENDING_KEY);clearStage();state.availableBuild=null;state.status='current';state.lastError=null;stopEarlyHealth();emit('health-committed',{build:target,attempts:p.attempts,earlyBootErrors:earlyFatal});}catch(error){state.status='health-hold';state.lastError=String(error&&error.message||error);emit('health-hold',{build:target,attempts:p.attempts,error:state.lastError,earlyBootErrors:earlyFatal});if(p.attempts>=MAX_HEALTH_ATTEMPTS){blockBuild(target,state.lastError);stopEarlyHealth();}}finally{global.removeEventListener('error',onError);global.removeEventListener('unhandledrejection',onError);}};
  if(global.__keloBootReady)void finish();else global.addEventListener('kelo:boot-ready',()=>void finish(),{once:true});
}
async function check(options){
  if(busy()&&!(options&&options.force))return getState();const previous=state.status;state.status='checking';state.lastError=null;emit('checking',{});
  try{const deployed=await fetchDeployedBuild();state.deployedBuild=deployed;const pending=readPending();if(pending&&normalize(pending.build)===deployed){state.availableBuild=null;state.status='validating-boot';armHealthCommit(pending,deployed);return getState();}if(!state.installedBuild){writeInstalled(deployed);state.status='current';state.availableBuild=null;emit('current',{build:deployed,firstInstall:true});return getState();}if(state.installedBuild!==deployed){state.availableBuild=deployed;const blocked=readBlocked();if(blocked&&blocked.build===deployed){state.status='blocked';emit('blocked',{build:deployed,reason:blocked.reason||'previous-health-failure'});return getState();}state.status=previous==='ready'&&state.stage.build===deployed?'ready':'available';emit('available',{build:deployed});if(state.status!=='ready')prepareUpdate(deployed).catch(()=>{});}else{state.availableBuild=null;state.status='current';clearStage();emit('current',{build:deployed});}}catch(error){state.status=previous==='ready'?'ready':'error';state.lastError=String(error&&error.message||error);emit('error',{error:state.lastError});}return getState();
}
async function applyUpdate(){if(busy())throw new Error('update_blocked_gameplay');if(!state.availableBuild)await check({force:true});const target=normalize(state.availableBuild||state.deployedBuild);if(!target)throw new Error('no_update_build');const blocked=readBlocked();if(blocked&&blocked.build===target)throw new Error('update_build_blocked');const saved=readStage();if(!saved||saved.build!==target)await prepareUpdate(target,{foreground:true});const ready=readStage();if(!ready||ready.build!==target)throw new Error('update_not_ready');writePending({build:target,previous:state.installedBuild,attempts:0,startedAt:Date.now(),verified:!!ready.verified});state.status='applying';emit('applying',{build:target,mode:'verified-warm-http-cache',verified:!!ready.verified});const next=new URL(global.location.href);next.searchParams.delete('kelo_update');next.searchParams.delete('kelo_update_nonce');global.location.replace(next.href);}
async function evaluateNetwork(){const c=getConnection();state.network={online:navigator.onLine!==false,effectiveType:c.effectiveType,downlinkMbps:c.downlinkMbps};return Object.freeze(Object.assign({},state.network,{allow:!busy()}));}
function setGameplayBusy(v,source){manualBusy=!!v;if(manualBusy){generation++;abortDownloads();if(state.stage.status==='planning'||state.stage.status==='downloading')state.stage.status='paused';}emit('network-priority',{busy:manualBusy,source:String(source||'manual')});return getState();}
function setNetworkPriority(priority,source){const p=String(priority||'').toLowerCase();return setGameplayBusy(p==='critical'||p==='gameplay'||p==='combat',source||'priority-api');}

state.network=Object.assign({online:navigator.onLine!==false},getConnection());
global.KeloUpdater=Object.freeze({version:VERSION,check,prepareUpdate,applyUpdate,evaluateNetwork,setGameplayBusy,setNetworkPriority,getState,clearBlockedBuild,learnHotset});
global.addEventListener('kelo:network-priority',e=>{const d=e&&e.detail||{};if(typeof d.busy==='boolean')setGameplayBusy(d.busy,d.source||'event');else if(d.priority)setNetworkPriority(d.priority,d.source||'event');});
global.addEventListener('online',()=>{state.network.online=true;if(!busy())check().catch(()=>{});});
global.addEventListener('offline',()=>{state.network.online=false;abortDownloads();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!busy())check().catch(()=>{});});
global.addEventListener('pagehide',()=>{try{learnHotset();}catch(_){}},{capture:false});
setTimeout(()=>{try{if(document.visibilityState==='visible')learnHotset();}catch(_){}},2500);
check({force:true}).catch(error=>{state.status='error';state.lastError=String(error&&error.message||error);emit('error',{error:state.lastError});});
})(window);
