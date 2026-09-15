/* KELO-INDEX
 * area: STUDIO / CONTEXT INSPECTOR
 * owns: compact on-canvas object properties card and proxying to existing Studio property/actions UI
 * does-not-own: world mutations, command history, authority or property semantics
 * public-api: createStudioContextInspector(), contextInspectorFields(), selectSimilarEntityIds()
 * online: no; UI delegates all persistent edits to existing Studio controls
 */

import { worldRectToScreen } from './studio-clean-workspace.mjs';

const STYLE_ID='kelo-studio-context-inspector-style';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function contextInspectorFields(entity={}){
  const t=entity?.transform||{};
  return Object.freeze({
    x:Number(t.x)||0,
    y:Number(t.y)||0,
    rotation:Number(t.rotation)||0,
    scalePercent:Math.round((Number(t.scale)||1)*100)
  });
}

export function selectSimilarEntityIds(document,entity={}){
  const prefabId=String(entity?.prefabId||'');
  if(!prefabId)return [];
  return (document?.entities||[])
    .filter(row=>String(row?.prefabId||'')===prefabId)
    .map(row=>String(row?.id||''))
    .filter(Boolean);
}

function ensureStyle(document){
  if(!document?.head||document.getElementById?.(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;style.dataset.keloStudioUi='1';
  style.textContent=`
    #kelo-studio-live.ks-context-inspector-on .ks-selection-float{display:none!important}
    #kelo-studio-live .ks-context-inspector{
      position:fixed;z-index:323;display:none;width:238px;pointer-events:auto;overflow:visible;
      border:1px solid rgba(231,197,106,.38);border-radius:14px;background:rgba(7,17,19,.965);
      box-shadow:0 14px 38px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.035);
      backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);transform:translateX(-50%)
    }
    #kelo-studio-live .ks-context-inspector.on{display:block}
    #kelo-studio-live .ks-context-head{height:40px;display:flex;align-items:center;gap:7px;padding:5px 6px 5px 9px}
    #kelo-studio-live .ks-context-dot{width:7px;height:7px;border-radius:50%;background:#e7c56a;box-shadow:0 0 12px rgba(231,197,106,.35);flex:0 0 7px}
    #kelo-studio-live .ks-context-title{min-width:0;flex:1}
    #kelo-studio-live .ks-context-title small{display:block;color:#7f9c91;font-size:5.5px;font-weight:900;letter-spacing:.14em}
    #kelo-studio-live .ks-context-title strong{display:block;margin-top:2px;color:#f2df9f;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #kelo-studio-live .ks-context-head button{width:31px;height:29px;border:1px solid rgba(255,255,255,.07);border-radius:8px;background:#0f1b1d;color:#dce7e1;font-size:12px;padding:0}
    #kelo-studio-live .ks-context-body{border-top:1px solid rgba(255,255,255,.055);padding:7px}
    #kelo-studio-live .ks-context-fields{display:grid;grid-template-columns:1fr 1fr;gap:5px}
    #kelo-studio-live .ks-context-field{display:grid;grid-template-columns:28px 1fr;align-items:center;gap:4px;min-width:0;padding:3px 5px;border:1px solid rgba(255,255,255,.065);border-radius:9px;background:rgba(12,25,26,.82)}
    #kelo-studio-live .ks-context-field label{font-size:5.5px;font-weight:950;color:#78958b;text-align:center}
    #kelo-studio-live .ks-context-field input{width:100%;height:28px;border:0;background:transparent;color:#f3f7f5;font-size:9px;font-weight:800;outline:none;padding:0 3px;min-width:0}
    #kelo-studio-live .ks-context-field:focus-within{border-color:rgba(231,197,106,.45);background:rgba(21,39,35,.9)}
    #kelo-studio-live .ks-context-actions{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-top:6px}
    #kelo-studio-live .ks-context-actions button{height:34px;border:1px solid rgba(255,255,255,.07);border-radius:8px;background:#0f1b1d;color:#e5eee9;font-size:13px;font-weight:900;padding:0}
    #kelo-studio-live .ks-context-actions button:hover{border-color:rgba(231,197,106,.38)}
    #kelo-studio-live .ks-context-actions [data-context-action="pick"]{color:#f4dfa0;border-color:rgba(231,197,106,.24)}
    #kelo-studio-live .ks-context-actions [data-context-action="similar"]{color:#d8ecff;border-color:rgba(123,187,255,.24)}
    #kelo-studio-live .ks-context-actions [data-context-action="delete"]{color:#ffc8c3;border-color:rgba(255,122,112,.22)}
    #kelo-studio-live .ks-context-inspector.collapsed{width:206px}
    #kelo-studio-live .ks-context-inspector.collapsed .ks-context-body{display:none}
    @media(max-width:760px){
      #kelo-studio-live .ks-context-inspector{width:min(232px,calc(100vw - 20px));border-radius:13px}
      #kelo-studio-live .ks-context-head{height:39px}
      #kelo-studio-live .ks-context-field input{font-size:10px}
      #kelo-studio-live .ks-context-actions button{height:36px}
    }
    @media(max-width:390px){
      #kelo-studio-live .ks-context-inspector{width:min(220px,calc(100vw - 16px))}
      #kelo-studio-live .ks-context-fields{gap:4px}
    }
  `;
  document.head.appendChild(style);
}

export function createStudioContextInspector({root=globalThis,kernel,tools}={}){
  const document=root?.document;
  if(!document||!kernel)return Object.freeze({attach:()=>false,update(){},destroy(){}});
  ensureStyle(document);

  let shell=null,card=null,observer=null,selectionUnsub=null,frame=0,destroyed=false,collapsed=false,suppressedId=null,lastSelectionId=null,lastPosition='';
  const actionSelector=Object.freeze({duplicate:'[data-act="duplicate"]',rotate:'[data-act="rotate"]',focus:'[data-act="focus"]',delete:'[data-act="delete"]'});

  function selectedEntity(){
    const ids=kernel.selection.get?.()||[];
    if(ids.length!==1)return null;
    return kernel.document.entities.find(row=>String(row.id)===String(ids[0]))||null;
  }
  function sourceControl(selector){
    if(!shell||!selector)return null;
    return [...shell.querySelectorAll(selector)].find(node=>!node.closest('.ks-context-inspector,.ks-clean-toolbar,.ks-selection-float'))||null;
  }
  function proxyAction(action){
    const target=sourceControl(actionSelector[action]);
    if(!target||target.disabled)return false;
    target.click();return true;
  }
  function dispatchInput(input){
    const EventCtor=root.Event||globalThis.Event;
    input?.dispatchEvent?.(new EventCtor('input',{bubbles:true}));
  }
  function pickSelected(){
    const entity=selectedEntity(),assetId=String(entity?.prefabId||'');
    if(!assetId)return false;
    const search=sourceControl('.ks-asset-search')||sourceControl('.ks-asset-search-mobile');
    if(!search)return false;
    const previous=search.value;
    search.value=assetId;dispatchInput(search);
    const target=[...shell.querySelectorAll('[data-asset]')].find(node=>!node.closest('.ks-context-inspector')&&String(node.dataset.asset)===assetId)||null;
    if(target)target.click();
    search.value=previous;dispatchInput(search);
    return !!target;
  }
  function selectSimilar(){
    const entity=selectedEntity(),ids=selectSimilarEntityIds(kernel.document,entity);
    if(!ids.length)return 0;
    kernel.selection.set(ids);
    return ids.length;
  }
  function proxyProperty(prop,value){
    const selector=prop==='scalePercent'?'[data-prop="scalePercent"]':`[data-prop="${prop}"]`;
    const target=sourceControl(`.ks-right .ks-properties ${selector}`)||sourceControl(selector);
    if(!target)return false;
    target.value=String(value);
    const EventCtor=root.Event||globalThis.Event;
    target.dispatchEvent(new EventCtor('change',{bubbles:true}));
    return true;
  }
  function currentRect(entity){
    const spatial=kernel.spatial.get(entity.id)?.rect;
    if(!spatial)return null;
    const preview=tools?.transform?.getPreview?.();
    const row=preview?.rows?.find?.(item=>String(item.entityId)===String(entity.id));
    if(!row)return spatial;
    return{...spatial,x:Number(row.preview?.x??spatial.x),y:Number(row.preview?.y??spatial.y)};
  }
  function fieldMarkup(prop,label,step='1'){
    return `<div class="ks-context-field"><label>${label}</label><input type="number" inputmode="decimal" step="${step}" data-context-prop="${prop}"></div>`;
  }
  function buildCard(){
    card=document.createElement('div');card.className='ks-context-inspector';card.dataset.keloStudioUi='1';card.setAttribute('aria-label','Inspector contextual del objeto');
    card.innerHTML=`
      <div class="ks-context-head">
        <span class="ks-context-dot" aria-hidden="true"></span>
        <div class="ks-context-title"><small>SELECCIÓN</small><strong>Objeto</strong></div>
        <button type="button" data-context-toggle aria-label="Contraer inspector" title="Contraer">⌃</button>
        <button type="button" data-context-close aria-label="Ocultar inspector" title="Ocultar">×</button>
      </div>
      <div class="ks-context-body">
        <div class="ks-context-fields">
          ${fieldMarkup('x','X')}${fieldMarkup('y','Y')}${fieldMarkup('rotation','ROT','15')}${fieldMarkup('scalePercent','ESC','5')}
        </div>
        <div class="ks-context-actions">
          <button type="button" data-context-action="pick" aria-label="Usar como pincel" title="Usar este objeto como pincel">✣</button>
          <button type="button" data-context-action="similar" aria-label="Seleccionar iguales" title="Seleccionar todas las instancias del mismo asset">≋</button>
          <button type="button" data-context-action="duplicate" aria-label="Duplicar" title="Duplicar">⧉</button>
          <button type="button" data-context-action="rotate" aria-label="Rotar" title="Rotar">⟳</button>
          <button type="button" data-context-action="focus" aria-label="Enfocar" title="Enfocar">◎</button>
          <button type="button" data-context-action="delete" aria-label="Borrar" title="Borrar">⌫</button>
        </div>
      </div>`;
    shell.appendChild(card);
    card.addEventListener('pointerdown',event=>event.stopPropagation());
    card.addEventListener('click',event=>{
      const toggle=event.target.closest('[data-context-toggle]');
      if(toggle){event.preventDefault();event.stopPropagation();collapsed=!collapsed;card.classList.toggle('collapsed',collapsed);toggle.textContent=collapsed?'⌄':'⌃';toggle.setAttribute('aria-label',collapsed?'Expandir inspector':'Contraer inspector');return;}
      if(event.target.closest('[data-context-close]')){event.preventDefault();event.stopPropagation();const entity=selectedEntity();suppressedId=entity?String(entity.id):null;card.classList.remove('on');return;}
      const action=event.target.closest('[data-context-action]')?.dataset.contextAction;
      if(action){event.preventDefault();event.stopPropagation();if(action==='pick')pickSelected();else if(action==='similar')selectSimilar();else proxyAction(action);}
    });
    card.addEventListener('change',event=>{
      const input=event.target.closest('[data-context-prop]');if(!input)return;
      event.stopPropagation();
      const prop=input.dataset.contextProp;
      let value=Number(input.value)||0;
      if(prop==='scalePercent')value=clamp(value,10,800);
      proxyProperty(prop,value);
    });
  }
  function attach(){
    if(destroyed)return false;
    const next=document.getElementById?.('kelo-studio-live')||document.querySelector?.('#kelo-studio-live');
    if(!next)return false;
    if(shell===next&&card?.isConnected)return true;
    card?.remove();shell=next;shell.classList.add('ks-context-inspector-on');buildCard();return true;
  }
  function syncFields(entity){
    if(!card||!entity)return;
    const fields=contextInspectorFields(entity);
    const title=card.querySelector('.ks-context-title strong');if(title)title.textContent=entity.label||entity.name||entity.prefabId||entity.id||'Objeto';
    for(const [prop,value] of Object.entries(fields)){
      const input=card.querySelector(`[data-context-prop="${prop}"]`);
      if(input&&document.activeElement!==input)input.value=String(Math.round(Number(value)*100)/100);
    }
  }
  function shouldShow(entity){
    if(!shell||!card||!entity)return false;
    if(suppressedId===String(entity.id))return false;
    if(shell.dataset.creatorMinimized==='1'||shell.dataset.sheetOpen==='1')return false;
    if(!['select','move'].includes(String(shell.dataset.activeTool||'select')))return false;
    if(tools?.paintCopies?.state?.().enabled)return false;
    return true;
  }
  function update(){
    attach();if(!shell||!card)return;
    const entity=selectedEntity(),id=entity?String(entity.id):null;
    if(id!==lastSelectionId){lastSelectionId=id;suppressedId=null;lastPosition='';}
    if(!shouldShow(entity)){card.classList.remove('on');return;}
    syncFields(entity);
    const rect=currentRect(entity),camera=root.KeloCamera?.snapshot?.();if(!rect||!camera){card.classList.remove('on');return;}
    const p=worldRectToScreen(rect,camera),vw=Number(camera.screenW)||root.innerWidth||1,vh=Number(camera.screenH)||root.innerHeight||1;
    if(!p||p.bottom<55||p.y>vh-55||p.x<-40||p.x>vw+40){card.classList.remove('on');return;}
    card.classList.add('on');card.classList.toggle('collapsed',collapsed);
    const width=collapsed?206:238,estimatedHeight=collapsed?40:151;
    const x=clamp(p.x,width/2+8,vw-width/2-8);
    const roomAbove=p.y-18>estimatedHeight+70;
    const top=roomAbove?clamp(p.y-estimatedHeight-14,66,vh-estimatedHeight-76):clamp(p.bottom+14,66,vh-estimatedHeight-76);
    const key=`${Math.round(x)}:${Math.round(top)}:${collapsed?'c':'e'}`;
    if(key!==lastPosition){card.style.left=`${x}px`;card.style.top=`${top}px`;lastPosition=key;}
  }
  function loop(){if(destroyed)return;update();frame=root.requestAnimationFrame?.(loop)||setTimeout(loop,32);}

  selectionUnsub=kernel.selection.onChange?.(()=>update());
  attach();
  if(typeof root.MutationObserver==='function'&&document.body){observer=new root.MutationObserver(()=>{if(!destroyed)attach();});observer.observe(document.body,{childList:true,subtree:true});}
  loop();

  return Object.freeze({
    attach,update,
    setCollapsed(value){collapsed=!!value;update();return collapsed;},
    reveal(){suppressedId=null;update();},
    destroy(){destroyed=true;selectionUnsub?.();observer?.disconnect?.();if(typeof root.cancelAnimationFrame==='function')root.cancelAnimationFrame(frame);else clearTimeout(frame);card?.remove();shell?.classList?.remove('ks-context-inspector-on');},
    get collapsed(){return collapsed;},
    get visible(){return !!card?.classList?.contains('on');}
  });
}
