/* KELO-INDEX
 * area: STUDIO / INPUT / QUICK ACTIONS
 * owner: Kelo Studio Quick Actions
 * keys: SELECTION NAVIGATION MOBILE SHORTCUTS GRID WORKSPACE PLAYTEST SAVE TOUCH DOCK SNAP ZOOM BRUSH CONTEXT STATE
 * owns: local selection accelerators and delegation to existing Studio UI actions
 * does-not-own: document mutation, CommandBus, authority, camera math or tool internals
 * online: no direct writes; persistent actions click/change the existing Studio controls so their CommandBus/authority path remains canonical
 */

const EDITABLE='input,textarea,select,[contenteditable="true"]';
const rootNode=root=>root.document?.querySelector?.('#kelo-studio-live')||null;
const q=(root,selector)=>rootNode(root)?.querySelector?.(selector)||null;
const click=(root,selector)=>{const el=q(root,selector);if(!el||el.disabled)return false;el.click();return true;};
const change=(root,selector,value)=>{const el=q(root,selector);if(!el||el.disabled)return false;el.value=String(value);el.dispatchEvent(new Event('change',{bubbles:true}));return true;};
const handled=e=>{e.preventDefault?.();e.stopImmediatePropagation?.();};

export function createStudioQuickActionsController({root=globalThis,kernel,assetPalette}={}){
  if(!root?.document||!kernel?.selection)return Object.freeze({destroy(){}});
  const document=root.document;
  let destroyed=false,observer=null,stateObserver=null,bar=null,style=null,mobileDock=null,mobileMore=null,outsideHandler=null,stateHandler=null,unsubscribeSelection=()=>{},deleteArmedUntil=0;
  const ids=()=>kernel.document?.entities?.map?.(e=>String(e.id))||[];
  const selected=()=>kernel.selection.get().map(String);
  const pulse=()=>{try{root.navigator?.vibrate?.(8);}catch{}};
  const setSelection=list=>kernel.selection.set(Array.from(new Set(list.map(String))));
  const selectAll=()=>{const all=ids();setSelection(all);return all.length;};
  const invertSelection=()=>{const current=new Set(selected()),next=ids().filter(id=>!current.has(id));setSelection(next);return next.length;};
  const clearSelection=()=>{if(!selected().length)return false;kernel.selection.clear();return true;};
  function cycleSelection(direction=1){const all=ids();if(!all.length)return false;const current=selected(),anchor=current[current.length-1];let index=all.indexOf(anchor);if(index<0)index=direction>0?-1:0;index=(index+direction+all.length)%all.length;kernel.selection.set(all[index]);return all[index];}
  function openMobilePane(name){const shell=rootNode(root);if(!shell)return false;shell.dataset.sheetOpen='1';shell.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('on',el.dataset.tab===name));shell.querySelectorAll('[data-pane]').forEach(el=>el.classList.toggle('on',el.dataset.pane===name));return true;}
  function closeMobileSheet(){const shell=rootNode(root);if(!shell)return false;shell.dataset.sheetOpen='0';document.activeElement?.blur?.();return true;}
  function focusAssetSearch(){try{assetPalette?.open?.();}catch{}openMobilePane('assets');const shell=rootNode(root),input=shell?.querySelector('.ks-asset-search-mobile')||shell?.querySelector('.ks-asset-search');if(!input)return false;input.focus();input.select?.();return true;}
  function clearAssetSearch(){const shell=rootNode(root);if(!shell)return false;let changed=false;shell.querySelectorAll('.ks-asset-search,.ks-asset-search-mobile').forEach(input=>{if(input.value){input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));changed=true;}});return changed;}
  function scrollTop(selector){const el=q(root,selector);if(!el)return false;el.scrollTo?.({top:0,behavior:'smooth'});if(!el.scrollTo)el.scrollTop=0;return true;}
  function mode(name){return name==='camera'?click(root,'[data-ext="camera"]'):click(root,`[data-mode="${name}"]`);}
  const snap=value=>change(root,'[data-ext="snap"]',value);
  const brush=value=>change(root,'[data-act="brush-size"]',value);
  function toggleMore(force){if(!mobileMore)return false;const open=typeof force==='boolean'?force:mobileMore.dataset.open!=='1';mobileMore.dataset.open=open?'1':'0';mobileMore.hidden=!open;return open;}
  function safeDelete(){const now=Date.now();if(now<deleteArmedUntil){deleteArmedUntil=0;return click(root,'[data-act="delete"]');}deleteArmedUntil=now+1800;const b=mobileMore?.querySelector('[data-mobile-quick="delete"]');if(b){b.dataset.armed='1';const old=b.querySelector('small');if(old)old.textContent='TOCA OTRA VEZ';setTimeout(()=>{if(Date.now()>=deleteArmedUntil){deleteArmedUntil=0;b.dataset.armed='0';if(old)old.textContent='BORRAR';}},1850);}return true;}

  const actions=Object.freeze({
    undo:()=>click(root,'[data-act="undo"]'), redo:()=>click(root,'[data-act="redo"]'), duplicate:()=>click(root,'[data-act="duplicate"]'), focus:()=>click(root,'[data-act="focus"]'), save:()=>click(root,'[data-act="save"]'),
    play:()=>click(root,'[data-act="play"]'), grid:()=>click(root,'[data-ext="grid"]'), assets:()=>click(root,'[data-act="edit-assets"]'), search:focusAssetSearch, explorer:()=>openMobilePane('explorer'),
    properties:()=>openMobilePane('properties'), rotate:()=>click(root,'[data-act="rotate"]'), scaleDown:()=>click(root,'[data-act="scale-down"]'), scaleReset:()=>click(root,'[data-act="scale-reset"]'), scaleUp:()=>click(root,'[data-act="scale-up"]'),
    select:()=>mode('select'), move:()=>mode('move'), terrain:()=>mode('terrain'), path:()=>mode('path'), collision:()=>mode('collision'), erase:()=>click(root,'[data-act="erase"]'), clear:clearSelection, delete:safeDelete,
    all:selectAll, invert:invertSelection, prev:()=>cycleSelection(-1), next:()=>cycleSelection(1), snap1:()=>snap(1), snap8:()=>snap(8), snap16:()=>snap(16), snap32:()=>snap(32), snap64:()=>snap(64),
    zoomOut:()=>click(root,'[data-ext="zoom-out"]'), zoomReset:()=>click(root,'[data-ext="zoom-reset"]'), zoomIn:()=>click(root,'[data-ext="zoom-in"]'), camera:()=>click(root,'[data-ext="camera"]'), minimize:()=>click(root,'[data-studio-minimize="1"]'),
    copy:()=>click(root,'[data-ext="copy"]'), paste:()=>click(root,'[data-ext="paste"]'), prefab:()=>click(root,'[data-ext="prefab"]'), check:()=>click(root,'[data-ext="check"]'), brush1:()=>brush(1), brush2:()=>brush(2), brush3:()=>brush(3), brush5:()=>brush(5),
    close:closeMobileSheet, clearSearch:clearAssetSearch, assetsTop:()=>scrollTop('.ks-mobile-pane.assets-pane .ks-assets'), explorerTop:()=>scrollTop('[data-pane="explorer"] .ks-explorer'), more:()=>toggleMore()
  });

  const ACTION_META=[
    ['undo','↶','UNDO'],['redo','↷','REDO'],['duplicate','⧉','DUP'],['focus','◎','FOCUS'],['save','▣','SAVE'],['play','▶','PLAY'],['grid','▦','GRID'],['assets','▦','ASSETS'],['search','⌕','BUSCAR'],['explorer','☷','EXPLORER'],
    ['properties','⚙','PROPS'],['rotate','⟳','ROTAR'],['scaleDown','−','ESCALA−'],['scaleReset','100','RESET'],['scaleUp','＋','ESCALA+'],['select','↖','SELECT'],['move','✥','MOVE'],['terrain','▦','GROUND'],['path','⌁','ROAD'],['collision','◇','COLLISION'],
    ['erase','⌫','ERASE'],['clear','○','CLEAR'],['delete','⌫','BORRAR'],['all','◎','TODOS'],['invert','◐','INVERTIR'],['prev','‹','ANTERIOR'],['next','›','SIGUIENTE'],['snap1','1','FREE'],['snap8','8','SNAP'],['snap16','16','SNAP'],
    ['snap32','32','SNAP'],['snap64','64','SNAP'],['zoomOut','−','ZOOM'],['zoomReset','100','ZOOM'],['zoomIn','＋','ZOOM'],['camera','⌖','CAMERA'],['minimize','—','MINIMIZAR'],['copy','⧉','COPY'],['paste','▤','PASTE'],['prefab','▱','PREFAB'],
    ['check','✓','CHECK'],['brush1','1','BRUSH'],['brush2','2','BRUSH'],['brush3','3','BRUSH'],['brush5','5','BRUSH'],['close','⌄','CERRAR'],['clearSearch','×','LIMPIAR BUSQ.'],['assetsTop','⇡','ASSETS TOP'],['explorerTop','⇡','EXPLORER TOP'],['more','•••','MÁS']
  ];

  const CANONICAL=Object.freeze({undo:'[data-act="undo"]',redo:'[data-act="redo"]',duplicate:'[data-act="duplicate"]',focus:'[data-act="focus"]',save:'[data-act="save"]',play:'[data-act="play"]',grid:'[data-ext="grid"]',assets:'[data-act="edit-assets"]',rotate:'[data-act="rotate"]',scaleDown:'[data-act="scale-down"]',scaleReset:'[data-act="scale-reset"]',scaleUp:'[data-act="scale-up"]',erase:'[data-act="erase"]',delete:'[data-act="delete"]',zoomOut:'[data-ext="zoom-out"]',zoomReset:'[data-ext="zoom-reset"]',zoomIn:'[data-ext="zoom-in"]',camera:'[data-ext="camera"]',minimize:'[data-studio-minimize="1"]',copy:'[data-ext="copy"]',paste:'[data-ext="paste"]',prefab:'[data-ext="prefab"]',check:'[data-ext="check"]'});
  function mobileButtons(id){return rootNode(root)?.querySelectorAll?.(`[data-mobile-quick="${id}"]`)||[];}
  function setButtonState(id,{disabled=false,active=false}={}){
    for(const b of mobileButtons(id)){
      const nextDisabled=!!disabled,nextActive=!!active,nextPressed=nextActive?'true':'false';
      if(b.disabled!==nextDisabled)b.disabled=nextDisabled;
      if(b.classList.contains('active')!==nextActive)b.classList.toggle('active',nextActive);
      if(b.getAttribute('aria-pressed')!==nextPressed)b.setAttribute('aria-pressed',nextPressed);
    }
  }
  function syncMobileState(){
    const shell=rootNode(root);if(!shell)return false;
    const count=selected().length,total=ids().length;
    for(const [id,selector] of Object.entries(CANONICAL)){const source=q(root,selector);setButtonState(id,{disabled:!!source?.disabled,active:!!source?.classList?.contains('on')});}
    for(const id of ['clear','delete','duplicate','focus','rotate','scaleDown','scaleReset','scaleUp','copy','prefab'])setButtonState(id,{disabled:count===0});
    setButtonState('all',{disabled:total===0||count===total});setButtonState('invert',{disabled:total===0});setButtonState('prev',{disabled:total<2});setButtonState('next',{disabled:total<2});
    const tool=String(shell.dataset.activeTool||'');for(const id of ['select','move','terrain','path','collision'])setButtonState(id,{active:tool===id});
    const snapValue=String(q(root,'[data-ext="snap"]')?.value||'');for(const value of [1,8,16,32,64])setButtonState(`snap${value}`,{active:snapValue===String(value)});
    const brushValue=String(q(root,'[data-act="brush-size"]')?.value||'');for(const value of [1,2,3,5])setButtonState(`brush${value}`,{active:brushValue===String(value)});
    const sheetOpen=shell.dataset.sheetOpen==='1';for(const pane of ['assets','explorer','properties'])setButtonState(pane,{active:sheetOpen&&!!shell.querySelector(`[data-pane="${pane}"].on`)});
    return true;
  }

  function onMobileAction(e){const act=e.target?.closest?.('[data-mobile-quick]')?.dataset.mobileQuick;if(!act||!actions[act]||e.target?.closest?.('button')?.disabled)return;pulse();actions[act]();queueMicrotask(syncMobileState);if(act!=='more'&&act!=='delete'&&mobileMore?.dataset.open==='1'&&!['snap1','snap8','snap16','snap32','snap64','brush1','brush2','brush3','brush5','zoomOut','zoomIn'].includes(act))toggleMore(false);}
  function onKey(e){if(destroyed||e.defaultPrevented||e.repeat||e.target?.closest?.(EDITABLE))return;const k=String(e.key||'').toLowerCase(),mod=!!(e.metaKey||e.ctrlKey);if(mod&&k==='a'){handled(e);e.shiftKey?invertSelection():selectAll();return;}if(k==='escape'&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&selected().length){handled(e);clearSelection();return;}if(k==='tab'&&!e.metaKey&&!e.ctrlKey&&!e.altKey){handled(e);cycleSelection(e.shiftKey?-1:1);return;}if(k==='/'&&!mod&&!e.altKey){handled(e);focusAssetSearch();return;}if(k==='g'&&e.shiftKey&&!mod&&!e.altKey){handled(e);actions.grid();return;}if(k==='m'&&!mod&&!e.altKey){handled(e);actions.minimize();return;}if(k==='enter'&&mod){handled(e);actions.save();return;}if(k==='p'&&e.shiftKey&&!mod&&!e.altKey){handled(e);actions.play();return;}if(/^[1-6]$/.test(k)&&!mod&&!e.altKey&&!e.shiftKey){handled(e);['','select','move','terrain','path','collision','camera'][Number(k)]&&mode(['','select','move','terrain','path','collision','camera'][Number(k)]);}}

  function mount(){if(destroyed)return;const shell=rootNode(root),slot=shell?.querySelector('.ks-productivity-edit-slot');if(!shell)return;if(!style){style=document.createElement('style');style.dataset.keloStudioQuickActions='1';style.textContent=`
    #kelo-studio-live .ks-quick-select{display:inline-flex;gap:4px;align-items:center}#kelo-studio-live .ks-quick-select button{min-width:44px;min-height:36px;border:1px solid rgba(231,197,106,.22);border-radius:10px;background:#101b1e;color:#dce6e0;font-size:6.5px;font-weight:900;padding:0 7px}.ks-mobile-quick-dock,.ks-mobile-quick-more{display:none}
    @media(max-width:760px){#kelo-studio-live .ks-quick-select button{min-width:44px;min-height:44px}#kelo-studio-live .ks-mobile-quick-dock{display:grid;position:absolute;left:8px;right:8px;bottom:calc(max(6px,env(safe-area-inset-bottom)) + 60px);grid-template-columns:repeat(5,1fr);gap:5px;padding:6px;border:1px solid rgba(231,197,106,.36);border-radius:16px;background:rgba(5,14,16,.96);pointer-events:auto;z-index:8;box-shadow:0 12px 34px rgba(0,0,0,.48);backdrop-filter:blur(14px)}#kelo-studio-live .ks-mobile-quick-dock button,#kelo-studio-live .ks-mobile-quick-more button{min-height:48px;border:1px solid rgba(231,197,106,.24);border-radius:12px;background:#102022;color:#fff0b2;font-size:18px;font-weight:900;-webkit-tap-highlight-color:transparent;touch-action:manipulation}#kelo-studio-live .ks-mobile-quick-dock button:disabled,#kelo-studio-live .ks-mobile-quick-more button:disabled{opacity:.28;filter:saturate(.35);pointer-events:none}#kelo-studio-live .ks-mobile-quick-dock button.active,#kelo-studio-live .ks-mobile-quick-more button.active{border-color:#e7c56a;background:linear-gradient(180deg,#29493c,#1d372f);box-shadow:0 0 0 1px rgba(231,197,106,.12),0 0 14px rgba(231,197,106,.1)}#kelo-studio-live .ks-mobile-quick-dock small,#kelo-studio-live .ks-mobile-quick-more small{display:block;font-size:5.5px;letter-spacing:.05em;margin-top:2px;color:#9db4aa}#kelo-studio-live .ks-mobile-quick-more{display:block;position:absolute;left:8px;right:8px;bottom:calc(max(6px,env(safe-area-inset-bottom)) + 122px);max-height:min(58vh,520px);overflow:auto;overscroll-behavior:contain;padding:8px;border:1px solid rgba(231,197,106,.5);border-radius:17px;background:rgba(5,14,16,.985);pointer-events:auto;z-index:9;box-shadow:0 18px 50px rgba(0,0,0,.6)}#kelo-studio-live .ks-mobile-quick-more[hidden]{display:none}.ks-mobile-quick-head{position:sticky;top:-8px;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:8px;background:rgba(5,14,16,.985);color:#f1d77e;font-size:8px;letter-spacing:.12em}.ks-mobile-quick-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.ks-mobile-quick-grid button[data-armed="1"]{border-color:#ff7a70!important;background:rgba(96,30,30,.7)!important}.ks-mobile-quick-grid .danger{border-color:rgba(255,122,112,.55)!important;color:#ffd4cf!important;background:rgba(65,24,24,.5)!important}@media(orientation:landscape){#kelo-studio-live .ks-mobile-quick-more{left:12%;right:12%;max-height:72vh}.ks-mobile-quick-grid{grid-template-columns:repeat(6,minmax(0,1fr))}}}
  `;document.head.appendChild(style);}if(slot&&!bar?.isConnected){bar=document.createElement('div');bar.className='ks-quick-select';bar.innerHTML='<button data-quick="all">ALL</button><button data-quick="invert">INV</button><button data-quick="clear">CLR</button>';bar.addEventListener('click',e=>{const a=e.target?.dataset.quick;if(a==='all')selectAll();if(a==='invert')invertSelection();if(a==='clear')clearSelection();});slot.appendChild(bar);}if(!mobileDock?.isConnected){mobileDock=document.createElement('nav');mobileDock.className='ks-mobile-quick-dock';mobileDock.setAttribute('aria-label','Acciones rápidas móviles');for(const id of ['undo','redo','duplicate','focus','more']){const meta=ACTION_META.find(x=>x[0]===id),b=document.createElement('button');b.dataset.mobileQuick=id;b.setAttribute('aria-label',meta[2]);b.innerHTML=`${meta[1]}<small>${meta[2]}</small>`;mobileDock.appendChild(b);}mobileDock.addEventListener('click',onMobileAction);shell.appendChild(mobileDock);}if(!mobileMore?.isConnected){mobileMore=document.createElement('section');mobileMore.className='ks-mobile-quick-more';mobileMore.dataset.open='0';mobileMore.hidden=true;mobileMore.innerHTML='<div class="ks-mobile-quick-head"><strong>50 ACCIONES MÓVILES</strong><button data-mobile-quick="more" aria-label="Cerrar">×</button></div><div class="ks-mobile-quick-grid"></div>';const grid=mobileMore.querySelector('.ks-mobile-quick-grid');for(const [id,icon,label] of ACTION_META.filter(x=>x[0]!=='more')){const b=document.createElement('button');b.dataset.mobileQuick=id;if(id==='delete')b.className='danger';b.setAttribute('aria-label',label);b.innerHTML=`${icon}<small>${label}</small>`;grid.appendChild(b);}mobileMore.addEventListener('click',onMobileAction);shell.appendChild(mobileMore);outsideHandler=e=>{if(mobileMore?.dataset.open==='1'&&!mobileMore.contains(e.target)&&!mobileDock?.contains(e.target))toggleMore(false);};document.addEventListener('pointerdown',outsideHandler,true);stateHandler=()=>queueMicrotask(syncMobileState);shell.addEventListener('click',stateHandler,true);shell.addEventListener('change',stateHandler,true);stateObserver=new MutationObserver(stateHandler);stateObserver.observe(shell,{subtree:true,attributes:true,attributeFilter:['class','disabled','data-active-tool','data-sheet-open','data-selection-count']});unsubscribeSelection=kernel.selection.onChange(stateHandler);syncMobileState();}}

  observer=new MutationObserver(mount);observer.observe(document.documentElement||document.body,{childList:true,subtree:true});mount();document.addEventListener('keydown',onKey,true);
  return Object.freeze({version:'studio-quick-actions-v3.1.1-idempotent-state',actions,selectAll,invertSelection,clearSelection,cycleSelection,focusAssetSearch,syncMobileState,destroy(){if(destroyed)return;destroyed=true;document.removeEventListener('keydown',onKey,true);if(outsideHandler)document.removeEventListener('pointerdown',outsideHandler,true);const shell=rootNode(root);if(shell&&stateHandler){shell.removeEventListener('click',stateHandler,true);shell.removeEventListener('change',stateHandler,true);}unsubscribeSelection();observer?.disconnect();stateObserver?.disconnect();bar?.remove();mobileDock?.remove();mobileMore?.remove();style?.remove();bar=mobileDock=mobileMore=style=null;}});
}
