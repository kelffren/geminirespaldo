/* KELO-INDEX
 * area: UI
 * keys: BUILDER INPUT POINTER JOYSTICK
 * hace: solo captura toques si el panel World Builder está VISIBLE y el target es el canvas
 * online: no persiste
 */
(function(){
  'use strict';
  window.KELO_BUILDER_OWN_INPUT=true;
  let painting=false,bound=false;
  function ui(){return window.KELO_WORLD_BUILDER_UI;}
  function host(){return document.getElementById('kelo-world-builder');}
  function panelOpen(){
    const h=host();if(!h)return false;
    const vis=h.style.display==='flex'||getComputedStyle(h).display==='flex';
    return vis;
  }
  function onCanvas(e){
    const t=e.target;
    return t&&(t.id==='game-canvas'||t.tagName==='CANVAS');
  }
  function layer(){return ui()?.guideState?.()?.layer||ui()?.layer||'terrain';}
  function world(e){
    if(typeof ui()?.toWorld==='function')return ui().toWorld(e.clientX,e.clientY);
    if(typeof screenToWorld==='function')return screenToWorld(e.clientX,e.clientY);
    const z=(typeof CONFIG!=='undefined'&&CONFIG.zoom)||1;
    return{x:camera.x+(e.clientX-screenW/2)/z,y:camera.y+(e.clientY-screenH/2)/z};
  }
  function onDown(e){
    if(!panelOpen())return;
    if(!onCanvas(e))return;
    if(ui()?.previewing)return;
    const UX=window.KELO_BUILDER_UX;
    const w=world(e),lyr=layer();
    e.preventDefault();e.stopImmediatePropagation();
    if(lyr==='objects'){
      painting=false;
      if(UX?.holding){UX.drop?.(w);return;}
      ui().objectAt?.(w);
      return;
    }
    painting=true;
    if(lyr==='terrain'||lyr==='path')ui().paintAt?.(w);
    else ui().collisionAtWorld?.(w);
  }
  function onMove(e){
    if(!panelOpen()||!painting)return;
    if(!onCanvas(e))return;
    if(layer()==='terrain'||layer()==='path')ui().paintAt?.(world(e));
  }
  function onUp(){painting=false;try{ui()?.pointerUp?.();}catch(e){}}
  function bind(){
    if(bound)return;
    document.addEventListener('pointerdown',onDown,true);
    document.addEventListener('pointermove',onMove,true);
    document.addEventListener('pointerup',onUp,true);
    document.addEventListener('pointercancel',onUp,true);
    bound=true;
  }
  bind();
  window.KELO_BUILDER_INPUT=Object.freeze({version:'builder-input-v1.2.0',owned:true,panelOpen});
})();
