/* KELO-INDEX
 * area: STUDIO / INPUT / PROPERTY COMMIT
 * owns: keyboard commit/cancel ergonomics and direct keyboard entry into canonical Studio property inputs
 * does-not-own: property mutation, CommandBus, authority or transform math
 * public-api: createStudioPropertyCommitController()
 * online: delegates persistence to the existing [data-prop] change handler
 */

const PROPERTY_SELECTOR='#kelo-studio-live [data-prop]';
const EDITABLE_SELECTOR='input,textarea,select,[contenteditable="true"],[contenteditable=""]';

export function shouldHandleStudioPropertyCommitKey(event){
  if(!event||event.defaultPrevented||event.repeat||event.ctrlKey||event.metaKey||event.altKey)return false;
  if(!event.target?.matches?.(PROPERTY_SELECTOR))return false;
  const key=String(event.key||'');
  return key==='Enter'||key==='Escape'||key==='Tab';
}

export function shouldHandleStudioPropertyFocusKey(event){
  if(!event||event.defaultPrevented||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return false;
  if(String(event.key||'')!=='F2')return false;
  return !event.target?.closest?.(EDITABLE_SELECTOR);
}

export function createStudioPropertyCommitController({root=globalThis}={}){
  const document=root?.document;
  if(!document?.addEventListener)return Object.freeze({focusFirstProperty:()=>false,destroy(){}});
  let destroyed=false;
  const initialValues=new WeakMap();
  const enqueue=typeof root?.queueMicrotask==='function'?root.queueMicrotask.bind(root):
    typeof globalThis.queueMicrotask==='function'?globalThis.queueMicrotask.bind(globalThis):fn=>Promise.resolve().then(fn);

  function enabledFields(){
    return Array.from(document.querySelectorAll?.(PROPERTY_SELECTOR)||[])
      .filter(field=>!field?.disabled&&field?.getAttribute?.('aria-disabled')!=='true');
  }

  function focusFirstProperty(){
    if(destroyed)return false;
    const first=enabledFields()[0];
    if(!first)return false;
    first.focus?.();
    first.select?.();
    return true;
  }

  function focusin(event){
    const input=event.target;
    if(!input?.matches?.(PROPERTY_SELECTOR))return;
    initialValues.set(input,String(input.value??''));
  }

  function keydown(event){
    if(shouldHandleStudioPropertyFocusKey(event)){
      if(!focusFirstProperty())return;
      event.preventDefault?.();
      event.stopPropagation?.();
      return;
    }
    if(!shouldHandleStudioPropertyCommitKey(event))return;
    const input=event.target;

    if(event.key==='Escape'){
      event.preventDefault?.();
      event.stopPropagation?.();
      const initial=initialValues.get(input);
      if(initial!==undefined)input.value=initial;
      input.blur?.();
      return;
    }

    const before=Array.from(document.querySelectorAll?.(PROPERTY_SELECTOR)||[]);
    const enabledBefore=before.filter(field=>!field?.disabled&&field?.getAttribute?.('aria-disabled')!=='true');
    const sourceIndex=before.indexOf(input);
    const enabledSourceIndex=enabledBefore.indexOf(input);
    const direction=event.shiftKey?-1:1;
    const sourceProp=String(input.dataset?.prop??input.getAttribute?.('data-prop')??'');
    const isTab=event.key==='Tab';

    // Keep native Tab behavior at the panel edges so keyboard users can leave the
    // Inspector naturally. Internal Tab navigation is stabilized across rerenders.
    if(isTab&&(enabledSourceIndex<0||enabledSourceIndex+direction<0||enabledSourceIndex+direction>=enabledBefore.length))return;

    event.preventDefault?.();
    event.stopPropagation?.();

    // Blur is intentionally canonical: the shell's existing `change` listener
    // owns conversion/clamping and forwards through its established CommandBus path.
    input.blur?.();

    // Property panels can rerender synchronously after commit. Resolve the fresh
    // input list in a microtask, then continue spreadsheet-style editing.
    enqueue(()=>{
      if(destroyed)return;
      const fields=enabledFields();
      if(!fields.length)return;
      let index=fields.indexOf(input);
      if(index<0&&sourceProp){
        index=fields.findIndex(field=>String(field.dataset?.prop??field.getAttribute?.('data-prop')??'')===sourceProp);
      }
      if(index<0&&sourceIndex>=0)index=Math.min(sourceIndex,fields.length-1);
      if(index<0)return;
      const nextIndex=isTab?index+direction:(index+direction+fields.length)%fields.length;
      if(nextIndex<0||nextIndex>=fields.length)return;
      const next=fields[nextIndex];
      if(!next||next===input&&fields.length===1)return;
      next.focus?.();
      next.select?.();
    });
  }

  document.addEventListener('focusin',focusin,true);
  document.addEventListener('keydown',keydown,true);
  return Object.freeze({
    version:'studio-property-commit-v1.4.0-stable-tab-navigation',
    focusFirstProperty,
    destroy(){
      if(destroyed)return;
      destroyed=true;
      document.removeEventListener?.('focusin',focusin,true);
      document.removeEventListener?.('keydown',keydown,true);
    }
  });
}
