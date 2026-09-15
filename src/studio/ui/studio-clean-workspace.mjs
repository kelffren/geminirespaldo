/* KELO-INDEX
 * area: STUDIO / CLEAN WORKSPACE
 * owns: decluttered contextual toolbar, dropdown menus, optional desktop side panels and floating selection HUD
 * does-not-own: world mutations, tool behavior, authority or camera ownership
 * public-api: createStudioCleanWorkspace(), worldRectToScreen(), CLEAN_MENU_GROUPS
 * online: no; UI proxies existing Studio actions only
 */

export const CLEAN_MENU_GROUPS=Object.freeze({
  edit:Object.freeze([
    ['undo','↶','UNDO'],['redo','↷','REDO'],['duplicate','⧉','DUPLICAR'],['rotate','⟳','ROTAR'],
    ['scale-down','−','ESCALA −'],['scale-reset','100','ESCALA 100%'],['scale-up','＋','ESCALA +'],['delete','⌫','BORRAR']
  ]),
  create:Object.freeze([
    ['assets','▦','ASSETS'],['select','↖','SELECCIÓN'],['move','✥','MOVER'],['paint','✣','PAINT COPIES'],
    ['terrain','▦','GROUND'],['path','⌁','ROAD'],['collision','◇','COLLISION'],['prefab','▱','SAVE PREFAB']
  ]),
  view:Object.freeze([
    ['inspector','◫','PROPERTIES'],['explorer','☷','EXPLORER'],['focus','◎','ENFOCAR'],['grid','▦','GRID'],
    ['camera','⌖','CÁMARA'],['zoom-out','−','ZOOM −'],['zoom-reset','100','ZOOM 100%'],['zoom-in','＋','ZOOM +'],['check','✓','CHECK MAP']
  ])
});

const ACTION_SELECTORS=Object.freeze({
  undo:'[data-act="undo"]',redo:'[data-act="redo"]',duplicate:'[data-act="duplicate"]',rotate:'[data-act="rotate"]',
  'scale-down':'[data-act="scale-down"]','scale-reset':'[data-act="scale-reset"]','scale-up':'[data-act="scale-up"]',delete:'[data-act="delete"]',
  focus:'[data-act="focus"]',select:'[data-mode="select"]',move:'[data-mode="move"]',terrain:'[data-mode="terrain"]',path:'[data-mode="path"]',collision:'[data-mode="collision"]',
  paint:'[data-ext-paint-copies]',prefab:'[data-ext="prefab"]',grid:'[data-ext="grid"]',camera:'[data-ext="camera"]',
  'zoom-out':'[data-ext="zoom-out"]','zoom-reset':'[data-ext="zoom-reset"]','zoom-in':'[data-ext="zoom-in"]',check:'[data-ext="check"]'
});

const STYLE_ID='kelo-studio-clean-workspace-style';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function worldRectToScreen(rect,camera={}){
  if(!rect)return null;
  const z=Math.max(.01,Number(camera.effectiveZoom)||1),w=Math.max(1,Number(camera.screenW)||1),h=Math.max(1,Number(camera.screenH)||1);
  return{
    x:(Number(rect.x)+Number(rect.w)/2-(Number(camera.x)||0))*z+w/2,
    y:(Number(rect.y)-(Number(camera.y)||0))*z+h/2,
    bottom:(Number(rect.y)+Number(rect.h)-(Number(camera.y)||0))*z+h/2
  };
}

function ensureStyle(document){
  if(!document?.head||document.getElementById?.(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;style.dataset.keloStudioUi='1';
  style.textContent=`
    #kelo-studio-live.ks-clean-workspace .ks-left,
    #kelo-studio-live.ks-clean-workspace .ks-right{display:none}
    #kelo-studio-live.ks-clean-workspace.ks-clean-show-assets .ks-left{display:block}
    #kelo-studio-live.ks-clean-workspace.ks-clean-show-inspector .ks-right{display:block}
    #kelo-studio-live.ks-clean-workspace[data-sheet-open="0"] .ks-bottom:not(.ks-compact):not(.ks-menu-minimized){
      width:min(690px,calc(100vw - 24px));max-height:76px;overflow:visible;padding:7px 9px
    }
    #kelo-studio-live.ks-clean-workspace .ks-bottom:not(.ks-compact) .ks-deck-body,
    #kelo-studio-live.ks-clean-workspace .ks-bottom:not(.ks-compact)>.ks-status{display:none}
    #kelo-studio-live.ks-clean-workspace[data-sheet-open="0"] .ks-bottom:not(.ks-compact) .ks-deck-head{min-height:56px;padding:0;border-bottom:0;gap:7px}
    #kelo-studio-live.ks-clean-workspace .ks-bottom:not(.ks-compact) .ks-deck-emblem{width:34px;height:34px;flex-basis:34px;font-size:14px}
    #kelo-studio-live.ks-clean-workspace .ks-bottom:not(.ks-compact) .ks-deck-brand small{display:none}
    #kelo-studio-live.ks-clean-workspace .ks-bottom:not(.ks-compact) .ks-deck-brand strong{font-size:9px}
    #kelo-studio-live.ks-clean-workspace .ks-bottom:not(.ks-compact) .ks-active-tool{min-width:145px;max-width:190px;margin-left:auto;padding:6px 8px}
    #kelo-studio-live.ks-clean-workspace .ks-bottom:not(.ks-compact) .ks-selection-badge{display:none}
    #kelo-studio-live.ks-clean-workspace .ks-clean-toolbar{display:flex;align-items:center;gap:5px;position:relative}
    #kelo-studio-live.ks-clean-workspace .ks-clean-trigger{
      min-height:36px;border:1px solid rgba(231,197,106,.25);border-radius:10px;background:#101b1e;color:#edf4ef;
      padding:0 10px;font-size:7px;font-weight:900;letter-spacing:.04em;white-space:nowrap
    }
    #kelo-studio-live.ks-clean-workspace .ks-clean-trigger.on{border-color:#e7c56a;background:#1d372f;color:#fff1b8}
    #kelo-studio-live .ks-clean-popover{
      position:absolute;bottom:calc(100% + 12px);left:0;z-index:18;width:min(250px,calc(100vw - 24px));
      padding:7px;border:1px solid rgba(231,197,106,.38);border-radius:14px;background:rgba(6,16,18,.985);
      box-shadow:0 18px 50px rgba(0,0,0,.58);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);display:none
    }
    #kelo-studio-live .ks-clean-popover.on{display:grid;grid-template-columns:1fr 1fr;gap:5px}
    #kelo-studio-live .ks-clean-popover button{
      min-height:39px;border:1px solid rgba(255,255,255,.075);border-radius:9px;background:#0e1a1c;color:#dfe9e4;
      font-size:7px;font-weight:850;text-align:left;padding:0 9px;white-space:nowrap
    }
    #kelo-studio-live .ks-clean-popover button:hover{border-color:rgba(231,197,106,.42)}
    #kelo-studio-live .ks-clean-popover button:disabled{opacity:.32}
    #kelo-studio-live .ks-clean-popover button[data-clean-action="delete"]{color:#ffd0cb;border-color:rgba(255,122,112,.22)}
    #kelo-studio-live .ks-clean-popover .ks-clean-icon{display:inline-grid;width:18px;color:#f0d67e;font-size:11px}
    #kelo-studio-live .ks-selection-float{
      position:fixed;z-index:321;display:none;align-items:center;gap:4px;padding:4px;border:1px solid rgba(231,197,106,.38);
      border-radius:13px;background:rgba(7,17,19,.94);box-shadow:0 10px 30px rgba(0,0,0,.42);pointer-events:auto;
      backdrop-filter:blur(13px);-webkit-backdrop-filter:blur(13px);transform:translate(-50%,-100%)
    }
    #kelo-studio-live .ks-selection-float.on{display:flex}
    #kelo-studio-live .ks-selection-float>button{
      min-width:38px;height:36px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:#101c1e;color:#f1e6bd;
      font-size:15px;font-weight:900;padding:0 8px
    }
    #kelo-studio-live .ks-selection-float>button:disabled{opacity:.3}
    #kelo-studio-live .ks-selection-more{position:absolute;bottom:calc(100% + 8px);right:0;display:none;grid-template-columns:repeat(2,minmax(90px,1fr));gap:4px;
      width:210px;padding:6px;border:1px solid rgba(231,197,106,.35);border-radius:12px;background:rgba(6,16,18,.985);box-shadow:0 14px 38px rgba(0,0,0,.5)}
    #kelo-studio-live .ks-selection-more.on{display:grid}
    #kelo-studio-live .ks-selection-more button{height:35px;border:1px solid rgba(255,255,255,.07);border-radius:8px;background:#0f1b1d;color:#dfe8e3;font-size:7px;font-weight:850}
    #kelo-studio-live .ks-selection-more [data-clean-action="delete"]{color:#ffc8c3;border-color:rgba(255,122,112,.24)}
    #kelo-studio-live .ks-menu-minimized .ks-clean-toolbar{display:none!important}
    @media(max-width:760px){
      #kelo-studio-live.ks-clean-workspace.ks-clean-show-assets .ks-left,
      #kelo-studio-live.ks-clean-workspace.ks-clean-show-inspector .ks-right{display:none}
      #kelo-studio-live.ks-clean-workspace[data-sheet-open="0"] .ks-bottom:not(.ks-compact):not(.ks-menu-minimized){left:8px;right:8px;width:auto;max-height:68px;padding:6px 7px}
      #kelo-studio-live.ks-clean-workspace[data-sheet-open="0"] .ks-bottom:not(.ks-compact) .ks-deck-head{min-height:54px;gap:4px}
      #kelo-studio-live.ks-clean-workspace .ks-bottom:not(.ks-compact) .ks-deck-emblem,
      #kelo-studio-live.ks-clean-workspace .ks-bottom:not(.ks-compact) .ks-deck-brand{display:none}
      #kelo-studio-live.ks-clean-workspace .ks-bottom:not(.ks-compact) .ks-active-tool{min-width:0;max-width:31%;padding:5px 7px;margin-left:0}
      #kelo-studio-live.ks-clean-workspace .ks-clean-toolbar{flex:1;justify-content:flex-end;gap:4px}
      #kelo-studio-live.ks-clean-workspace .ks-clean-trigger{min-width:0;padding:0 8px;font-size:6.2px}
      #kelo-studio-live .ks-clean-popover{position:fixed;left:8px!important;right:8px;width:auto;bottom:82px;grid-template-columns:repeat(2,1fr)}
      #kelo-studio-live .ks-selection-float{padding:3px;gap:3px}
      #kelo-studio-live .ks-selection-float>button{min-width:40px;height:38px}
    }
    @media(max-width:430px){
      #kelo-studio-live.ks-clean-workspace .ks-bottom:not(.ks-compact) .ks-active-tool{display:none}
      #kelo-studio-live.ks-clean-workspace .ks-clean-trigger{flex:1;padding:0 5px;font-size:5.8px}
      #kelo-studio-live .ks-selection-more{width:196px}
    }
  `;
  document.head.appendChild(style);
}

function unionSelectionRect(kernel){
  const rows=(kernel?.selection?.get?.()||[]).map(id=>kernel.spatial.get(id)?.rect).filter(Boolean);
  if(!rows.length)return null;
  const x=Math.min(...rows.map(r=>r.x)),y=Math.min(...rows.map(r=>r.y)),x2=Math.max(...rows.map(r=>r.x+r.w)),y2=Math.max(...rows.map(r=>r.y+r.h));
  return{x,y,w:x2-x,h:y2-y};
}

export function createStudioCleanWorkspace({root=globalThis,kernel}={}){
  const document=root?.document;
  if(!document||!kernel)return Object.freeze({attach:()=>false,update(){},destroy(){}});
  ensureStyle(document);

  let shell=null,toolbar=null,hud=null,observer=null,selectionUnsub=null,frame=0,destroyed=false,openMenu=null,lastHudKey='';

  const isMobile=()=>typeof root.matchMedia==='function'?root.matchMedia('(max-width:760px)').matches:Number(root.innerWidth||0)<=760;
  const findProxy=selector=>selector&&shell?[...shell.querySelectorAll(selector)].find(node=>!node.closest('.ks-clean-toolbar,.ks-selection-float'))||null:null;
  const proxy=(action)=>{
    if(action==='assets'){
      if(isMobile()){findProxy('[data-act="edit-assets"]')?.click();return true;}
      shell.classList.toggle('ks-clean-show-assets');shell.classList.remove('ks-clean-show-inspector');return true;
    }
    if(action==='inspector'){
      if(isMobile()){shell.querySelector('[data-tab="properties"]')?.click();return true;}
      shell.classList.toggle('ks-clean-show-inspector');shell.classList.remove('ks-clean-show-assets');return true;
    }
    if(action==='explorer'){
      if(isMobile()){shell.querySelector('[data-tab="explorer"]')?.click();return true;}
      shell.classList.toggle('ks-clean-show-inspector');shell.classList.remove('ks-clean-show-assets');return true;
    }
    const target=findProxy(ACTION_SELECTORS[action]);
    if(!target||target.disabled)return false;
    target.click();return true;
  };

  function closeMenus(){
    openMenu=null;
    toolbar?.querySelectorAll('.ks-clean-popover,.ks-clean-trigger').forEach(node=>node.classList.remove('on'));
    hud?.querySelector('.ks-selection-more')?.classList.remove('on');
  }
  function syncDisabled(){
    if(!shell)return;
    shell.querySelectorAll('[data-clean-action]').forEach(button=>{
      const action=button.dataset.cleanAction;
      if(['assets','inspector','explorer'].includes(action)){button.disabled=false;return;}
      const target=findProxy(ACTION_SELECTORS[action]);
      button.disabled=!target||!!target.disabled;
      button.classList.toggle('on',!!target?.classList?.contains('on'));
    });
  }
  function makeItem(action,icon,label){
    const b=document.createElement('button');b.type='button';b.dataset.cleanAction=action;
    const i=document.createElement('span');i.className='ks-clean-icon';i.textContent=icon;
    const t=document.createElement('span');t.textContent=label;b.append(i,t);return b;
  }
  function buildMenu(key,label){
    const wrap=document.createElement('div');wrap.style.position='relative';
    const trigger=document.createElement('button');trigger.type='button';trigger.className='ks-clean-trigger';trigger.dataset.cleanMenu=key;trigger.textContent=`${label} ▾`;
    const pop=document.createElement('div');pop.className='ks-clean-popover';pop.dataset.cleanPopover=key;
    for(const row of CLEAN_MENU_GROUPS[key])pop.appendChild(makeItem(...row));
    wrap.append(trigger,pop);toolbar.appendChild(wrap);
  }
  function buildHud(){
    hud=document.createElement('div');hud.className='ks-selection-float';hud.dataset.keloStudioUi='1';hud.setAttribute('aria-label','Acciones de selección');
    const quick=[['duplicate','⧉','Duplicar'],['rotate','⟳','Rotar']];
    for(const [action,icon,label] of quick){const b=document.createElement('button');b.type='button';b.dataset.cleanAction=action;b.textContent=icon;b.title=label;b.setAttribute('aria-label',label);hud.appendChild(b);}
    const moreButton=document.createElement('button');moreButton.type='button';moreButton.dataset.selectionMore='1';moreButton.textContent='•••';moreButton.title='Más acciones';moreButton.setAttribute('aria-label','Más acciones');hud.appendChild(moreButton);
    const more=document.createElement('div');more.className='ks-selection-more';
    for(const row of [['focus','◎','ENFOCAR'],['scale-down','−','ESCALA −'],['scale-reset','100','100%'],['scale-up','＋','ESCALA +'],['delete','⌫','BORRAR']])more.appendChild(makeItem(...row));
    hud.appendChild(more);shell.appendChild(hud);
  }

  function attach(){
    if(destroyed)return false;
    const next=document.getElementById?.('kelo-studio-live')||document.querySelector?.('#kelo-studio-live');
    if(!next)return false;
    if(shell===next&&toolbar?.isConnected&&hud?.isConnected)return true;
    toolbar?.remove();hud?.remove();shell=next;shell.classList.add('ks-clean-workspace');shell.dataset.workspaceUi='clean';
    const head=shell.querySelector('.ks-deck-head');if(!head)return false;
    toolbar=document.createElement('div');toolbar.className='ks-clean-toolbar';toolbar.dataset.keloStudioUi='1';
    buildMenu('edit','EDITAR');buildMenu('create','CREAR');buildMenu('view','VISTA');
    const menuMin=head.querySelector('[data-studio-menu-minimize]');head.insertBefore(toolbar,menuMin||null);
    buildHud();syncDisabled();return true;
  }

  function updateHud(){
    if(!shell||!hud)return;
    const rect=unionSelectionRect(kernel),tool=String(shell.dataset.activeTool||'select');
    const allowed=['select','move'].includes(tool);
    if(!rect||!allowed||shell.dataset.creatorMinimized==='1'||shell.dataset.sheetOpen==='1'){hud.classList.remove('on');lastHudKey='';return;}
    const camera=root.KeloCamera?.snapshot?.();if(!camera){hud.classList.remove('on');return;}
    const p=worldRectToScreen(rect,camera),vw=Number(camera.screenW)||root.innerWidth||1,vh=Number(camera.screenH)||root.innerHeight||1;
    if(!p||p.bottom<58||p.y>vh-64||p.x<-30||p.x>vw+30){hud.classList.remove('on');lastHudKey='';return;}
    const x=clamp(p.x,62,vw-62),y=clamp(p.y-10,112,vh-88),key=`${Math.round(x)}:${Math.round(y)}`;
    if(key!==lastHudKey){hud.style.left=`${x}px`;hud.style.top=`${y}px`;lastHudKey=key;}
    hud.classList.add('on');
  }
  function update(){attach();syncDisabled();updateHud();}
  function loop(){if(destroyed)return;updateHud();frame=root.requestAnimationFrame?.(loop)||setTimeout(loop,32);}

  function onPointerDown(event){
    if(!shell||event.target?.closest?.('.ks-clean-toolbar,.ks-selection-float'))return;
    closeMenus();
  }
  function onKeyDown(event){if(event.key==='Escape')closeMenus();}
  function onClick(event){
    if(!shell||!event.target?.closest?.('#kelo-studio-live'))return;
    const trigger=event.target.closest('[data-clean-menu]');
    if(trigger){event.preventDefault();event.stopPropagation();const key=trigger.dataset.cleanMenu,same=openMenu===key;closeMenus();if(!same){openMenu=key;trigger.classList.add('on');toolbar?.querySelector(`[data-clean-popover="${key}"]`)?.classList.add('on');syncDisabled();}return;}
    const more=event.target.closest('[data-selection-more]');
    if(more){event.preventDefault();event.stopPropagation();hud?.querySelector('.ks-selection-more')?.classList.toggle('on');return;}
    const action=event.target.closest('[data-clean-action]')?.dataset.cleanAction;
    if(action){event.preventDefault();event.stopPropagation();proxy(action);if(!['scale-down','scale-up'].includes(action))closeMenus();syncDisabled();}
  }

  document.addEventListener('pointerdown',onPointerDown,true);
  document.addEventListener('keydown',onKeyDown,true);
  document.addEventListener('click',onClick,true);
  selectionUnsub=kernel.selection.onChange(()=>{syncDisabled();updateHud();});
  attach();
  if(typeof root.MutationObserver==='function'&&document.body){
    observer=new root.MutationObserver(()=>{if(!destroyed)attach();});observer.observe(document.body,{childList:true,subtree:true});
  }
  loop();

  return Object.freeze({
    attach,update,closeMenus,
    showAssets(value=true){if(shell){shell.classList.toggle('ks-clean-show-assets',!!value);if(value)shell.classList.remove('ks-clean-show-inspector');}},
    showInspector(value=true){if(shell){shell.classList.toggle('ks-clean-show-inspector',!!value);if(value)shell.classList.remove('ks-clean-show-assets');}},
    destroy(){
      destroyed=true;selectionUnsub?.();observer?.disconnect?.();document.removeEventListener('pointerdown',onPointerDown,true);document.removeEventListener('keydown',onKeyDown,true);document.removeEventListener('click',onClick,true);
      if(typeof root.cancelAnimationFrame==='function')root.cancelAnimationFrame(frame);else clearTimeout(frame);
      toolbar?.remove();hud?.remove();shell?.classList?.remove('ks-clean-workspace','ks-clean-show-assets','ks-clean-show-inspector');
    },
    get shell(){return shell;}
  });
}
