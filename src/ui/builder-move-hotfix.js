/* KELO-INDEX
 * area: UI
 * keys: BUILDER UNDO JOYSTICK HOTFIX
 * hace: DESHACER no tapa el joy; se oculta si el builder está cerrado
 */
(function(){
  function panelOpen(){
    const h=document.getElementById('kelo-world-builder');
    return !!(h&&(h.style.display==='flex'||getComputedStyle(h).display==='flex'));
  }
  function tick(){
    const b=document.getElementById('kelo-builder-undo');
    if(!b)return;
    b.style.left='auto';
    b.style.right='max(12px, env(safe-area-inset-right))';
    b.style.bottom='max(160px, calc(env(safe-area-inset-bottom) + 150px))';
    b.style.display=panelOpen()?'block':'none';
    const fab=document.getElementById('kelo-world-builder-fab');
    if(fab)fab.style.left='auto';
  }
  setInterval(tick,250);
})();
