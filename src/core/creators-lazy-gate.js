/* KELO-INDEX
 * area: CORE / OPTIONAL UI
 * owner: KeloCreatorsLazyGate
 * keys: CREATORS LAZY FIRST-USE ADMIN MOBILE SAFARI NO-FREEZE
 * purpose: mantiene la entrada Creators disponible sin evaluar Studio/World Surgery/Auth/Avatar hasta que el usuario la abre
 * public-api: KeloCreatorsLazyGate.open/sync
 * consumes: KELO_ADMIN_KEYS + Luxe menu
 * do-not: NO creator imports on normal boot, NO polling, NO second loop
 */
(function(root){
'use strict';
if(root.KeloCreatorsLazyGate)return;
const VERSION='kelo-creators-lazy-gate-v3';
let loading=null;
const query=()=>{try{return new URLSearchParams(root.location.search);}catch(_){return new URLSearchParams();}};
const directRequested=()=>query().get('creators')==='1'||query().get('creator')==='1'||query().get('mapEditor')==='1';
const actor=()=>String(root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||'local_pioneer');
function allowed(){
  const keys=root.KELO_ADMIN_KEYS,who=actor();
  return !!(keys?.can?.('creators.access',who)||keys?.can?.('world.edit',who)||keys?.can?.('animation.edit',who));
}
function toast(msg){if(typeof root.showToast==='function')root.showToast(msg);else console.info('[Kelo Creators gate]',msg);}
function paint(btn,busy){
  if(!btn)return;
  btn.innerHTML='<span class="lx-menu-icon" aria-hidden="true">♟</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'Creators')+'</b><small>'+(busy?'Cargando bajo demanda':'Herramientas de creación')+'</small></span>';
  btn.disabled=!!busy;
  if(busy)btn.setAttribute('aria-busy','true');else btn.removeAttribute('aria-busy');
}
function sync(){
  const grid=document.querySelector('#lx-menu-panel .lx-menu-grid');
  if(!grid)return false;
  let btn=document.getElementById('lx-create-studio');
  if(!allowed()&&!directRequested()){btn?.remove();return true;}
  if(!btn){
    btn=document.createElement('button');btn.id='lx-create-studio';btn.type='button';btn.className='lx-menu-item';
    btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();void open();});grid.appendChild(btn);
  }
  btn.setAttribute('aria-label','Abrir Kelo Creators');paint(btn,!!loading);return true;
}
function loadStudio(){
  if(root.KELO_STUDIO_LAUNCHER)return Promise.resolve(root.KELO_STUDIO_LAUNCHER);
  if(loading)return loading;
  loading=new Promise(function(resolve,reject){
    const s=document.createElement('script');s.src='src/ui/studio-launcher.js?v=world-bridge-20260915-24';s.async=false;s.dataset.keloCreatorsFirstUse='1';
    s.onload=function(){resolve(root.KELO_STUDIO_LAUNCHER||null);};s.onerror=function(){reject(new Error('CREATORS_LAUNCHER_LOAD_FAILED'));};document.head.appendChild(s);
  }).finally(function(){loading=null;sync();});
  return loading;
}
async function open(){
  if(!allowed()){
    if(directRequested()&&query().get('mapEditor')==='1'&&root.KELO_ADMIN_KEYS?.request){
      try{await root.KELO_ADMIN_KEYS.request('admin-key:bootstrap-local-root',{actorId:actor(),ownerId:actor(),developer:true});}catch(_){}
    }
  }
  if(!allowed()){toast('Necesitas acceso a Kelo Creators');return false;}
  const btn=document.getElementById('lx-create-studio');paint(btn,true);
  try{const launcher=await loadStudio();if(!launcher||typeof launcher.open!=='function')throw new Error('CREATORS_LAUNCHER_UNAVAILABLE');await launcher.open();return true;}
  catch(error){console.error('[Kelo Creators lazy gate]',error);toast('No se pudo abrir Kelo Creators');return false;}
  finally{paint(document.getElementById('lx-create-studio'),false);}
}
const api=Object.freeze({version:VERSION,open,sync,get allowed(){return allowed();},get directRequested(){return directRequested();}});
root.KeloCreatorsLazyGate=api;
root.KELO_CREATORS_LAZY_GATE=api;
try{root.KELO_ADMIN_KEYS?.onChange?.(sync);}catch(_){}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){sync();if(directRequested())void open();},{once:true});
else{sync();if(directRequested())void open();}
})(typeof globalThis!=='undefined'?globalThis:window);