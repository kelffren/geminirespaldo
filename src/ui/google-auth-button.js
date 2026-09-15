/* KELO-INDEX
 * area: UI / GOOGLE AUTH
 * owner: KeloGoogleAuthButton
 * keys: GOOGLE OAUTH LOGIN REGISTER SUPABASE ACCOUNT
 * purpose: añadir Continuar con Google a la puerta de cuenta existente sin crear auth ni transporte paralelo
 * online: consume exclusivamente KeloOnlineAuth.signInWithGoogle(); Supabase conserva la sesión y el characterId se resuelve en el runtime principal
 * do-not: NO almacenar tokens Google, NO secrets, NO sockets, NO fusionar invitados automáticamente
 */
(function(){
'use strict';
const VERSION='kelo-google-auth-button-v1';
const STYLE_ID='kelo-google-auth-style';
function auth(){return window.KeloOnlineAuth||null}
function gate(){return document.getElementById('kelo-account-auth')}
function uiState(){return window.KeloAccountAuthUI?.state?.()||null}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const el=document.createElement('style');el.id=STYLE_ID;el.textContent=`
.ka-google-wrap{display:grid;gap:9px;margin:0 0 14px}.ka-google{width:100%;min-height:49px;display:flex;align-items:center;justify-content:center;gap:11px;border:1px solid #d7dbe0;border-radius:13px;background:#fff;color:#202124;font:800 14px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.01em;box-shadow:0 1px 2px rgba(0,0,0,.16)}.ka-google:active{transform:translateY(1px)}.ka-google:disabled{opacity:.58}.ka-google-g{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;font:900 17px/1 Arial,sans-serif;color:#4285f4}.ka-google-msg{min-height:0;text-align:center;color:#ffaaa5;font:700 11px/1.35 -apple-system,sans-serif}.ka-google-divider{display:flex;align-items:center;gap:10px;color:#666c75;font-size:11px}.ka-google-divider:before,.ka-google-divider:after{content:"";height:1px;flex:1;background:rgba(255,255,255,.07)}
`;document.head.appendChild(el);
}
function errorText(error){
  const raw=String(error?.message||error||'Error');
  if(/provider.*not enabled|unsupported provider/i.test(raw))return 'Google todavía no está activado en Supabase.';
  if(raw==='GUEST_GOOGLE_ACCOUNT_SEPARATE_REQUIRED')return 'Este invitado tiene progreso. Para no mezclarlo, protégelo primero o usa Google desde una sesión cerrada.';
  return raw.replace(/_/g,' ').toLowerCase();
}
function eligible(){
  const state=auth()?.state?.();const modal=uiState();
  return !!(gate()&&!gate().hidden&&modal&&(modal.mode==='login'||modal.mode==='register')&&!state?.authenticated);
}
function render(){
  installStyle();const root=gate();if(!root)return;
  const old=root.querySelector('.ka-google-wrap');
  if(!eligible()){old?.remove();return;}
  if(old)return;
  const card=root.querySelector('.ka-card'),tabs=card?.querySelector('.ka-tabs');if(!card||!tabs)return;
  const wrap=document.createElement('div');wrap.className='ka-google-wrap';wrap.innerHTML='<button class="ka-google" type="button" data-google-auth><span class="ka-google-g" aria-hidden="true">G</span><span>Continuar con Google</span></button><div class="ka-google-divider">o usa email</div><div class="ka-google-msg" aria-live="polite"></div>';
  tabs.insertAdjacentElement('afterend',wrap);
  const button=wrap.querySelector('[data-google-auth]'),msg=wrap.querySelector('.ka-google-msg');
  button.addEventListener('click',async()=>{
    const api=auth();if(!api?.signInWithGoogle){msg.textContent='Google Auth no está disponible.';return;}
    button.disabled=true;button.querySelector('span:last-child').textContent='Abriendo Google…';msg.textContent='';
    try{await api.signInWithGoogle()}catch(error){button.disabled=false;button.querySelector('span:last-child').textContent='Continuar con Google';msg.textContent=errorText(error)}
  });
}
const observer=new MutationObserver(()=>queueMicrotask(render));
function boot(){installStyle();observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});render()}
window.addEventListener('kelo:online-auth-state',render);
window.addEventListener('kelo:online-auth-required',render);
window.KeloGoogleAuthButton=Object.freeze({version:VERSION,refresh:render});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
