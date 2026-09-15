/* KELO-INDEX
 * area: UI
 * keys: BUILDER CLOSED DEFAULT JOYSTICK PROPERTIES
 * hace: World Builder arranca CERRADO; se abre solo desde Propiedades; no roba el joy
 */
(function(){
  'use strict';
  window.KELO_BUILDER_WANT_OPEN=false;
  function hideFabs(){
    const ids=['kelo-world-builder-fab','pe-fab','kelo-builder-undo','pe-world-tools'];
    ids.forEach(id=>{const n=document.getElementById(id);if(n)n.style.display='none';});
  }
  function forceClose(){
    if(window.KELO_BUILDER_WANT_OPEN)return;
    try{window.KELO_WORLD_BUILDER_UI?.close?.(true);}catch(e){}
    const h=document.getElementById('kelo-world-builder');
    if(h){h.style.display='none';}
    document.body.classList.remove('kelo-world-building','kelo-world-previewing');
    hideFabs();
  }
  function hookOpen(){
    const UI=window.KELO_WORLD_BUILDER_UI;if(!UI||UI.__gated)return;
    const rawOpen=UI.open, rawClose=UI.close;
    window.KELO_WORLD_BUILDER_UI=Object.assign({},UI,{
      open:function(){window.KELO_BUILDER_WANT_OPEN=true;return rawOpen.apply(this,arguments);},
      close:function(){window.KELO_BUILDER_WANT_OPEN=false;return rawClose.apply(this,arguments);}
    });
    window.KELO_WORLD_BUILDER_UI.__gated=true;
  }
  function hookProperties(){
    const prev=window.openSocialTool;
    if(typeof prev!=='function'||prev.__builderGate)return;
    window.openSocialTool=function(name){
      const r=prev.apply(this,arguments);
      if(name==='properties'&&window.KELO_ADMIN_KEYS?.can?.('world.edit')){
        window.KELO_BUILDER_WANT_OPEN=true;
        try{window.KELO_WORLD_BUILDER_UI?.open?.();}catch(e){}
      }
      return r;
    };
    window.openSocialTool.__builderGate=true;
  }
  forceClose();
  const t=setInterval(()=>{hookOpen();hookProperties();if(!window.KELO_BUILDER_WANT_OPEN)forceClose();},200);
  setTimeout(()=>clearInterval(t),12000);
  document.addEventListener('DOMContentLoaded',forceClose);
})();
