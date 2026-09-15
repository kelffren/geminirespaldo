/* KELO-INDEX
 * area: STUDIO / INPUT / KEYBOARD DELETE
 * owner: Kelo Studio Keyboard Delete
 * keys: DELETE BACKSPACE SELECTION DESKTOP COMMAND-BUS AUTHORITY
 * owns: guarded desktop delete/backspace delegation to the canonical Studio delete control
 * does-not-own: document mutation, CommandBus implementation, selection semantics or mobile confirmation
 * online: no direct writes; deletion is delegated to the existing Studio delete button and its canonical command path
 */

const EDITABLE='input,textarea,select,[contenteditable="true"]';
const DELETE_KEYS=new Set(['delete','backspace']);

export function createStudioKeyboardDeleteController({root=globalThis,kernel}={}){
  const document=root?.document;
  if(!document||!kernel?.selection)return Object.freeze({version:'studio-keyboard-delete-v1.0.0',destroy(){}});
  let destroyed=false;

  function canonicalDelete(){
    return document.querySelector?.('#kelo-studio-live [data-act="delete"]')||null;
  }

  function onKey(event){
    if(destroyed||event.defaultPrevented||event.repeat)return;
    const key=String(event.key||'').toLowerCase();
    if(!DELETE_KEYS.has(key))return;
    if(event.metaKey||event.ctrlKey||event.altKey)return;
    if(event.target?.closest?.(EDITABLE))return;
    if(!kernel.selection.get().length)return;
    const button=canonicalDelete();
    if(!button||button.disabled||button.getAttribute?.('aria-disabled')==='true')return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    button.click();
  }

  document.addEventListener('keydown',onKey,true);
  return Object.freeze({
    version:'studio-keyboard-delete-v1.0.0',
    destroy(){
      if(destroyed)return;
      destroyed=true;
      document.removeEventListener('keydown',onKey,true);
    }
  });
}
