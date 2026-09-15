/* KELO-INDEX
 * area: AUTH / GUEST PLAY
 * owner-adjacent: KeloAccountAuthUI
 * keys: GUEST AI TEST PLAYWRIGHT AUTH BYPASS ANONYMOUS MOBILE SAFARI VISUALLAB LOCAL
 * purpose: make guest play one-step after anonymous auth; if Supabase anonymous is disabled or rate-limited, keep a local-play fallback that never mints a JWT
 * online: explicit test/local guest does not mint credentials or bypass server authorization; authenticated anonymous sessions keep using KeloOnlineAuth/Supabase normally
 * do-not: NO fake JWT, NO server privilege bypass, NO service_role/secret, NO gameplay authority
 */
(function(){
'use strict';
const VERSION='kelo-guest-play-bypass-v2.2';
const LOCAL_KEY='kelo_local_guest_play_v1';
const params=new URLSearchParams(location.search||'');
const explicitGuest=params.get('guest')==='1'||params.get('aiGuest')==='1'||params.get('visualLab')==='1'||params.get('mapEditor')==='1';
let lastReason='boot';
let observer=null;

function authState(){
  try{return window.KeloOnlineAuth&&typeof window.KeloOnlineAuth.state==='function'?window.KeloOnlineAuth.state():null}catch(_){return null}
}
function isAnonymousSession(state){return !!(state?.authenticated&&state?.isAnonymous)}
function localGuest(){
  try{return sessionStorage.getItem(LOCAL_KEY)==='1'||localStorage.getItem(LOCAL_KEY)==='1'}catch(_){return false}
}
function markLocalGuest(){
  try{sessionStorage.setItem(LOCAL_KEY,'1');localStorage.setItem(LOCAL_KEY,'1')}catch(_){}
}
function ensureStyle(){
  if(document.getElementById('kelo-guest-play-style'))return;
  const el=document.createElement('style');
  el.id='kelo-guest-play-style';
  el.textContent='html[data-kelo-guest-play="1"] #kelo-account-auth{display:none!important;visibility:hidden!important;pointer-events:none!important}';
  (document.head||document.documentElement).appendChild(el);
}
function closeGate(reason){
  const state=authState();
  const anonymous=isAnonymousSession(state);
  if(!explicitGuest&&!anonymous&&!localGuest())return false;
  lastReason=reason||(explicitGuest?'explicit-guest':anonymous?'anonymous-session':'local-guest');
  ensureStyle();
  document.documentElement.dataset.keloGuestPlay='1';
  if(explicitGuest)document.documentElement.dataset.keloAuthGate='off';
  try{window.KeloAccountAuthUI?.close?.()}catch(_){}
  const gate=document.getElementById('kelo-account-auth');
  if(gate&&!gate.hidden)gate.hidden=true;
  try{window.dispatchEvent(new CustomEvent('kelo:guest-play-ready',{detail:{version:VERSION,explicitGuest,anonymous,local:localGuest(),reason:lastReason}}))}catch(_){}
  return true;
}
function enterLocal(reason){
  markLocalGuest();
  return closeGate(reason||'local-guest-enter');
}
function authGuestFallbackError(error){
  const code=String(error?.code||error?.name||'').toLowerCase();
  const raw=String(error?.message||error||'').toLowerCase();
  const status=Number(error?.status)||0;
  if(code==='anonymous_provider_disabled'||code==='anonymous_sign_ins_disabled'||code==='signup_disabled')return true;
  if(/anonymous/.test(code+' '+raw)&&/(disabled|not enabled|not allow|provider)/.test(code+' '+raw))return true;
  if(status===429||/over_request_rate_limit|rate.?limit/.test(code+' '+raw))return true;
  return false;
}
function installAuthGuestFallback(){
  const auth=window.KeloOnlineAuth;
  if(!auth||typeof auth.signInAsGuest!=='function'||auth.__keloGuestFallbackVersion===VERSION)return false;
  const nativeGuest=auth.signInAsGuest.bind(auth);
  const facade={...auth};
  facade.signInAsGuest=async function(){
    try{return await nativeGuest();}
    catch(error){
      if(!authGuestFallbackError(error))throw error;
      enterLocal('supabase-anonymous-unavailable');
      try{window.dispatchEvent(new CustomEvent('kelo:guest-local-fallback',{detail:{version:VERSION,code:String(error?.code||''),status:Number(error?.status)||0}}))}catch(_){}
      return Object.freeze({state:'guest-local',authenticated:false,isAnonymous:false,localGuest:true,profileComplete:true,error:null});
    }
  };
  facade.__keloGuestFallbackVersion=VERSION;
  window.KeloOnlineAuth=Object.freeze(facade);
  return true;
}
function syncGate(reason){
  const state=authState();
  const active=explicitGuest||isAnonymousSession(state)||localGuest();
  if(active)return closeGate(reason);
  delete document.documentElement.dataset.keloGuestPlay;
  if(!explicitGuest)delete document.documentElement.dataset.keloAuthGate;
  return false;
}
function schedule(reason){
  [0,50,250,750,1500].forEach((delay,index)=>setTimeout(()=>syncGate(`${reason||'sync'}-${index}`),delay));
}
function observeGate(){
  if(observer||typeof MutationObserver!=='function')return;
  observer=new MutationObserver(()=>{
    const gate=document.getElementById('kelo-account-auth');
    if(gate&&!gate.hidden)schedule('gate-reopened');
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','style','class']});
}

['kelo:online-auth-state','kelo:online-auth-ready','kelo:guest-created','kelo:online-auth-required','kelo:account-signed-in','kelo:account-signed-out'].forEach(name=>window.addEventListener(name,()=>schedule(name),true));
window.addEventListener('DOMContentLoaded',()=>{observeGate();installAuthGuestFallback();schedule('dom-ready')},{once:true});
window.addEventListener('load',()=>{installAuthGuestFallback();schedule('load')},{once:true});
window.addEventListener('pageshow',()=>{installAuthGuestFallback();schedule('pageshow')});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){installAuthGuestFallback();schedule('visible')}});
observeGate();
installAuthGuestFallback();
schedule('boot');

window.KeloGuestPlay=Object.freeze({
  version:VERSION,
  isExplicit:()=>explicitGuest,
  active:()=>explicitGuest||isAnonymousSession(authState())||localGuest(),
  state:()=>Object.freeze({version:VERSION,explicitGuest,anonymous:isAnonymousSession(authState()),local:localGuest(),lastReason}),
  closeGate:()=>closeGate('api'),
  enterLocal:()=>enterLocal('api'),
  sync:()=>syncGate('api-sync')
});
})();
