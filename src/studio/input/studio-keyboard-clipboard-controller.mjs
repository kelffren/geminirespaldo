/* KELO-INDEX
 * area: STUDIO / INPUT / KEYBOARD CLIPBOARD
 * owner: Kelo Studio Keyboard Clipboard
 * keys: COPY PASTE SHORTCUT CTRL CMD SELECTION DESKTOP
 * owns: guarded Ctrl/Cmd+C and Ctrl/Cmd+V delegation to canonical Studio copy/paste actions
 * does-not-own: clipboard contents, document mutation, paste semantics, CommandBus, authority or undo history
 * online: never writes directly; clicks canonical [data-ext="copy"]/[data-ext="paste"] controls so existing CommandBus/authority remains canonical
 */

const EDITABLE='input,textarea,select,[contenteditable="true"]';
const shell=root=>root?.document?.querySelector?.('#kelo-studio-live')||null;

export function createStudioKeyboardClipboardController({root=globalThis}={}){
  const document=root?.document;
  if(!document?.addEventListener)return Object.freeze({destroy(){}});
  let destroyed=false;

  function onKey(event){
    if(destroyed||event.defaultPrevented||event.repeat)return;
    if(event.target?.closest?.(EDITABLE))return;
    const key=String(event.key||'').toLowerCase();
    const command=!!(event.metaKey||event.ctrlKey);
    if(!command||event.altKey||event.shiftKey||(key!=='c'&&key!=='v'))return;
    const selector=key==='c'?'[data-ext="copy"]':'[data-ext="paste"]';
    const button=shell(root)?.querySelector?.(selector);
    if(!button||button.disabled)return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    button.click?.();
  }

  document.addEventListener('keydown',onKey,true);
  return Object.freeze({
    version:'studio-keyboard-clipboard-v1.0.0',
    destroy(){if(destroyed)return;destroyed=true;document.removeEventListener('keydown',onKey,true);}
  });
}
