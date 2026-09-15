/* KELO-INDEX
 * area: CORE / OPTIONAL UI
 * owner: KeloAdminControlLazyGate
 * keys: ADMIN LAZY FIRST-USE MOBILE SAFARI NO-FREEZE
 * purpose: mostrar entrada Administrador sin evaluar permisos online/panel GM hasta que el administrador la toca
 * do-not: NO Supabase import on normal boot, NO polling, NO second loop, NO Studio dependency
 */
(function(root){
'use strict';
if(root.KeloAdminControlLazyGate)return;
const VERSION='kelo-admin-control-lazy-gate-v2';
let loading=null;
const actor=()=>String(root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||'local_pioneer');
function locallyEligible(){
  const keys=root.KELO_ADMIN_KEYS,who=actor(),online=root.KeloAccountPermissions;
  return !!(online?.hasRole?.('admin')||online?.can?.('admin.panel')||keys?.can?.('admin.panel',who)||keys?.can?.('accounts.roles',who)||keys?.can?.('world.edit',who));
}
function toast(msg){if(typeof root.showToast==='function')root.showToast(msg);else console.info('[Kelo Admin gate]',msg);}
function paint(btn,busy){if(!btn)return;btn.innerHTML='<span class="lx-menu-icon" aria-hidden="true">⚙</span><span class="lx-menu-copy"><b>'+(busy?'Abriendo…':'Administrador')+'</b><small>'+(busy?'Autorizando':'Usuarios · economía · GM LIVE')+'</small></span>';btn.disabled=!!busy;}
function sync(){
  const grid=document.querySelector('#lx-menu-panel .lx-menu-grid');if(!grid)return false;
  let btn=document.getElementById('lx-admin-control');
  if(!locallyEligible()){btn?.remove();return true;}
  if(!btn){btn=document.createElement('button');btn.id='lx-admin-control';btn.type='button';btn.className='lx-menu-item';btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();void open();});grid.appendChild(btn);}
  paint(btn,!!loading);return true;
}
async function load(){
  if(root.KeloAccountAdminPanel)return root.KeloAccountAdminPanel;
  if(loading)return loading;
  loading=(async()=>{
    const permissionsModule=await import('./../auth/account-permissions-runtime.mjs?v=1');
    const permissions=await permissionsModule.installAccountPermissions({root});
    if(!(permissions?.hasRole?.('admin')||permissions?.can?.('admin.panel')))throw new Error('ADMIN_PERMISSION_DENIED');
    const adminModule=await import('./../ui/account-admin-panel.mjs?v=3');
    return adminModule.installAccountAdminPanel({root});
  })().finally(()=>{loading=null;sync();});
  return loading;
}
async function open(){
  const btn=document.getElementById('lx-admin-control');paint(btn,true);
  try{const panel=await load();if(!panel?.open)throw new Error('ADMIN_PANEL_UNAVAILABLE');await panel.open();return true;}
  catch(error){console.warn('[Kelo Admin lazy gate]',error);toast(String(error?.message||error).includes('ADMIN_PERMISSION_DENIED')?'Tu cuenta no tiene permiso de administrador':'No se pudo abrir Administrador');return false;}
  finally{paint(document.getElementById('lx-admin-control'),false);}
}
const api=Object.freeze({version:VERSION,open,sync,get eligible(){return locallyEligible();}});root.KeloAdminControlLazyGate=api;
try{root.KELO_ADMIN_KEYS?.onChange?.(sync);}catch(_){}
root.addEventListener('kelo:permissions-changed',sync);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
})(typeof globalThis!=='undefined'?globalThis:window);