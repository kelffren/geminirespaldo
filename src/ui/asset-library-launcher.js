/* KELO-INDEX
 * area: UI / DEV TOOLS
 * owner: Kelo Asset Library Launcher
 * keys: ASSETS LIBRARY MOBILE LINK
 * purpose: small in-game entry point to the separate asset-library page.
 */
(function(root){
'use strict';
if(document.getElementById('kelo-asset-library-launcher'))return;
function mount(){
  if(document.getElementById('kelo-asset-library-launcher'))return;
  const link=document.createElement('a');
  link.id='kelo-asset-library-launcher';
  link.href='asset-library.html';link.target='_blank';link.rel='noopener';
  link.setAttribute('aria-label','Abrir Biblioteca de Assets');
  Object.assign(link.style,{position:'fixed',right:'max(10px, env(safe-area-inset-right))',top:'max(10px, env(safe-area-inset-top))',zIndex:'2147483500',display:'flex',alignItems:'center',justifyContent:'center',height:'34px',padding:'0 10px',borderRadius:'12px',border:'1px solid rgba(229,189,98,.36)',background:'rgba(8,10,14,.82)',backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)',color:'#e7c56a',textDecoration:'none',font:'800 11px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',letterSpacing:'.02em',boxShadow:'0 8px 24px rgba(0,0,0,.28)',pointerEvents:'auto'});
  function refresh(){try{const state=root.KELO_ASSET_REGISTRY?.getState?.();const off=state?.disabled?.length||0;link.textContent=off?'🧱 Assets · '+off+' off':'🧱 Assets';link.title=off?off+' paquetes desactivados':'Biblioteca de Assets';}catch(_){link.textContent='🧱 Assets';}}
  refresh();root.addEventListener('kelo:asset-selection-changed',refresh);root.addEventListener('storage',refresh);document.body.appendChild(link);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(typeof globalThis!=='undefined'?globalThis:window);
