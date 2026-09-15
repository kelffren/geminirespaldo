/* KELO-INDEX
 * area: SERVER / AVATAR
 * owner: Kelo server authority
 * keys: SUPABASE AVATAR MANIFEST CHARACTER CONTENT RLS SANITIZE
 * purpose: resolve the active creator avatar from persisted character state using a verified user JWT
 * online: server derives runtime manifest from Supabase; clients never declare asset URLs or frame metadata
 * do-not: NO renderer, NO client-trusted URL, NO service-role requirement, NO duplicate avatar persistence
 */
'use strict';

function cleanBase(value){return String(value||'').trim().replace(/\/+$/,'');}
function cleanPath(value){
  const raw=String(value||'').trim().replace(/^\/+/, '');
  if(!raw||raw.includes('..')||!/^[a-zA-Z0-9_./-]+$/.test(raw))return null;
  return raw.slice(0,512);
}
function int(value,min,max,fallback){const n=Math.floor(Number(value));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
const DIRECTION_KEYS=Object.freeze(['n','ne','e','se','s','sw','w','nw']);
function directions(raw,rows){const source=Array.isArray(raw)?raw.map(value=>String(value||'').toLowerCase()):[];if(source.length===rows&&source.every(key=>DIRECTION_KEYS.includes(key))&&new Set(source).size===source.length)return source;if(rows===8)return [...DIRECTION_KEYS];if(rows===4)return['s','w','e','n'];return['s',...new Array(Math.max(0,rows-1)).fill(0).map((_,index)=>`row${index+2}`)];}
function rowMap(raw,rows,directionKeys){const src=raw&&typeof raw==='object'?raw:{},fallback={down:0,left:1,right:2,up:3},out={};for(const key of ['down','left','right','up'])out[key]=int(src[key],0,Math.max(0,rows-1),Math.min(fallback[key],Math.max(0,rows-1)));for(const key of DIRECTION_KEYS){const fallbackRow=directionKeys.indexOf(key);if(src[key]!=null||fallbackRow>=0)out[key]=int(src[key],0,Math.max(0,rows-1),Math.max(0,fallbackRow));}return out;}
function frameCounts(raw,rows,columns){const source=Array.isArray(raw)?raw:[];return new Array(rows).fill(columns).map((fallback,row)=>int(source[row],1,columns,fallback));}
function encodePath(path){return path.split('/').map(encodeURIComponent).join('/');}

function createAvatarSyncStore(options={}){
  const supabaseUrl=cleanBase(options.supabaseUrl||process.env.SUPABASE_URL);
  const apiKey=String(options.supabaseApiKey||process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
  const fetchImpl=options.fetchImpl||global.fetch;
  const configured=Boolean(supabaseUrl&&apiKey&&fetchImpl);

  async function request(url,opts={}){
    const res=await fetchImpl(url,opts),text=await res.text();
    if(!res.ok){const e=new Error(`SUPABASE_${res.status}:${text.slice(0,200)}`);e.status=res.status;throw e;}
    return text?JSON.parse(text):null;
  }
  function headers(token){return{apikey:apiKey,Authorization:`Bearer ${String(token||'')}`,'Content-Type':'application/json'};}
  function sanitize(raw){
    if(!raw||typeof raw!=='object'||!raw.contentId)return null;
    const payload=raw.payload&&typeof raw.payload==='object'?raw.payload:{},rt=payload.avatarRuntime&&typeof payload.avatarRuntime==='object'?payload.avatarRuntime:null;
    if(!rt||rt.bucket!=='avatars')return null;
    const path=cleanPath(rt.path);if(!path)return null;
    const columns=int(rt.columns,1,16,1),rows=int(rt.rows,1,16,1),directionKeys=directions(rt.directionKeys,rows);
    const runtime={bucket:'avatars',path,publicUrl:`${supabaseUrl}/storage/v1/object/public/avatars/${encodePath(path)}`,columns,rows,directionKeys:Object.freeze(directionKeys),frameCounts:Object.freeze(frameCounts(rt.frameCounts,rows,columns)),rowMap:Object.freeze(rowMap(rt.rowMap,rows,directionKeys)),frameMs:int(rt.frameMs,70,1000,140),renderHeight:int(rt.renderHeight,44,180,82)};
    const safePayload={rigProfileId:String(payload.rigProfileId||`sprite-rig-${rows}d`).slice(0,80),directions:int(payload.directions,1,8,directionKeys.length),avatarRuntime:Object.freeze(runtime)};
    return Object.freeze({contentId:String(raw.contentId).slice(0,160),displayName:String(raw.displayName||'Avatar').slice(0,100),payload:Object.freeze(safePayload)});
  }
  async function resolve(characterId,accessToken){
    if(!configured||!characterId||!accessToken)return null;
    const query=new URLSearchParams({id:`eq.${String(characterId)}`,status:'eq.active',select:'id,active_avatar_content_id',limit:'1'});
    const chars=await request(`${supabaseUrl}/rest/v1/characters?${query}`,{method:'GET',headers:headers(accessToken)}),row=Array.isArray(chars)?chars[0]:null;
    const contentId=row&&row.active_avatar_content_id;if(!contentId)return null;
    const manifest=await request(`${supabaseUrl}/rest/v1/rpc/get_avatar_manifest`,{method:'POST',headers:headers(accessToken),body:JSON.stringify({p_content_id:contentId})});
    return sanitize(manifest);
  }
  return Object.freeze({version:'avatar-sync-store-v2-8d',configured,resolve,sanitize,audit:()=>({version:'avatar-sync-store-v2-8d',configured,clientManifestTrusted:false,publicBucket:'avatars',directionRigs:[1,4,8]})});
}
module.exports={createAvatarSyncStore};
