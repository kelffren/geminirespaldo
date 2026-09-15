/* KELO-INDEX
 * area: UI
 * keys: WORLD BUILDER ADMIN KEY DRAFT REVIEW PUBLISH ROLLBACK PREVIEW AUTOSAVE TERRAIN PATH OBJECT COLLISION MOBILE TOUCH
 * hace: editor táctil por capas + flujo Draft→Review→Publish; toda mutación sale por KELO_WORLD_EDIT.request()
 * online: UI no conoce persistencia ni transporte; cambiar Local por Remote no modifica esta UI
 */
(function(){
'use strict';
if(window.KELO_WORLD_BUILDER_UI)return;

const VERSION='world-builder-ui-v2.0.0';
const WORLD_PARCEL_ID='parcel:world:editor';
let WB=null,E=null,S=null,C=null,open=false,layer='terrain',brushSize=1,material='grass',eraseTerrain=false;
let selectedAsset=null,selectedPlacement=null,movingPlacement=null,selectedCollision=null,collisionSize={w:64,h:64},painting=false,lastPaintKey='',cursor=null;
let currentDraft=null,publishedRevision=null,revisions=[],previewing=false,saveTimer=null,saveLabel='GUARDADO',workflowBusy=false;
const toast=msg=>{if(typeof window.showToast==='function')window.showToast(msg);else console.info('[WorldBuilder]',msg);};
const canEdit=()=>!!window.KELO_ADMIN_KEYS?.can?.('world.edit',window.KELO_ADMIN_KEYS?.playerId?.());
const canScope=s=>!!window.KELO_ADMIN_KEYS?.can?.(s,window.KELO_ADMIN_KEYS?.playerId?.());
const actor=()=>window.KELO_ADMIN_KEYS?.playerId?.()||S?.playerId?.()||'local_pioneer';
const tile=()=>Number(WB?.tileSize)||32;
const editable=()=>!!currentDraft&&['DRAFT','REJECTED'].includes(currentDraft.status)&&!previewing;
function ready(){WB=window.KELO_WORLD_BUILDER;E=window.KELO_WORLD_EDIT;S=window.KELO_PROPERTY_SYSTEM;C=window.KELO_PROPERTY_CATALOG;return!!(WB&&E?.ready&&S&&C&&window.KELO_ADMIN_KEYS);}
function toWorld(sx,sy){if(typeof window.screenToWorld==='function')return window.screenToWorld(sx,sy);const z=window.CONFIG?.zoom||1,c=window.camera||{x:0,y:0};return{x:c.x+(sx-(window.screenW||innerWidth)/2)/z,y:c.y+(sy-(window.screenH||innerHeight)/2)/z};}
function snapPoint(w,size=tile()){return{x:Math.floor(Math.max(0,w.x)/size)*size,y:Math.floor(Math.max(0,w.y)/size)*size};}
function root(){return document.getElementById('kelo-world-builder');}
function fab(){return document.getElementById('kelo-world-builder-fab');}
function el(id){return document.getElementById(id);}
function draftId(){return currentDraft?.draftId||null;}
function statusIcon(status){return status==='SUBMITTED'?'🔵':status==='APPROVED'||status==='PUBLISHED'?'🟢':status==='REJECTED'?'🔴':'🟡';}
function statusLabel(status){return status==='SUBMITTED'?'EN REVISIÓN':status==='APPROVED'?'APROBADO':status==='PUBLISHED'?'PUBLICADO':status==='REJECTED'?'RECHAZADO':'BORRADOR';}

function ensureStyle(){
  if(document.getElementById('kelo-world-builder-style'))return;
  const style=document.createElement('style');style.id='kelo-world-builder-style';style.textContent=`
#kelo-world-builder{position:fixed;z-index:270;left:max(8px,env(safe-area-inset-left));top:max(8px,env(safe-area-inset-top));bottom:max(8px,env(safe-area-inset-bottom));width:min(430px,calc(100vw - 16px));display:none;flex-direction:column;background:rgba(7,13,15,.985);border:1px solid rgba(231,197,106,.52);border-radius:21px;color:#eef4ef;box-shadow:0 26px 80px rgba(0,0,0,.66);overflow:hidden;pointer-events:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
#kelo-world-builder *{box-sizing:border-box}.wb-head{display:flex;gap:8px;align-items:center;padding:10px 11px;border-bottom:1px solid rgba(255,255,255,.07)}.wb-title{font-weight:950;color:#f0d37b;flex:1;letter-spacing:.03em}.wb-badge{font-size:8px;color:#9ed7be;background:#12352d;border:1px solid rgba(115,211,168,.28);border-radius:999px;padding:5px 7px;white-space:nowrap}.wb-close{width:34px;height:34px;border-radius:10px;border:1px solid rgba(231,197,106,.28);background:#101b1e;color:#e7c56a;font-size:20px}
.wb-workflow{padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.018)}.wb-worldline{display:flex;gap:8px;align-items:center;font-size:8px;color:#81958d}.wb-worldline strong{font-size:9px;color:#e7ece9}.wb-worldline .grow{flex:1}.wb-save-state{font-size:7px;color:#83b8a4}.wb-state{margin-top:5px;font-size:9px;font-weight:900;color:#efd77e}.wb-flow-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.wb-flow-actions button,.wb-history button{background:#101b1e;color:#e9d38d;border:1px solid rgba(231,197,106,.22);border-radius:8px;padding:7px;font-size:8px;font-weight:850}.wb-flow-actions button.primary{background:#24443a;border-color:#d5ba68;color:#fff1ba}.wb-flow-actions button.danger{color:#ffb5b5;border-color:rgba(255,100,100,.35)}.wb-flow-actions button:disabled{opacity:.38}.wb-history{margin-top:6px}.wb-history summary{font-size:8px;color:#8fa19a;cursor:pointer}.wb-history-list{max-height:104px;overflow:auto;margin-top:5px;display:grid;gap:4px}.wb-rev{display:flex;gap:6px;align-items:center;padding:5px 6px;border:1px solid rgba(255,255,255,.06);border-radius:8px;font-size:8px;color:#93a79f}.wb-rev strong{color:#e8d28b}.wb-rev span{flex:1}
.wb-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:7px 8px}.wb-tab{min-width:0;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:#0f191c;color:#8fa19a;padding:8px 4px;font-size:8px;font-weight:900}.wb-tab.on{color:#ffe69a;border-color:rgba(231,197,106,.56);background:#18251f}.wb-tab:disabled{opacity:.35}.wb-status{padding:0 11px 7px;font-size:8px;color:#8ea099;line-height:1.35}.wb-controls{padding:0 9px 7px;display:flex;gap:6px;flex-wrap:wrap}.wb-controls button,.wb-controls select,.wb-controls input,.wb-footer button,.wb-actions button{background:#101b1e;color:#e9d38d;border:1px solid rgba(231,197,106,.22);border-radius:9px;padding:8px;font-size:9px;font-weight:800}.wb-controls button.on{background:#24443a;border-color:#e7c56a;color:#fff1ba}.wb-controls .danger{color:#ffadad;border-color:rgba(255,100,100,.35)}.wb-list{flex:1;overflow:auto;padding:0 9px 9px;display:grid;grid-template-columns:repeat(2,1fr);gap:7px;align-content:start;-webkit-overflow-scrolling:touch}.wb-card{min-height:72px;text-align:left;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:#0e181a;color:#e7ece9;padding:7px}.wb-card.on{border-color:#e7c56a;box-shadow:inset 0 0 0 1px rgba(231,197,106,.18)}.wb-card:disabled{opacity:.45}.wb-card strong{display:block;font-size:9px}.wb-card small{display:block;color:#7e928a;font-size:7px;margin-top:4px}.wb-actions{display:flex;gap:6px;padding:7px 9px;border-top:1px solid rgba(255,255,255,.06)}.wb-actions span{flex:1;color:#8fa19a;font-size:8px;align-self:center}.wb-footer{display:flex;gap:6px;padding:7px 9px;border-top:1px solid rgba(255,255,255,.06)}.wb-footer button{flex:1}.wb-hint{padding:0 10px 7px;font-size:8px;color:#789088}.wb-hidden{display:none!important}
#kelo-world-builder-fab{position:fixed;z-index:250;left:max(10px,env(safe-area-inset-left));bottom:max(58px,calc(env(safe-area-inset-bottom) + 52px));border:1px solid rgba(231,197,106,.62);background:linear-gradient(145deg,#17241f,#0b1214);color:#f1d77e;border-radius:14px;padding:10px 12px;font:900 9px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.42);pointer-events:auto}
body.kelo-world-building #menu-sheet,body.kelo-world-building #kelo-property-editor{pointer-events:none!important}
body.kelo-world-previewing #kelo-world-builder{opacity:.16;pointer-events:none}
@media(max-width:620px){#kelo-world-builder{top:auto;height:min(76vh,650px)}.wb-list{grid-template-columns:repeat(3,1fr)}.wb-card{min-height:64px;padding:6px}#kelo-world-builder-fab{bottom:max(70px,calc(env(safe-area-inset-bottom) + 64px))}.wb-workflow{padding:6px 8px}.wb-flow-actions button{padding:6px;font-size:7px}}
@media(max-height:460px) and (orientation:landscape){#kelo-world-builder{top:4px;bottom:4px;height:auto;width:min(390px,46vw)}.wb-history-list{max-height:70px}.wb-card{min-height:56px}.wb-workflow{padding:5px 7px}.wb-tabs{padding:4px 7px}.wb-controls{padding-bottom:4px}.wb-footer{padding:4px 7px}}
`;document.head.appendChild(style);
}
function ensureDom(){
  if(root())return;
  ensureStyle();
  const panel=document.createElement('section');panel.id='kelo-world-builder';panel.innerHTML=`
<div class="wb-head"><div class="wb-title">🗝 WORLD BUILDER</div><span class="wb-badge" id="wb-badge">CARGANDO</span><button class="wb-close" id="wb-close">×</button></div>
<div class="wb-workflow">
  <div class="wb-worldline"><strong>KELO WORLD</strong><span class="grow" id="wb-live">LIVE —</span><span class="wb-save-state" id="wb-save-state">GUARDADO</span></div>
  <div class="wb-state" id="wb-flow-state">Preparando borrador…</div>
  <div class="wb-flow-actions" id="wb-flow-actions"></div>
  <details class="wb-history" id="wb-history"><summary>HISTORIAL DE VERSIONES</summary><div class="wb-history-list" id="wb-history-list"></div></details>
</div>
<div class="wb-tabs"><button class="wb-tab" data-wb-layer="terrain">SUELO</button><button class="wb-tab" data-wb-layer="path">CAMINOS</button><button class="wb-tab" data-wb-layer="objects">OBJETOS</button><button class="wb-tab" data-wb-layer="collision">COLISIÓN</button></div>
<div class="wb-status" id="wb-status"></div><div class="wb-controls" id="wb-controls"></div><div class="wb-list" id="wb-list"></div>
<div class="wb-actions" id="wb-actions"></div><div class="wb-hint" id="wb-hint"></div>
<div class="wb-footer"><button id="wb-export">EXPORTAR</button><button id="wb-import">IMPORTAR</button><input id="wb-file" type="file" accept="application/json,.json" hidden><button id="wb-reset" class="danger">REVELAR BASE TOTAL</button></div>`;
  document.body.appendChild(panel);
  const b=document.createElement('button');b.id='kelo-world-builder-fab';b.textContent='🗝 WORLD BUILDER';b.onclick=()=>openBuilder();document.body.appendChild(b);
  el('wb-close').onclick=()=>closeBuilder();
  panel.querySelector('.wb-tabs').onclick=e=>{const btn=e.target.closest('[data-wb-layer]');if(btn)setLayer(btn.dataset.wbLayer);};
  el('wb-export').onclick=exportDraft;
  el('wb-import').onclick=()=>{if(!canScope('world.import'))return toast('Tu llave no tiene permiso de importar');el('wb-file').click();};
  el('wb-file').onchange=importDraft;
  el('wb-reset').onclick=clearDraftOverrides;
  syncPermissionUI();
}
function syncPermissionUI(){
  const allowed=canEdit();
  if(fab())fab().style.display=allowed?'block':'none';
  const tabs=document.getElementById('pe-tabs');if(tabs&&allowed)tabs.classList.remove('pe-hidden');
  if(open&&!allowed)closeBuilder();
}
async function refreshWorkflow(){
  if(!E?.ready)return;
  try{
    const [d,p,r]=await Promise.all([E.getCurrentDraft(),E.getPublishedRevision(),E.listRevisions()]);
    currentDraft=d?.draft||currentDraft;
    publishedRevision=p?.revision||publishedRevision;
    revisions=r?.revisions||revisions;
    renderWorkflow();status();
  }catch(err){if(canEdit())console.warn('[WorldBuilder workflow]',err);}
}
function renderWorkflow(){
  if(!root())return;
  const badge=el('wb-badge'),live=el('wb-live'),flow=el('wb-flow-state'),a=el('wb-flow-actions');
  if(live)live.textContent=`LIVE v${publishedRevision?.number||1}`;
  if(badge)badge.textContent=`${E?.authoritySource?.()==='local'?'OFFLINE':'ONLINE'} · ${currentDraft?statusLabel(currentDraft.status):'SIN BORRADOR'}`;
  if(flow)flow.textContent=currentDraft?`${statusIcon(currentDraft.status)} ${statusLabel(currentDraft.status)} · ${currentDraft.changeCount||0} cambios · base v${revisionNumber(currentDraft.baseRevisionId)||publishedRevision?.number||1}`:'Sin borrador activo';
  if(a){
    a.innerHTML='';
    const add=(id,text,fn,{primary=false,danger=false,disabled=false}={})=>{const b=document.createElement('button');b.id=id;b.textContent=text;b.disabled=disabled;b.className=primary?'primary':danger?'danger':'';b.onclick=fn;a.appendChild(b);return b;};
    if(!currentDraft){
      add('wb-new-draft','NUEVO BORRADOR',createNewDraft,{primary:true});
    }else if(['DRAFT','REJECTED'].includes(currentDraft.status)){
      add('wb-save','GUARDAR',saveNow);
      add('wb-preview',previewing?'SALIR PREVIEW':'VISTA PREVIA',togglePreview);
      add('wb-submit','ENVIAR A REVISIÓN',submitDraft,{primary:true});
      add('wb-discard','DESCARTAR',discardDraft,{danger:true});
    }else if(currentDraft.status==='SUBMITTED'){
      if(canScope('world.publish')){
        add('wb-approve','APROBAR',approveDraft,{primary:true});
        add('wb-reject','RECHAZAR',rejectDraft,{danger:true});
      }
    }else if(currentDraft.status==='APPROVED'){
      if(canScope('world.publish')){
        add('wb-publish','PUBLICAR',publishDraft,{primary:true});
        add('wb-reject','RECHAZAR',rejectDraft,{danger:true});
      }
    }else{
      add('wb-new-draft','NUEVO BORRADOR',createNewDraft,{primary:true});
    }
  }
  const editableNow=editable();
  root().querySelectorAll('.wb-tab').forEach(b=>b.disabled=!editableNow);
  if(el('wb-export'))el('wb-export').disabled=!currentDraft||!canScope('world.export');
  if(el('wb-import'))el('wb-import').disabled=!editableNow||!canScope('world.import');
  if(el('wb-reset'))el('wb-reset').disabled=!editableNow;
  renderHistory();
}
function revisionNumber(id){return revisions.find(r=>r.revisionId===id)?.number||null;}
function renderHistory(){
  const list=el('wb-history-list');if(!list)return;list.innerHTML='';
  if(!revisions.length){list.textContent='Sin historial';return;}
  for(const r of revisions.slice(0,12)){
    const row=document.createElement('div');row.className='wb-rev';
    const label=document.createElement('strong');label.textContent=`v${r.number}`;
    const text=document.createElement('span');text.textContent=r.revisionId===publishedRevision?.revisionId?'PUBLICADO AHORA':r.rolledBackFromRevisionId?`rollback de v${revisionNumber(r.rolledBackFromRevisionId)||'?'}`:'publicado';
    row.append(label,text);
    if(canScope('world.publish')&&r.revisionId!==publishedRevision?.revisionId){
      const b=document.createElement('button');b.textContent='RESTAURAR';b.onclick=()=>rollback(r.revisionId);row.appendChild(b);
    }
    list.appendChild(row);
  }
}
function status(){
  if(!root()||!WB)return;
  const s=WB.snapshot(),objectCount=S?.getPlacements?.(WORLD_PARCEL_ID)?.length||0;
  el('wb-status').textContent=`Vista ${s.view?.kind||'—'} · suelo ${Object.keys(s.cells||{}).length} · objetos ${objectCount} · colisiones ${Object.keys(s.collisions||{}).length}`;
}
function setLayer(next){
  layer=['terrain','path','objects','collision'].includes(next)?next:'terrain';
  selectedAsset=null;selectedPlacement=null;movingPlacement=null;selectedCollision=null;eraseTerrain=false;cursor=null;
  root().querySelectorAll('[data-wb-layer]').forEach(b=>b.classList.toggle('on',b.dataset.wbLayer===layer));
  renderControls();renderList();renderActions();status();
}
function renderControls(){
  const c=el('wb-controls');c.innerHTML='';
  if(!editable()){el('wb-hint').textContent='Este borrador está bloqueado para edición en su estado actual.';return;}
  if(layer==='terrain'||layer==='path'){
    const mats=layer==='path'?['marble','grass']:['grass','marble'];
    for(const id of mats){const b=document.createElement('button');b.textContent=id==='grass'?(layer==='path'?'QUITAR CAMINO':'PASTO'):'MÁRMOL';b.classList.toggle('on',material===id&&!eraseTerrain);b.onclick=()=>{material=id;eraseTerrain=false;renderControls();};c.appendChild(b);}
    const erase=document.createElement('button');erase.textContent='REVELAR BASE';erase.className=eraseTerrain?'on':'';erase.onclick=()=>{eraseTerrain=!eraseTerrain;renderControls();};c.appendChild(erase);
    for(const n of [1,3,5]){const b=document.createElement('button');b.textContent=`PINCEL ${n}×${n}`;b.classList.toggle('on',brushSize===n);b.onclick=()=>{brushSize=n;renderControls();};c.appendChild(b);}
  }else if(layer==='objects'){
    const input=document.createElement('input');input.id='wb-q';input.placeholder='Buscar objeto…';input.oninput=renderList;
    const select=document.createElement('select');select.id='wb-cat';select.innerHTML='<option value="">Todos</option>'+C.categories().map(x=>`<option value="${x}">${x}</option>`).join('');select.onchange=renderList;c.append(input,select);
  }else{
    for(const s of [{w:32,h:32},{w:64,h:32},{w:64,h:64},{w:128,h:64}]){const b=document.createElement('button');b.textContent=`${s.w}×${s.h}`;b.classList.toggle('on',collisionSize.w===s.w&&collisionSize.h===s.h);b.onclick=()=>{collisionSize=s;renderControls();};c.appendChild(b);}
  }
  el('wb-hint').textContent=layer==='objects'?'Selecciona un asset y toca el mundo. Todo placement pasa por KELO_WORLD_EDIT.':layer==='collision'?'Toca el mundo para crear bloqueos del borrador.':'Pinta el borrador; REVELAR BASE elimina el override sin tocar el mapa original.';
}
function renderList(){
  const list=el('wb-list');list.innerHTML='';
  if(layer!=='objects'||!editable()){list.classList.add('wb-hidden');return;}
  list.classList.remove('wb-hidden');
  const q=(el('wb-q')?.value||'').toLowerCase(),cat=el('wb-cat')?.value||'';
  let rows=C.list({category:cat||undefined});if(q)rows=rows.filter(t=>`${t.label} ${t.id} ${t.family}`.toLowerCase().includes(q));
  const rr=window.KELO_WORLD_BUILDER_PROPERTY_RENDERER;let readyKeys=new Set(),failed={},hasPending=false;
  if(rr){
    readyKeys=new Set(rr.readyKeys||[]);failed=rr.errors||{};
    rows=rows.filter(t=>{const keys=[...new Set((t.parts||[]).map(p=>p.assetKey).filter(Boolean))];return keys.length&&keys.every(k=>!failed[k]);});
    hasPending=rows.some(t=>[...new Set((t.parts||[]).map(p=>p.assetKey).filter(Boolean))].some(k=>!readyKeys.has(k)));
  }
  if(!rows.length){const empty=document.createElement('div');empty.style.cssText='grid-column:1/-1;padding:14px;color:#8fa19a;font-size:9px';empty.textContent='No hay assets visuales disponibles en esta categoría.';list.appendChild(empty);return;}
  for(const t of rows){
    const keys=[...new Set((t.parts||[]).map(p=>p.assetKey).filter(Boolean))],isReady=!rr||keys.every(k=>readyKeys.has(k));
    const b=document.createElement('button');b.className='wb-card'+(selectedAsset===t.id?' on':'');b.dataset.assetId=t.id;b.dataset.ready=isReady?'1':'0';b.disabled=!isReady;
    b.innerHTML=`<strong>${t.label}</strong><small>${t.category} · ${Math.round(t.width)}×${Math.round(t.height)} · ${isReady?'∞ admin':'CARGANDO…'}</small>`;
    b.onclick=()=>{selectedAsset=t.id;selectedPlacement=null;movingPlacement=null;renderList();renderActions();};list.appendChild(b);
  }
  if(hasPending)setTimeout(()=>{if(open&&layer==='objects')renderList();},180);
}
function renderActions(){
  const a=el('wb-actions');a.innerHTML='';
  if(!editable()){const label=document.createElement('span');label.textContent='Edición bloqueada';a.append(label);return;}
  if(layer==='objects'){
    const m=document.createElement('button');m.textContent=movingPlacement?'TOCA DESTINO':'MOVER';m.disabled=!selectedPlacement;m.onclick=()=>{movingPlacement=movingPlacement?null:selectedPlacement;selectedAsset=null;renderList();renderActions();};
    const r=document.createElement('button');r.textContent='↻ GIRAR';r.disabled=!selectedPlacement;r.onclick=rotateObject;
    const d=document.createElement('button');d.textContent='BORRAR';d.disabled=!selectedPlacement;d.onclick=deleteObject;
    const label=document.createElement('span');label.textContent=selectedPlacement?'Objeto seleccionado':selectedAsset?'Toca el mundo para colocar':'Selecciona un objeto';a.append(m,r,d,label);
  }else if(layer==='collision'){
    const d=document.createElement('button');d.textContent='BORRAR BLOQUEO';d.disabled=!selectedCollision;d.onclick=deleteCollision;
    const label=document.createElement('span');label.textContent=selectedCollision?'Bloqueo seleccionado':'Toca para crear';a.append(d,label);
  }else{
    const label=document.createElement('span');label.textContent=eraseTerrain?'Revelar mapa base':'Pintura activa';a.append(label);
  }
}
async function ensureDraftForEditing(){
  let res=await E.getCurrentDraft();currentDraft=res?.draft||null;
  if(!currentDraft||!['DRAFT','REJECTED','SUBMITTED','APPROVED'].includes(currentDraft.status)){
    res=await E.request('world:draft:create',{actorId:actor()});currentDraft=res.draft;
  }else{
    res=await E.request('world:draft:get',{actorId:actor(),draftId:currentDraft.draftId});currentDraft=res.draft;
  }
  const pub=await E.getPublishedRevision();publishedRevision=pub?.revision||publishedRevision;
  revisions=(await E.listRevisions())?.revisions||[];
  renderWorkflow();return currentDraft;
}
async function openBuilder(){
  if(!ready())return toast('World Builder todavía cargando');
  if(!canEdit())return toast('Necesitas una Llave Admin con permiso world.edit');
  if(!WB.isMainWorld())return toast('Sal de la casa para editar el mundo principal');
  workflowBusy=true;
  try{
    open=true;previewing=false;root().style.display='flex';document.body.classList.add('kelo-world-building');
    try{window.KELO_PROPERTY_EDITOR?.close?.();}catch(e){}
    if(typeof window.closeMenu==='function')window.closeMenu();
    await ensureDraftForEditing();setLayer(layer);
  }catch(err){toast(err.message||'No se pudo abrir World Builder');open=false;root().style.display='none';document.body.classList.remove('kelo-world-building');}
  finally{workflowBusy=false;}
}
async function closeBuilder(restoreLive=true){
  if(workflowBusy)return;
  open=false;painting=false;cursor=null;previewing=false;clearTimeout(saveTimer);saveTimer=null;
  if(root())root().style.display='none';document.body.classList.remove('kelo-world-building','kelo-world-previewing');
  if(restoreLive&&E?.ready){try{await E.request('world:view:published',{actorId:actor()});}catch(e){}}
}
function updateDraftFromResult(res){if(res?.draft)currentDraft=res.draft;renderWorkflow();status();}
function scheduleAutosave(){
  if(!editable())return;
  saveLabel='GUARDANDO…';if(el('wb-save-state'))el('wb-save-state').textContent=saveLabel;
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveNow(true),350);
}
async function saveNow(silent=false){
  if(!currentDraft||!['DRAFT','REJECTED'].includes(currentDraft.status))return;
  try{
    saveLabel='GUARDANDO…';if(el('wb-save-state'))el('wb-save-state').textContent=saveLabel;
    const res=await E.request('world:draft:save',{actorId:actor(),draftId:draftId()});updateDraftFromResult(res);
    saveLabel='GUARDADO';if(el('wb-save-state'))el('wb-save-state').textContent=saveLabel;if(!silent)toast('Borrador guardado');
  }catch(err){saveLabel='ERROR AL GUARDAR';if(el('wb-save-state'))el('wb-save-state').textContent=saveLabel;if(!silent)toast(err.message);}
}
async function paintAt(w){
  if(!editable())return;
  const p=snapPoint(w),k=`${p.x},${p.y}:${layer}:${brushSize}:${eraseTerrain}:${material}`;if(k===lastPaintKey)return;lastPaintKey=k;
  try{
    const res=eraseTerrain?
      await E.request('world:tile:clear',{actorId:actor(),draftId:draftId(),x:p.x,y:p.y,brushSize}):
      await E.request('world:tile:paint',{actorId:actor(),draftId:draftId(),x:p.x,y:p.y,brushSize,material,role:layer==='path'?'path':'terrain'});
    updateDraftFromResult(res);scheduleAutosave();
  }catch(err){toast(err.message);}
}
async function objectAt(w){
  if(!editable())return;
  if(movingPlacement){
    const rec=S.getPlacements(WORLD_PARCEL_ID).find(x=>x.placementId===movingPlacement),t=rec&&C.get(rec.assetId);
    if(!rec||!t){movingPlacement=null;return;}
    const p=snapPoint(w,t.snap||tile());
    try{const res=await E.request('world:placement:move',{actorId:actor(),draftId:draftId(),placementId:rec.placementId,x:p.x,y:p.y});movingPlacement=null;selectedPlacement=rec.placementId;updateDraftFromResult(res);scheduleAutosave();toast('Objeto movido');}catch(e){toast(e.message);}
    renderActions();return;
  }
  const hit=S.placementForPoint(w.x,w.y,WORLD_PARCEL_ID);
  if(hit){selectedPlacement=hit.placementId;selectedAsset=null;renderList();renderActions();return;}
  if(!selectedAsset)return;
  const t=C.get(selectedAsset),p=snapPoint(w,t?.snap||tile());
  try{
    const res=await E.request('world:placement:create',{actorId:actor(),draftId:draftId(),assetId:selectedAsset,x:p.x,y:p.y,rotation:0});
    selectedPlacement=res.placement?.placementId||null;updateDraftFromResult(res);scheduleAutosave();toast('Objeto colocado');renderActions();
  }catch(e){toast(e.message);}
}
async function collisionAtWorld(w){
  if(!editable())return;
  const hit=WB.collisionAt(w.x,w.y);if(hit){selectedCollision=hit.collisionId;renderActions();return;}
  const p=snapPoint(w);
  try{const res=await E.request('world:collision:create',{actorId:actor(),draftId:draftId(),x:p.x,y:p.y,w:collisionSize.w,h:collisionSize.h});selectedCollision=res.collision?.collisionId||null;updateDraftFromResult(res);scheduleAutosave();renderActions();}catch(e){toast(e.message);}
}
async function rotateObject(){
  if(!selectedPlacement||!editable())return;
  try{const res=await E.request('world:placement:rotate',{actorId:actor(),draftId:draftId(),placementId:selectedPlacement,delta:1});updateDraftFromResult(res);scheduleAutosave();toast('Objeto girado');}catch(e){toast(e.message);}
}
async function deleteObject(){
  if(!selectedPlacement||!editable())return;
  try{const res=await E.request('world:placement:remove',{actorId:actor(),draftId:draftId(),placementId:selectedPlacement});selectedPlacement=null;updateDraftFromResult(res);scheduleAutosave();renderActions();toast('Objeto borrado');}catch(e){toast(e.message);}
}
async function deleteCollision(){
  if(!selectedCollision||!editable())return;
  try{const res=await E.request('world:collision:remove',{actorId:actor(),draftId:draftId(),collisionId:selectedCollision});selectedCollision=null;updateDraftFromResult(res);scheduleAutosave();renderActions();toast('Bloqueo borrado');}catch(e){toast(e.message);}
}
function pointerDown(e){
  if(!open||previewing||!editable()||root().contains(e.target)||fab()?.contains(e.target))return;
  const w=toWorld(e.clientX,e.clientY);e.preventDefault();e.stopImmediatePropagation();if(typeof window.input!=='undefined')window.input.touchActive=false;
  painting=true;lastPaintKey='';
  if(layer==='terrain'||layer==='path')paintAt(w);else if(layer==='objects')objectAt(w);else collisionAtWorld(w);
}
function pointerMove(e){
  if(!open||previewing||root().contains(e.target))return;
  const w=toWorld(e.clientX,e.clientY),p=snapPoint(w);cursor={x:p.x,y:p.y,w:layer==='collision'?collisionSize.w:tile()*brushSize,h:layer==='collision'?collisionSize.h:tile()*brushSize};
  if(painting&&(layer==='terrain'||layer==='path'))paintAt(w);
}
function pointerUp(){painting=false;lastPaintKey='';}

async function createNewDraft(){
  if(workflowBusy)return;workflowBusy=true;
  try{const res=await E.request('world:draft:create',{actorId:actor(),forceNew:true});currentDraft=res.draft;previewing=false;await refreshWorkflow();setLayer(layer);toast('Nuevo borrador creado');}catch(e){toast(e.message);}finally{workflowBusy=false;}
}
async function submitDraft(){
  if(!editable())return;
  await saveNow(true);
  try{const res=await E.request('world:draft:submit',{actorId:actor(),draftId:draftId()});currentDraft=res.draft;await E.request('world:view:published',{actorId:actor()});await refreshWorkflow();renderControls();renderList();renderActions();toast('Enviado a revisión');}catch(e){toast(e.message);}
}
async function approveDraft(){
  if(!canScope('world.publish')||!currentDraft)return;
  try{const res=await E.request('world:draft:approve',{actorId:actor(),draftId:draftId()});currentDraft=res.draft;await refreshWorkflow();renderControls();renderActions();toast('Borrador aprobado');}catch(e){toast(e.message);}
}
async function rejectDraft(){
  if(!canScope('world.publish')||!currentDraft)return;
  const reason=prompt('Motivo del rechazo (opcional):','')||'';
  try{const res=await E.request('world:draft:reject',{actorId:actor(),draftId:draftId(),reason});currentDraft=res.draft;await E.request('world:draft:get',{actorId:actor(),draftId:draftId()});await refreshWorkflow();setLayer(layer);toast('Borrador rechazado y reabierto para edición');}catch(e){toast(e.message);}
}
async function publishDraft(){
  if(!canScope('world.publish')||!currentDraft)return;
  if(!confirm('¿Publicar este borrador como nueva versión LIVE local?'))return;
  try{const res=await E.request('world:publish',{actorId:actor(),draftId:draftId()});currentDraft=res.draft;publishedRevision=res.revision;await refreshWorkflow();renderControls();renderActions();toast(`Publicado v${res.revision?.number||''}`);}catch(e){toast(e.message);}
}
async function discardDraft(){
  if(!editable()||!confirm('¿Descartar este borrador? El LIVE no cambia.'))return;
  try{const res=await E.request('world:draft:discard',{actorId:actor(),draftId:draftId()});currentDraft=res.draft;await refreshWorkflow();renderControls();renderList();renderActions();toast('Borrador descartado');}catch(e){toast(e.message);}
}
async function togglePreview(){
  if(!currentDraft)return;
  if(!previewing){
    try{await saveNow(true);await E.request('world:preview:enter',{actorId:actor(),draftId:draftId()});previewing=true;document.body.classList.add('kelo-world-previewing');renderWorkflow();toast('Vista previa del borrador. Pulsa de nuevo para volver a LIVE.');}
    catch(e){toast(e.message);}
  }else{
    try{await E.request('world:preview:exit',{actorId:actor()});previewing=false;document.body.classList.remove('kelo-world-previewing');await closeBuilder(false);toast('De vuelta al mundo LIVE');}catch(e){toast(e.message);}
  }
}
async function rollback(revisionId){
  if(!canScope('world.publish')||!confirm(`¿Restaurar esta versión? Se creará una NUEVA revisión; el historial no se borra.`))return;
  try{const res=await E.request('world:rollback',{actorId:actor(),revisionId});publishedRevision=res.revision;await refreshWorkflow();toast(`Rollback publicado como v${res.revision?.number||''}`);}catch(e){toast(e.message);}
}
async function exportDraft(){
  if(!currentDraft||!canScope('world.export'))return toast('Tu llave no tiene permiso de exportar');
  try{
    const res=await E.request('world:draft:export',{actorId:actor(),draftId:draftId()}),blob=new Blob([JSON.stringify(res.bundle,null,2)],{type:'application/json'}),a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download=`kelo-world-${currentDraft.draftId}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),800);toast('Borrador exportado');
  }catch(e){toast(e.message);}
}
async function importDraft(e){
  const f=e.target.files?.[0];if(!f)return;
  try{
    const data=JSON.parse(await f.text());if(data.contract!=='kelo-world-edit-draft-v1')throw new Error('CONTRACT');
    const res=await E.request('world:draft:import',{actorId:actor(),draftId:draftId(),bundle:data});currentDraft=res.draft;await refreshWorkflow();status();scheduleAutosave();toast('Borrador importado');
  }catch(err){toast('Archivo de World Builder no válido');}
  e.target.value='';
}
async function clearDraftOverrides(){
  if(!editable()||!confirm('¿Revelar completamente el mapa base? Se eliminarán suelo/caminos y colisiones del borrador. Los objetos se conservan.'))return;
  try{const res=await E.request('world:draft:clear-overrides',{actorId:actor(),draftId:draftId()});currentDraft=res.draft;await refreshWorkflow();scheduleAutosave();toast('Mapa base revelado');}catch(e){toast(e.message);}
}
function interceptOldWorldTab(e){
  const b=e.target.closest?.('#pe-tabs [data-mode="world"]');if(!b||!canEdit())return;
  e.preventDefault();e.stopImmediatePropagation();try{window.KELO_PROPERTY_EDITOR?.close?.();}catch(err){};openBuilder();
}
function guideState(){
  return{
    open:open&&!previewing,
    layer,
    cursor:selectedPlacement&&layer==='objects'?(S.placementBounds(S.getPlacements(WORLD_PARCEL_ID).find(x=>x.placementId===selectedPlacement))||cursor):cursor,
    selectedPlacement,
    selectedCollision
  };
}
function boot(){
  if(!ready()){setTimeout(boot,80);return;}
  ensureDom();
  document.addEventListener('pointerdown',pointerDown,true);document.addEventListener('pointermove',pointerMove,true);document.addEventListener('pointerup',pointerUp,true);document.addEventListener('pointercancel',pointerUp,true);document.addEventListener('click',interceptOldWorldTab,true);
  window.KELO_ADMIN_KEYS.onChange(syncPermissionUI);
  WB.onChange(()=>{if(open)status();});
  E.onChange(()=>{if(open&&!workflowBusy)status();});
  S.onChange(()=>{if(open)status();});
  syncPermissionUI();
}
window.KELO_WORLD_BUILDER_UI=Object.freeze({
  version:VERSION,
  open:openBuilder,
  close:closeBuilder,
  get isOpen(){return open;},
  get layer(){return layer;},
  get currentDraft(){return currentDraft?JSON.parse(JSON.stringify(currentDraft)):null;},
  get previewing(){return previewing;},
  refreshWorkflow,
  guideState
});
window.KELO_WORLD_BUILDER_UI_AUDIT=Object.freeze({
  version:VERSION,
  mobile:true,
  adminKeyGate:true,
  terrain:true,
  paths:true,
  objectsReuseProperty:true,
  collisions:true,
  draftReviewPublish:true,
  rollback:true,
  preview:true,
  autosaveDebounced:true,
  uiStorageFree:true,
  uiTransportFree:true,
  requestBoundary:'KELO_WORLD_EDIT.request'
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();
