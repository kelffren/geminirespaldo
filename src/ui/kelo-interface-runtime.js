/* KELO-INDEX
 * area: UI / INTERFACE RUNTIME
 * owner: Kelo Interface System
 * purpose: progressive disclosure, contextual actions and accessibility upgrades across Kelo software surfaces
 * do-not-own: feature state, gameplay state, persistence or editor mutations
 */
(function(){
'use strict';
if(window.KELO_INTERFACE_RUNTIME)return;

const VERSION='kelo-interface-runtime-v1.4.0';
const RUNTIME_STYLE_ID='kelo-interface-runtime-style';

function ensureStyle(){
  if(document.getElementById(RUNTIME_STYLE_ID))return;
  const style=document.createElement('style');
  style.id=RUNTIME_STYLE_ID;
  style.textContent=`
    #kelo-asset-repairer [data-kui-advanced="1"][hidden]{display:none!important}
    #kelo-asset-repairer .kui-more-tools{
      width:100%!important;margin-top:8px!important;border-color:transparent!important;
      background:transparent!important;color:var(--kui-text-3,#8e8e93)!important;
      box-shadow:none!important;font-weight:600!important;
    }
    #kelo-asset-repairer .kui-more-tools:hover{background:rgba(255,255,255,.045)!important;color:var(--kui-text-2,#c7c7cc)!important}
    #kelo-asset-repairer[data-kui-has-asset="false"] .kar-tool{opacity:.42}

    /* KELO-INDEX UI/IOS interaction quality: native-feeling taps, editable text and predictable disabled controls. */
    :is(#kelo-luxe,#kelo-account-auth,#kelo-creators-hub,#kelo-studio-live,#kelo-asset-repairer,#kelo-bag,#kelo-market-v1,#kelo-warehouse,#kelo-mount-panel,#kelo-commerce-dock,#kelo-commerce-modal,#kelo-house-panel) :is(button,[role="button"]){
      touch-action:manipulation;
    }
    :is(#kelo-account-auth,#kelo-studio-live,#kelo-asset-repairer,#kelo-commerce-modal,#kelo-mount-panel) :is(input,textarea){
      user-select:text!important;
      -webkit-user-select:text!important;
      caret-color:var(--kui-accent,#e7c56a);
    }
    :is(#kelo-luxe,#kelo-account-auth,#kelo-creators-hub,#kelo-studio-live,#kelo-asset-repairer,#kelo-bag,#kelo-market-v1,#kelo-warehouse,#kelo-mount-panel,#kelo-commerce-dock,#kelo-commerce-modal,#kelo-house-panel) :is(button,input,select,textarea):disabled,
    :is(#kelo-luxe,#kelo-account-auth,#kelo-creators-hub,#kelo-studio-live,#kelo-asset-repairer,#kelo-bag,#kelo-market-v1,#kelo-warehouse,#kelo-mount-panel,#kelo-commerce-dock,#kelo-commerce-modal,#kelo-house-panel) [aria-disabled="true"]{
      opacity:.42!important;
      cursor:default!important;
      transform:none!important;
      box-shadow:none!important;
      filter:saturate(.65);
    }

    @media(max-width:700px){
      #kelo-asset-repairer .kui-more-tools{grid-column:1/-1}
      /* iOS Safari auto-zooms focused form fields below 16px; keep forms stable like a native app. */
      #kelo-account-auth :is(input,textarea,select),
      #kelo-studio-live :is(input,textarea,select),
      #kelo-asset-repairer :is(input,textarea,select),
      #kelo-commerce-modal :is(input,textarea,select),
      #kelo-mount-panel :is(input,textarea,select){font-size:16px!important}
      #kelo-account-auth,#kelo-commerce-modal{
        padding-top:max(12px,env(safe-area-inset-top))!important;
        padding-bottom:max(12px,env(safe-area-inset-bottom))!important;
        padding-left:max(12px,env(safe-area-inset-left))!important;
        padding-right:max(12px,env(safe-area-inset-right))!important;
      }
    }
  `;
  document.head.appendChild(style);
}

function text(el,value){if(el&&el.textContent!==value)el.textContent=value;}
function aria(el,label){if(el&&!el.getAttribute('aria-label'))el.setAttribute('aria-label',label);}
function relabel(button,map){
  if(!button)return;
  const raw=button.textContent?.trim()||'';
  const next=map[raw];
  if(next)text(button,next);
  const label=(next||button.textContent||'').trim();
  if(label)aria(button,label);
}
function relabelAll(host,selector,map){host?.querySelectorAll(selector).forEach(button=>relabel(button,map));}

function enhanceLuxe(host){
  if(!host)return;
  const heading=host.querySelector('.lx-menu-head');
  if(heading&&heading.childNodes.length)heading.childNodes[0].textContent='Menu';
  aria(host.querySelector('.lx-menu-close'),'Cerrar menú');
  host.querySelectorAll('.lx-menu-item').forEach(button=>{
    const label=button.querySelector('.lx-menu-copy b')?.textContent?.trim();
    if(label)aria(button,label);
  });
}

function enhanceAccount(host){
  if(!host)return;
  host.querySelectorAll('button').forEach(button=>{
    const label=button.textContent?.trim();
    if(label)aria(button,label);
  });
}

function enhanceCreators(host){
  if(!host)return;
  aria(host.querySelector('.kc-close'),'Cerrar Kelo Creators');
  host.querySelectorAll('.kc-nav button,.kc-card').forEach(button=>{
    const label=button.querySelector('strong')?.textContent?.trim()||button.textContent?.trim();
    if(label)aria(button,label);
  });
}

function enhanceStudio(host){
  if(!host)return;
  host.querySelectorAll('button').forEach(button=>{
    const action=button.dataset?.act;
    if(action==='close')aria(button,'Cerrar Studio');
    else if(action==='save')aria(button,'Guardar cambios');
    else if(action==='undo')aria(button,'Deshacer');
    else if(action==='redo')aria(button,'Rehacer');
  });
}

function setAdvanced(host,open){
  host.dataset.kuiAdvanced=open?'true':'false';
  host.querySelectorAll('[data-kui-advanced="1"]').forEach(button=>{button.hidden=!open;});
  const toggle=host.querySelector('[data-kui-more-tools]');
  if(toggle){
    toggle.setAttribute('aria-expanded',open?'true':'false');
    toggle.textContent=open?'Hide Tools':'More Tools';
  }
}

function syncAssetRepairer(host){
  if(!host)return;
  const exportButton=host.querySelector('[data-act="export"]');
  const hasAsset=Boolean(exportButton&&!exportButton.disabled);
  host.dataset.kuiHasAsset=hasAsset?'true':'false';
  host.querySelectorAll('[data-tool]').forEach(button=>{button.disabled=!hasAsset;});
  const reset=host.querySelector('[data-act="reset"]');
  const undo=host.querySelector('[data-act="undo"]');
  if(reset)reset.disabled=!hasAsset;
  if(undo)undo.disabled=!hasAsset;
}

function enhanceAssetRepairer(host){
  if(!host)return;
  if(host.dataset.kuiEnhanced!=='true'){
    host.dataset.kuiEnhanced='true';
    text(host.querySelector('.kar-title small'),'Clean, align and export assets');
    text(host.querySelector('.kar-stage-head h2'),'Preview');
    text(host.querySelector('.kar-kicker'),'Repair');
    const steps=[...host.querySelectorAll('.kar-step span')];
    ['Import','Repair','Review','Export'].forEach((label,index)=>text(steps[index],label));

    const open=host.querySelector('[data-act="open"]');
    if(open){text(open,'Open Asset');aria(open,'Open asset');}
    const reset=host.querySelector('[data-act="reset"]');
    if(reset){text(reset,'Reset');aria(reset,'Reset current asset');}
    const undo=host.querySelector('[data-act="undo"]');
    if(undo){text(undo,'Undo');aria(undo,'Undo last repair');}
    const exportButton=host.querySelector('[data-act="export"]');
    if(exportButton){text(exportButton,'Export PNG');aria(exportButton,'Export repaired PNG');}
    aria(host.querySelector('[data-repair-close]'),'Close Asset Repairer');

    const auto=host.querySelector('[data-tool="auto"]');
    if(auto){
      text(auto.querySelector('strong'),'Auto Repair');
      text(auto.querySelector('small'),'Recommended');
      auto.dataset.kuiRole='primary';
      aria(auto,'Automatically repair the current asset');
    }
    const align=host.querySelector('[data-tool="align"]');
    if(align){
      text(align.querySelector('strong'),'Align Frames');
      text(align.querySelector('small'),'Lock animation to feet');
      aria(align,'Align animation frames to a shared feet anchor');
    }
    for(const tool of ['background','edges','pivot','scale','seams']){
      const button=host.querySelector(`[data-tool="${tool}"]`);
      if(button)button.dataset.kuiAdvanced='1';
    }
    const tools=host.querySelector('.kar-tools');
    if(tools&&!tools.querySelector('[data-kui-more-tools]')){
      const more=document.createElement('button');
      more.type='button';
      more.className='kar-btn kui-more-tools';
      more.dataset.kuiMoreTools='1';
      more.setAttribute('aria-expanded','false');
      more.setAttribute('aria-label','Show advanced repair tools');
      more.textContent='More Tools';
      more.addEventListener('click',()=>setAdvanced(host,host.dataset.kuiAdvanced!=='true'));
      tools.appendChild(more);
    }
    setAdvanced(host,false);
  }
  syncAssetRepairer(host);
}

const BAG_LABELS=Object.freeze({
  '⚔ EQUIPO':'⚔ Equipo','♟ APARIENCIA':'♟ Apariencia','☰ ORGANIZAR':'Organizar',
  'DESEQUIPAR':'Desequipar','EQUIPAR':'Equipar','MOVER':'Mover','CANCELAR MOVER':'Cancelar',
  'DIVIDIR':'Dividir','CANCELAR DIVIDIR':'Cancelar','DESCARTAR':'Descartar','CANCELAR':'Cancelar',
  'SEPARAR':'Separar','CONFIRMAR DESCARTE':'Descartar definitivamente','RESTABLECER HABILIDADES':'Restablecer habilidades'
});
function enhanceBackpack(host){
  if(!host)return;
  aria(host.querySelector('.kb-close'),'Cerrar Mochila');
  relabelAll(host,'.kb-main-tab,.kb-sort,.kb-action',BAG_LABELS);
  const filters={all:'Todo',consumables:'Consumibles',materials:'Materiales',missions:'Misiones',others:'Otros'};
  host.querySelectorAll('.kb-category[data-filter]').forEach(button=>{const label=filters[button.dataset.filter];if(label)text(button,label);aria(button,label||button.textContent?.trim());});
  host.querySelectorAll('.kb-card-title').forEach(title=>{
    if(title.textContent==='ATRIBUTOS')text(title,'Atributos');
    else if(title.textContent==='APARIENCIA')text(title,'Apariencia');
    else if(title.textContent?.startsWith('HABILIDADES DEL ARMA · '))text(title,title.textContent.replace('HABILIDADES DEL ARMA · ','Habilidades del arma · '));
  });
}

function enhanceMarket(host){
  if(!host)return;
  text(host.querySelector('.km-title'),'Mercado');
  aria(host.querySelector('.km-close'),'Cerrar Mercado');
  const browse=host.querySelector('.km-tab[data-tab="browse"]');
  if(browse)text(browse,'Explorar');
  const mine=host.querySelector('.km-tab[data-tab="mine"]');
  if(mine){const count=mine.textContent?.match(/\((\d+)\)/)?.[1];text(mine,`Mis publicaciones${count?` (${count})`:''}`);}
  relabelAll(host,'.km-cancel',{'CANCELAR PUBLICACIÓN':'Cancelar publicación'});
  host.querySelectorAll('button').forEach(button=>aria(button,button.textContent?.trim()));
}

function enhanceWarehouse(host){
  if(!host)return;
  text(host.querySelector('.kw-title'),'Almacén');
  aria(host.querySelector('.kw-close'),'Cerrar Almacén');
  const backpack=host.querySelector('.kw-tab[data-c="backpack"]');
  const warehouse=host.querySelector('.kw-tab[data-c="warehouse"]');
  if(backpack)text(backpack,'Mochila');
  if(warehouse)text(warehouse,'Almacén');
  relabelAll(host,'.kw-go',{'TRANSFERIR':'Transferir'});
  host.querySelectorAll('button').forEach(button=>aria(button,button.textContent?.trim()));
}

const MOUNT_LABELS=Object.freeze({'EQUIPAR':'Equipar','MONTAR':'Montar','DESMONTAR':'Desmontar'});
function enhanceMount(host){
  if(!host)return;
  const heading=host.firstElementChild?.querySelector?.('b');
  if(heading?.textContent==='MONTURAS')text(heading,'Monturas');
  host.querySelectorAll('button').forEach(button=>{
    const raw=button.textContent?.trim()||'';
    if(raw==='MONTAR')button.dataset.kuiRole='primary';
    relabel(button,MOUNT_LABELS);
    if(raw==='✕')aria(button,'Cerrar Monturas');
  });
  host.querySelectorAll('select').forEach(select=>{
    if(!select.getAttribute('aria-label')){
      const label=select.closest('div')?.querySelector('span,b')?.textContent?.trim();
      if(label)select.setAttribute('aria-label',label);
    }
  });
}

const COMMERCE_LABELS=Object.freeze({
  'MERCADO':'Mercado','MI PUESTO':'Mi puesto','TRADE DEMO':'Intercambio','SALIR':'Salir',
  'COMPRAR':'Comprar','PUBLICAR':'Publicar','CANCELAR':'Cancelar','ACEPTAR':'Aceptar','RECHAZAR':'Rechazar',
  'LISTO':'Listo','CONFIRMAR':'Confirmar','CANCELAR TRADE':'Cancelar intercambio'
});
function enhanceCommerce(dock,modal){
  if(dock)relabelAll(dock,'button',COMMERCE_LABELS);
  if(!modal)return;
  aria(modal.querySelector('.kc-close'),'Cerrar Comercio');
  relabelAll(modal,'button',COMMERCE_LABELS);
  modal.querySelectorAll('button').forEach(button=>aria(button,button.textContent?.trim()));
}

function enhanceHouse(host,exit){
  if(host){
    text(host.querySelector('.hi-title'),'Mi propiedad');
    aria(host.querySelector('.hi-close'),'Cerrar Propiedad');
    relabel(host.querySelector('#hi-enter'),{'ENTRAR A MI CASA':'Entrar a mi casa'});
    relabel(host.querySelector('#hi-exterior'),{'PARCELA EXTERIOR':'Parcela exterior'});
    relabel(host.querySelector('#hi-test'),{'ASSETS DE PRUEBA':'Assets de prueba'});
  }
  if(exit){text(exit,'Salir de casa');aria(exit,'Salir de casa');}
}

let disposed=false;
let scanPending=false;
let scanFrame=0;
let scanRuns=0;
let observerCallbacks=0;

function scan(root=document){
  if(disposed)return;
  scanRuns++;
  ensureStyle();
  enhanceLuxe(root.querySelector?.('#kelo-luxe'));
  enhanceAccount(root.querySelector?.('#kelo-account-auth'));
  enhanceCreators(root.querySelector?.('#kelo-creators-hub'));
  enhanceStudio(root.querySelector?.('#kelo-studio-live'));
  enhanceAssetRepairer(root.querySelector?.('#kelo-asset-repairer'));
  enhanceBackpack(root.querySelector?.('#kelo-bag'));
  enhanceMarket(root.querySelector?.('#kelo-market-v1'));
  enhanceWarehouse(root.querySelector?.('#kelo-warehouse'));
  enhanceMount(root.querySelector?.('#kelo-mount-panel'));
  enhanceCommerce(root.querySelector?.('#kelo-commerce-dock'),root.querySelector?.('#kelo-commerce-modal'));
  enhanceHouse(root.querySelector?.('#kelo-house-panel'),root.querySelector?.('#hi-exit'));
}

function scheduleScan(){
  observerCallbacks++;
  if(disposed||scanPending)return;
  scanPending=true;
  const run=()=>{
    scanPending=false;
    scanFrame=0;
    if(!disposed)scan(document);
  };
  if(typeof requestAnimationFrame==='function')scanFrame=requestAnimationFrame(run);
  else Promise.resolve().then(run);
}

const observer=new MutationObserver(scheduleScan);
observer.observe(document.documentElement,{childList:true,subtree:true});
scan(document);

window.KELO_INTERFACE_RUNTIME=Object.freeze({
  version:VERSION,
  scan:()=>scan(document),
  snapshot:()=>Object.freeze({version:VERSION,scanRuns,observerCallbacks,scanPending}),
  destroy(){
    disposed=true;
    observer.disconnect();
    if(scanFrame&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(scanFrame);
    scanFrame=0;
    scanPending=false;
    document.getElementById(RUNTIME_STYLE_ID)?.remove();
    delete window.KELO_INTERFACE_RUNTIME;
  }
});
})();
