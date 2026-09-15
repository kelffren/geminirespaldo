/* KELO-INDEX
 * area: SERVER / IDENTITY
 * owner: Kelo server authority
 * keys: SUPABASE AUTH JWT CHARACTER ACCOUNT PUBLISHABLE KEY BAN SUSPENSION ACCESS
 * purpose: verifica sesión Supabase, estado de cuenta y ownership de personaje sin exponer una secret key al cliente
 * online: Auth valida JWT; characters y get_my_account_access usan el mismo JWT + RLS/RPC
 * do-not: NO confiar userId/characterId declarados por cliente, NO exponer secret/service-role key, NO usar user_metadata para autorización
 */
'use strict';

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function cleanBase(value){return String(value||'').trim().replace(/\/+$/,'');}
function short(value,max){return value==null?'':String(value).trim().slice(0,max||256);}
function keyModel(value){const key=String(value||'');if(key.startsWith('sb_publishable_'))return'publishable';if(key.startsWith('sb_secret_'))return'secret';if(key.split('.').length===3)return'legacy-jwt-key';return key?'unknown':'none';}

function createOnlineIdentityStore(options={}){
  const supabaseUrl=cleanBase(options.supabaseUrl||process.env.SUPABASE_URL);
  const apiKey=String(options.supabasePublishableKey||process.env.SUPABASE_PUBLISHABLE_KEY||options.supabaseServerKey||options.supabaseServiceKey||'').trim();
  const requireAuth=options.requireAuth===true;
  const configured=Boolean(supabaseUrl&&apiKey);
  const tokenCache=new Map();
  const CACHE_TTL_MS=60_000,MAX_CACHE=256;

  async function request(url,options={}){
    const res=await fetch(url,options);const text=await res.text();
    if(!res.ok){const error=new Error(`SUPABASE_${res.status}:${text.slice(0,240)}`);error.status=res.status;throw error;}
    return text?JSON.parse(text):null;
  }
  function userHeaders(token){return{apikey:apiKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json'};}
  function cacheGet(token){const hit=tokenCache.get(token);if(!hit)return null;if(Date.now()-hit.at>CACHE_TTL_MS){tokenCache.delete(token);return null;}return hit.user;}
  function cacheSet(token,user){tokenCache.set(token,{at:Date.now(),user});while(tokenCache.size>MAX_CACHE)tokenCache.delete(tokenCache.keys().next().value);}

  async function verifyAccessToken(rawToken){
    if(!configured)throw new Error('SUPABASE_NOT_CONFIGURED');
    const token=short(rawToken,8192);if(!token)throw new Error('AUTH_TOKEN_REQUIRED');
    const cached=cacheGet(token);if(cached)return cached;
    const user=await request(`${supabaseUrl}/auth/v1/user`,{method:'GET',headers:userHeaders(token)});
    if(!user||!UUID_RE.test(String(user.id||'')))throw new Error('INVALID_AUTH_USER');
    const normalized={id:String(user.id).toLowerCase(),email:user.email||null,isAnonymous:Boolean(user.is_anonymous)};cacheSet(token,normalized);return normalized;
  }

  async function getAccountAccess(rawToken){
    if(!configured)throw new Error('SUPABASE_NOT_CONFIGURED');
    const token=short(rawToken,8192);if(!token)throw new Error('AUTH_TOKEN_REQUIRED');
    try{
      const access=await request(`${supabaseUrl}/rest/v1/rpc/get_my_account_access`,{method:'POST',headers:userHeaders(token),body:'{}'});
      const row=Array.isArray(access)?access[0]:access;
      if(!row||typeof row!=='object')return{status:'active',roles:[],permissions:[],legacy:false};
      return{status:String(row.status||'active'),reason:row.reason||null,expiresAt:row.expires_at||null,roles:Array.isArray(row.roles)?row.roles.map(String):[],permissions:Array.isArray(row.permissions)?row.permissions.map(String):[],legacy:false};
    }catch(error){
      const raw=String(error&&error.message||error);
      if(error?.status===404||raw.includes('PGRST202')||raw.includes('42883'))return{status:'active',roles:[],permissions:[],legacy:true};
      throw error;
    }
  }

  async function getCharacter(accountId,characterId,rawToken){
    if(!configured)throw new Error('SUPABASE_NOT_CONFIGURED');
    if(!UUID_RE.test(String(accountId||''))||!UUID_RE.test(String(characterId||'')))throw new Error('INVALID_CHARACTER_ID');
    const token=short(rawToken,8192);if(!token)throw new Error('AUTH_TOKEN_REQUIRED');
    const query=new URLSearchParams({id:`eq.${String(characterId).toLowerCase()}`,account_id:`eq.${String(accountId).toLowerCase()}`,status:'eq.active',select:'id,account_id,name,legacy_player_key,status',limit:'1'});
    const rows=await request(`${supabaseUrl}/rest/v1/characters?${query.toString()}`,{method:'GET',headers:userHeaders(token)});
    return Array.isArray(rows)&&rows[0]?rows[0]:null;
  }

  async function resolve(input={}){
    const accessToken=short(input.accessToken,8192),characterId=short(input.characterId,80);
    if(!configured){if(requireAuth)throw new Error('SUPABASE_NOT_CONFIGURED');return{authenticated:false,source:'legacy-local'};}
    if(!accessToken){if(requireAuth)throw new Error('AUTH_TOKEN_REQUIRED');return{authenticated:false,source:'legacy-transition'};}
    const user=await verifyAccessToken(accessToken);
    const access=await getAccountAccess(accessToken);
    if(access.status==='banned')throw new Error('ACCOUNT_BANNED');
    if(access.status==='suspended')throw new Error('ACCOUNT_SUSPENDED');
    if(!characterId)throw new Error('CHARACTER_REQUIRED');
    const character=await getCharacter(user.id,characterId,accessToken);if(!character)throw new Error('CHARACTER_NOT_OWNED');
    return{authenticated:true,source:'supabase-auth-rls',accountId:user.id,characterId:String(character.id).toLowerCase(),playerKey:String(character.id).toLowerCase(),name:short(character.name,24)||short(input.name,24)||'Kelo',legacyPlayerKey:character.legacy_player_key||null,isAnonymous:user.isAnonymous,roles:access.roles,permissions:access.permissions};
  }

  return Object.freeze({version:'kelo-online-identity-v3-access-control',configured,requireAuth,source:configured?'supabase-auth-ready':'legacy-local',verifyAccessToken,getAccountAccess,getCharacter,resolve,audit:()=>({version:'kelo-online-identity-v3-access-control',configured,requireAuth,cacheSize:tokenCache.size,apiKeyModel:keyModel(apiKey),accountAccessRpc:true})});
}
module.exports={createOnlineIdentityStore};
