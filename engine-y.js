/* KELO-INDEX
 * area: LEGACY PLAZA HOUSES
 * owner: legacy house presentation; render extension owned by KeloRender
 * keys: HOUSES FACADE RENDER FOUNDATION
 * purpose: conserva fachadas legacy no sustituidas por assets authored sin envolver render
 * public-api: keloHouses, KELO_LEGACY_HOUSE_RENDERER
 * consumes: KeloRender, tile registry, camera
 * state-owned: HOUSES legacy
 * extension-points: KeloRender.afterFrame
 * reuse: no añadir arquitectura nueva aquí
 * legacy: visual fallback
 * do-not: NO envolver render
 */
(function () {
  const T = 32, OX = 1024, OY = 1216;
  const HOUSES = [
    { x: OX + 4 * T, y: OY + 2 * T, w: 5 * T, h: 3 * T, title: 'Mercado', wall: '#4a281c', roof: '#6a3020' },
    { x: OX + 20 * T, y: OY + 5 * T, w: 4 * T, h: 3 * T, title: 'Banco', wall: '#2a3038', roof: '#3a4048' },
    { x: OX + 2 * T, y: OY + 8 * T, w: 4 * T, h: 3 * T, title: 'Atelier', wall: '#402028', roof: '#5a2830' },
    { x: OX + 18 * T, y: OY + 14 * T, w: 5 * T, h: 3 * T, title: 'Café Oro', wall: '#3a2814', roof: '#5a3a18' }
  ];
  window.keloHouses = HOUSES;

  function resetActive(){return window.KELO_WORLD_DECORATION_RESET===true||window.KELO_WORLD_RENDERER?.decorationReset===true;}
  function overlapArea(a,b) {
    const w=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
    const h=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
    return w*h;
  }
  function authoredReplacementBounds() {
    const r=window.KELO_TILE_REGISTRY;
    if(!r?.architecturePrefabs||!r?.architectureAssets)return [];
    return Object.values(r.architecturePrefabs).filter(p=>p?.legacyVisualReplacement).map(p=>{
      const a=r.architectureAssets[p.asset];
      return a?{x:p.x,y:p.y,w:a.worldWidth,h:a.worldHeight,id:p.id}:null;
    }).filter(Boolean);
  }
  function substantiallyCoveredByAuthored(b) {
    return authoredReplacementBounds().some(a=>overlapArea(b,a)/(b.w*b.h)>=0.35);
  }
  function visibleHouses(){return resetActive()?[]:HOUSES.filter(b=>!substantiallyCoveredByAuthored(b));}
  function suppressedHouses(){return resetActive()?HOUSES.map(b=>b.title):HOUSES.filter(substantiallyCoveredByAuthored).map(b=>b.title);}

  function facade(ctx, b) {
    const x = b.x, y = b.y, w = b.w, h = b.h;
    ctx.fillStyle = b.roof;
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 16);
    ctx.lineTo(x + w / 2, y - 22);
    ctx.lineTo(x + w + 6, y + 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = b.wall;
    ctx.fillRect(x, y + 16, w, h - 16);
    ctx.fillStyle = '#d4b46a';
    ctx.fillRect(x + 12, y + 28, 14, 16);
    ctx.fillRect(x + w - 28, y + 28, 14, 16);
    ctx.fillStyle = '#1c1810';
    ctx.fillRect(x + 14, y + 30, 10, 12);
    ctx.fillRect(x + w - 26, y + 30, 10, 12);
    ctx.fillStyle = '#140e0a';
    ctx.fillRect(x + w / 2 - 10, y + h - 24, 20, 24);
    ctx.fillStyle = '#e7c56a';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.title, x + w / 2, y - 26);
  }

  function drawLegacyHouses() {
    if (resetActive()) return;
    if (window._keloHouseFrame === window._keloFrame) return;
    window._keloHouseFrame = window._keloFrame || 0;
    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    visibleHouses().forEach(function (b) { facade(ctx, b); });
    ctx.restore();
  }
  if(!window.KeloRender) throw new Error('KeloRender unavailable before engine-y');
  window.KeloRender.afterFrame('engine-y:legacy-houses', drawLegacyHouses, 90);
  window.KELO_LEGACY_HOUSE_RENDERER=Object.freeze({version:'legacy-house-authored-overlap-v3-foundation',suppressionMode:'decoration-reset-or-luxe-overlap-v1',coverageSource:'registry-prefabs-v1',threshold:0.35,renderOwner:'KeloRender',get decorationReset(){return resetActive();},get visibleTitles(){return visibleHouses().map(b=>b.title);},get suppressedTitles(){return suppressedHouses();}});
})();