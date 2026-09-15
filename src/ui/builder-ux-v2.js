/* KELO-INDEX
 * area: UI
 * keys: BUILDER UX SCOPE PICKUP ROTATE DOCK BRUSH UNDO ONLINE POSITION CAMERA
 * hace: Plaza|Parcela + recoger/rotar + barra abajo; el pointer lo posee builder-input; transiciones de jugador/cámara se delegan a Foundation owners
 * online: envuelve request()
 * do-not: NO escribir localPlayer.x/y ni camera.* directamente
 */
(function(){
  'use strict';
  if(window.KELO_BUILDER_UX)return;
  const TILE=32;
  const undo=[];
  let ghost=null,scope='world',parcel=null,editWrapped=false,held=null,selectedId=null;
  const toast=m=>{if(typeof showToast==='function')showToast(m);};
  const actor=()=>String(window.keloNet?.playerKey||window.KELO_ADMIN_KEYS?.playerId?.()||window.localPlayer?.id||'local_pioneer');
  function toWorld(e){if(typeof screenToWorld==='function')return screenToWorld(e.clientX,e.clientY);const z=(typeof CONFIG!=='undefined'&&CONFIG.zoom)||1;return{x:camera.x+(e.clientX-screenW/2)/z,y:camera.y+(e.clientY-screenH/2)/z};}
  function snap(v){return Math.floor(Number(v)/TILE)*TILE;}
  function insideParcel(x,y){const b=parcel?.bounds;if(!b)return true;return x>=b.x&&y>=b.y&&x<=b.x+b.w&&y<=b.y+b.h;}
  function pushUndo(entry){undo.push(entry);if(undo.length>20)undo.shift();}
  function layerNow(){return window.KELO_WORLD_BUILDER_UI?.guideState?.()?.layer||'terrain';}
  function builderOpen(){return !!window.KELO_WORLD_BUILDER_UI?.guideState?.()?.open;}
  function parcelIdNow(){return scope==='parcel'?(parcel?.parcelId||null):'parcel:world:editor';}
  function hitAt(x,y){
    const S=window.KELO_PROPERTY_SYSTEM;if(!S?.placementForPoint)return null;
    return S.placementForPoint(x,y,parcelIdNow())||S.placementForPoint(x,y)||null;
  }
  async function ensureParcel(){
    const S=window.KELO_PROPERTY_SYSTEM;if(!S?.request)return null;
    parcel=scope==='world'?await S.request('ensureWorldEditorParcel',{ownerId:'developer'}):await S.request('ensureLegacyParcel',{ownerId:actor()});
    return parcel;
  }
  async function editReq(op,payload){
    const E=window.KELO_WORLD_EDIT;if(!E?.request)throw new Error('WORLD_EDIT_NOT_READY');
    return E.request(op,payload);
  }
  async function pickUp(rec){
    if(!rec){toast('Toca un objeto primero');return;}
    const C=window.KELO_PROPERTY_CATALOG,t=C?.get?.(rec.assetId);
    held={assetId:rec.assetId,rotation:rec.rotation||0,w:t?.width||TILE,h:t?.height||TILE,fromId:rec.placementId};
    try{await editReq('world:placement:remove',{actorId:actor(),placementId:rec.placementId});}catch(e){
      try{await window.KELO_PROPERTY_SYSTEM.request('remove',{ownerId:actor(),placementId:rec.placementId});}catch(err){toast(err.message);held=null;return;}
    }
    selectedId=null;toast('En la mano — toca el suelo');
  }
  async function dropHeld(w){
    if(!held)return;
    const x=snap(w.x),y=snap(w.y);
    if(scope==='parcel'&&!insideParcel(x,y)){toast('FUERA_DE_LA_PARCELA');return;}
    try{await editReq('world:placement:create',{actorId:actor(),assetId:held.assetId,x,y,rotation:held.rotation||0});held=null;toast('Colocado');}catch(e){toast(e.message);}
  }
  async function rotateHeldOrSelected(){
    if(held){held.rotation=((held.rotation||0)+1)%4;toast('Rotado '+held.rotation);return;}
    if(!selectedId){toast('Selecciona o recoge un objeto primero');return;}
    try{await editReq('world:placement:rotate',{actorId:actor(),placementId:selectedId,delta:1});toast('Rotado');}catch(e){toast(e.message);}
  }
  async function pickUnderGhost(){
    if(!ghost){toast('Pon el recuadro sobre el objeto');return;}
    const hit=hitAt(ghost.x+8,ghost.y+8);if(!hit){toast('No hay objeto bajo el recuadro');return;}
    await pickUp(hit);
  }
  async function undoLast(){
    const e=undo.pop();if(!e){toast('Nada que deshacer');return;}
    try{
      if(e.kind==='paint')await window.KELO_WORLD_BUILDER.request('world-builder:erase-terrain',{actorId:actor(),x:e.x,y:e.y,brushSize:e.brush||1});
      else if(e.kind==='erase')await window.KELO_WORLD_BUILDER.request('world-builder:paint',{actorId:actor(),x:e.x,y:e.y,brushSize:1,material:e.material||'grass',role:e.role||'terrain'});
      else if(e.kind==='collision'&&e.collisionId)await window.KELO_WORLD_BUILDER.request('world-builder:collision-remove',{actorId:actor(),collisionId:e.collisionId});
      else if(e.kind==='place'&&e.placementId){
        await window.KELO_PROPERTY_SYSTEM.request('remove',{ownerId:e.ownerId||actor(),placementId:e.placementId});
        if(e.collisionId)await window.KELO_WORLD_BUILDER.request('world-builder:collision-remove',{actorId:actor(),collisionId:e.collisionId});
      }
      toast('Deshecho');
    }catch(err){toast(err.message||'No se pudo deshacer');}
  }
  function wrapWorld(){
    const WB=window.KELO_WORLD_BUILDER;if(!WB||WB.__uxWrapped)return;
    const raw=WB.request.bind(WB);
    async function request(op,payload){
      if(scope==='parcel'&&(op==='world-builder:paint'||op==='world-builder:erase-terrain')&&!insideParcel(payload.x,payload.y))throw new Error('FUERA_DE_LA_PARCELA');
      const out=await raw(op,payload||{});
      if(op==='world-builder:paint')pushUndo({kind:'paint',x:payload.x,y:payload.y,brush:payload.brushSize||1});
      if(op==='world-builder:erase-terrain')pushUndo({kind:'erase',x:payload.x,y:payload.y,material:'grass'});
      if(op==='world-builder:collision-create')pushUndo({kind:'collision',collisionId:out?.collisionId||out?.id||out?.collision?.collisionId});
      return out;
    }
    window.KELO_WORLD_BUILDER=Object.assign({},WB,{request,__uxWrapped:true});
  }
  function wrapProperty(){
    const S=window.KELO_PROPERTY_SYSTEM;if(!S||S.__uxWrapped)return;
    const raw=S.request.bind(S);
    async function request(op,payload){
      const data=Object.assign({},payload||{});
      if(op==='place'&&scope==='parcel'&&parcel?.parcelId)data.parcelId=parcel.parcelId;
      if(op==='place'&&scope==='world')data.parcelId=data.parcelId||'parcel:world:editor';
      const out=await raw(op,data);
      if(op==='place'&&out?.placementId){
        const C=window.KELO_PROPERTY_CATALOG,t=C?.get?.(data.assetId);
        const fp=t?.footprint||{x:0,y:0,w:t?.width||TILE,h:Math.max(16,(t?.height||TILE)*0.28)};
        let collisionId=null;
        try{
          const col=await window.KELO_WORLD_BUILDER?.request?.('world-builder:collision-create',{
            actorId:actor(),x:data.x+(fp.x||0),y:data.y+(t?Math.max(0,t.height-(fp.h||16)):0),w:fp.w||TILE,h:fp.h||TILE
          });
          collisionId=col?.collisionId||col?.id||col?.collision?.collisionId||null;
        }catch(e){}
        pushUndo({kind:'place',placementId:out.placementId,ownerId:data.ownerId||actor(),collisionId});
      }
      return out;
    }
    window.KELO_PROPERTY_SYSTEM=Object.assign({},S,{request,__uxWrapped:true});
  }
  function wrapEdit(){
    const E=window.KELO_WORLD_EDIT;if(!E?.request||editWrapped)return;
    const raw=E.request.bind(E);
    async function request(op,payload){
      if(scope==='parcel'){
        await ensureParcel();
        const S=window.KELO_PROPERTY_SYSTEM;
        if(op==='world:placement:create')return S.request('place',{ownerId:actor(),parcelId:parcel.parcelId,assetId:payload.assetId,x:payload.x,y:payload.y,rotation:payload.rotation||0});
        if(op==='world:placement:move')return S.request('move',{ownerId:actor(),placementId:payload.placementId,x:payload.x,y:payload.y});
        if(op==='world:placement:rotate')return S.request('rotate',{ownerId:actor(),placementId:payload.placementId,delta:payload.delta||1});
        if(op==='world:placement:remove')return S.request('remove',{ownerId:actor(),placementId:payload.placementId});
        if((op==='world:tile:paint'||op==='world:tile:clear')&&!insideParcel(payload.x,payload.y))throw new Error('FUERA_DE_LA_PARCELA');
        if(op==='world:publish'||op==='world:draft:submit'||op==='world:draft:approve'){toast('En parcela no se publica el mundo');return{ok:false,reason:'PARCEL_SCOPE'};}
      }
      return raw(op,payload||{});
    }
    window.KELO_WORLD_EDIT=Object.assign({},E,{request});
    editWrapped=true;
  }
  function setScope(next){
    scope=next==='parcel'?'parcel':'world';
    ensureParcel().then(p=>{
      toast(scope==='world'?'Editando PLAZA':'Editando MI PARCELA');
      if(scope==='parcel'&&p?.bounds){
        const x=p.bounds.x+p.bounds.w/2,y=p.bounds.y+p.bounds.h+40;
        if(!window.KeloPlayerPosition?.teleport)throw new Error('KeloPlayerPosition unavailable in builder scope');
        window.KeloPlayerPosition.teleport(x,y,{source:'builder-ux:parcel-scope',stopMotion:true});
        if(window.KeloCamera?.setTarget)window.KeloCamera.setTarget(x,y,{snap:true,source:'builder-ux:parcel-scope'});
      }
      document.getElementById('kelo-scope-world')?.classList.toggle('on',scope==='world');
      document.getElementById('kelo-scope-parcel')?.classList.toggle('on',scope==='parcel');
    }).catch(err=>toast(err.message));
  }
  function dock(on){
    const host=document.getElementById('kelo-world-builder');if(!host)return;
    host.classList.toggle('wb-dock',!!on);
    const btn=document.getElementById('kelo-builder-dock');
    if(btn)btn.textContent=on?'PANEL':'BARRA';
  }
  function injectChrome(){
    const host=document.getElementById('kelo-world-builder');
    if(!host)return;
    if(!document.getElementById('kelo-builder-scope')){
      const bar=document.createElement('div');
      bar.id='kelo-builder-scope';
      bar.innerHTML='<button id="kelo-scope-world" class="on">PLAZA</button><button id="kelo-scope-parcel">MI PARCELA</button>';
      const head=host.querySelector('.wb-head')||host.firstElementChild;
      if(head&&head.nextSibling)host.insertBefore(bar,head.nextSibling);else host.prepend(bar);
      document.getElementById('kelo-scope-world').onclick=()=>setScope('world');
      document.getElementById('kelo-scope-parcel').onclick=()=>setScope('parcel');
    }
    if(!document.getElementById('kelo-builder-hands')){
      const hands=document.createElement('div');
      hands.id='kelo-builder-hands';
      hands.innerHTML='<button id="kelo-builder-pick">RECOGER</button><button id="kelo-builder-rot">ROTAR</button><button id="kelo-builder-dock">BARRA</button>';
      host.appendChild(hands);
      document.getElementById('kelo-builder-pick').onclick=()=>pickUnderGhost();
      document.getElementById('kelo-builder-rot').onclick=()=>rotateHeldOrSelected();
      document.getElementById('kelo-builder-dock').onclick=()=>dock(!host.classList.contains('wb-dock'));
    }
    if(!document.getElementById('kelo-builder-ux-css')){
      const s=document.createElement('style');s.id='kelo-builder-ux-css';
      s.textContent='#kelo-builder-scope,#kelo-builder-hands{display:flex;gap:6px;padding:8px 10px}#kelo-builder-scope button,#kelo-builder-hands button{flex:1;border:1px solid rgba(231,197,106,.28);background:#111e20;color:#9db0a9;border-radius:9px;padding:8px;font-size:9px;font-weight:900}#kelo-builder-scope button.on,#kelo-builder-hands button.on{border-color:#e7c56a;color:#fff4d6;background:#1a2c26}#kelo-world-builder.wb-dock{top:auto!important;left:0!important;right:0!important;bottom:0!important;width:100%!important;height:auto!important;max-height:42vh;border-radius:18px 18px 0 0}#kelo-world-builder.wb-dock .wb-workflow,#kelo-world-builder.wb-dock .wb-history,#kelo-world-builder.wb-dock .wb-status{display:none}#kelo-world-builder.wb-dock .wb-list{max-height:22vh}';
      document.head.appendChild(s);
    }
    if(!document.getElementById('kelo-builder-undo')){
      const b=document.createElement('button');
      b.id='kelo-builder-undo';b.textContent='DESHACER';
      b.style.cssText='position:absolute;z-index:250;left:max(10px,env(safe-area-inset-left));bottom:max(58px,calc(env(safe-area-inset-bottom) + 46px));pointer-events:auto;border:1px solid rgba(231,197,106,.5);background:rgba(10,20,21,.94);color:#e7c56a;border-radius:12px;padding:8px 10px;font:800 10px/1 sans-serif';
      b.onclick=()=>undoLast();document.body.appendChild(b);
    }
    const peFab=document.getElementById('pe-fab');if(peFab)peFab.style.display='none';
    document.getElementById('pe-world-tools')?.remove();
    const pe=document.getElementById('kelo-property-editor');
    if(pe&&host.style.display!=='none'&&pe.style.display==='flex')pe.style.display='none';
    const lyr=layerNow();
    if(builderOpen()&&(lyr==='terrain'||lyr==='path'||lyr==='objects'))dock(true);
  }
  function drawGhost(g){
    if(parcel?.bounds&&scope==='parcel'){
      const b=parcel.bounds;g.save();g.strokeStyle='rgba(231,197,106,.9)';g.setLineDash([8,6]);g.strokeRect(b.x,b.y,b.w,b.h);g.setLineDash([]);g.restore();
    }
    if(!ghost)return;
    const w=held?.w||TILE,h=held?.h||TILE;
    g.save();g.globalAlpha=.4;g.fillStyle=held?'#7ad0ff':'#e7c56a';g.fillRect(ghost.x,ghost.y,w,h);g.globalAlpha=1;g.strokeStyle='#fff4d6';g.strokeRect(ghost.x,ghost.y,w,h);
    if(held){g.fillStyle='#fff4d6';g.font='12px sans-serif';g.fillText('↻ '+((held.rotation||0)*90)+'°',ghost.x+4,ghost.y+14);}
    g.restore();
  }
  const L=window.KELO_ENVIRONMENT_LAYERS;
  if(L?.register)L.register({id:'builder-ux-ghost',phase:'vfx_weather_lighting',priority:998,required:false,ready:()=>true,draw:drawGhost,ownership:'builder-ux-v4',bounds:()=>[]});
  window.addEventListener('pointermove',e=>{const w=toWorld(e);ghost={x:snap(w.x),y:snap(w.y),w:held?.w||TILE,h:held?.h||TILE};},{passive:true});
  window.addEventListener('keydown',e=>{
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undoLast();}
    if(e.key.toLowerCase()==='r')rotateHeldOrSelected();
  });
  const t=setInterval(()=>{wrapWorld();wrapProperty();wrapEdit();injectChrome();},200);
  setTimeout(()=>clearInterval(t),25000);
  window.KELO_BUILDER_UX=Object.freeze({
    version:'builder-ux-v1.4.0-position-owner',undoLast,setScope,pickUnderGhost,rotateHeldOrSelected,dock,
    drop:dropHeld,pickUp,
    get scope(){return scope;},get parcelId(){return parcel?.parcelId||null;},get holding(){return !!held;},get undoCount(){return undo.length;}
  });
})();