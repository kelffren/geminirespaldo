/* KELO-INDEX
 * area: CREATORS / DRAFT AUTOSAVE
 * owner: generic Creator workspace draft-save scheduling
 * owns: dirty/debounce/flush lifecycle only
 * does-not-own: repositories, documents, validation, UI, networking or publish
 * reused-by: Animation Creator, VFX Creator and future repository-backed workspaces
 */
export function createWorkspaceDraftAutosave({save,delay=650,onState=null,setTimeoutFn=globalThis.setTimeout?.bind(globalThis),clearTimeoutFn=globalThis.clearTimeout?.bind(globalThis)}={}){
  if(typeof save!=='function')throw new Error('CREATOR_AUTOSAVE_SAVE_REQUIRED');
  let timer=null,dirty=false,saving=null;
  const emit=()=>{try{onState?.({dirty,saving:!!saving});}catch{}};
  async function run(){if(!dirty)return null;if(saving)return saving;dirty=false;emit();saving=Promise.resolve().then(save).catch(error=>{dirty=true;emit();throw error;}).finally(()=>{saving=null;emit();});return saving;}
  function markDirty(){dirty=true;if(timer&&clearTimeoutFn)clearTimeoutFn(timer);timer=setTimeoutFn?setTimeoutFn(()=>{timer=null;void run().catch(error=>console.warn('[Kelo Creators autosave]',error));},Math.max(0,Number(delay)||0)):null;emit();return true;}
  async function flush(){if(timer&&clearTimeoutFn){clearTimeoutFn(timer);timer=null;}if(saving)await saving;if(dirty)return run();return null;}
  function cancel(){if(timer&&clearTimeoutFn)clearTimeoutFn(timer);timer=null;dirty=false;emit();}
  return Object.freeze({version:'creator-draft-autosave-v1.0.0',markDirty,flush,cancel,get dirty(){return dirty;},get saving(){return !!saving;}});
}
