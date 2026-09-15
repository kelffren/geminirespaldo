/* KELO-INDEX
 * area: UI
 * keys: MAP EDITOR DOCK COMPACT DEDUPE WORLD BUILDER
 * hace: no duplica el World Builder; encoge EDITOR DE MAPA y esconde el FAB doble
 * online: no muta mundo
 */
(function(){
  'use strict';
  function toast(msg){if(typeof showToast==='function')showToast(msg);}
  function pe(){return document.getElementById('kelo-property-editor');}
  function wb(){return document.getElementById('kelo-world-builder');}
  function injectStyle(){
    if(document.getElementById('pe-dock-style'))return;
    const st=document.createElement('style');st.id='pe-dock-style';
    st.textContent=`
      #kelo-property-editor.pe-compact{
        top:auto!important;left:max(8px,env(safe-area-inset-left))!important;
        right:max(8px,env(safe-area-inset-right))!important;
        bottom:max(8px,env(safe-area-inset-bottom))!important;
        width:auto!important;height:auto!important;max-height:118px!important;
      }
      #kelo-property-editor.pe-compact .pe-tabs,
      #kelo-property-editor.pe-compact .pe-info,
      #kelo-property-editor.pe-compact .pe-toolbar,
      #kelo-property-editor.pe-compact .pe-search,
      #kelo-property-editor.pe-compact .pe-placed,
      #kelo-property-editor.pe-compact .pe-list,
      #kelo-property-editor.pe-compact .pe-hint,
      #kelo-property-editor.pe-compact #pe-world-tools{display:none!important}
      #pe-fab{display:none!important}
      #pe-world-tools{display:none!important}
      #kelo-world-builder.wb-compact{
        top:auto!important;height:auto!important;max-height:128px!important;
        bottom:max(8px,env(safe-area-inset-bottom))!important;
      }
      #kelo-world-builder.wb-compact .wb-workflow,
      #kelo-world-builder.wb-compact .wb-list,
      #kelo-world-builder.wb-compact .wb-history,
      #kelo-world-builder.wb-compact .wb-footer{display:none!important}
    `;
    document.head.appendChild(st);
  }
  function compactPe(on){
    const h=pe();if(!h)return;
    h.classList.toggle('pe-compact',!!on);
    const b=document.getElementById('pe-expand');
    if(b)b.textContent=on?'CATÁLOGO':'MAPA';
  }
  function compactWb(on){
    const h=wb();if(!h)return;
    h.classList.toggle('wb-compact',!!on);
  }
  function ensurePeButton(){
    const h=pe();if(!h)return;
    const head=h.querySelector('.pe-head');
    if(head&&!document.getElementById('pe-expand')){
      const b=document.createElement('button');b.className='pe-icon';b.id='pe-expand';b.textContent='MAPA';
      b.onclick=()=>compactPe(!h.classList.contains('pe-compact'));
      head.insertBefore(b,document.getElementById('pe-close'));
    }
    h.querySelector('#pe-list')?.addEventListener('click',e=>{if(e.target.closest('.pe-card'))compactPe(true);});
    const tools=document.getElementById('pe-world-tools');if(tools)tools.remove();
  }
  function ensureWbButton(){
    const h=wb();if(!h||document.getElementById('wb-dock'))return;
    const head=h.querySelector('.wb-head')||h.firstElementChild;
    if(!head)return;
    const b=document.createElement('button');b.id='wb-dock';b.textContent='MAPA';
    b.style.cssText='margin-left:auto;border:1px solid rgba(231,197,106,.3);background:#101b1e;color:#e7c56a;border-radius:10px;padding:6px 10px;font-weight:900;font-size:10px';
    b.onclick=()=>{const on=!h.classList.contains('wb-compact');compactWb(on);b.textContent=on?'PANEL':'MAPA';};
    head.appendChild(b);
  }
  function hideDupFab(){
    const f=document.getElementById('pe-fab');if(f)f.style.display='none';
  }
  function tick(){
    injectStyle();hideDupFab();ensurePeButton();ensureWbButton();
  }
  const t=setInterval(tick,200);
  setTimeout(()=>clearInterval(t),20000);
  document.addEventListener('click',e=>{
    if(e.target.closest('.pe-card'))compactPe(true);
    if(e.target.closest('[data-wb-layer],#wb-controls button'))compactWb(true);
  },true);
  window.KELO_EDITOR_DOCK=Object.freeze({version:'editor-dock-v1.0.0',compactPe,compactWb});
})();
