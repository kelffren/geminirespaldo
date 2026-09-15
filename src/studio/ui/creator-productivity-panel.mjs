/* KELO-INDEX
 * area: STUDIO / CREATOR PRODUCTIVITY UI
 * owner: Kelo Studio Creator Productivity Panel
 * keys: STUDIO UI COPY PASTE PREFAB GRID SNAP CAMERA ZOOM VALIDATION MOBILE
 * owns: modular Copy/Paste, Prefab, Snap/Grid, Camera/Zoom, Check Map and mobile minimize controls
 * does-not-own: world mutations, validation rules, camera math or persistence
 * public-api: createCreatorProductivityPanel()
 * online: no; callbacks delegate to creator services
 */

export function createCreatorProductivityPanel({
  shell,onCopy,onPaste,onSavePrefab,onValidate,onSnapChange,onGridToggle,
  onCameraToggle,onZoomIn,onZoomOut,onZoomReset
}={}){
  const root=shell?.root,document=root?.ownerDocument;
  if(!root||!document)throw new Error('STUDIO_PRODUCTIVITY_SHELL_REQUIRED');

  const style=document.createElement('style');
  style.dataset.keloStudioUi='1';
  style.textContent=`
    #kelo-studio-live .ks-ext-strip{display:flex;gap:5px;align-items:center;min-width:0}
    #kelo-studio-live .ks-ext-strip button,
    #kelo-studio-live .ks-ext-strip select{
      min-height:36px;border:1px solid rgba(231,197,106,.22);border-radius:10px;
      background:#101b1e;color:#dce6e0;font-size:7px;font-weight:900;padding:0 9px;
      white-space:nowrap;letter-spacing:.025em
    }
    #kelo-studio-live .ks-ext-strip button.on{
      border-color:#e7c56a;background:linear-gradient(180deg,#29493c,#1d372f);color:#fff1b8;
      box-shadow:0 0 0 1px rgba(231,197,106,.08),0 0 16px rgba(231,197,106,.08)
    }
    #kelo-studio-live .ks-ext-strip button:disabled,
    #kelo-studio-live .ks-ext-strip select:disabled{opacity:.35}
    #kelo-studio-live .ks-ext-edit{display:inline-flex}
    #kelo-studio-live .ks-ext-map{overflow-x:auto;padding-bottom:1px}
    #kelo-studio-live .ks-ext-view{overflow-x:auto;max-width:100%}
    #kelo-studio-live .ks-zoom-label{min-width:48px;padding:0 7px!important}
    #kelo-studio-live .ks-minimize{
      display:inline-flex;align-items:center;justify-content:center;min-width:38px!important;
      padding:0 8px!important;font-size:14px!important;line-height:1
    }
    #kelo-studio-live .ks-modal-backdrop{
      position:fixed;inset:0;z-index:5;background:rgba(0,0,0,.52);display:grid;place-items:center;
      pointer-events:auto;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)
    }
    #kelo-studio-live .ks-modal{
      width:min(430px,calc(100vw - 28px));max-height:min(72vh,620px);overflow:auto;
      border:1px solid rgba(231,197,106,.46);border-radius:18px;
      background:linear-gradient(180deg,#091517,#071012);padding:15px;
      box-shadow:0 26px 80px rgba(0,0,0,.68),inset 0 1px 0 rgba(255,255,255,.035)
    }
    #kelo-studio-live .ks-modal h3{
      margin:0 0 10px;color:#ecd174;font-family:Georgia,"Times New Roman",serif;
      font-size:12px;letter-spacing:.08em
    }
    #kelo-studio-live .ks-modal p,#kelo-studio-live .ks-modal li{
      font-size:9px;color:#b8c8c0;line-height:1.55
    }
    #kelo-studio-live .ks-modal input{
      width:100%;height:40px;border:1px solid rgba(255,255,255,.12);border-radius:10px;
      background:#0d1719;color:#fff;padding:0 10px;margin:5px 0 12px;outline:none
    }
    #kelo-studio-live .ks-modal input:focus{border-color:rgba(231,197,106,.58)}
    #kelo-studio-live .ks-modal-actions{display:flex;gap:7px;justify-content:flex-end}
    #kelo-studio-live .ks-modal-actions button{
      min-height:36px;border:1px solid rgba(231,197,106,.28);border-radius:10px;
      background:#14231f;color:#fff1b8;font-size:8px;font-weight:900;padding:0 13px
    }
    #kelo-studio-live .ks-health-counts{
      display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0
    }
    #kelo-studio-live .ks-health-counts div{
      border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#0d1719;
      padding:8px;font-size:8px;color:#92aa9f
    }
    #kelo-studio-live .ks-health-counts b{display:block;color:#fff;font-size:14px;margin-top:3px}
    #kelo-studio-live .ks-health-ok{color:#82d6a7!important}
    #kelo-studio-live .ks-health-error{color:#ff9b9b!important}
    #kelo-studio-live .ks-health-warn{color:#ead078!important}

    @media(max-width:760px){
      #kelo-studio-live .ks-ext-strip button,
      #kelo-studio-live .ks-ext-strip select{min-height:38px;font-size:6.2px;padding:0 8px}
      #kelo-studio-live .ks-ext-edit{gap:4px}
      #kelo-studio-live .ks-ext-map{gap:4px}
      #kelo-studio-live .ks-ext-view{gap:4px;margin-top:5px}
      #kelo-studio-live .ks-zoom-label{min-width:44px}
    }
    @media(max-width:430px){
      #kelo-studio-live .ks-ext-strip button,
      #kelo-studio-live .ks-ext-strip select{padding:0 7px;font-size:5.8px}
      #kelo-studio-live .ks-ext-map{max-width:100%}
    }
  `;
  document.head.appendChild(style);

  const host=root.querySelector('.ks-bottom');
  if(!host)throw new Error('STUDIO_PRODUCTIVITY_HOST_MISSING');

  const editSlot=root.querySelector('.ks-productivity-edit-slot');
  const mapSlot=root.querySelector('.ks-productivity-map-slot');
  const viewSlot=root.querySelector('.ks-productivity-view-slot');

  const editBar=document.createElement('div');
  editBar.className='ks-ext-strip ks-ext-edit';
  editBar.innerHTML=`
    <button data-ext="copy"><span class="ks-ico">⧉</span>COPY</button>
    <button data-ext="paste" disabled><span class="ks-ico">▤</span>PASTE</button>
  `;

  const mapBar=document.createElement('div');
  mapBar.className='ks-ext-strip ks-ext-map';
  mapBar.innerHTML=`
    <button data-ext="prefab"><span class="ks-ico">▱</span>SAVE PREFAB</button>
    <button data-ext="check"><span class="ks-ico">⌑</span>CHECK MAP</button>
    <button class="on" data-ext="grid"><span class="ks-ico">▦</span>GRID</button>
    <select data-ext="snap" aria-label="Snap">
      <option value="1">FREE</option>
      <option value="8">SNAP 8</option>
      <option value="16">SNAP 16</option>
      <option value="32" selected>SNAP 32</option>
      <option value="64">SNAP 64</option>
    </select>
  `;

  const viewBar=document.createElement('div');
  viewBar.className='ks-ext-strip ks-ext-view';
  viewBar.innerHTML=`
    <button data-ext="camera"><span class="ks-ico">⌖</span>CAMERA</button>
    <button data-ext="zoom-out" aria-label="Zoom out">−</button>
    <button class="ks-zoom-label" data-ext="zoom-reset">100%</button>
    <button data-ext="zoom-in" aria-label="Zoom in">+</button>
  `;

  (editSlot||host).appendChild(editBar);
  (mapSlot||host).appendChild(mapBar);
  (viewSlot||host).appendChild(viewBar);

  const top=root.querySelector('.ks-top');
  const closeButton=top?.querySelector('[data-act="close"]')||null;
  const minimize=document.createElement('button');
  minimize.type='button';
  minimize.className='ks-minimize';
  minimize.dataset.studioMinimize='1';
  if(top)top.insertBefore(minimize,closeButton);

  const compactSmall=root.querySelector('.ks-compact-copy small');
  const compactLabel=root.querySelector('.ks-active-asset-label');

  let clipboard=0,grid=true,snap=32,camera=false,zoom=1,modal=null;
  const isCompact=()=>host.classList.contains('ks-compact');
  const selectionCount=()=>Math.max(0,Number(root.dataset.selectionCount)||0);

  function syncAvailability(){
    const hasSelection=selectionCount()>0;
    const copy=editBar.querySelector('[data-ext="copy"]');
    const paste=editBar.querySelector('[data-ext="paste"]');
    const prefab=mapBar.querySelector('[data-ext="prefab"]');
    if(copy)copy.disabled=!hasSelection;
    if(paste)paste.disabled=!clipboard;
    if(prefab)prefab.disabled=!hasSelection;
  }

  function syncMinimizeUi(){
    const compact=isCompact();
    minimize.textContent=compact?'▴':'—';
    minimize.title=compact?'Expandir Studio':'Minimizar Studio';
    minimize.setAttribute('aria-label',compact?'Expandir Kelo Studio':'Minimizar Kelo Studio');
    root.dataset.creatorMinimized=compact?'1':'0';
    if(compact&&!root.dataset.activeAsset){
      if(compactSmall)compactSmall.textContent='KELO STUDIO';
      if(compactLabel)compactLabel.textContent='MODO CREADOR';
    }else if(root.dataset.activeAsset&&compactSmall){
      compactSmall.textContent='ASSET ACTIVO';
    }
  }

  function setMinimized(next){
    const compact=!!next;
    host.classList.toggle('ks-compact',compact);
    root.dataset.compact=compact?(root.dataset.activeAsset?'asset':'manual'):'full';
    if(compact){
      root.dataset.sheetOpen='0';
      document.activeElement?.blur?.();
    }
    syncMinimizeUi();
    return compact;
  }

  const observer=new MutationObserver(()=>{
    syncMinimizeUi();
    syncAvailability();
  });
  observer.observe(host,{attributes:true,attributeFilter:['class']});
  observer.observe(root,{attributes:true,attributeFilter:['data-selection-count','data-active-asset']});
  minimize.addEventListener('click',()=>setMinimized(!isCompact()));

  function syncCameraUi(){
    viewBar.querySelector('[data-ext="camera"]')?.classList.toggle('on',camera);
    const z=viewBar.querySelector('[data-ext="zoom-reset"]');
    if(z)z.textContent=`${Math.round(zoom*100)}%`;
  }

  function closeModal(){
    modal?.remove();
    modal=null;
  }

  function modalShell(title){
    closeModal();
    modal=document.createElement('div');
    modal.className='ks-modal-backdrop';
    modal.innerHTML=`
      <section class="ks-modal">
        <h3></h3>
        <div class="ks-modal-content"></div>
        <div class="ks-modal-actions"><button data-modal="cancel">CLOSE</button></div>
      </section>
    `;
    modal.querySelector('h3').textContent=title;
    root.appendChild(modal);
    modal.addEventListener('click',e=>{
      if(e.target===modal||e.target.closest('[data-modal="cancel"]'))closeModal();
    });
    return modal.querySelector('.ks-modal-content');
  }

  function openPrefab(){
    const content=modalShell('SAVE AS PREFAB');
    content.innerHTML=`
      <p>Guarda la selección como una pieza reutilizable. Luego aparecerá en <b>My Prefabs</b>.</p>
      <input data-prefab-name maxlength="48" placeholder="Ej. Blacksmith Shop">
      <div class="ks-modal-actions"><button data-modal="save-prefab">SAVE PREFAB</button></div>
    `;
    const input=content.querySelector('input');
    input.value=`Prefab ${Date.now().toString().slice(-4)}`;
    input.focus();
    content.querySelector('[data-modal="save-prefab"]').addEventListener('click',async()=>{
      const label=input.value.trim();
      if(!label)return;
      const result=await onSavePrefab?.(label);
      if(result!==false)closeModal();
    });
  }

  function openHealth(report){
    const content=modalShell(report?.ok?'MAP READY':'CHECK MAP');
    const counts=report?.counts||{},errors=report?.errors||[],warnings=report?.warnings||[];
    const title=document.createElement('p');
    title.className=errors.length?'ks-health-error':warnings.length?'ks-health-warn':'ks-health-ok';
    title.textContent=errors.length
      ?`${errors.length} error(es) que debes corregir.`
      :warnings.length
        ?`Sin errores · ${warnings.length} aviso(s).`
        :'Sin errores estructurales.';
    content.appendChild(title);

    const countGrid=document.createElement('div');
    countGrid.className='ks-health-counts';
    for(const [label,value] of [
      ['Objects',counts.objects||0],['Surface',counts.surface||0],['Collision',counts.collisions||0],
      ['Interactive',counts.interactive||0],['AI',counts.ai||0],['Particles',counts.particles||0]
    ]){
      const d=document.createElement('div');
      d.textContent=label;
      const b=document.createElement('b');b.textContent=String(value);
      d.appendChild(b);countGrid.appendChild(d);
    }
    content.appendChild(countGrid);

    if(errors.length){
      const h=document.createElement('p');h.className='ks-health-error';h.textContent='ERRORS';content.appendChild(h);
      const ul=document.createElement('ul');
      for(const row of errors.slice(0,12)){const li=document.createElement('li');li.textContent=row.message;ul.appendChild(li);}
      content.appendChild(ul);
    }

    if(warnings.length){
      const h=document.createElement('p');h.className='ks-health-warn';h.textContent='WARNINGS';content.appendChild(h);
      const ul=document.createElement('ul');
      for(const row of warnings.slice(0,12)){const li=document.createElement('li');li.textContent=row.message;ul.appendChild(li);}
      content.appendChild(ul);
    }

    const notice=document.createElement('p');
    notice.textContent=report?.performance?.notice||'';
    content.appendChild(notice);
  }

  mapBar.addEventListener('change',e=>{
    if(e.target.matches('[data-ext="snap"]')){
      snap=Math.max(1,Number(e.target.value)||1);
      onSnapChange?.(snap);
    }
  });

  async function handleAction(act,target){
    if(!act)return;
    if(act==='camera'){
      const next=!camera;
      const result=await onCameraToggle?.(next);
      camera=typeof result==='boolean'?result:next;
      syncCameraUi();
    }else if(act==='zoom-in'){
      zoom=Number(await onZoomIn?.())||zoom;
      syncCameraUi();
    }else if(act==='zoom-out'){
      zoom=Number(await onZoomOut?.())||zoom;
      syncCameraUi();
    }else if(act==='zoom-reset'){
      zoom=Number(await onZoomReset?.())||1;
      syncCameraUi();
    }else if(act==='copy'){
      clipboard=Number(await onCopy?.())||0;
      syncAvailability();
    }else if(act==='paste'){
      await onPaste?.();
    }else if(act==='prefab'){
      openPrefab();
    }else if(act==='check'){
      openHealth(await onValidate?.());
    }else if(act==='grid'){
      grid=!grid;
      target?.classList.toggle('on',grid);
      onGridToggle?.(grid);
    }
  }

  for(const bar of [editBar,mapBar,viewBar]){
    bar.addEventListener('click',async e=>{
      const target=e.target.closest('[data-ext]');
      if(!target)return;
      await handleAction(target.dataset.ext,target);
    });
  }

  syncCameraUi();
  syncMinimizeUi();
  syncAvailability();

  return Object.freeze({
    setClipboard(count){
      clipboard=Math.max(0,Number(count)||0);
      syncAvailability();
    },
    setSnap(value){
      snap=Math.max(1,Number(value)||1);
      const s=mapBar.querySelector('[data-ext="snap"]');
      if(s)s.value=String(snap);
    },
    setGrid(value){
      grid=!!value;
      mapBar.querySelector('[data-ext="grid"]')?.classList.toggle('on',grid);
    },
    setCamera(value){
      camera=!!value;
      syncCameraUi();
    },
    setZoom(value){
      zoom=Math.max(.01,Number(value)||1);
      syncCameraUi();
    },
    setMinimized,
    showHealth:openHealth,
    destroy(){
      closeModal();
      observer.disconnect();
      minimize.remove();
      editBar.remove();
      mapBar.remove();
      viewBar.remove();
      style.remove();
    },
    get minimized(){return isCompact();},
    get snap(){return snap;},
    get grid(){return grid;},
    get camera(){return camera;},
    get zoom(){return zoom;}
  });
}
