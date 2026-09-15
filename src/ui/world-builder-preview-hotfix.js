/* KELO-INDEX
 * area: UI
 * keys: WORLD BUILDER PREVIEW MOBILE EXIT CLEAN VIEW DRAFT LIVE
 * hace: corrige la vista previa del World Builder: proyecta el draft, oculta herramientas/guías y deja un botón táctil para volver a editar
 * online: usa exclusivamente KELO_WORLD_EDIT.request(); no conoce storage ni transporte
 */
(function(){
'use strict';
if(window.KELO_WORLD_BUILDER_PREVIEW_FIX)return;

const VERSION='world-builder-preview-hotfix-v1.0.0';
let active=false,busy=false,previewDraftId=null;
const actor=()=>window.KELO_ADMIN_KEYS?.playerId?.()||'local_pioneer';
const E=()=>window.KELO_WORLD_EDIT;
const U=()=>window.KELO_WORLD_BUILDER_UI;
const toast=msg=>{if(typeof window.showToast==='function')window.showToast(msg);else console.info('[WorldBuilder preview]',msg);};

function ensureStyle(){
  if(document.getElementById('kelo-world-preview-fix-style'))return;
  const s=document.createElement('style');s.id='kelo-world-preview-fix-style';s.textContent=`
body.kelo-world-preview-clean #kelo-world-builder,
body.kelo-world-preview-clean #kelo-world-builder-fab{display:none!important}
#kelo-world-preview-exit{position:fixed;z-index:290;left:50%;transform:translateX(-50%);bottom:max(18px,calc(env(safe-area-inset-bottom) + 14px));display:none;align-items:center;gap:7px;border:1px solid rgba(231,197,106,.72);border-radius:14px;background:rgba(7,13,15,.94);color:#ffe69a;padding:11px 15px;font:900 10px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 12px 34px rgba(0,0,0,.5);pointer-events:auto;backdrop-filter:blur(10px)}
#kelo-world-preview-exit small{font-size:7px;color:#9ed7be;font-weight:800;letter-spacing:.04em}
body.kelo-world-preview-clean #kelo-world-preview-exit{display:flex}
@media(max-height:460px) and (orientation:landscape){#kelo-world-preview-exit{bottom:max(8px,env(safe-area-inset-bottom));padding:9px 12px}}
`;document.head.appendChild(s);
}
function ensureButton(){
  let b=document.getElementById('kelo-world-preview-exit');
  if(b)return b;
  b=document.createElement('button');b.id='kelo-world-preview-exit';b.type='button';
  b.innerHTML='<span>← VOLVER A EDITAR</span><small>VISTA PREVIA</small>';
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();exitPreview();});
  document.body.appendChild(b);return b;
}
function setPreviewClass(on){
  document.body.classList.toggle('kelo-world-preview-clean',!!on);
  document.body.classList.toggle('kelo-world-previewing',!!on);
}
async function enterPreview(){
  if(active||busy)return;
  const api=E(),ui=U(),draft=ui?.currentDraft;
  if(!api?.ready||!ui||!draft?.draftId)return toast('No hay borrador listo para previsualizar');
  busy=true;
  try{
    if(['DRAFT','REJECTED'].includes(draft.status)){
      await api.request('world:draft:save',{actorId:actor(),draftId:draft.draftId});
    }
    const res=await api.request('world:preview:enter',{actorId:actor(),draftId:draft.draftId});
    if(api.getViewState?.().kind!=='preview')throw new Error('PREVIEW_VIEW_NOT_ACTIVE');
    previewDraftId=draft.draftId;active=true;
    await ui.close(false);
    setPreviewClass(true);ensureButton();
    toast('Vista previa activa · estás viendo el borrador sin herramientas');
    window.dispatchEvent(new CustomEvent('kelo:world-preview',{detail:{active:true,draftId:previewDraftId,view:api.getViewState?.()||null}}));
    return res;
  }catch(err){
    active=false;previewDraftId=null;setPreviewClass(false);toast(err.message||'No se pudo abrir la vista previa');
  }finally{busy=false;}
}
async function exitPreview(){
  if(!active||busy)return;
  busy=true;
  const api=E(),ui=U();
  try{
    await api.request('world:preview:exit',{actorId:actor()});
    active=false;setPreviewClass(false);
    const oldDraftId=previewDraftId;previewDraftId=null;
    await ui?.open?.();
    toast('Volviste al editor del borrador');
    window.dispatchEvent(new CustomEvent('kelo:world-preview',{detail:{active:false,draftId:oldDraftId,view:api.getViewState?.()||null}}));
  }catch(err){toast(err.message||'No se pudo salir de la vista previa');}
  finally{busy=false;}
}
function interceptPreviewClick(e){
  const b=e.target?.closest?.('#wb-preview');if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(active)exitPreview();else enterPreview();
}
function boot(){
  if(!E()?.ready||!U()){setTimeout(boot,80);return;}
  ensureStyle();ensureButton();
  document.addEventListener('click',interceptPreviewClick,true);
}

window.KELO_WORLD_BUILDER_PREVIEW_FIX=Object.freeze({
  version:VERSION,
  enter:enterPreview,
  exit:exitPreview,
  get active(){return active;},
  get draftId(){return previewDraftId;}
});
window.KELO_WORLD_BUILDER_PREVIEW_FIX_AUDIT=Object.freeze({version:VERSION,cleanPreview:true,exitButton:true,requestBoundary:'KELO_WORLD_EDIT.request',storageFree:true,transportFree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();
