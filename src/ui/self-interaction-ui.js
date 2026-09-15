/* KELO-INDEX
 * area: UI / SOCIAL
 * owner: KeloSelfInteractionUI (presentation only)
 * keys: SELF PROFILE CHARACTER CUSTOMIZER EMOTES INPUT LOCK FOUNDATION
 * purpose: presenta acciones sobre el propio jugador y panel de burlas
 * public-api: KeloSelfInteractionUI
 * consumes: KeloCharacterCustomizer, KeloEmotes, KeloBackpackUI, KeloInputLocks
 * state-owned: estado visual de sus paneles + tokens de input propios
 * extension-points: nuevas acciones UI consumen APIs de sus owners
 * reuse: menú contextual del propio jugador
 * legacy: todavía envuelve checkSocialTouch/toggleMenu; no añadir wrappers nuevos
 * do-not: no modificar movimiento ni gameplay directamente
 */
(function(){
'use strict';

const VERSION='self-interaction-ui-v1.3.0';
const ACTION_ID='kelo-self-actions';
const EMOTE_PANEL_ID='kelo-emotes-panel';
let actionOpen=false,emoteOpen=false;
const inputLockTokens=Object.create(null);

function toast(text){if(typeof showToast==='function')showToast(text);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c];});}
function ensureStyles(){
  if(document.getElementById('kelo-self-interaction-styles'))return;
  const style=document.createElement('style');
  style.id='kelo-self-interaction-styles';
  style.textContent=`
#${ACTION_ID}{position:absolute;z-index:240;display:none;width:min(270px,calc(100vw - 28px));padding:16px 16px 14px;border:2px solid rgba(231,197,106,.56);border-radius:18px;background:rgba(9,13,18,.96);box-shadow:0 22px 60px rgba(0,0,0,.56);pointer-events:auto;backdrop-filter:blur(14px)}
#${ACTION_ID} .ksi-close{position:absolute;right:-12px;top:-22px;width:52px;height:52px;border-radius:50%;border:2px solid #15171b;background:#d84d52;color:white;font-size:32px;font-weight:800;line-height:1;display:grid;place-items:center;box-shadow:0 5px 14px rgba(0,0,0,.4)}
#${ACTION_ID} .ksi-action{width:100%;min-height:68px;margin-top:9px;border:1px solid #d7bd78;border-radius:10px;background:#f7f7f5;color:#111;font-size:18px;font-weight:850;letter-spacing:.03em;box-shadow:inset 0 0 0 2px rgba(255,255,255,.65)}
#${ACTION_ID} .ksi-action:first-of-type{margin-top:0}
#${EMOTE_PANEL_ID}{position:absolute;inset:0;z-index:235;display:none;align-items:flex-start;justify-content:center;padding:max(74px,calc(env(safe-area-inset-top) + 56px)) 12px max(20px,env(safe-area-inset-bottom));background:rgba(3,6,9,.42);pointer-events:auto}
#${EMOTE_PANEL_ID} .ke-shell{width:min(430px,100%);max-height:calc(100vh - 110px);display:flex;flex-direction:column;border:2px solid rgba(201,162,74,.88);border-radius:18px;background:linear-gradient(180deg,#0d202a,#07131b);color:#e8edf1;box-shadow:0 24px 80px rgba(0,0,0,.58);overflow:hidden}
#${EMOTE_PANEL_ID} .ke-head{height:66px;display:flex;align-items:center;justify-content:space-between;padding:10px 12px 10px 18px;border-bottom:1px solid rgba(201,162,74,.38);background:rgba(16,33,43,.96)}
#${EMOTE_PANEL_ID} .ke-title{font-family:Georgia,serif;color:#ecd28c;font-size:23px;font-weight:800;letter-spacing:.05em}
#${EMOTE_PANEL_ID} .ke-close{width:48px;height:48px;border:2px solid #d7bd78;border-radius:8px;background:#6f2424;color:#f7e8cf;font-size:29px;display:grid;place-items:center}
#${EMOTE_PANEL_ID} .ke-body{overflow:auto;padding:16px;touch-action:pan-y;-webkit-overflow-scrolling:touch}
#${EMOTE_PANEL_ID} .ke-copy{font-size:12px;line-height:1.45;color:#93a5af;margin-bottom:14px}
#${EMOTE_PANEL_ID} .ke-list{display:grid;gap:10px}
#${EMOTE_PANEL_ID} .ke-slot{min-height:76px;border:1px solid rgba(201,162,74,.35);border-radius:12px;background:rgba(255,255,255,.035);display:grid;grid-template-columns:48px 1fr auto;align-items:center;gap:12px;padding:10px}
#${EMOTE_PANEL_ID} .ke-icon{width:48px;height:48px;border:1px solid rgba(231,197,106,.42);border-radius:10px;display:grid;place-items:center;background:#081118;color:#ecd28c;font-size:24px}
#${EMOTE_PANEL_ID} .ke-name{font-weight:800;color:#f1f4f5;font-size:14px}.ke-empty-name{color:#667782!important;font-weight:650!important}
#${EMOTE_PANEL_ID} .ke-meta{font-size:10px;color:#7f919b;margin-top:3px}
#${EMOTE_PANEL_ID} .ke-unequip{min-width:106px;min-height:46px;border:1px solid rgba(231,197,106,.68);border-radius:9px;background:#172735;color:#efd98f;font-weight:800;font-size:11px}
#${EMOTE_PANEL_ID} .ke-footer{padding:14px 16px;border-top:1px solid rgba(201,162,74,.26);background:#09151d}
#${EMOTE_PANEL_ID} .ke-inventory{width:100%;min-height:48px;border:1px solid #c9a24a;border-radius:10px;background:#142633;color:#efd98f;font-weight:850;font-size:12px}
.kelo-emote-equip-action{order:-10}
@media(max-width:360px){#${EMOTE_PANEL_ID} .ke-slot{grid-template-columns:44px 1fr}.ke-unequip{grid-column:1/-1;width:100%}}
`;
  document.head.appendChild(style);
}
function claimLock(owner){
  const locks=window.KeloInputLocks;
  if(!locks||typeof locks.acquire!=='function'){
    console.error('[KeloSelfInteractionUI] KeloInputLocks unavailable for',owner);
    return false;
  }
  if(!inputLockTokens[owner])inputLockTokens[owner]=locks.acquire(owner,{source:'self-interaction-ui'});
  return true;
}
function releaseLock(owner){
  const locks=window.KeloInputLocks,token=inputLockTokens[owner];
  if(!token)return false;
  if(locks&&typeof locks.release==='function')locks.release(token);
  delete inputLockTokens[owner];
  return true;
}
function closeActionMenu(){const el=document.getElementById(ACTION_ID);if(el)el.style.display='none';actionOpen=false;releaseLock('self-actions');}
function closeEmotes(){const el=document.getElementById(EMOTE_PANEL_ID);if(el)el.style.display='none';emoteOpen=false;releaseLock('emotes');}
function openProfile(){
  closeActionMenu();closeEmotes();
  if(window.KeloCharacterCustomizer&&typeof window.KeloCharacterCustomizer.open==='function'){
    if(window.KeloCharacterCustomizer.open())return;
  }
  if(window.KeloBackpackUI&&typeof window.KeloBackpackUI.open==='function'){window.KeloBackpackUI.open();return;}
  if(typeof inspectPlayer==='function')inspectPlayer(localPlayer,true);
}
function renderEmotes(){
  ensureStyles();
  let root=document.getElementById(EMOTE_PANEL_ID);
  if(!root){root=document.createElement('div');root.id=EMOTE_PANEL_ID;document.body.appendChild(root);}
  const slots=window.KeloEmotes?window.KeloEmotes.getSlots():[];
  const rows=(slots.length?slots:Array.from({length:4},(_,i)=>({index:i,item:null}))).map(function(slot){
    const item=slot.item;
    if(!item)return '<div class="ke-slot"><div class="ke-icon">◇</div><div><div class="ke-name ke-empty-name">Espacio '+(slot.index+1)+' · Vacío</div><div class="ke-meta">Equipa una burla desde tu Mochila</div></div></div>';
    return '<div class="ke-slot"><div class="ke-icon">'+esc(item.icon||'♪')+'</div><div><div class="ke-name">'+esc(item.name||'Burla')+'</div><div class="ke-meta">'+esc(item.rarity||'Normal')+' · equipada</div></div><button type="button" class="ke-unequip" data-emote-id="'+esc(item.id||item.uid||'')+'">DESEQUIPAR</button></div>';
  }).join('');
  root.innerHTML='<div class="ke-shell" role="dialog" aria-modal="true" aria-label="Burlas equipadas"><div class="ke-head"><div class="ke-title">BURLAS</div><button type="button" class="ke-close" aria-label="Cerrar">×</button></div><div class="ke-body"><div class="ke-copy">Aquí aparecen únicamente las burlas equipadas. Las burlas guardadas en la Mochila se pueden equipar desde su ficha y desaparecen de la Mochila mientras estén equipadas.</div><div class="ke-list">'+rows+'</div></div><div class="ke-footer"><button type="button" class="ke-inventory">ABRIR MOCHILA PARA EQUIPAR</button></div></div>';
  root.querySelector('.ke-close').onclick=closeEmotes;
  root.querySelector('.ke-inventory').onclick=function(){closeEmotes();if(window.KeloBackpackUI)window.KeloBackpackUI.open();};
  root.querySelectorAll('.ke-unequip').forEach(function(button){button.onclick=function(){
    const out=window.KeloEmotes&&window.KeloEmotes.unequip(button.dataset.emoteId);
    if(out&&out.ok){toast('Burla devuelta a la Mochila');renderEmotes();}
    else if(out&&out.error==='DESTINATION_FULL')toast('Mochila llena: libera un espacio primero');
    else toast('No se pudo desequipar la burla');
  };});
  return root;
}
function openEmotes(){closeActionMenu();if(typeof closeMenu==='function')closeMenu();if(window.KeloBackpackUI)window.KeloBackpackUI.close();const root=renderEmotes();root.style.display='flex';emoteOpen=true;claimLock('emotes');}
function ensureActionMenu(){
  ensureStyles();
  let root=document.getElementById(ACTION_ID);
  if(root)return root;
  root=document.createElement('div');root.id=ACTION_ID;
  root.innerHTML='<button type="button" class="ksi-close" aria-label="Cerrar">×</button><button type="button" class="ksi-action ksi-profile">MY PROFILE</button><button type="button" class="ksi-action ksi-emotes">BURLAS</button>';
  document.body.appendChild(root);
  root.querySelector('.ksi-close').onclick=closeActionMenu;
  root.querySelector('.ksi-profile').onclick=openProfile;
  root.querySelector('.ksi-emotes').onclick=openEmotes;
  return root;
}
function openActionMenu(sx,sy){
  closeEmotes();
  if(typeof closeMenu==='function')closeMenu();
  const root=ensureActionMenu();
  const width=Math.min(270,window.innerWidth-28);
  const left=Math.max(14,Math.min(window.innerWidth-width-14,Number(sx||window.innerWidth/2)-width/2));
  const top=Math.max(82,Math.min(window.innerHeight-190,Number(sy||window.innerHeight/2)-105));
  root.style.left=left+'px';root.style.top=top+'px';root.style.display='block';actionOpen=true;claimLock('self-actions');
}
function decorateBackpack(){
  const root=document.getElementById('kelo-bag');
  if(!root||getComputedStyle(root).display==='none')return;
  const selected=root.querySelector('.kb-slot.selected');
  if(!selected)return;
  const index=Number(selected.dataset.slot);
  const slot=window.KeloBackpack&&window.KeloBackpack.getSlots()[index];
  if(!slot||!slot.item||slot.item.kind!=='emote')return;
  const actions=root.querySelector('.kb-detail .kb-actions');
  if(!actions||actions.querySelector('.kelo-emote-equip-action'))return;
  const button=document.createElement('button');
  button.type='button';button.className='kb-action primary kelo-emote-equip-action';button.textContent='EQUIPAR BURLA';
  button.onclick=function(){
    const out=window.KeloEmotes&&window.KeloEmotes.equip(slot.item.id||slot.item.uid);
    if(out&&out.ok){toast('Burla equipada');if(window.KeloBackpackUI)window.KeloBackpackUI.render();}
    else if(out&&out.error==='DESTINATION_FULL')toast('Ya tienes las 4 burlas equipadas');
    else toast('No se pudo equipar la burla');
  };
  actions.insertBefore(button,actions.firstChild);
}
function observeBackpack(){
  const observer=new MutationObserver(function(){queueMicrotask(decorateBackpack);});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('kelo:emotes-changed',function(){if(window.KeloBackpackUI&&window.KeloBackpackUI.isOpen())window.KeloBackpackUI.render();});
}
function installSelfTap(){
  const previous=window.checkSocialTouch;
  window.checkSocialTouch=function(sx,sy){
    try{
      const w=typeof screenToWorld==='function'?screenToWorld(sx,sy):null;
      if(w&&typeof localPlayer!=='undefined'){
        const radius=Math.max(18,Number(localPlayer.radius)||16)*2.15;
        if(Math.hypot(w.x-localPlayer.x,w.y-localPlayer.y)<=radius){openActionMenu(sx,sy);return true;}
      }
    }catch(e){}
    closeActionMenu();
    return typeof previous==='function'?previous.apply(this,arguments):undefined;
  };
}
function wrapMenu(){
  const original=window.toggleMenu;
  if(typeof original!=='function'||original.__keloSelfWrapped)return;
  function wrapped(){closeActionMenu();closeEmotes();return original.apply(this,arguments);}
  wrapped.__keloSelfWrapped=true;window.toggleMenu=wrapped;
}
function boot(){ensureStyles();ensureActionMenu();renderEmotes();observeBackpack();installSelfTap();wrapMenu();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

window.KeloSelfInteractionUI=Object.freeze({version:VERSION,open:openActionMenu,close:closeActionMenu,openProfile,openEmotes,closeEmotes,decorateBackpack});
window.KELO_SELF_INTERACTION_AUDIT=Object.freeze({version:VERSION,selfTapMenu:true,actions:['my_profile','emotes'],closeButtonMinPx:48,profileUsesCharacterCustomizer:true,profileFallbackUsesBackpackUI:true,emotePanel:true,backpackEquipBridge:true,tapFirst:true,dragDrop:false,inputLockOwner:'KeloInputLocks',tokenLocks:true,legacyModalWrites:false});
})();
