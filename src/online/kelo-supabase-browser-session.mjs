/* KELO-INDEX
 * area: ONLINE / AUTH
 * owner: Kelo browser Supabase session adapter
 * owns: creator-side session persistence + basic password/anonymous auth transport
 * does-not-own: game character identity, permissions, WebSocket authority or secrets
 */
import { KELO_SUPABASE_PUBLIC_CONFIG } from './kelo-supabase-public-config.mjs';
const KEY='kelo.supabase.session.v1';
const F=Object.freeze;
function decodeJwt(token){try{const p=String(token||'').split('.')[1];if(!p)return{};const s=p.replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(decodeURIComponent(Array.from(atob(s),c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join('')));}catch{return{};}}
async function read(r){const t=await r.text();let d=null;try{d=t?JSON.parse(t):null;}catch{d=t;}if(!r.ok)throw Object.assign(new Error(String(d?.msg||d?.message||d?.error_description||d?.error||`HTTP_${r.status}`)),{status:r.status,data:d});return d;}
export function createKeloSupabaseBrowserSession({root=globalThis,config=KELO_SUPABASE_PUBLIC_CONFIG,fetchImpl=root.fetch}={}){
  if(!fetchImpl)throw new Error('FETCH_REQUIRED');const listeners=new Set();let current=null;
  try{const raw=root.localStorage?.getItem(KEY);if(raw)current=JSON.parse(raw);}catch{}
  function persist(v){current=v||null;try{if(current)root.localStorage?.setItem(KEY,JSON.stringify(current));else root.localStorage?.removeItem(KEY);}catch{}listeners.forEach(fn=>{try{fn(current);}catch{}});return current;}
  function authHeaders(extra={}){return Object.assign({'apikey':config.publishableKey,'Content-Type':'application/json'},extra);}
  async function post(path,body,authorization=null){const headers=authHeaders(authorization?{'Authorization':`Bearer ${authorization}`}:{ });return read(await fetchImpl(`${config.url}/auth/v1${path}`,{method:'POST',headers,body:body==null?undefined:JSON.stringify(body)}));}
  function normalizeSession(data){if(!data)return null;if(data.access_token)return{access_token:data.access_token,refresh_token:data.refresh_token||null,expires_in:data.expires_in||3600,expires_at:data.expires_at||Math.floor(Date.now()/1000)+(data.expires_in||3600),token_type:data.token_type||'bearer',user:data.user||null};if(data.session)return normalizeSession(data.session);return null;}
  async function signInWithPassword(email,password){const data=await post('/token?grant_type=password',{email:String(email||'').trim(),password:String(password||'')});return persist(normalizeSession(data));}
  async function signUp(email,password){const data=await post('/signup',{email:String(email||'').trim(),password:String(password||''),data:{source:'kelo-creators'}});const session=normalizeSession(data);if(session)persist(session);return{session,user:data?.user||session?.user||null,confirmationRequired:!session};}
  async function signInAnonymously(){const data=await post('/signup',{data:{source:'kelo-creators-anonymous'}});const session=normalizeSession(data);if(!session)throw new Error('ANONYMOUS_SESSION_NOT_RETURNED');return persist(session);}
  async function refresh(){if(!current?.refresh_token)throw new Error('REFRESH_TOKEN_REQUIRED');const data=await post('/token?grant_type=refresh_token',{refresh_token:current.refresh_token});return persist(normalizeSession(data));}
  async function ensureFresh(){if(!current?.access_token)return null;const exp=Number(current.expires_at||decodeJwt(current.access_token).exp||0);if(exp&&exp-Math.floor(Date.now()/1000)<90&&current.refresh_token){try{await refresh();}catch{}}return current;}
  async function signOut(){const token=current?.access_token;try{if(token)await post('/logout',{},token);}catch{}persist(null);return true;}
  return F({version:'kelo-supabase-browser-session-v1.0.0',get session(){return current;},get accessToken(){return current?.access_token||null;},get userId(){return current?.user?.id||decodeJwt(current?.access_token).sub||null;},signInWithPassword,signUp,signInAnonymously,refresh,ensureFresh,signOut,onChange(fn){if(typeof fn==='function')listeners.add(fn);return()=>listeners.delete(fn);}});
}
