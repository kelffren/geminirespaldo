/* KELO-INDEX
 * area: CORE / VIEWPORT CSS
 * owner: KELO_VIEWPORT
 * keys: VISUALVIEWPORT KEYBOARD SAFE-AREA RESPONSIVE CSS TOKENS MOBILE
 * purpose: publica métricas de layout/visual viewport a CSS sin tocar canvas, cámara ni gameplay
 * public-api: KELO_VIEWPORT.snapshot/sync
 * consumes: window + VisualViewport opcional
 * state-owned: último snapshot de viewport CSS
 * do-not: NO cambiar canvas.width/height, NO escribir CONFIG.zoom, NO crear loop propio
 */
(function(root){
'use strict';
if(root.KELO_VIEWPORT)return;
const VERSION='kelo-viewport-v1.0.0';
const doc=root.document;
if(!doc?.documentElement)return;
const el=doc.documentElement;
let scheduled=false;
let lastKey='';
let lastSnapshot=null;
function n(value,fallback){const x=Number(value);return Number.isFinite(x)?x:fallback;}
function read(){
  const vv=root.visualViewport||null;
  const layoutW=Math.max(1,n(root.innerWidth,390));
  const layoutH=Math.max(1,n(root.innerHeight,844));
  const visualW=Math.max(1,n(vv?.width,layoutW));
  const visualH=Math.max(1,n(vv?.height,layoutH));
  const offsetX=Math.max(0,n(vv?.offsetLeft,0));
  const offsetY=Math.max(0,n(vv?.offsetTop,0));
  const keyboardInset=Math.max(0,layoutH-visualH-offsetY);
  const orientation=layoutW>=layoutH?'landscape':'portrait';
  const shortSide=Math.min(layoutW,layoutH);
  const uiScale=Math.max(.88,Math.min(1.18,shortSide/390));
  return Object.freeze({version:VERSION,layoutW,layoutH,visualW,visualH,offsetX,offsetY,keyboardInset,orientation,uiScale,visualViewport:!!vv});
}
function apply(snapshot,source){
  const s=snapshot||read();
  const key=[s.layoutW,s.layoutH,s.visualW,s.visualH,s.offsetX,s.offsetY,s.orientation].join(':');
  el.style.setProperty('--kelo-layout-vw',s.layoutW+'px');
  el.style.setProperty('--kelo-layout-vh',s.layoutH+'px');
  el.style.setProperty('--kelo-visual-vw',s.visualW+'px');
  el.style.setProperty('--kelo-visual-vh',s.visualH+'px');
  el.style.setProperty('--kelo-visual-offset-x',s.offsetX+'px');
  el.style.setProperty('--kelo-visual-offset-y',s.offsetY+'px');
  el.style.setProperty('--kelo-keyboard-inset',s.keyboardInset+'px');
  el.style.setProperty('--kelo-ui-scale',String(s.uiScale));
  el.dataset.keloOrientation=s.orientation;
  el.dataset.keloKeyboard=s.keyboardInset>40?'open':'closed';
  lastSnapshot=s;
  if(key!==lastKey){
    lastKey=key;
    try{root.dispatchEvent(new CustomEvent('kelo:viewport-css-change',{detail:Object.freeze({...s,source:source||'sync'})}));}catch(_){}
  }
  return s;
}
function sync(source){scheduled=false;return apply(read(),source);}
function schedule(source){
  if(scheduled)return;
  scheduled=true;
  const raf=root.requestAnimationFrame||function(fn){return setTimeout(fn,16);};
  raf(function(){sync(source||'scheduled');});
}
root.addEventListener('resize',function(){schedule('window-resize');},{passive:true});
root.addEventListener('orientationchange',function(){schedule('orientationchange');},{passive:true});
if(root.visualViewport){
  root.visualViewport.addEventListener('resize',function(){schedule('visual-resize');},{passive:true});
  root.visualViewport.addEventListener('scroll',function(){schedule('visual-scroll');},{passive:true});
}
const api=Object.freeze({version:VERSION,sync:function(){return sync('api');},snapshot:function(){return lastSnapshot||read();}});
root.KELO_VIEWPORT=api;
sync('boot');
})(typeof globalThis!=='undefined'?globalThis:window);
