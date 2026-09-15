/* KELO-INDEX
 * area: WORLD BUILDER
 * keys: PARCEL CAP OCCUPIED OVERLAP GHOST SPRITE RULES ONLINE
 * hace: tope de parcela, no apilar props, ghost con sprite si hay asset
 * online: solo valida en request(); límites viajan luego al server igual
 */
(function(){
  'use strict';
  if(window.KELO_BUILDER_RULES)return;
  const MAX_PROPS=40;
  const MAX_TILES=400;
  const TILE=32;
  let wrappedE=false,wrappedS=false,wrappedW=false;
  function toast(m){if(typeof showToast==='function')showToast(m);}
  function ux(){return window.KELO_BUILDER_UX;}
  function scope(){return ux()?.scope||'world';}
  function parcelId(){return ux()?.parcelId||null;}
  function parcelRec(){
    const S=window.KELO_PROPERTY_SYSTEM;
    const id=parcelId();
    if(!id||!S?.getParcel)return null;
    try{return S.getParcel(id)||null;}catch(e){return null;}
  }
  function placements(){
    const S=window.KELO_PROPERTY_SYSTEM;if(!S?.getPlacements)return [];
    const id=parcelId();
    return id?S.getPlacements(id)||[]:S.getPlacements?.()||[];
  }
  function tmpl(id){return window.KELO_PROPERTY_CATALOG?.get?.(id)||null;}
  function boxOf(assetId,x,y,rot){
    const t=tmpl(assetId)||{};
    let w=Number(t.width)||TILE,h=Number(t.height)||TILE;
    if((Number(rot)||0)%2){const s=w;w=h;h=s;}
    return{x:Number(x)||0,y:Number(y)||0,w,h};
  }
  function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
  function occupied(assetId,x,y,rot,ignoreId){
    const a=boxOf(assetId,x,y,rot);
    a.x+=4;a.y+=4;a.w=Math.max(8,a.w-8);a.h=Math.max(8,a.h-8);
    for(const p of placements()){
      if(!p||p.placementId===ignoreId)continue;
      const b=boxOf(p.assetId,p.x,p.y,p.rotation||0);
      if(overlap(a,b))return p;
    }
    return null;
  }
  function tileCountInParcel(){
    const rec=parcelRec();const cells=window.KELO_WORLD_BUILDER?.snapshot?.()?.cells||{};
    if(!rec?.bounds)return Object.keys(cells).length;
    const b=rec.bounds;let n=0;
    for(const k of Object.keys(cells)){
      const p=k.split(',');const x=Number(p[0]),y=Number(p[1]);
      if(x>=b.x&&y>=b.y&&x<b.x+b.w&&y<b.y+b.h)n++;
    }
    return n;
  }
  function assertParcelPlace(payload){
    if(scope()!=='parcel')return;
    if(placements().length>=MAX_PROPS)throw new Error('PARCELA_LLENA ('+MAX_PROPS+' props)');
    const hit=occupied(payload.assetId,payload.x,payload.y,payload.rotation||0,payload.placementId);
    if(hit)throw new Error('ENCIMA_DE_OTRO_OBJETO');
  }
  function assertParcelPaint(payload){
    if(scope()!=='parcel')return;
    if(tileCountInParcel()>=MAX_TILES)throw new Error('PARCELA_SUELO_LLENO ('+MAX_TILES+' tiles)');
  }
  function wrapE(){
    const E=window.KELO_WORLD_EDIT;if(!E?.request||E.__rules)return;
    const raw=E.request.bind(E);
    async function request(op,payload){
      const data=payload||{};
      if(op==='world:placement:create')assertParcelPlace(data);
      if(op==='world:placement:move')assertParcelPlace(data);
      if(op==='world:tile:paint')assertParcelPaint(data);
      return raw(op,data);
    }
    window.KELO_WORLD_EDIT=Object.assign({},E,{request,__rules:true});
    wrappedE=true;
  }
  function wrapS(){
    const S=window.KELO_PROPERTY_SYSTEM;if(!S?.request||S.__rules)return;
    const raw=S.request.bind(S);
    async function request(op,payload){
      const data=payload||{};
      if(op==='place')assertParcelPlace(data);
      if(op==='move')assertParcelPlace(data);
      return raw(op,data);
    }
    window.KELO_PROPERTY_SYSTEM=Object.assign({},S,{request,__rules:true});
    wrappedS=true;
  }
  function wrapW(){
    const W=window.KELO_WORLD_BUILDER;if(!W?.request||W.__rules)return;
    const raw=W.request.bind(W);
    async function request(op,payload){
      const data=payload||{};
      if(op==='world-builder:paint')assertParcelPaint(data);
      return raw(op,data);
    }
    window.KELO_WORLD_BUILDER=Object.assign({},W,{request,__rules:true});
    wrappedW=true;
  }

  const imgCache=new Map();
  function partImage(t){
    const key=t?.parts?.[0]?.assetKey;if(!key)return null;
    if(imgCache.has(key))return imgCache.get(key);
    const img=new Image();
    const candidates=[
      'assets/'+key+'.PNG','assets/'+key+'.png','assets/'+key+'.webp',
      'assets/'+String(key).replace(/-runtime$/,'')+'.PNG'
    ];
    img.onload=()=>imgCache.set(key,img);
    img.onerror=()=>{const n=candidates.shift();if(n)img.src=n;else imgCache.set(key,null);};
    img.src=candidates.shift();
    imgCache.set(key,'pending');
    return null;
  }
  function drawGhost(g){
    const held=!!ux()?.holding;
    const t=window.__keloGhostAsset?tmpl(window.__keloGhostAsset):null;
    if(!t)return;
    const img=partImage(t);
    if(!img||img==='pending')return;
    const gx=window.__keloGhostX,gy=window.__keloGhostY;if(gx==null)return;
    g.save();g.globalAlpha=.55;g.drawImage(img,gx,gy,t.width||TILE,t.height||TILE);g.restore();
  }
  window.addEventListener('pointermove',e=>{
    const z=(typeof CONFIG!=='undefined'&&CONFIG.zoom)||1;
    const w=typeof screenToWorld==='function'?screenToWorld(e.clientX,e.clientY):{x:camera.x+(e.clientX-screenW/2)/z,y:camera.y+(e.clientY-screenH/2)/z};
    window.__keloGhostX=Math.floor(w.x/TILE)*TILE;
    window.__keloGhostY=Math.floor(w.y/TILE)*TILE;
  },{passive:true});
  const L=window.KELO_ENVIRONMENT_LAYERS;
  if(L?.register)L.register({id:'builder-rules-ghost',phase:'vfx_weather_lighting',priority:999,required:false,ready:()=>true,draw:drawGhost,ownership:'builder-rules',bounds:()=>[]});

  document.addEventListener('click',e=>{
    const card=e.target.closest?.('.wb-card[data-asset-id]');
    if(card)window.__keloGhostAsset=card.dataset.assetId;
  },true);

  const iv=setInterval(()=>{wrapE();wrapS();wrapW();},160);
  setTimeout(()=>clearInterval(iv),20000);
  window.KELO_BUILDER_RULES=Object.freeze({
    version:'builder-rules-v1.0.0',MAX_PROPS,MAX_TILES,occupied,
    get props(){return placements().length;},
    get tiles(){return tileCountInParcel();}
  });
})();
