/* KELO-INDEX
 * area: SERVER / AUTH
 * owner: KeloGameTuningPublisher
 * keys: ADMIN TUNING PUBLISH GITHUB CONFIG REVISION AUTHORITY UPDATE
 * purpose: valida configuración visual y publica game-tuning.json en la rama release desde servidor, nunca desde el navegador
 * public-api: createGameTuningPublisher().get/publish/audit
 * consumes: GitHub Contents API + secret KELO_GITHUB_TOKEN/GITHUB_TOKEN solo server-side
 * state-owned: ninguna verdad gameplay; publica revisiones inmutables por commit y devuelve snapshot saneado
 * extension-points: repo/branch/path por variables de entorno
 * reuse: autoridad de producción para KeloGameTuning
 * legacy: N/A
 * do-not: NO aceptar repo/branch/path del cliente; NO devolver token; NO confiar config sin sanitize
 */
'use strict';

const DEFAULT_CONFIG=Object.freeze({schema:1,revision:0,publishedAt:null,publishedBy:'server-defaults',camera:{baseZoom:.82,dampX:null,dampY:null,deadXRatio:null,deadYRatio:null,lookAheadDist:null,lookAheadDecay:null,dprCap:3},sprites:{localPlayerScale:1,remotePlayerScale:1}});
const LIMITS=Object.freeze({camera:Object.freeze({baseZoom:[.45,1.5],dampX:[.25,30],dampY:[.25,30],deadXRatio:[0,.8],deadYRatio:[0,.8],lookAheadDist:[0,500],lookAheadDecay:[.1,30],dprCap:[1,3]}),sprites:Object.freeze({localPlayerScale:[.5,2.5],remotePlayerScale:[.5,2.5]})});
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function finite(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function sanitize(raw,base=DEFAULT_CONFIG){
  const source=raw&&typeof raw==='object'?raw:{},fallback=base&&typeof base==='object'?base:DEFAULT_CONFIG;
  const out={schema:1,revision:Math.max(0,Math.floor(finite(source.revision)??finite(fallback.revision)??0)),publishedAt:source.publishedAt==null?(fallback.publishedAt||null):String(source.publishedAt).slice(0,80),publishedBy:source.publishedBy==null?(fallback.publishedBy||null):String(source.publishedBy).slice(0,120),camera:{},sprites:{}};
  for(const group of ['camera','sprites'])for(const [key,[min,max]] of Object.entries(LIMITS[group])){
    const candidate=finite(source[group]?.[key]),inherited=finite(fallback[group]?.[key]);
    out[group][key]=candidate==null?(inherited==null?null:clamp(inherited,min,max)):clamp(candidate,min,max);
  }
  return out;
}
function cleanRepo(value){const repo=String(value||'kelffren/gemini').trim();if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))throw new Error('GAME_TUNING_REPO_INVALID');return repo;}
function cleanRef(value,fallback){const ref=String(value||fallback||'main').trim();if(!/^[A-Za-z0-9._\/-]+$/.test(ref)||ref.includes('..'))throw new Error('GAME_TUNING_REF_INVALID');return ref;}
function cleanPath(value){const path=String(value||'game-tuning.json').trim();if(!/^[A-Za-z0-9._\/-]+$/.test(path)||path.includes('..'))throw new Error('GAME_TUNING_PATH_INVALID');return path;}
function createGameTuningPublisher(options={}){
  const repository=cleanRepo(options.repository||process.env.KELO_GITHUB_REPO||'kelffren/gemini');
  const branch=cleanRef(options.branch||process.env.KELO_GITHUB_BRANCH,'main');
  const path=cleanPath(options.path||process.env.KELO_GAME_TUNING_PATH||'game-tuning.json');
  const token=String(options.token||process.env.KELO_GITHUB_TOKEN||process.env.GITHUB_TOKEN||'').trim();
  const endpoint=`https://api.github.com/repos/${repository}/contents/${path}`;
  function headers(auth){const out={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'kelo-world-game-tuning'};if(auth&&token)out.Authorization=`Bearer ${token}`;return out;}
  async function github(url,init){const res=await fetch(url,init);const text=await res.text();let body=null;try{body=text?JSON.parse(text):null;}catch(_){body=null;}if(!res.ok){const error=new Error(`GAME_TUNING_GITHUB_${res.status}`);error.status=res.status;error.githubMessage=body?.message||null;throw error;}return body;}
  async function get(){
    const query=new URLSearchParams({ref:branch});
    try{
      const row=await github(`${endpoint}?${query}`,{method:'GET',headers:headers(Boolean(token)),cache:'no-store'});
      const decoded=Buffer.from(String(row?.content||'').replace(/\n/g,''),'base64').toString('utf8');
      const parsed=JSON.parse(decoded);
      return{config:sanitize(parsed,DEFAULT_CONFIG),sha:String(row.sha||''),source:'github-contents',repository,branch,path};
    }catch(error){
      if(error?.status===404)return{config:sanitize(DEFAULT_CONFIG,DEFAULT_CONFIG),sha:null,source:'server-defaults',repository,branch,path};
      throw error;
    }
  }
  async function publish(raw,actor={}){
    if(!token)throw new Error('GAME_TUNING_PUBLISH_NOT_CONFIGURED');
    const current=await get();
    const next=sanitize(raw,current.config);
    next.revision=Math.max(1,(Number(current.config.revision)||0)+1);
    next.publishedAt=new Date().toISOString();
    next.publishedBy=String(actor.characterId||actor.accountId||actor.playerKey||'admin').slice(0,120);
    const payload={message:`chore(tuning): publish game tuning r${next.revision}`,content:Buffer.from(JSON.stringify(next,null,2)+'\n','utf8').toString('base64'),branch};
    if(current.sha)payload.sha=current.sha;
    const result=await github(endpoint,{method:'PUT',headers:{...headers(true),'Content-Type':'application/json'},body:JSON.stringify(payload)});
    return{config:next,commitSha:String(result?.commit?.sha||''),commitUrl:result?.commit?.html_url||null,contentSha:result?.content?.sha||null,source:'github-main',repository,branch,path};
  }
  function audit(){return Object.freeze({version:'kelo-game-tuning-publisher-v1',configured:Boolean(token),repository,branch,path,tokenExposed:false});}
  return Object.freeze({version:'kelo-game-tuning-publisher-v1',get,publish,audit,sanitize});
}
module.exports={createGameTuningPublisher,sanitizeGameTuning:sanitize};
