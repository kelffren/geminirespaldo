/* KELO-INDEX
 * area: STUDIO / INPUT / SELECTION HISTORY
 * owns: local navigation across recent Studio selections
 * does-not-own: world mutations, command history, authority or entity lifecycle
 * public-api: createStudioSelectionHistoryController(), normalizeSelectionSnapshot(), stepSelectionHistory(), selectionHistoryNavState()
 * online: no; selection-only UI state
 */

const MAX_HISTORY=40;
const EDITABLE_SELECTOR='input,textarea,select,[contenteditable="true"]';

export function normalizeSelectionSnapshot(ids=[]){
  return [...new Set((Array.isArray(ids)?ids:[]).map(id=>String(id||'')).filter(Boolean))];
}

export function stepSelectionHistory(history=[],index=-1,direction=-1){
  const rows=Array.isArray(history)?history:[];
  if(!rows.length)return -1;
  const current=Number.isInteger(index)?index:rows.length-1;
  return Math.max(0,Math.min(rows.length-1,current+(direction<0?-1:1)));
}

export function selectionHistoryNavState(history=[],index=-1){
  const size=Array.isArray(history)?history.length:0;
  const current=size?Math.max(0,Math.min(size-1,Number.isInteger(index)?index:size-1)):-1;
  return Object.freeze({visible:size>1,canBack:current>0,canForward:current>=0&&current<size-1});
}

export function createStudioSelectionHistoryController({root=globalThis,kernel,maxHistory=MAX_HISTORY}={}){
  const document=root?.document;
  if(!document||!kernel?.selection)return Object.freeze({back:()=>false,forward:()=>false,destroy(){},get size(){return 0;},get index(){return -1;}});

  let history=[];
  let index=-1;
  let replaying=false;
  let destroyed=false;
  let nav=null;
  let backButton=null;
  let forwardButton=null;

  const same=(a,b)=>a.length===b.length&&a.every((value,i)=>value===b[i]);
  const existing=snapshot=>{
    const live=new Set((kernel.document?.entities||[]).map(row=>String(row?.id||'')).filter(Boolean));
    return normalizeSelectionSnapshot(snapshot).filter(id=>live.has(id));
  };
  const refreshNav=()=>{
    if(!nav)return;
    const state=selectionHistoryNavState(history,index);
    nav.hidden=!state.visible;
    backButton.disabled=!state.canBack;
    forwardButton.disabled=!state.canForward;
    backButton.setAttribute?.('aria-disabled',String(!state.canBack));
    forwardButton.setAttribute?.('aria-disabled',String(!state.canForward));
  };
  const push=snapshot=>{
    const next=normalizeSelectionSnapshot(snapshot);
    if(index>=0&&same(history[index]||[],next))return false;
    if(index<history.length-1)history=history.slice(0,index+1);
    history.push(next);
    if(history.length>Math.max(2,Number(maxHistory)||MAX_HISTORY))history.shift();
    index=history.length-1;
    refreshNav();
    return true;
  };
  const apply=nextIndex=>{
    if(nextIndex<0||nextIndex>=history.length||nextIndex===index)return false;
    const snapshot=existing(history[nextIndex]);
    replaying=true;
    try{kernel.selection.set(snapshot);index=nextIndex;}
    finally{replaying=false;}
    refreshNav();
    return true;
  };
  const back=()=>apply(stepSelectionHistory(history,index,-1));
  const forward=()=>apply(stepSelectionHistory(history,index,1));

  const makeButton=(label,text,action)=>{
    const button=document.createElement('button');
    button.type='button';
    button.textContent=text;
    button.setAttribute('aria-label',label);
    button.title=label;
    button.style.cssText='width:44px;height:44px;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:rgba(12,15,22,.92);color:#fff;font:700 20px/1 system-ui;touch-action:manipulation;cursor:pointer;';
    button.addEventListener('pointerdown',event=>{event.preventDefault?.();event.stopPropagation?.();});
    button.addEventListener('click',event=>{event.preventDefault?.();event.stopPropagation?.();action();});
    return button;
  };
  const mountNav=()=>{
    if(nav||typeof document.createElement!=='function')return false;
    const shell=document.getElementById?.('kelo-studio-live');
    if(!shell?.appendChild)return false;
    nav=document.createElement('div');
    nav.dataset.ext='selection-history-nav';
    nav.setAttribute('role','group');
    nav.setAttribute('aria-label','Selection history');
    nav.style.cssText='position:absolute;left:50%;bottom:max(76px,calc(env(safe-area-inset-bottom) + 64px));transform:translateX(-50%);z-index:42;display:flex;gap:8px;padding:6px;border-radius:16px;background:rgba(7,10,16,.72);backdrop-filter:blur(10px);pointer-events:auto;';
    backButton=makeButton('Previous selection','‹',back);
    forwardButton=makeButton('Next selection','›',forward);
    nav.appendChild(backButton);
    nav.appendChild(forwardButton);
    shell.appendChild(nav);
    refreshNav();
    return true;
  };

  push(kernel.selection.get?.()||[]);
  mountNav();
  const observer=!nav&&root.MutationObserver&&document.body?new root.MutationObserver(()=>{if(mountNav())observer.disconnect();}):null;
  observer?.observe?.(document.body,{childList:true,subtree:true});

  const unsubscribe=kernel.selection.onChange?.(()=>{
    if(destroyed||replaying)return;
    push(kernel.selection.get?.()||[]);
  });

  const onKeyDown=event=>{
    if(destroyed||event.defaultPrevented||event.metaKey||event.ctrlKey||!event.altKey)return;
    if(event.target?.closest?.(EDITABLE_SELECTOR))return;
    const shell=document.getElementById?.('kelo-studio-live');
    if(!shell)return;
    const key=String(event.key||'');
    if(key!=='['&&key!==']')return;
    const moved=key==='['?back():forward();
    if(moved){event.preventDefault();event.stopPropagation();}
  };
  root.addEventListener?.('keydown',onKeyDown,{capture:true});

  return Object.freeze({
    back,forward,
    destroy(){
      if(destroyed)return;
      destroyed=true;
      root.removeEventListener?.('keydown',onKeyDown,{capture:true});
      try{unsubscribe?.();}catch{}
      try{observer?.disconnect?.();}catch{}
      nav?.remove?.();
      nav=null;backButton=null;forwardButton=null;
      history=[];index=-1;
    },
    get size(){return history.length;},
    get index(){return index;}
  });
}
