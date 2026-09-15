/* KELO-INDEX
 * area: STUDIO / INPUT / KEYBOARD DUPLICATE
 * owner: Kelo Studio Keyboard Duplicate
 * keys: DUPLICATE SHORTCUT CTRL CMD SELECTION DESKTOP
 * owns: guarded Ctrl/Cmd+D delegation to the canonical Studio duplicate action
 * does-not-own: document mutation, duplicate semantics, CommandBus, authority or undo history
 * online: never writes directly; clicks the canonical [data-act="duplicate"] control so existing CommandBus/authority remains canonical
 */

const EDITABLE='input,textarea,select,[contenteditable="true"]';
const shell=root=>root?.document?.querySelector?.('#kelo-studio-live')||null;

export function createStudioKeyboardDuplicateController({root=globalThis,kernel}={}){
  const document=root?.document;
  if(!document?.addEventListener||!kernel?.selection)return Object.freeze({destroy(){}});
  let destroyed=false;

  function onKey(event){
    if(destroyed||event.defaultPrevented||event.repeat)return;
    if(event.target?.closest?.(EDITABLE))return;
    const key=String(event.key||'').toLowerCase();
    const command=!!(event.metaKey||event.ctrlKey);
    if(key!=='d'||!command||event.altKey||event.shiftKey)return;
    if(!kernel.selection.get?.().length)return;
    const button=shell(root)?.querySelector?.('[data-act="duplicate"]');
    if(!button||button.disabled)return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    button.click?.();
  }

  document.addEventListener('keydown',onKey,true);
  return Object.freeze({
    version:'studio-keyboard-duplicate-v1.0.0',
    destroy(){if(destroyed)return;destroyed=true;document.removeEventListener('keydown',onKey,true);}
  });
}
