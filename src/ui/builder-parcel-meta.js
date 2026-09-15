/* KELO-INDEX
 * area: PROPERTY
 * owner: parcel metadata; player transition owned by KeloPlayerPosition; camera owned by KeloCamera
 * keys: PARCEL NAME DOOR SPAWN META ONLINE POSITION CAMERA
 * hace: nombre + tile puerta de la parcela; al entrar delega posición/cámara a Foundation owners
 * online: metadata local lista para copiar al record del server
 * do-not: NO escribir localPlayer.x/y ni camera.* directamente
 */
(function(){
  'use strict';
  if(window.KELO_PARCEL_META)return;
  const STORE='kelo-parcel-meta-v1';
  const TILE=32;
  let db={};
  let doorPick=false;
  try{db=JSON.parse(localStorage.getItem(STORE)||'{}')||{};}catch(e){db={};}
  function save(){try{localStorage.setItem(STORE,JSON.stringify(db));}catch(e){}}
  function toast(m){if(typeof showToast==='function')showToast(m);}
  function pid(){return window.KELO_BUILDER_UX?.parcelId||null;}
  function rec(id){
    const k=id||pid();if(!k)return {name:'Mi parcela',door:null};
    if(!db[k])db[k]={name:'Mi parcela',door:null};
    return db[k];
  }
  function setName(name){
    const k=pid();if(!k){toast('Abre MI PARCELA primero');return;}
    rec(k).name=String(name||'Mi parcela').slice(0,32);save();toast('Nombre: '+rec(k).name);
  }
  function setDoor(x,y){
    const k=pid();if(!k){toast('Abre MI PARCELA primero');return;}
    rec(k).door={x:Math.floor(x/TILE)*TILE,y:Math.floor(y/TILE)*TILE};save();doorPick=false;toast('Puerta lista');
    const btn=document.getElementById('kelo-door-pick');if(btn)btn.classList.remove('on');
  }
  function warpToDoor(){
    const m=rec();if(!m.door)return;
    if(!window.KeloPlayerPosition?.teleport){console.error('[Kelo parcel meta] KeloPlayerPosition unavailable');return;}
    const x=m.door.x+TILE/2,y=m.door.y+TILE+8;
    window.KeloPlayerPosition.teleport(x,y,{source:'parcel-meta:door',stopMotion:true});
    if(window.KeloCamera?.setTarget)window.KeloCamera.setTarget(x,y,{snap:true,source:'parcel-meta:door'});
  }
  function inject(){
    const host=document.getElementById('kelo-world-builder');if(!host||document.getElementById('kelo-parcel-meta'))return;
    const box=document.createElement('div');
    box.id='kelo-parcel-meta';
    box.innerHTML='<input id="kelo-parcel-name" maxlength="32" placeholder="Nombre de parcela"><button id="kelo-door-pick">PUERTA</button><button id="kelo-door-go">IR</button>';
    const scope=document.getElementById('kelo-builder-scope');
    if(scope&&scope.nextSibling)host.insertBefore(box,scope.nextSibling);else host.appendChild(box);
    const input=document.getElementById('kelo-parcel-name');
    input.value=rec().name||'';
    input.onchange=()=>setName(input.value);
    document.getElementById('kelo-door-pick').onclick=()=>{doorPick=!doorPick;document.getElementById('kelo-door-pick').classList.toggle('on',doorPick);toast(doorPick?'Toca el tile de la puerta':'Cancelado');};
    document.getElementById('kelo-door-go').onclick=warpToDoor;
    if(!document.getElementById('kelo-parcel-meta-css')){
      const s=document.createElement('style');s.id='kelo-parcel-meta-css';
      s.textContent='#kelo-parcel-meta{display:flex;gap:6px;padding:6px 10px}#kelo-parcel-meta input{flex:1;min-width:0;border:1px solid rgba(231,197,106,.28);background:#0f191c;color:#e7ece9;border-radius:8px;padding:8px;font-size:11px}#kelo-parcel-meta button{border:1px solid rgba(231,197,106,.28);background:#111e20;color:#e9d38d;border-radius:8px;padding:8px;font-size:9px;font-weight:900}#kelo-parcel-meta button.on{border-color:#e7c56a;color:#fff4d6}';
      document.head.appendChild(s);
    }
  }
  document.addEventListener('pointerdown',function(e){
    if(!doorPick)return;
    const host=document.getElementById('kelo-world-builder');
    if(host&&host.contains(e.target))return;
    e.preventDefault();e.stopImmediatePropagation();
    const z=(typeof CONFIG!=='undefined'&&CONFIG.zoom)||1;
    const w=typeof screenToWorld==='function'?screenToWorld(e.clientX,e.clientY):{x:camera.x+(e.clientX-screenW/2)/z,y:camera.y+(e.clientY-screenH/2)/z};
    setDoor(w.x,w.y);
  },true);
  function drawDoor(g){
    const m=rec();if(!m.door)return;
    g.save();g.strokeStyle='#7ad0ff';g.lineWidth=2;g.strokeRect(m.door.x,m.door.y,TILE,TILE);
    g.fillStyle='#7ad0ff';g.font='10px sans-serif';g.fillText('PUERTA',m.door.x+2,m.door.y-4);g.restore();
  }
  const L=window.KELO_ENVIRONMENT_LAYERS;
  if(L?.register)L.register({id:'parcel-door-mark',phase:'vfx_weather_lighting',priority:997,required:false,ready:()=>true,draw:drawDoor,ownership:'parcel-meta',bounds:()=>[]});
  const t=setInterval(()=>{
    inject();
    const input=document.getElementById('kelo-parcel-name');
    if(input&&document.activeElement!==input){
      const n=rec().name||'';
      if(input.value!==n&&!input.matches(':focus'))input.value=n;
    }
  },300);
  setTimeout(()=>clearInterval(t),25000);
  const prev=window.KELO_BUILDER_UX;
  if(prev&&prev.setScope){
    const raw=prev.setScope.bind(prev);
    /* wrap via interval after UX exists */
  }
  window.addEventListener('kelo-builder-scope',e=>{if(e.detail==='parcel')setTimeout(warpToDoor,80);});
  document.addEventListener('click',e=>{
    if(e.target&&e.target.id==='kelo-scope-parcel')setTimeout(warpToDoor,120);
  },true);
  window.KELO_PARCEL_META=Object.freeze({version:'parcel-meta-v1.1.0-position-owner',setName,setDoor,warpToDoor,get meta(){return rec();}});
})();
