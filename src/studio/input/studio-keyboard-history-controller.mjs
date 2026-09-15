/* KELO-INDEX
 * area: STUDIO / INPUT / KEYBOARD HISTORY
 * owner: Kelo Studio Keyboard History
 * keys: UNDO REDO SHORTCUT CTRL CMD Z Y DESKTOP
 * owns: guarded Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y delegation to canonical Studio history actions
 * does-not-own: document mutation, history semantics, CommandBus, authority or command stacks
 * online: never writes directly; clicks canonical undo/redo controls so existing CommandBus/authority remains canonical
 */

const EDITABLE='input,textarea,select,[contenteditable="true"]';
const shell=root=>root?.document?.querySelector?.('#kelo-studio-live')||null;

export function createStudioKeyboardHistoryController({root=globalThis}={}){
  const document=root?.document;
  if(!document?.addEventListener)return Object.freeze({destroy(){}});
  let destroyed=false;

  function onKey(event){
    if(destroyed||event.defaultPrevented||event.repeat)return;
    if(event.target?.closest?.(EDITABLE))return;
    const key=String(event.key||'').toLowerCase();
    const command=!!(event.metaKey||event.ctrlKey);
    if(!command||event.altKey)return;

    let action='';
    if(key==='z')action=event.shiftKey?'redo':'undo';
    else if(key==='y'&&event.ctrlKey&&!event.metaKey&&!event.shiftKey)action='redo';
    else return;

    const button=shell(root)?.querySelector?.(`[data-act="${action}"]`);
    if(!button||button.disabled)return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    button.click?.();
  }

  document.addEventListener('keydown',onKey,true);
  return Object.freeze({
    version:'studio-keyboard-history-v1.0.0',
    destroy(){if(destroyed)return;destroyed=true;document.removeEventListener('keydown',onKey,true);}
  });
}
