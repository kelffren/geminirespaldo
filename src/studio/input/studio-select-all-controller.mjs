/* KELO-INDEX
 * area: STUDIO / INPUT
 * owns: select-all and clear-selection keyboard shortcuts for current world entities
 * does-not-own: document mutation, CommandBus commands or persistent history
 * public-api: createStudioSelectAllController()
 * online: local-only transient selection state
 */

const EDITABLE_SELECTOR='input,textarea,select,[contenteditable="true"],[contenteditable=""]';

export function createStudioSelectAllController({root=globalThis,kernel}={}){
  const document=root?.document;
  if(!document||!kernel?.selection)return Object.freeze({destroy(){}});
  let destroyed=false;

  const onKeyDown=event=>{
    if(destroyed||event.defaultPrevented||event.repeat)return;
    if(event.target?.closest?.(EDITABLE_SELECTOR))return;
    if(!document.getElementById?.('kelo-studio-live'))return;

    if(event.key==='Escape'){
      if(!kernel.selection.get?.().length)return;
      event.preventDefault?.();
      kernel.selection.set([]);
      return;
    }

    if(!(event.metaKey||event.ctrlKey)||event.metaKey&&event.ctrlKey||event.altKey)return;
    if(String(event.key||'').toLowerCase()!=='a')return;

    if(event.shiftKey){
      event.preventDefault?.();
      kernel.selection.set([]);
      return;
    }

    const ids=[];
    const seen=new Set();
    for(const entity of kernel.document?.entities||[]){
      if(entity?.id==null)continue;
      const id=String(entity.id);
      if(!id||seen.has(id))continue;
      seen.add(id);ids.push(id);
    }
    if(!ids.length)return;
    event.preventDefault?.();
    kernel.selection.set(ids);
  };

  document.addEventListener?.('keydown',onKeyDown);
  return Object.freeze({
    version:'studio-select-all-v1.2.0-escape-clear',
    destroy(){if(destroyed)return;destroyed=true;document.removeEventListener?.('keydown',onKeyDown);}
  });
}
