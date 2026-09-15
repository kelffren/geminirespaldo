/* KELO-INDEX
 * area: UI / HUD
 * owner: Kelo Luxe Shell presentation
 * keys: COMBAT HUD PVP HP MANA GUIDE MOBILE RAIL QUICK ACTIONS COLLAPSIBLE BOUTIQUE MENU FULLSCREEN MINIMAP
 * purpose: prioriza el paisaje: en social no hay player HUD; el rail lateral conserva los accesos reales dentro de un launcher retráctil mobile-first; el minimapa LIVE queda sobre la tarjeta de cuenta Kelo
 * public-api: KELO_LUXE_PLAYER_HUD.refresh/snapshot
 * consumes: localPlayer, STATE, KeloPvPWorld, KeloEvents, KeloRender, Luxe Shell, KELO_ORIENTATION
 * state-owned: cache visual del último snapshot + estado efímero abierto/cerrado del quick-actions rail + presentación del minimapa
 * reuse: reutiliza los botones/handlers reales de Boutique, Menú, PvP y Pantalla Completa; GUÍA sigue siendo el único acceso añadido al mismo rail
 * do-not: NO gameplay state, NO segundo render loop, NO setInterval, NO player profile duplicado, NO handlers duplicados de Boutique/Menú/PvP/Fullscreen
 * online: presentación solamente; la autoridad de combate/recursos permanece en sus owners
 */
(function(root){
'use strict';
if(typeof document==='undefined'||document.getElementById('kw-player-hud-wrap'))return;
const luxe=document.getElementById('kelo-luxe');
if(!luxe)return;
luxe.querySelector('.lx-gold')?.remove();
luxe.querySelector('.lx-presence')?.remove();
const rail=luxe.querySelector('.lx-rail');
const shop=document.getElementById('lx-shop');
const menu=document.getElementById('lx-side-menu');
const pvp=document.getElementById('lx-side-pvp');
let fullscreen=document.getElementById('kelo-orientation-btn');
let guide=document.getElementById('kw-player-guide');
if(shop){shop.classList.add('lx-side-shop');shop.textContent='Boutique';shop.setAttribute('aria-label','Abrir Boutique');shop.setAttribute('title','Boutique');}
if(!guide){guide=document.createElement('a');guide.id='kw-player-guide';guide.className='lx-side-guide';guide.href='guide.html';guide.setAttribute('aria-label','Abrir guía');guide.innerHTML='<b aria-hidden="true">▤</b><span>GUÍA</span>';}
let quickActionsExpanded=false,quickToggle=null,quickOptions=null;
if(rail){
  quickToggle=document.createElement('button');
  quickToggle.id='kw-quick-actions-toggle';
  quickToggle.className='kw-quick-actions-toggle';
  quickToggle.type='button';
  quickToggle.setAttribute('aria-expanded','false');
  quickToggle.setAttribute('aria-controls','kw-quick-actions-options');
  quickToggle.setAttribute('aria-label','Mostrar accesos rápidos');
  quickToggle.setAttribute('title','Accesos rápidos');
  quickToggle.innerHTML='<span class="kw-quick-actions-icon" aria-hidden="true"><i></i><i></i><i></i></span>';
  quickOptions=document.createElement('div');
  quickOptions.id='kw-quick-actions-options';
  quickOptions.className='kw-quick-actions-options';
  quickOptions.setAttribute('aria-hidden','true');
  rail.appendChild(quickToggle);
  rail.appendChild(quickOptions);
  [shop,menu,pvp,guide,fullscreen].filter(Boolean).forEach(node=>quickOptions.appendChild(node));
}
function adoptFullscreenControl(){
  const control=document.getElementById('kelo-orientation-btn');
  if(!control||!quickOptions)return false;
  fullscreen=control;
  if(control.parentElement!==quickOptions)quickOptions.appendChild(control);
  return true;
}
if(!adoptFullscreenControl()){
  root.addEventListener?.('kelo:orientationchange',adoptFullscreenControl,{once:true});
  root.addEventListener?.('kelo:fullscreenchange',adoptFullscreenControl,{once:true});
}
function setQuickActionsExpanded(force){
  if(!rail||!quickToggle||!quickOptions)return false;
  quickActionsExpanded=typeof force==='boolean'?force:!quickActionsExpanded;
  rail.classList.toggle('kw-quick-actions-open',quickActionsExpanded);
  quickToggle.setAttribute('aria-expanded',String(quickActionsExpanded));
  quickToggle.setAttribute('aria-label',quickActionsExpanded?'Ocultar accesos rápidos':'Mostrar accesos rápidos');
  quickToggle.setAttribute('title',quickActionsExpanded?'Cerrar accesos rápidos':'Accesos rápidos');
  quickOptions.setAttribute('aria-hidden',String(!quickActionsExpanded));
  return quickActionsExpanded;
}
if(quickToggle)quickToggle.addEventListener('click',()=>setQuickActionsExpanded());
if(quickOptions){
  const autoCloseActions=new Set([shop,menu,pvp,guide].filter(Boolean));
  quickOptions.addEventListener('click',event=>{
    const action=event.target.closest('#lx-shop,#lx-side-menu,#lx-side-pvp,#kw-player-guide,#kelo-orientation-btn');
    if(action&&autoCloseActions.has(action))setQuickActionsExpanded(false);
  });
}
root.addEventListener?.('keydown',event=>{
  if(event.key==='Escape'&&quickActionsExpanded)setQuickActionsExpanded(false);
});
/* lx-top conserva un spacer decorativo aun tras mover Boutique; la superficie completa ya no tiene función. */
const oldTop=luxe.querySelector('.lx-top');if(oldTop)oldTop.remove();
const style=document.createElement('style');style.id='kw-player-hud-style';style.textContent=`
#kw-player-hud-wrap{position:absolute;top:max(7px,env(safe-area-inset-top));left:max(7px,env(safe-area-inset-left));width:clamp(146px,40vw,174px);z-index:86;pointer-events:none;color:#fff4d6;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:none}
body:not(.social-mode) #kw-player-hud-wrap{display:block}
.kw-combat-hud{position:relative;padding:6px 7px;border:1px solid rgba(231,197,106,.58);border-radius:11px;background:linear-gradient(145deg,rgba(7,24,30,.91),rgba(4,13,18,.95));box-shadow:0 7px 18px rgba(0,0,0,.28),inset 0 0 0 1px rgba(255,255,255,.025);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.kw-combat-hud:before{content:"";position:absolute;inset:3px;border:1px solid rgba(231,197,106,.08);border-radius:8px;pointer-events:none}
.kw-combat-row{position:relative;display:grid;grid-template-columns:14px minmax(0,1fr);gap:5px;align-items:center}.kw-combat-row+.kw-combat-row{margin-top:5px}
.kw-combat-icon{width:14px;height:14px;display:grid;place-items:center;color:#f0dba1;font-size:8px;line-height:1}.kw-combat-main{min-width:0}.kw-combat-head{display:flex;align-items:baseline;justify-content:space-between;gap:5px;font-size:6px;line-height:1}.kw-combat-head b{color:#f5e8bf;font:800 7px/1 Georgia,serif}.kw-combat-head span{color:#d4ded8;font-size:6px;font-variant-numeric:tabular-nums}
.kw-combat-bar{display:block;width:100%;height:6px;margin-top:2px;border-radius:99px;overflow:hidden;background:rgba(0,6,9,.76);box-shadow:inset 0 0 0 1px rgba(255,255,255,.07)}.kw-combat-bar i{display:block;height:100%;width:0;transition:width .16s ease}.kw-combat-hp i{background:linear-gradient(90deg,#941016,#ef473a);box-shadow:0 0 6px rgba(239,71,58,.24)}.kw-combat-mana i{background:linear-gradient(90deg,#0752a6,#22a6f5);box-shadow:0 0 6px rgba(34,166,245,.22)}.kw-combat-row.unavailable{opacity:.5}.kw-combat-row.unavailable .kw-combat-bar i{width:0!important}
#kelo-luxe .lx-rail{position:absolute!important;top:calc(env(safe-area-inset-top,0px) + 10px)!important;right:calc(env(safe-area-inset-right,0px) + 8px)!important;width:64px!important;height:58px!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:0!important;pointer-events:none!important;z-index:86!important}
#kelo-luxe .kw-quick-actions-toggle{position:relative!important;isolation:isolate!important;width:64px!important;min-width:64px!important;height:58px!important;min-height:58px!important;margin:0!important;padding:0!important;border-radius:18px!important;border:1px solid rgba(231,197,106,.68)!important;background:linear-gradient(145deg,rgba(23,39,35,.97),rgba(6,14,17,.99))!important;color:#e7c56a!important;box-shadow:0 10px 24px rgba(0,0,0,.30),inset 0 0 0 1px rgba(255,255,255,.035)!important;display:grid!important;place-items:center!important;pointer-events:auto!important;touch-action:manipulation!important;overflow:hidden!important}
#kelo-luxe .kw-quick-actions-toggle:before{content:"";position:absolute;inset:-34%;z-index:-1;background:radial-gradient(circle,rgba(231,197,106,.15),transparent 60%)}
#kelo-luxe .kw-quick-actions-toggle:active{transform:scale(.95)!important;border-color:#e7c56a!important}
.kw-quick-actions-icon{position:relative;display:block;width:26px;height:22px}.kw-quick-actions-icon i{position:absolute;left:50%;top:50%;display:block;width:24px;height:2px;border-radius:99px;background:#e7c56a;box-shadow:0 0 8px rgba(231,197,106,.24);transform-origin:center;transition:transform .21s ease,opacity .16s ease}.kw-quick-actions-icon i:nth-child(1){transform:translate(-50%,-50%) translateY(-7px)}.kw-quick-actions-icon i:nth-child(2){transform:translate(-50%,-50%)}.kw-quick-actions-icon i:nth-child(3){transform:translate(-50%,-50%) translateY(7px)}
#kelo-luxe .kw-quick-actions-open .kw-quick-actions-icon i:nth-child(1){transform:translate(-50%,-50%) rotate(45deg)}#kelo-luxe .kw-quick-actions-open .kw-quick-actions-icon i:nth-child(2){opacity:0;transform:translate(-50%,-50%) scaleX(.35)}#kelo-luxe .kw-quick-actions-open .kw-quick-actions-icon i:nth-child(3){transform:translate(-50%,-50%) rotate(-45deg)}
#kelo-luxe .kw-quick-actions-options{position:absolute!important;top:calc(100% + 8px)!important;right:0!important;width:64px!important;max-height:calc(100vh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 86px)!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:8px!important;padding:0 0 4px!important;overflow-x:visible!important;overflow-y:auto!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch;scrollbar-width:none;opacity:0;visibility:hidden;transform:translateY(-6px) scale(.97);transform-origin:top right;pointer-events:none!important;transition:opacity .21s ease,transform .21s ease,visibility 0s linear .21s}
#kelo-luxe .kw-quick-actions-options::-webkit-scrollbar{display:none}
#kelo-luxe .kw-quick-actions-open .kw-quick-actions-options{opacity:1;visibility:visible;transform:none;pointer-events:auto!important;transition:opacity .21s ease,transform .21s ease,visibility 0s linear 0s}
#kelo-luxe .lx-side-menu,#kelo-luxe .lx-side-pvp,#kelo-luxe #lx-shop,#kelo-luxe .lx-side-guide,#kelo-luxe #kelo-orientation-btn{position:relative!important;isolation:isolate!important;width:64px!important;min-width:64px!important;height:58px!important;min-height:58px!important;margin:0!important;padding:5px 3px!important;border-radius:18px!important;border:1px solid rgba(231,197,106,.58)!important;background:linear-gradient(145deg,rgba(23,39,35,.96),rgba(6,14,17,.98))!important;color:#fff4d6!important;box-shadow:0 10px 24px rgba(0,0,0,.30),inset 0 0 0 1px rgba(255,255,255,.035)!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;text-decoration:none!important;pointer-events:auto!important;touch-action:manipulation!important;overflow:hidden!important;flex:0 0 auto!important}
#kelo-luxe .kw-quick-actions-options[aria-hidden="true"]>*{visibility:hidden!important;pointer-events:none!important}
#kelo-luxe .kw-quick-actions-open .kw-quick-actions-options[aria-hidden="false"]>*{visibility:visible!important;pointer-events:auto!important}
#kelo-luxe .lx-side-menu:before,#kelo-luxe .lx-side-pvp:before,#kelo-luxe #lx-shop:before,#kelo-luxe .lx-side-guide:before,#kelo-luxe #kelo-orientation-btn:before{content:"";position:absolute;inset:-34%;z-index:-1;background:radial-gradient(circle,rgba(231,197,106,.13),transparent 60%)}
#kelo-luxe .lx-side-menu b,#kelo-luxe .lx-side-pvp b,#kelo-luxe .lx-side-guide b{color:#e7c56a!important;font:800 22px/1 Georgia,serif!important;text-shadow:0 0 10px rgba(231,197,106,.22)}
#kelo-luxe .lx-side-menu span,#kelo-luxe .lx-side-pvp span,#kelo-luxe .lx-side-guide span{display:block!important;color:#e8cf84!important;font:850 8px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;letter-spacing:.12em!important}
#kelo-luxe #lx-shop{font:800 12px/1 Georgia,serif!important;color:#f0d27d!important;letter-spacing:0!important}
#kelo-luxe #kelo-orientation-btn .kelo-fullscreen-icon{width:22px!important;height:22px!important;color:#e7c56a!important}#kelo-luxe #kelo-orientation-btn [data-fullscreen-primary]{display:block!important;color:#fff4d6!important;font-size:6px!important;line-height:1!important;letter-spacing:.07em!important}#kelo-luxe #kelo-orientation-btn [data-fullscreen-secondary]{display:block!important;color:#9eb0aa!important;font-size:5.4px!important;line-height:1!important;letter-spacing:.055em!important}
#kelo-luxe .lx-side-menu:active,#kelo-luxe .lx-side-pvp:active,#kelo-luxe #lx-shop:active,#kelo-luxe .lx-side-guide:active,#kelo-luxe #kelo-orientation-btn:active{transform:scale(.95)!important;border-color:#e7c56a!important}
@media(max-width:360px){#kw-player-hud-wrap{width:142px}#kelo-luxe .lx-rail{width:58px!important;height:54px!important;right:calc(env(safe-area-inset-right,0px) + 6px)!important}#kelo-luxe .kw-quick-actions-toggle{width:58px!important;min-width:58px!important;height:54px!important;min-height:54px!important;border-radius:16px!important}#kelo-luxe .kw-quick-actions-options{width:58px!important;gap:7px!important;max-height:calc(100vh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 80px)!important}#kelo-luxe .lx-side-menu,#kelo-luxe .lx-side-pvp,#kelo-luxe #lx-shop,#kelo-luxe .lx-side-guide,#kelo-luxe #kelo-orientation-btn{width:58px!important;min-width:58px!important;height:54px!important;min-height:54px!important;border-radius:16px!important}#kelo-luxe #lx-shop{font-size:10.5px!important}}
@media(max-height:620px){#kelo-luxe .lx-rail{height:48px!important;top:calc(env(safe-area-inset-top,0px) + 5px)!important}#kelo-luxe .kw-quick-actions-toggle{height:48px!important;min-height:48px!important;border-radius:15px!important}#kelo-luxe .kw-quick-actions-options{gap:5px!important;top:calc(100% + 5px)!important;max-height:calc(100vh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 58px)!important}#kelo-luxe .lx-side-menu,#kelo-luxe .lx-side-pvp,#kelo-luxe #lx-shop,#kelo-luxe .lx-side-guide,#kelo-luxe #kelo-orientation-btn{height:48px!important;min-height:48px!important;border-radius:15px!important}#kelo-luxe .lx-side-menu b,#kelo-luxe .lx-side-pvp b,#kelo-luxe .lx-side-guide b{font-size:18px!important}#kelo-luxe .lx-side-menu span,#kelo-luxe .lx-side-pvp span,#kelo-luxe .lx-side-guide span{font-size:7px!important}#kw-player-hud-wrap{top:max(5px,env(safe-area-inset-top));width:148px}.kw-combat-hud{padding:5px 6px}}
@media(max-height:430px) and (orientation:landscape){#kelo-luxe .lx-rail{top:calc(env(safe-area-inset-top,0px) + 4px)!important;width:54px!important;height:44px!important}#kelo-luxe .kw-quick-actions-toggle{width:54px!important;min-width:54px!important;height:44px!important;min-height:44px!important;border-radius:13px!important}#kelo-luxe .kw-quick-actions-options{width:54px!important;gap:4px!important;top:calc(100% + 4px)!important;max-height:calc(100vh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 52px)!important}#kelo-luxe .lx-side-menu,#kelo-luxe .lx-side-pvp,#kelo-luxe #lx-shop,#kelo-luxe .lx-side-guide,#kelo-luxe #kelo-orientation-btn{width:54px!important;min-width:54px!important;height:44px!important;min-height:44px!important;border-radius:13px!important}#kelo-luxe .lx-rail{width:54px!important}.kw-combat-row+.kw-combat-row{margin-top:3px}.kw-combat-bar{height:5px}}
@supports(height:100dvh){#kelo-luxe .kw-quick-actions-options{max-height:calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 86px)!important}@media(max-width:360px){#kelo-luxe .kw-quick-actions-options{max-height:calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 80px)!important}}@media(max-height:620px){#kelo-luxe .kw-quick-actions-options{max-height:calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 58px)!important}}@media(max-height:430px) and (orientation:landscape){#kelo-luxe .kw-quick-actions-options{max-height:calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 52px)!important}}}
@media(prefers-reduced-motion:reduce){.kw-combat-bar i,#kelo-luxe .kw-quick-actions-options,.kw-quick-actions-icon i{transition:none!important}}
`;document.head.appendChild(style);
const wrap=document.createElement('div');wrap.id='kw-player-hud-wrap';wrap.innerHTML=`<section class="kw-combat-hud" aria-label="Estado de combate"><div class="kw-combat-row kw-combat-hp" id="kw-hud-hp-row"><span class="kw-combat-icon" aria-hidden="true">♥</span><span class="kw-combat-main"><span class="kw-combat-head"><b>Vida</b><span id="kw-hud-hp-text">— / —</span></span><span class="kw-combat-bar" id="kw-hud-hp-bar" role="progressbar" aria-label="Vida"><i></i></span></span></div><div class="kw-combat-row kw-combat-mana" id="kw-hud-mana-row"><span class="kw-combat-icon" aria-hidden="true">◆</span><span class="kw-combat-main"><span class="kw-combat-head"><b>Maná</b><span id="kw-hud-mana-text">— / —</span></span><span class="kw-combat-bar" id="kw-hud-mana-bar" role="progressbar" aria-label="Maná"><i></i></span></span></div></section>`;luxe.appendChild(wrap);
const byId=id=>document.getElementById(id),finite=v=>Number.isFinite(Number(v))?Number(v):null,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));let last=null;
function snapshot(){const p=typeof localPlayer!=='undefined'?localPlayer:null,state=typeof STATE!=='undefined'?STATE:{},hp=finite(p?.hp),maxHp=finite(p?.maxHp),mana=finite(p?.mana??state?.playerProfile?.mana),maxMana=finite(p?.maxMana??state?.playerProfile?.maxMana),pvpState=root.KeloPvPWorld?.state;return Object.freeze({hp,maxHp,mana,maxMana,combatEnabled:!!(root.KELO_COMBAT_ENABLED||pvpState?.combatEnabled),mode:pvpState?.mode||((document.body?.classList.contains('social-mode'))?'social':'combat')});}
function setBar(rowId,barId,textId,value,max){const row=byId(rowId),bar=byId(barId),text=byId(textId),fill=bar?.querySelector('i'),available=value!=null&&max!=null&&max>0;row?.classList.toggle('unavailable',!available);if(text)text.textContent=available?`${Math.round(value)} / ${Math.round(max)}`:'— / —';const pct=available?clamp((value/max)*100,0,100):0;if(fill)fill.style.width=pct+'%';if(bar){bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax',available?String(max):'0');bar.setAttribute('aria-valuenow',available?String(value):'0');bar.setAttribute('aria-valuetext',available?`${Math.round(value)} de ${Math.round(max)}`:'No disponible');}}
function refresh(){last=snapshot();setBar('kw-hud-hp-row','kw-hud-hp-bar','kw-hud-hp-text',last.hp,last.maxHp);setBar('kw-hud-mana-row','kw-hud-mana-bar','kw-hud-mana-text',last.mana,last.maxMana);return last;}
const eventNames=['player:stat_changed','player:state_changed','combat:entity_damaged','combat:damage_applied','ability:cast','ability:resource_changed'];if(root.KeloEvents?.on)eventNames.forEach(name=>root.KeloEvents.on(name,refresh));['pageshow','focus','online'].forEach(name=>root.addEventListener?.(name,refresh));document.addEventListener('pointerup',()=>queueMicrotask(refresh),{capture:true,passive:true});document.addEventListener('keyup',()=>queueMicrotask(refresh),{capture:true,passive:true});refresh();requestAnimationFrame(refresh);
root.KELO_LUXE_PLAYER_HUD=Object.freeze({version:'luxe-player-hud-v1.3.0-minimap',layout:'pvp-only-combat-v1',visibility:'pvp-only',rail:'collapsible-five',refresh,snapshot,owner:'Kelo Luxe Shell presentation',polling:false});
})(typeof globalThis!=='undefined'?globalThis:window);

/* KELO-INDEX UI/MINIMAP: usa el owner KeloRender; no crea un segundo loop. Queda arriba del chip de cuenta Kelo. */
(function(root){
'use strict';
if(typeof document==='undefined'||root.KELO_HIDE_MINIMAP===true||document.getElementById('kw-live-minimap'))return;
const renderOwner=root.KeloRender;
if(!renderOwner?.afterFrame)return;
const host=document.createElement('div');
host.id='kw-live-minimap';
host.setAttribute('aria-label','Minimapa de Kelo World');
host.innerHTML='<canvas width="96" height="96" aria-hidden="true"></canvas><span class="kw-minimap-north" aria-hidden="true">N</span>';
document.body.appendChild(host);
const canvas=host.querySelector('canvas'),mini=canvas.getContext('2d',{alpha:true});
const base=document.createElement('canvas');base.width=192;base.height=192;const baseCtx=base.getContext('2d',{alpha:false});
const miniStyle=document.createElement('style');miniStyle.id='kw-live-minimap-style';miniStyle.textContent=`
#kw-live-minimap{position:fixed;top:max(10px,env(safe-area-inset-top));left:max(10px,env(safe-area-inset-left));width:88px;height:88px;z-index:2147480050;border:1px solid rgba(229,189,98,.48);border-radius:50%;overflow:hidden;background:rgba(7,13,14,.94);box-shadow:0 10px 28px rgba(0,0,0,.38),inset 0 0 0 2px rgba(255,255,255,.035);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);pointer-events:none;isolation:isolate}
#kw-live-minimap:after{content:"";position:absolute;inset:4px;border:1px solid rgba(231,197,106,.18);border-radius:50%;pointer-events:none}
#kw-live-minimap canvas{display:block;width:100%;height:100%;border-radius:50%;image-rendering:auto}
#kw-live-minimap .kw-minimap-north{position:absolute;top:5px;left:50%;transform:translateX(-50%);z-index:2;color:#ffe19a;font:900 7px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-shadow:0 1px 4px #000}
.ka-account-chip{top:calc(max(10px,env(safe-area-inset-top)) + 96px)!important;left:max(10px,env(safe-area-inset-left))!important;right:auto!important;z-index:2147480000!important}
@media(max-width:360px){#kw-live-minimap{width:80px;height:80px}.ka-account-chip{top:calc(max(10px,env(safe-area-inset-top)) + 88px)!important}}
@media(max-height:430px) and (orientation:landscape){#kw-live-minimap{width:64px;height:64px;top:max(5px,env(safe-area-inset-top));left:max(6px,env(safe-area-inset-left))}.ka-account-chip{top:calc(max(5px,env(safe-area-inset-top)) + 70px)!important;left:max(6px,env(safe-area-inset-left))!important}}
`;document.head.appendChild(miniStyle);
let baseReady=false,lastBaseAttempt=0,lastPaint=0;
function worldConfig(frame){
  const c=frame?.config||(typeof CONFIG!=='undefined'?CONFIG:null)||{};
  return {w:Math.max(1,Number(c.worldWidth)||3600),h:Math.max(1,Number(c.worldHeight)||3200)};
}
function paintFallback(w,h){
  baseCtx.setTransform(1,0,0,1,0,0);baseCtx.fillStyle='#163528';baseCtx.fillRect(0,0,base.width,base.height);
  baseCtx.strokeStyle='rgba(235,207,128,.25)';baseCtx.lineWidth=3;baseCtx.beginPath();baseCtx.moveTo(base.width*.08,base.height*.5);baseCtx.lineTo(base.width*.92,base.height*.5);baseCtx.moveTo(base.width*.5,base.height*.08);baseCtx.lineTo(base.width*.5,base.height*.92);baseCtx.stroke();
  baseCtx.strokeStyle='rgba(255,255,255,.10)';baseCtx.lineWidth=1;baseCtx.strokeRect(1,1,base.width-2,base.height-2);
}
function rebuildBase(frame,now){
  if(baseReady||now-lastBaseAttempt<1800)return;
  lastBaseAttempt=now;
  const size=worldConfig(frame);paintFallback(size.w,size.h);
  const renderer=root.KELO_WORLD_RENDERER;
  if(!renderer?.draw)return;
  try{
    baseCtx.save();baseCtx.setTransform(base.width/size.w,0,0,base.height/size.h,0,0);
    const drawn=renderer.draw(baseCtx)===true;baseCtx.restore();
    if(drawn)baseReady=true;
  }catch(error){try{baseCtx.restore();}catch(_){} }
}
function actorPoint(actor,size){if(!actor)return null;const x=Number(actor.x),y=Number(actor.y);if(!Number.isFinite(x)||!Number.isFinite(y))return null;return{x:(x/size.w)*canvas.width,y:(y/size.h)*canvas.height};}
function drawDot(point,r,fill,stroke){if(!point)return;mini.beginPath();mini.arc(point.x,point.y,r,0,Math.PI*2);mini.fillStyle=fill;mini.fill();if(stroke){mini.strokeStyle=stroke;mini.lineWidth=1;mini.stroke();}}
function paint(frame,now){
  if(now-lastPaint<90)return;lastPaint=now;rebuildBase(frame,now);
  const size=worldConfig(frame);mini.setTransform(1,0,0,1,0,0);mini.clearRect(0,0,canvas.width,canvas.height);mini.drawImage(base,0,0,canvas.width,canvas.height);
  const cam=frame?.camera||(typeof camera!=='undefined'?camera:null),sw=Number(frame?.screenW)||0,sh=Number(frame?.screenH)||0,zoom=Math.max(.01,Number(frame?.config?.zoom)||(typeof CONFIG!=='undefined'?Number(CONFIG.zoom):1)||1);
  if(cam&&sw&&sh){const vw=(sw/zoom)/size.w*canvas.width,vh=(sh/zoom)/size.h*canvas.height,cx=(Number(cam.x)||0)/size.w*canvas.width,cy=(Number(cam.y)||0)/size.h*canvas.height;mini.strokeStyle='rgba(255,255,255,.46)';mini.lineWidth=.8;mini.strokeRect(cx-vw/2,cy-vh/2,vw,vh);}
  const others=typeof simulatedPlayers!=='undefined'&&Array.isArray(simulatedPlayers)?simulatedPlayers:[];others.forEach(actor=>drawDot(actorPoint(actor,size),1.7,'rgba(246,247,247,.82)','rgba(0,0,0,.55)'));
  const me=typeof localPlayer!=='undefined'?localPlayer:null;drawDot(actorPoint(me,size),3.3,'#58bfff','#fff3bf');
}
const hookId=renderOwner.afterFrame('KeloLuxeMinimap',frame=>paint(frame,performance.now()),900);
root.KELO_LUXE_MINIMAP=Object.freeze({version:'luxe-minimap-v1.0.0',owner:'Kelo Luxe Shell presentation',renderHook:hookId,position:'above-account-chip',timers:0});
})(typeof globalThis!=='undefined'?globalThis:window);
