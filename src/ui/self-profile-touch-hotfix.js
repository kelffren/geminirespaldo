(function(){
'use strict';
const VERSION='self-profile-touch-hotfix-v1.0.0';
let lastActivation=0;

function hideLegacyProfile(){
  try{if(typeof window.closeInspect==='function')window.closeInspect();}catch(e){}
  const sheet=document.getElementById('inspect-sheet');
  if(sheet)sheet.style.display='none';
}
function hideSelfMenus(){
  const actions=document.getElementById('kelo-self-actions');
  const emotes=document.getElementById('kelo-emotes-panel');
  if(actions)actions.style.display='none';
  if(emotes)emotes.style.display='none';
}
function openBackpackProfile(){
  hideSelfMenus();
  hideLegacyProfile();
  try{if(typeof window.closeMenu==='function')window.closeMenu();}catch(e){}
  window.KELO_MODAL_INPUT_LOCK='profile-transition';
  const launch=function(){
    let opened=false;
    try{
      if(window.KeloBackpackUI&&typeof window.KeloBackpackUI.open==='function'){
        window.KeloBackpackUI.open();
        opened=true;
      }else if(typeof window.openInventory==='function'){
        window.openInventory();
        opened=true;
      }
    }catch(e){
      console.error('[Kelo] MY PROFILE open failed',e);
    }
    if(!opened&&window.KELO_MODAL_INPUT_LOCK==='profile-transition')window.KELO_MODAL_INPUT_LOCK=null;
  };
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(function(){requestAnimationFrame(launch);});
  else setTimeout(launch,0);
}
function activate(event){
  if(event){
    event.preventDefault();
    event.stopPropagation();
    if(typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();
  }
  const now=Date.now();
  if(now-lastActivation<320)return;
  lastActivation=now;
  openBackpackProfile();
}
function swallow(event){event.stopPropagation();}
function bind(){
  const button=document.querySelector('#kelo-self-actions .ksi-profile');
  if(!button||button.dataset.keloProfileTouchFixed==='1')return !!button;
  button.dataset.keloProfileTouchFixed='1';
  button.style.touchAction='manipulation';
  button.style.webkitTapHighlightColor='transparent';
  button.addEventListener('pointerdown',swallow,true);
  button.addEventListener('touchstart',swallow,{capture:true,passive:true});
  button.addEventListener('pointerup',activate,true);
  button.addEventListener('click',activate,true);
  return true;
}
function boot(){
  bind();
  const observer=new MutationObserver(bind);
  observer.observe(document.documentElement,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.KeloSelfProfileTouchFix=Object.freeze({version:VERSION,open:openBackpackProfile,bind});
window.KELO_SELF_PROFILE_TOUCH_AUDIT=Object.freeze({version:VERSION,physicalTouchBridge:true,preventsTapThrough:true,closesLegacyProfile:true,opensBackpackProfile:true});
})();
