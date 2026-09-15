/* KELO-INDEX
 * area: UI
 * keys: MAP EDITOR PARCEL PROPERTY ASSET PLACE MOVE DELETE TILESET EXPORT IMPORT MOBILE
 * hace: editor visual; lista de colocados para borrar sin acertar el sprite
 * online: nunca muta balances directo; todo por KELO_PROPERTY_SYSTEM.request()
 */
(function(){
  'use strict';
  const S=window.KELO_PROPERTY_SYSTEM,C=window.KELO_PROPERTY_CATALOG,L=window.KELO_ENVIRONMENT_LAYERS;
  if(!S||!C||!L){console.error('[Kelo property editor] system/catalog/layers missing');return;}
  const params=new URLSearchParams(location.search);
  const developer=!!window.KELO_ADMIN_KEYS?.can?.('world.edit',S.playerId());
  const localPrototype=params.get('mapEditor')==='1'&&window.KELO_ADMIN_KEYS?.authoritySource?.()==='local-prototype';
  let open=false,mode=developer?'world':'parcel',parcelId=null,selectedAsset=null,selectedPlacement=null,movePlacementId=null,ghost=null,lastPlacementId=null;

  const css=document.createElement('style');css.id='kelo-property-editor-style';css.textContent=`
  #kelo-property-editor{position:absolute;z-index:240;left:max(8px,env(safe-area-inset-left));top:max(8px,env(safe-area-inset-top));bottom:max(8px,env(safe-area-inset-bottom));width:min(380px,calc(100vw - 16px));display:none;flex-direction:column;pointer-events:auto;color:#f4edda;background:rgba(8,15,17,.975);border:1px solid rgba(231,197,106,.42);border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.6);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  #kelo-property-editor *{box-sizing:border-box}.pe-head{display:flex;align-items:center;gap:8px;padding:12px;border-bottom:1px solid rgba(255,255,255,.07)}.pe-title{font-weight:900;color:#e7c56a;flex:1}.pe-mode{font-size:9px;padding:5px 7px;border-radius:999px;background:#173f36;color:#fff4d6}.pe-icon{width:34px;height:34px;border:1px solid rgba(231,197,106,.3);border-radius:10px;background:#101b1e;color:#e7c56a;font-weight:900}
  .pe-tabs{display:flex;gap:6px;padding:8px 10px}.pe-tab{flex:1;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:#0e191c;color:#9db0a9;padding:8px;font-size:10px;font-weight:800}.pe-tab.on{border-color:rgba(231,197,106,.55);color:#e7c56a;background:#17231f}
  .pe-info{padding:0 11px 9px;color:#91a29c;font-size:10px;line-height:1.4}.pe-toolbar{display:flex;gap:6px;padding:0 10px 9px;flex-wrap:wrap}.pe-toolbar button,.pe-actions button{border:1px solid rgba(231,197,106,.25);background:#111e20;color:#e7c56a;border-radius:9px;padding:8px 9px;font-size:9px;font-weight:800}.pe-search{margin:0 10px 8px;display:flex;gap:6px}.pe-search input,.pe-search select{min-width:0;background:#0b1416;color:#e8eee9;border:1px solid rgba(255,255,255,.09);border-radius:9px;padding:8px;font-size:10px}.pe-search input{flex:1}.pe-list{padding:0 10px 10px;display:grid;grid-template-columns:1fr 1fr;gap:7px;overflow:auto;flex:1;align-content:start;-webkit-overflow-scrolling:touch}.pe-card{position:relative;min-height:83px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:#0e181a;color:#e8eee9;text-align:left;padding:8px}.pe-card.on{border-color:#e7c56a;box-shadow:inset 0 0 0 1px rgba(231,197,106,.22)}.pe-card strong{display:block;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pe-card small{display:block;color:#7f958d;font-size:8px;margin-top:4px}.pe-count{position:absolute;right:6px;bottom:6px;color:#e7c56a;font-size:8px;font-weight:900}.pe-test{position:absolute;left:6px;bottom:5px;border:0;background:#173f36;color:#d9f0e5;border-radius:7px;padding:4px 5px;font-size:7px;font-weight:900}.pe-actions{display:flex;gap:6px;padding:9px 10px;border-top:1px solid rgba(255,255,255,.07);min-height:48px}.pe-actions .grow{flex:1;color:#a8bbb4;font-size:9px}.pe-hint{font-size:9px;color:#8fa19a;padding:0 11px 10px}.pe-placed{max-height:88px;overflow:auto;padding:0 10px 8px;display:flex;flex-direction:column;gap:4px}.pe-placed button{display:flex;justify-content:space-between;align-items:center;border:1px solid rgba(255,255,255,.08);background:#10191b;color:#e8eee9;border-radius:8px;padding:6px 8px;font-size:9px}.pe-placed button.on{border-color:#e7c56a;color:#e7c56a}.pe-placed em{color:#ef9a9a;font-style:normal;font-weight:800}.pe-fab{position:absolute;z-index:230;left:max(10px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));pointer-events:auto;border:1px solid rgba(231,197,106,.55);background:rgba(10,20,21,.95);color:#e7c56a;border-radius:14px;padding:10px 12px;font:900 10px/1 sans-serif;box-shadow:0 8px 26px rgba(0,0,0,.4)}
  #pe-move.on{border-color:#fff4d6!important;color:#fff4d6!important}
  body.kelo-property-editing #kelo-luxe,body.kelo-property-editing #menu-sheet{pointer-events:none!important}.pe-hidden{display:none!important}@media(max-width:600px){#kelo-property-editor{top:auto;height:min(62vh,560px);width:calc(100vw - 16px)}.pe-list{grid-template-columns:repeat(3,1fr)}.pe-card{min-height:74px;padding:6px}.pe-tabs{padding-top:6px}}
  `;document.head.appendChild(css);

  const root=document.createElement('section');root.id='kelo-property-editor';root.innerHTML=`
    <div class="pe-head"><div class="pe-title">EDITOR DE MAPA</div><span class="pe-mode" id="pe-mode"></span><button class="pe-icon" id="pe-close">×</button></div>
    <div class="pe-tabs" id="pe-tabs"><button class="pe-tab" data-mode="world">MUNDO</button><button class="pe-tab" data-mode="parcel">MI PARCELA</button></div>
    <div class="pe-info" id="pe-info"></div>
    <div class="pe-toolbar"><button id="pe-export">EXPORTAR</button><button id="pe-import">IMPORTAR</button><input type="file" id="pe-file" accept="application/json,.json" hidden><button id="pe-clear">LIMPIAR SELECCIÓN</button><button id="pe-undo">BORRAR ÚLTIMO</button></div>
    <div class="pe-search"><input id="pe-q" placeholder="Buscar asset o tileset…"><select id="pe-cat"><option value="">Todos</option></select></div>
    <div class="pe-placed" id="pe-placed"></div>
    <div class="pe-list" id="pe-list"></div>
    <div class="pe-actions"><button id="pe-move">MOVER</button><button id="pe-rotate">↻ ROTAR</button><button id="pe-delete">BORRAR</button><span class="grow" id="pe-selected"></span></div>
    <div class="pe-hint">Toca un objeto en el mapa o en la lista de colocados y pulsa BORRAR. Los tilesets de assets aparecen en la categoría tileset.</div>`;document.body.appendChild(root);
  if(developer){const fab=document.createElement('button');fab.className='pe-fab';fab.id='pe-fab';fab.textContent='MAP EDITOR';fab.onclick=()=>toggle('world');document.body.appendChild(fab);}else document.getElementById('pe-tabs').classList.add('pe-hidden');

  const el=id=>document.getElementById(id);const toast=msg=>{if(typeof showToast==='function')showToast(msg);else console.log(msg);};
  function currentParcel(){return S.parcel(parcelId);}
  function isWorld(){return currentParcel()?.kind==='world_editor';}
  function worldScope(scope){if(!isWorld())return true;try{window.KELO_ADMIN_KEYS?.assert?.(scope,S.playerId());return true;}catch(e){toast('Tu Llave Admin no tiene permiso para esta acción');return false;}}
  function toWorld(sx,sy){if(typeof screenToWorld==='function')return screenToWorld(sx,sy);const z=(typeof CONFIG!=='undefined'&&CONFIG.zoom)||1;return{x:camera.x+(sx-screenW/2)/z,y:camera.y+(sy-screenH/2)/z};}
  function snapPoint(w,t){const s=t?.snap||C.tileSize;return{x:Math.round(w.x/s)*s,y:Math.round(w.y/s)*s};}
  async function ensureParcel(){const p=mode==='world'?await S.request('ensureWorldEditorParcel',{ownerId:'developer'}):await S.request('ensureLegacyParcel',{ownerId:S.playerId()});parcelId=p.parcelId;return p;}
  function refreshPlaced(){
    const box=el('pe-placed');if(!box||!parcelId)return;
    const rows=S.getPlacements(parcelId).slice().reverse().slice(0,12);
    box.innerHTML=rows.length?'':"";
    for(const rec of rows){
      const t=C.get(rec.assetId);
      const b=document.createElement('button');
      b.className=rec.placementId===selectedPlacement?'on':'';
      b.innerHTML=`<span>${t?.label||rec.assetId}</span><em>X</em>`;
      b.onclick=async ev=>{if(ev.target.tagName==='EM'){selectedPlacement=rec.placementId;await removeSelected();return;}selectedPlacement=rec.placementId;selectedAsset=null;refreshSelected();refreshPlaced();};
      box.appendChild(b);
    }
  }
  function refreshInfo(){const p=currentParcel();if(!p)return;const n=S.getPlacements(parcelId).length;el('pe-mode').textContent=mode==='world'?'LLAVE ADMIN · MUNDO':'PARCELA · UNIDADES';el('pe-info').textContent=`${p.parcelId} · ${Math.round(p.bounds.w/C.tileSize)}×${Math.round(p.bounds.h/C.tileSize)} tiles · ${n} colocados`;el('pe-tabs').querySelectorAll('.pe-tab').forEach(b=>b.classList.toggle('on',b.dataset.mode===mode));refreshPlaced();}
  function cards(){
    const q=el('pe-q').value.trim().toLowerCase(),cat=el('pe-cat').value;let list=C.list({category:cat||undefined});if(q)list=list.filter(t=>`${t.label} ${t.id} ${t.family}`.toLowerCase().includes(q));
    el('pe-list').innerHTML='';for(const t of list){const b=document.createElement('button');b.className='pe-card'+(selectedAsset===t.id?' on':'');const owned=isWorld()?Infinity:S.getOwnedUnits(t.id),avail=isWorld()?Infinity:S.getAvailableUnits(t.id);b.innerHTML=`<strong>${t.label}</strong><small>${t.category} · ${Math.round(t.width)}×${Math.round(t.height)}</small><span class="pe-count">${isWorld()?'∞':`${avail}/${owned}`}</span>${localPrototype&&!isWorld()?'<span class="pe-test">TEST +1</span>':''}`;
      b.onclick=async ev=>{if(ev.target.classList.contains('pe-test')){ev.stopPropagation();await S.request('grantUnits',{ownerId:S.playerId(),assetId:t.id,quantity:1,developer:true});cards();return;}selectedAsset=t.id;selectedPlacement=null;movePlacementId=null;ghost=null;cards();refreshSelected();};el('pe-list').appendChild(b);}
  }
  function refreshSelected(){const t=C.get(selectedAsset);const p=selectedPlacement&&S.getPlacements(parcelId).find(x=>x.placementId===selectedPlacement);el('pe-selected').textContent=movePlacementId?'Toca el nuevo lugar del objeto':(p?`Seleccionado: ${C.get(p.assetId)?.label||p.assetId}`:(t?`Para colocar: ${t.label}`:'Toca un colocado o el mapa'));el('pe-move').disabled=!p;el('pe-move').classList.toggle('on',!!movePlacementId);el('pe-move').textContent=movePlacementId?'TOCA DESTINO':'MOVER';el('pe-rotate').disabled=!p;el('pe-delete').disabled=!p&&!lastPlacementId;}
  function populateCategories(){const s=el('pe-cat');const cats=C.categories();if(cats.includes('tileset'))s.insertAdjacentHTML('beforeend','<option value="tileset">Tileset</option>');for(const c of cats){if(c==='tileset')continue;const o=document.createElement('option');o.value=c;o.textContent=c;s.appendChild(o);}C.onRegister(()=>{const have=new Set(Array.from(s.options).map(o=>o.value));for(const c of C.categories()){if(have.has(c))continue;const o=document.createElement('option');o.value=c;o.textContent=c;s.appendChild(o);have.add(c);}cards();});}
  async function setMode(next){if(next==='world'&&!developer)return;mode=next;selectedAsset=null;selectedPlacement=null;movePlacementId=null;ghost=null;await ensureParcel();refreshInfo();cards();refreshSelected();}
  async function openEditor(next){open=true;root.style.display='flex';document.body.classList.add('kelo-property-editing');if(typeof closeMenu==='function')closeMenu();await setMode(next||mode);if(mode==='parcel'){const p=currentParcel();if(p&&typeof localPlayer!=='undefined'){localPlayer.x=p.bounds.x+p.bounds.w/2;localPlayer.y=p.bounds.y+p.bounds.h+90;camera.x=localPlayer.x;camera.y=localPlayer.y;camera.targetX=localPlayer.x;camera.targetY=localPlayer.y;}}}
  function closeEditor(){open=false;root.style.display='none';document.body.classList.remove('kelo-property-editing');selectedAsset=null;selectedPlacement=null;movePlacementId=null;ghost=null;if(typeof input!=='undefined'){input.touchActive=false;input.touchId=null;}}
  function toggle(next){if(open)closeEditor();else openEditor(next);}

  async function placeAt(w){const t=C.get(selectedAsset);if(!t)return;const pt=snapPoint(w,t);try{const rec=await S.request('place',{ownerId:isWorld()?'developer':S.playerId(),parcelId,assetId:t.id,x:pt.x,y:pt.y,rotation:0});selectedPlacement=rec.placementId;lastPlacementId=rec.placementId;if(!isWorld()&&S.getAvailableUnits(t.id)<1)selectedAsset=null;refreshInfo();cards();refreshSelected();toast('Colocado. Bórralo con X en la lista o BORRAR.');}catch(err){toast(err.message==='NO_OWNED_UNITS'?'No tienes unidades disponibles de ese asset':err.message==='OUTSIDE_PARCEL'?'Ese asset no cabe dentro de la parcela':`No se pudo colocar: ${err.message}`);}}
  async function moveAt(w){const rec=S.getPlacements(parcelId).find(x=>x.placementId===movePlacementId);const t=rec&&C.get(rec.assetId);if(!rec||!t){movePlacementId=null;refreshSelected();return;}const pt=snapPoint(w,t);try{await S.request('move',{ownerId:isWorld()?'developer':S.playerId(),placementId:rec.placementId,x:pt.x,y:pt.y});movePlacementId=null;refreshInfo();refreshSelected();toast('Objeto movido');}catch(err){toast(err.message==='OUTSIDE_PARCEL'?'Ese asset no cabe ahí':`No se pudo mover: ${err.message}`);}}
  async function removeSelected(){
    const id=selectedPlacement||lastPlacementId;if(!id){toast('Selecciona el objeto en el mapa o en la lista');return;}
    try{
      await S.request('remove',{ownerId:isWorld()?'developer':S.playerId(),placementId:id});
      if(lastPlacementId===id)lastPlacementId=null;
      selectedPlacement=null;movePlacementId=null;refreshInfo();cards();refreshSelected();toast('Objeto borrado');
    }catch(err){toast('No se pudo borrar: '+err.message);}
  }
  function hitPlacement(w){
    const pad=28;
    const list=S.getPlacements(parcelId).slice().reverse();
    return list.find(p=>{const b=S.placementBounds(p);return b&&w.x>=b.x-pad&&w.x<=b.x+b.w+pad&&w.y>=b.y-pad&&w.y<=b.y+b.h+pad;})||null;
  }
  function pointerDown(e){if(!open||root.contains(e.target))return;const w=toWorld(e.clientX,e.clientY),p=currentParcel();if(!p)return;e.preventDefault();e.stopImmediatePropagation();if(typeof input!=='undefined')input.touchActive=false;if(movePlacementId){moveAt(w);return;}const hit=hitPlacement(w);if(hit){selectedPlacement=hit.placementId;lastPlacementId=hit.placementId;selectedAsset=null;ghost=null;cards();refreshSelected();refreshPlaced();return;}if(selectedAsset){placeAt(w);return;}selectedPlacement=null;refreshSelected();}
  function pointerMove(e){if(!open||root.contains(e.target)||!selectedAsset||movePlacementId){ghost=null;return;}const t=C.get(selectedAsset);if(!t)return;ghost={assetId:t.id,...snapPoint(toWorld(e.clientX,e.clientY),t)};}
  window.addEventListener('pointerdown',pointerDown,true);window.addEventListener('pointermove',pointerMove,true);

  function drawGuide(g){if(!open)return;const p=currentParcel();if(!p)return;g.save();g.lineWidth=2;g.strokeStyle='rgba(231,197,106,.95)';g.setLineDash([10,7]);g.strokeRect(p.bounds.x,p.bounds.y,p.bounds.w,p.bounds.h);g.setLineDash([]);
    const z=(typeof CONFIG!=='undefined'&&CONFIG.zoom)||1;if(z>=.78){g.globalAlpha=.16;g.lineWidth=1;const s=C.tileSize;g.beginPath();for(let x=p.bounds.x;x<=p.bounds.x+p.bounds.w;x+=s){g.moveTo(x,p.bounds.y);g.lineTo(x,p.bounds.y+p.bounds.h);}for(let y=p.bounds.y;y<=p.bounds.y+p.bounds.h;y+=s){g.moveTo(p.bounds.x,y);g.lineTo(p.bounds.x+p.bounds.w,y);}g.stroke();g.globalAlpha=1;}
    if(selectedPlacement){const rec=S.getPlacements(parcelId).find(x=>x.placementId===selectedPlacement),b=rec&&S.placementBounds(rec);if(b){g.lineWidth=3;g.strokeStyle='#fff4d6';g.strokeRect(b.x-3,b.y-3,b.w+6,b.h+6);}}
    if(ghost){const t=C.get(ghost.assetId);if(t){g.globalAlpha=.35;g.fillStyle='#e7c56a';g.fillRect(ghost.x,ghost.y,t.width,t.height);g.globalAlpha=1;}}
    g.restore();}
  L.register({id:'property-editor-guide',phase:'vfx_weather_lighting',priority:999,required:false,ready:()=>true,draw:drawGuide,ownership:'property-editor-ui-v1',bounds:()=>[]});

  el('pe-close').onclick=closeEditor;el('pe-q').oninput=cards;el('pe-cat').onchange=cards;el('pe-clear').onclick=()=>{selectedAsset=null;selectedPlacement=null;movePlacementId=null;ghost=null;cards();refreshSelected();};
  el('pe-undo').onclick=async()=>{if(!lastPlacementId){const rows=S.getPlacements(parcelId);lastPlacementId=rows[rows.length-1]?.placementId;}selectedPlacement=lastPlacementId;await removeSelected();};
  el('pe-tabs').onclick=e=>{const b=e.target.closest('[data-mode]');if(b)setMode(b.dataset.mode);};
  el('pe-move').onclick=()=>{if(!selectedPlacement)return;movePlacementId=movePlacementId?null:selectedPlacement;selectedAsset=null;ghost=null;cards();refreshSelected();if(movePlacementId)toast('Toca el nuevo lugar del objeto');};
  el('pe-rotate').onclick=async()=>{if(!selectedPlacement)return;movePlacementId=null;try{await S.request('rotate',{ownerId:isWorld()?'developer':S.playerId(),placementId:selectedPlacement,delta:1});refreshSelected();}catch(err){toast(err.message==='OUTSIDE_PARCEL'?'No cabe al rotarlo':err.message);}};
  el('pe-delete').onclick=()=>removeSelected();
  el('pe-export').onclick=()=>{if(!worldScope('world.export'))return;const data=S.exportLayout(parcelId),blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`kelo-${parcelId.replace(/[^a-z0-9]+/gi,'-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
  el('pe-import').onclick=()=>{if(!isWorld()){toast('Importar layouts completos solo está disponible en modo autor');return;}if(!worldScope('world.import'))return;el('pe-file').click();};
  el('pe-file').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());await S.request('replaceLayout',{parcelId,placements:data.placements||[],developer:true});refreshInfo();cards();toast('Layout importado');}catch(err){toast('JSON de layout no válido');}e.target.value='';};

  const oldOpen=window.openSocialTool;if(typeof oldOpen==='function'){window.openSocialTool=function(tool){if(tool==='properties'){openEditor('parcel');return;}return oldOpen.apply(this,arguments);};}
  populateCategories();S.onChange(()=>{if(open){refreshInfo();cards();refreshSelected();}});C.onRegister(()=>{if(open)cards();});
  window.KELO_PROPERTY_EDITOR=Object.freeze({version:'property-editor-v1.3.0',developer,open:(m)=>openEditor(m||'parcel'),close:closeEditor,toggle:()=>toggle(mode),get mode(){return mode;},get parcelId(){return parcelId;},get selectedPlacementId(){return selectedPlacement;},get movingPlacementId(){return movePlacementId;}});
  window.KELO_PROPERTY_EDITOR_AUDIT=Object.freeze({version:'property-editor-v1.3.0',developerGate:'admin-key-world.edit',mobile:true,exportImport:true,unitAware:true,worldEditor:true,nativeMove:true,placedListDelete:true,undoLast:true,tilesetCategory:true});
})();
