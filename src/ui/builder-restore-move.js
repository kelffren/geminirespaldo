/* KELO-INDEX
 * area: UI
 * keys: JOYSTICK RESTORE POINTER CAPTURE
 * hace: si el builder no está pedido, recupera el joy y corta a los listeners del editor
 */
(function(){
  'use strict';
  function editing(){
    const h=document.getElementById('kelo-world-builder');
    const vis=h&&(h.style.display==='flex'||(h.offsetParent!==null&&getComputedStyle(h).display==='flex'));
    return !!(window.KELO_BUILDER_WANT_OPEN&&vis);
  }
  function onCanvas(e){
    const t=e.target;
    return t&&(t.id==='game-canvas'||t.tagName==='CANVAS');
  }
  function down(e){
    window.KELO_MODAL_INPUT_LOCK=false;
    try{if(typeof isBuildMode!=='undefined')isBuildMode=false;}catch(err){}
    if(editing())return;
    if(!onCanvas(e))return;
    if(typeof input==='undefined')return;
    input.touchActive=true;
    input.touchId=e.pointerId;
    input.originX=e.clientX;input.originY=e.clientY;
    input.currentX=e.clientX;input.currentY=e.clientY;
    e.stopImmediatePropagation();
  }
  function move(e){
    if(editing())return;
    if(typeof input==='undefined'||!input.touchActive||e.pointerId!==input.touchId)return;
    input.currentX=e.clientX;input.currentY=e.clientY;
    e.stopImmediatePropagation();
  }
  function up(e){
    if(typeof input==='undefined')return;
    if(e.pointerId!==input.touchId)return;
    input.touchActive=false;input.touchId=null;input.normX=0;input.normY=0;
    if(!editing())e.stopImmediatePropagation();
  }
  window.addEventListener('pointerdown',down,true);
  window.addEventListener('pointermove',move,true);
  window.addEventListener('pointerup',up,true);
  window.addEventListener('pointercancel',up,true);
  setInterval(function(){
    window.KELO_MODAL_INPUT_LOCK=false;
    try{if(typeof isBuildMode!=='undefined')isBuildMode=false;}catch(e){}
    if(!window.KELO_BUILDER_WANT_OPEN){
      const h=document.getElementById('kelo-world-builder');
      if(h)h.style.display='none';
      document.body.classList.remove('kelo-world-building','kelo-property-editing');
      try{window.KELO_PROPERTY_EDITOR?.close?.();}catch(err){}
    }
  },300);
})();
