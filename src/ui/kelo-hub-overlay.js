/* KELO-INDEX
 * area: UI / HUB OVERLAY RECOVERY
 * owner: Kelo Hub presentation layer
 * purpose: fail-open recovery: never block Kelo World boot; restore known-good Luxe controls while Hub v2 is isolated
 * do-not: NO MutationObserver, NO DOM scanning loop, NO gameplay state, NO blocking boot
 */
(function(root){
'use strict';
if(root.KeloHubOverlay?.__recovery)return;
const VERSION='kelo-hub-overlay-recovery-v1';
function restoreLegacyChrome(){
  try{
    const old=document.getElementById('kelo-hub-overlay-style');if(old)old.remove();
    const oldLauncher=document.getElementById('kelo-hub-launcher');if(oldLauncher)oldLauncher.remove();
    const oldSections=document.getElementById('kelo-hub-sections');if(oldSections)oldSections.remove();
    const oldChat=document.getElementById('lx-chat-tab');if(oldChat)oldChat.remove();
    document.documentElement.classList.remove('kelo-hub-safe-ready');
    if(!document.getElementById('kelo-hub-recovery-style')){
      const style=document.createElement('style');style.id='kelo-hub-recovery-style';style.textContent=`
        .lx-top{display:flex!important}
        .lx-rail{display:flex!important}
        #lx-shop,#lx-side-pvp,#kelo-logistics-admin-fab,#kelo-orientation-btn{visibility:visible!important;opacity:1!important}
        #lx-menu-grid{display:grid!important}
      `;document.head.appendChild(style);
    }
  }catch(error){console.error('[Kelo Hub Recovery]',error);}
}
function boot(){try{restoreLegacyChrome();}catch(error){console.error('[Kelo Hub Recovery boot]',error);}}
root.KeloHubOverlay=Object.freeze({
  __recovery:true,
  __safeSingleton:true,
  version:VERSION,
  refresh:boot,
  open(){try{root.KELO_LUXE?.toggleMenu?.(true);}catch(_){}},
  close(){try{root.KELO_LUXE?.closeMenu?.();}catch(_){}},
  openChat(){try{root.KELO_LUXE?.renderMenu?.();const chat=Array.from(document.querySelectorAll('#lx-menu-grid [data-tool]')).find(el=>el.dataset.tool==='chat');if(chat){chat.click();return true;}}catch(_){}return false;},
  audit:Object.freeze({failOpen:true,noObservers:true,recovery:true})
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
