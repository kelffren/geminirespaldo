/* KELO-INDEX
 * area: AUTH / NET
 * owner: KeloGameTuningAuthority
 * keys: ADMIN TUNING ACCESS AUTHORITY HTTP SUPABASE PUBLISH CONFIG UPDATE
 * purpose: frontera cliente para leer/probar acceso/publicar tuning contra el HTTP existente; el secreto GitHub nunca entra al navegador
 * public-api: KeloGameTuningAuthority.get/access/publish/status
 * consumes: KELO_ONLINE_RUNTIME_CONFIG + sesión Supabase local + /api/game-tuning
 * state-owned: solo metadata efímera de endpoint/último error
 * extension-points: endpoint deriva del mismo WSS de KeloNetAuthority
 * reuse: KeloGameTuning + Admin UI
 * legacy: N/A
 * do-not: NO commit directo a GitHub; NO guardar secrets; NO tratar éxito HTTP como autoridad gameplay
 */
(function(root){
  'use strict';
  if(root.KeloGameTuningAuthority)return;
  const VERSION='kelo-game-tuning-authority-v1.1',SESSION_KEY='kelo.supabase.session.v1';
  let lastError=null,lastSource=null;
  function endpointBase(){const ws=root.KELO_ONLINE_RUNTIME_CONFIG?.effectiveNet||root.keloNet?.url||root.KELO_ONLINE_RUNTIME_CONFIG?.defaultWsUrl||'';if(!ws)throw new Error('GAME_TUNING_SERVER_UNAVAILABLE');const url=new URL(ws,location.href);url.protocol=url.protocol==='wss:'?'https:':url.protocol==='ws:'?'http:':url.protocol;url.pathname='/';url.search='';url.hash='';return url;}
  function accessToken(){try{const raw=localStorage.getItem(SESSION_KEY),session=raw?JSON.parse(raw):null;return String(session?.access_token||'');}catch(_){return '';}}
  async function request(path,options){const base=endpointBase(),url=new URL(path,base),opts=options||{},headers={'Accept':'application/json'};if(opts.body)headers['Content-Type']='application/json';if(opts.auth){const token=accessToken();if(!token)throw new Error('AUTH_TOKEN_REQUIRED');headers.Authorization='Bearer '+token;}const response=await fetch(url.href,{method:opts.method||'GET',headers,body:opts.body?JSON.stringify(opts.body):undefined,cache:'no-store',credentials:'omit'});let payload=null;try{payload=await response.json();}catch(_){payload=null;}if(!response.ok||!payload?.ok){const error=new Error(String(payload?.error||('GAME_TUNING_HTTP_'+response.status)));error.status=response.status;throw error;}lastError=null;lastSource=payload.source||'server';return payload;}
  async function guarded(fn){try{return await fn();}catch(error){lastError=String(error&&error.message||error);throw error;}}
  function status(){let base=null;try{base=endpointBase().href;}catch(_){base=null;}return Object.freeze({version:VERSION,endpoint:base,publishAuth:'supabase-bearer',lastError,lastSource,authenticated:!!accessToken()});}
  root.KeloGameTuningAuthority=Object.freeze({version:VERSION,get:()=>guarded(()=>request('/api/game-tuning')),access:()=>guarded(()=>request('/api/game-tuning/access',{auth:true})),publish:config=>guarded(()=>request('/api/game-tuning/publish',{method:'POST',auth:true,body:{config}})),status});
  root.KELO_GAME_TUNING_AUTHORITY_AUDIT=Object.freeze({version:VERSION,sameServerEndpoint:true,supabaseBearer:true,accessProbe:true,clientGitHubSecret:false});
})(typeof globalThis!=='undefined'?globalThis:window);
