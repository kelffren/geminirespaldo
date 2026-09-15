/* KELO-INDEX
 * area: NET / GUARDIAN
 * owner: KeloGuardianAuthority
 * keys: GUARDIAN DONATION HOST WEBRTC SIGNAL SUPABASE RPC HTTP AUTH
 * purpose: frontera cliente para registrar nodos y señalizar WebRTC; Supabase RPC es control plane primario y el HTTP existente queda como fallback transitorio
 * online: identidad sale de la sesión Supabase; signaling solo intercambia offer/answer/ICE, nunca autoridad gameplay
 * do-not: NO secretos backend; NO autoridad gameplay; NO segundo WebSocket; NO confiar métricas de recompensa declaradas
 */
(function(root){
'use strict';
if(root.KeloGuardianAuthority)return;
const VERSION='kelo-guardian-authority-v2-supabase-webrtc',SESSION_KEY='kelo.supabase.session.v1';
let lastError=null,lastSource=null;
function endpointBase(){const ws=root.KELO_ONLINE_RUNTIME_CONFIG?.effectiveNet||root.keloNet?.url||root.KELO_ONLINE_RUNTIME_CONFIG?.defaultWsUrl||'';if(!ws)throw new Error('GUARDIAN_SERVER_UNAVAILABLE');const url=new URL(ws,location.href);url.protocol=url.protocol==='wss:'?'https:':url.protocol==='ws:'?'http:':url.protocol;url.pathname='/';url.search='';url.hash='';return url;}
async function accessToken(){try{if(root.KeloOnlineAuth&&typeof root.KeloOnlineAuth.credentials==='function'){const c=await root.KeloOnlineAuth.credentials();if(c?.accessToken)return String(c.accessToken);}}catch(_){}try{const raw=localStorage.getItem(SESSION_KEY),session=raw?JSON.parse(raw):null;return String(session?.access_token||'');}catch(_){return '';}}
async function httpRequest(path,options={}){const base=endpointBase(),url=new URL(path,base),token=await accessToken();if(!token)throw new Error('AUTH_TOKEN_REQUIRED');const headers={Accept:'application/json',Authorization:'Bearer '+token};if(options.body)headers['Content-Type']='application/json';const response=await fetch(url.href,{method:options.method||'GET',headers,body:options.body?JSON.stringify(options.body):undefined,cache:'no-store',credentials:'omit'});let payload=null;try{payload=await response.json();}catch(_){payload=null;}if(!response.ok||!payload?.ok){const error=new Error(String(payload?.error||('GUARDIAN_HTTP_'+response.status)));error.status=response.status;throw error;}lastSource=payload.source||'guardian-http-fallback';return payload;}
async function supabaseClient(){try{if(root.KeloOnlineAuth&&typeof root.KeloOnlineAuth.ready==='function')await root.KeloOnlineAuth.ready(6000);}catch(_){}const client=root.KeloOnlineAuth&&typeof root.KeloOnlineAuth.getClient==='function'?root.KeloOnlineAuth.getClient():null;if(!client||typeof client.rpc!=='function')throw new Error('GUARDIAN_SUPABASE_UNAVAILABLE');return client;}
function rpcMissing(error){const raw=String(error&&error.message||error),code=String(error&&error.code||'');return code==='PGRST202'||code==='42883'||raw.includes('PGRST202')||raw.includes('42883')||raw.includes('Could not find the function');}
async function rpc(name,args){const client=await supabaseClient(),result=await client.rpc(name,args||{});if(result.error){const error=new Error(String(result.error.message||result.error.code||'GUARDIAN_RPC_ERROR'));error.code=result.error.code;throw error;}if(!result.data||result.data.ok!==true)throw new Error(String(result.data?.error||'GUARDIAN_RPC_INVALID'));lastSource=result.data.source||'guardian-supabase-v2';return result.data;}
async function preferRpc(rpcName,args,httpPath,httpOptions){try{return await rpc(rpcName,args);}catch(error){if(!rpcMissing(error))throw error;return httpRequest(httpPath,httpOptions);}}
async function guarded(fn){try{const result=await fn();lastError=null;return result;}catch(error){lastError=String(error&&error.message||error);throw error;}}
function withNode(path,nodeId){return String(path||'/api/guardian/status')+'?nodeId='+encodeURIComponent(String(nodeId||''));}
function rpcPayload(payload){const p=payload||{};return{p_node_id:String(p.nodeId||''),p_capabilities:p.capabilities||{},p_preferences:p.preferences||{}};}
function status(){let endpoint=null;try{endpoint=endpointBase().href;}catch(_){}return Object.freeze({version:VERSION,primary:'supabase-rpc',fallbackEndpoint:endpoint,lastError,lastSource,authenticated:!!root.KeloOnlineAuth?.state?.().authenticated});}
root.KeloGuardianAuthority=Object.freeze({
  version:VERSION,
  status:nodeId=>guarded(()=>preferRpc('guardian_status',{p_node_id:String(nodeId||'')},withNode('/api/guardian/status',nodeId))),
  enable:payload=>guarded(()=>preferRpc('guardian_enable',rpcPayload(payload),'/api/guardian/enable',{method:'POST',body:payload})),
  heartbeat:payload=>guarded(()=>preferRpc('guardian_heartbeat',rpcPayload(payload),'/api/guardian/heartbeat',{method:'POST',body:payload})),
  disable:payload=>guarded(()=>preferRpc('guardian_disable',{p_node_id:String(payload?.nodeId||'')},'/api/guardian/disable',{method:'POST',body:payload})),
  startMaster:payload=>guarded(()=>preferRpc('guardian_master_start',{p_node_id:String(payload?.nodeId||'')},'/api/guardian/master/start',{method:'POST',body:payload})),
  stopMaster:payload=>guarded(()=>preferRpc('guardian_master_stop',{p_node_id:String(payload?.nodeId||'')},'/api/guardian/master/stop',{method:'POST',body:payload})),
  sendSignal:payload=>guarded(()=>rpc('guardian_signal_send',{p_node_id:String(payload?.nodeId||''),p_to_node_id:String(payload?.toNodeId||''),p_kind:String(payload?.type||''),p_payload:payload?.data||{}})),
  pollSignals:nodeId=>guarded(()=>rpc('guardian_signal_poll',{p_node_id:String(nodeId||'')})),
  diagnostics:status
});
root.KELO_GUARDIAN_AUTHORITY_AUDIT=Object.freeze({version:VERSION,primarySupabaseRpc:true,httpFallback:true,secondWebSocket:false,supabaseSession:true,webrtcSignaling:true,gameplayAuthority:false});
})(typeof globalThis!=='undefined'?globalThis:window);
