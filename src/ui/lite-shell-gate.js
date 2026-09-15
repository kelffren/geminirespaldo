/* KELO-INDEX
 * area: LAB / UI BOOT
 * owner: KeloLiteShellGate
 * keys: LITE SHELL UI FIRST-USE IOS SAFARI FRAME BUDGET ZERO-BOOT
 * purpose: mostrar controles esenciales con pocos bytes y cargar Luxe UI completa solo al primer uso
 * public-api: KeloLiteShellGate.upgrade/openMenu/openPvp/getState
 * do-not: NO polling, NO second loop, NO automatic full UI load, NO production promotion without lab proof
 */
(function(root){
'use strict';
if(root.KeloLiteShellGate)return;
const VERSION='kelo-lite-shell-gate-v1';
const FRAME_LIMIT_MS=28;
const RETRY_MS=700;
const BETWEEN_MS=180;
const FULL_UI=[
  'src/ui/luxe-shell.js?v=231',
  'src/ui/mobile-orientation.js?v=6',
  'src/ui/luxe-player-hud.js?v=4-minimap-live-20260914'
];
let upgrading=null;
let upgraded=false;
let failed=[];
let rootEl=null;
let requestedAction=null;

function emit(type,detail){try{root.dispatchEvent(new CustomEvent('kelo:lite-shell:'+type,{detail:Object.assign({version:VERSION},detail||{})}));}catch(_){} }
function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
function sampleFrame(){return new Promise(function(resolve){if(typeof requestAnimationFrame!=='function'){resolve(0);return;}requestAnimationFrame(function(a){requestAnimationFrame(function(b){resolve(Math.max(0,b-a));});});});}
async function waitSafe(){
  while(true){
    if(document.visibilityState!=='visible'){await sleep(RETRY_MS);continue;}
    try{if(typeof input!=='undefined'&&input&&(input.active||Math.abs(input.normX)>0.02||Math.abs(input.normY)>0.02)){await sleep(RETRY_MS);continue;}}catch(_){}
    try{const d=root.KELO_MODULE_LOADER?.diagnostics?.();if(d&&Array.isArray(d.inflight)&&d.inflight.length){await sleep(RETRY_MS);continue;}}catch(_){}
    const frame=await sampleFrame();
    if(frame>FRAME_LIMIT_MS){emit('throttle',{frameMs:Math.round(frame)});await sleep(RETRY_MS);continue;}
    return frame;
  }
}
function base(src){return String(src||'').split('?')[0];}
function exists(src){const target=base(src);return Array.from(document.scripts).some(function(s){return base(s.getAttribute('src'))===target;});}
async function loadOne(src){
  if(exists(src))return true;
  await waitSafe();
  const t0=performance.now();
  const ok=await new Promise(function(resolve){const s=document.createElement('script');s.src=src;s.async=false;s.dataset.keloLiteUpgrade='1';s.onload=function(){resolve(true);};s.onerror=function(){resolve(false);};document.head.appendChild(s);});
  const ms=Math.round(performance.now()-t0);emit(ok?'file-end':'file-error',{src,ms});
  if(!ok){failed.push(src);return false;}
  await sleep(BETWEEN_MS);return true;
}
function mount(){
  if(rootEl||document.getElementById('kelo-luxe'))return;
  const style=document.createElement('style');style.id='kelo-lite-shell-style';style.textContent='#kelo-lite-shell{position:fixed;z-index:90;top:max(10px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right));display:flex;gap:8px;pointer-events:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}#kelo-lite-shell button{width:58px;height:52px;border-radius:16px;border:1px solid rgba(231,197,106,.62);background:rgba(7,18,20,.94);color:#f0d27d;font:900 9px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.08em;box-shadow:0 7px 18px rgba(0,0,0,.28);touch-action:manipulation}#kelo-lite-shell button b{display:block;font:700 20px/1 Georgia,serif;margin-bottom:4px}#kelo-lite-shell button:disabled{opacity:.55}';document.head.appendChild(style);
  rootEl=document.createElement('div');rootEl.id='kelo-lite-shell';rootEl.innerHTML='<button type="button" data-kelo-lite="menu" aria-label="Abrir menú"><b>◆</b>MENÚ</button><button type="button" data-kelo-lite="pvp" aria-label="Entrar PvP"><b>⚔</b>PVP</button>';document.body.appendChild(rootEl);
  rootEl.addEventListener('click',function(e){const b=e.target.closest('[data-kelo-lite]');if(!b)return;const action=b.getAttribute('data-kelo-lite');void (action==='pvp'?openPvp():openMenu());});
  emit('mounted',{bytesMode:'tiny-gate'});
}
function setBusy(on){if(!rootEl)return;rootEl.querySelectorAll('button').forEach(function(b){b.disabled=!!on;});}
function unmount(){rootEl?.remove();rootEl=null;document.getElementById('kelo-lite-shell-style')?.remove();}
async function upgrade(action){
  requestedAction=action||requestedAction||'menu';
  if(upgraded)return finishAction(requestedAction);
  if(upgrading)return upgrading.then(function(ok){return ok?finishAction(requestedAction):false;});
  setBusy(true);emit('upgrade-start',{action:requestedAction,files:FULL_UI.length});
  upgrading=(async function(){
    for(const src of FULL_UI){if(!await loadOne(src))return false;}
    upgraded=!!root.KELO_LUXE;
    if(upgraded){unmount();emit('upgrade-end',{ok:true});return true;}
    failed.push('KELO_LUXE_MISSING');emit('upgrade-end',{ok:false});return false;
  })().finally(function(){upgrading=null;if(!upgraded)setBusy(false);});
  const ok=await upgrading;return ok?finishAction(requestedAction):false;
}
function finishAction(action){
  if(action==='pvp'){
    const btn=document.getElementById('lx-side-pvp');if(btn){btn.click();return true;}
  }
  if(root.KELO_LUXE&&typeof root.KELO_LUXE.toggleMenu==='function'){root.KELO_LUXE.toggleMenu(true);return true;}
  return false;
}
function openMenu(){return upgrade('menu');}
function openPvp(){return upgrade('pvp');}
function getState(){return Object.freeze({version:VERSION,upgraded,upgrading:!!upgrading,failed:failed.slice(),fullUi:FULL_UI.slice(),mounted:!!rootEl});}
const api=Object.freeze({version:VERSION,upgrade,openMenu,openPvp,getState});root.KeloLiteShellGate=api;root.KELO_LITE_SHELL_GATE=api;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof globalThis!=='undefined'?globalThis:window);
