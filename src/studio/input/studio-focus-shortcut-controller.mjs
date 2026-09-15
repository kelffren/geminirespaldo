/* KELO-INDEX
 * area: STUDIO / INPUT / FOCUS SHORTCUT
 * owns: local keyboard access to the existing frame-selection action
 * does-not-own: camera state, world mutation, CommandBus or authority
 * public-api: createStudioFocusShortcutController()
 * online: local-only; delegates to the existing Studio focus action
 */

const EDITABLE_SELECTOR='input,textarea,select,[contenteditable="true"],[contenteditable=""]';

export function shouldHandleStudioFocusKey(event){
  if(!event||event.defaultPrevented||event.repeat||event.ctrlKey||event.metaKey||event.altKey)return false;
  if(String(event.key||'').toLowerCase()!=='f')return false;
  const target=event.target;
  return !target?.closest?.(EDITABLE_SELECTOR);
}

export function createStudioFocusShortcutController({root=globalThis}={}){
  const document=root?.document;
  if(!document?.addEventListener)return Object.freeze({focusSelection:()=>false,destroy(){}});
  let destroyed=false;

  function focusSelection(){
    if(destroyed)return false;
    const button=document.querySelector?.('#kelo-studio-live [data-act="focus"]');
    if(!button||button.disabled)return false;
    button.click?.();
    return true;
  }

  function keydown(event){
    if(!shouldHandleStudioFocusKey(event))return;
    if(!focusSelection())return;
    event.preventDefault?.();
    event.stopPropagation?.();
  }

  document.addEventListener('keydown',keydown,true);
  return Object.freeze({
    focusSelection,
    destroy(){
      if(destroyed)return;
      destroyed=true;
      document.removeEventListener?.('keydown',keydown,true);
    }
  });
}
