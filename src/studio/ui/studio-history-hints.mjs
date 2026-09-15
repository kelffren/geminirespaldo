/* KELO-INDEX
 * area: STUDIO / UI / HISTORY HINTS
 * owns: contextual labels and availability state for undo/redo controls
 * does-not-own: history mutation, commands, authority or shell structure
 * public-api: createStudioHistoryHints()
 * online: no; reads local history metadata only
 */

function nextLabels(history){
  const state=history?.inspect?.()||{undo:[],redo:[]};
  const undo=state.undo||[],redo=state.redo||[];
  return{
    undo:undo.length?String(undo[undo.length-1]):'',
    redo:redo.length?String(redo[redo.length-1]):'',
    canUndo:undo.length>0,
    canRedo:redo.length>0
  };
}

function labelButton(button,kind,label,available){
  if(!button)return;
  const base=kind==='undo'?'Deshacer':'Rehacer';
  const text=available?(label?`${base}: ${label}`:base):(kind==='undo'?'Nada que deshacer':'Nada que rehacer');
  button.title=text;
  button.setAttribute('aria-label',text);
  button.setAttribute('aria-disabled',String(!available));
  button.disabled=!available;
  button.dataset.historyHint=label||'';
  button.dataset.historyAvailable=available?'true':'false';
}

export function createStudioHistoryHints({root=globalThis,kernel}={}){
  const document=root?.document;
  const history=kernel?.history;
  if(!document||!history)return Object.freeze({refresh(){return false;},destroy(){}});
  let destroyed=false;

  const refresh=()=>{
    if(destroyed)return false;
    const labels=nextLabels(history);
    document.querySelectorAll?.('[data-act="undo"]').forEach(button=>labelButton(button,'undo',labels.undo,labels.canUndo));
    document.querySelectorAll?.('[data-act="redo"]').forEach(button=>labelButton(button,'redo',labels.redo,labels.canRedo));
    return true;
  };

  const unsubscribe=kernel.commands?.on?.(()=>queueMicrotask(refresh))||(()=>{});
  const observer=typeof root.MutationObserver==='function'?new root.MutationObserver(()=>refresh()):null;
  observer?.observe?.(document.documentElement||document.body,{childList:true,subtree:true});
  refresh();

  return Object.freeze({
    version:'studio-history-hints-v1.1.0',
    refresh,
    get next(){return nextLabels(history);},
    destroy(){if(destroyed)return;destroyed=true;unsubscribe?.();observer?.disconnect?.();}
  });
}
