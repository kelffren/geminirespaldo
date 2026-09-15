/* KELO-INDEX
 * area: CORE
 * owner: legacy social/render bridge; frame authority owned by KeloRender; transition position commands owned by KeloPlayerPosition; camera commands after boot owned by KeloCamera
 * keys: RENDER LAYERS VISUAL VFX SCREEN UPDATE SOCIAL CAMERA POSITION FOUNDATION PVP LEGACY BOT GUARD SIMULATION BRIDGE
 * hace: expone dibujo legacy mediante KELO_LEGACY_RENDER_BRIDGE y augmentación legacy de simulación mediante KELO_LEGACY_SIMULATION_BRIDGE sin poseer render/updateSimulation/position transitions
 * online: visuales consumen eventos; este archivo no decide autoridad compartida
 * legacy: CONFIG.zoom/cycleZoom/screenToWorld son bootstrap pre-KeloCamera y quedan reemplazados por el owner tras carga; simulación base permanece en engine-a
 * do-not: no añadir nuevos writers camera.* ni localPlayer.x/y ni wrappers render/renderAvatar/updateSimulation; usar KeloCamera/KeloPlayerPosition/KeloRender/KeloAvatar/KeloSimulation
 */
CONFIG.zoom = 0.82;
const ZOOM_STEPS = [0.7, 0.82, 1];
function decorationResetActive() {
  return window.KELO_WORLD_DECORATION_RESET === true || window.KELO_WORLD_RENDERER?.decorationReset === true;
}
function screenToWorld(sx, sy) {
  const z = CONFIG.zoom || 1;
  return { x: camera.x + (sx - screenW / 2) / z, y: camera.y + (sy - screenH / 2) / z };
}
function cycleZoom() {
  const i = ZOOM_STEPS.indexOf(CONFIG.zoom);
  CONFIG.zoom = ZOOM_STEPS[(i + 1) % ZOOM_STEPS.length];
  showToast('Zoom ' + CONFIG.zoom);
  closeMenu();
}
function closeSocialOverlays() {
  const bag = document.getElementById('kelo-bag');
  if (bag) bag.style.display = 'none';
  const stones = document.getElementById('kelo-builder');
  if (stones) stones.style.display = 'none';
  const chat = document.getElementById('lx-chat-drawer');
  if (chat) chat.classList.remove('open');
}
function toggleMenu() {
  const el = document.getElementById('menu-sheet');
  if (!el) return;
  const open = el.style.display === 'block';
  document.querySelectorAll('.app-panel').forEach(p => p.style.display = 'none');
  if (!open) closeSocialOverlays();
  el.style.display = open ? 'none' : 'block';
}
function closeMenu() {
  const el = document.getElementById('menu-sheet');
  if (el) el.style.display = 'none';
}
function openFromMenu(id) { closeMenu(); togglePanel(id); }
function openSocialTool(tool) {
  closeMenu();
  if (tool !== 'chat') {
    const drawer = document.getElementById('lx-chat-drawer');
    if (drawer) drawer.classList.remove('open');
  }
  if (tool === 'bag') {
    if (window.KeloSocialUI && typeof window.KeloSocialUI.openBag === 'function') return window.KeloSocialUI.openBag();
    showToast('Mochila no disponible');
    return;
  }
  if (tool === 'stones' || tool === 'abilities') {
    if (window.KeloAbilities && typeof window.KeloAbilities.openStonePanel === 'function') return window.KeloAbilities.openStonePanel();
    showToast('Habilidades todavía cargando');
    return;
  }
  if (tool === 'chat') {
    const drawer = document.getElementById('lx-chat-drawer');
    if (drawer) {
      const bag = document.getElementById('kelo-bag');
      if (bag) bag.style.display = 'none';
      const stones = document.getElementById('kelo-builder');
      if (stones) stones.style.display = 'none';
      drawer.classList.add('open');
      return;
    }
    showToast('Chat todavía cargando');
    return;
  }
  if (tool === 'profile') {
    if (typeof inspectPlayer === 'function') return inspectPlayer(localPlayer, true);
    showToast('Perfil no disponible');
    return;
  }
  if (tool === 'market') { showToast('Mercado · acceso social preparado'); return; }
  if (tool === 'properties') { showToast('Propiedades · acceso social preparado'); return; }
  if (tool === 'missions') { showToast('Misiones · acceso social preparado'); return; }
  if (tool === 'friends') { showToast('Amigos · acceso social preparado'); return; }
  if (tool === 'settings') { showToast('Ajustes · usa Zoom HD por ahora'); return; }
}
function transitionPlayer(x,y,source) {
  if (!window.KeloPlayerPosition || typeof window.KeloPlayerPosition.teleport !== 'function') throw new Error('KeloPlayerPosition unavailable during quickTravel');
  return window.KeloPlayerPosition.teleport(x,y,{source:source,stopMotion:true});
}
function quickTravel(dest) {
  closeMenu();
  if (!window.KeloCamera) throw new Error('KeloCamera unavailable during quickTravel');
  if (dest === 'plaza') { transitionPlayer(1400,1600,'engine-c:quick-travel-plaza'); window.KeloCamera.setTarget(1400, 1600, { source:'engine-c:quick-travel-plaza' }); showToast('Plaza Central'); }
  else if (dest === 'farm') { teleportToFarm(); showToast('Distrito Rural'); }
  else if (dest === 'house') { teleportToPlot(); showToast('Tu parcela'); }
  else if (dest === 'arena') { const x=arenaPvP.x+80,y=arenaPvP.y+arenaPvP.h/2; transitionPlayer(x,y,'engine-c:quick-travel-arena'); window.KeloCamera.setTarget(arenaPvP.x + arenaPvP.w / 2, arenaPvP.y + arenaPvP.h / 2, { source:'engine-c:quick-travel-arena' }); showToast('Arena 1v1'); }
}
checkFarmTouch = function(sx, sy) {
  if (decorationResetActive()) return false;
  const w = screenToWorld(sx, sy);
  const farm = STATE.farm, now = Date.now();
  for (let i = 0; i < farm.crops.length; i++) {
    const c = farm.crops[i];
    const cx = farm.x + 20 + (i % 2) * 110;
    const cy = farm.y + 30 + Math.floor(i / 2) * 110;
    if (w.x >= cx && w.x <= cx + 90 && w.y >= cy && w.y <= cy + 90) {
      if (c.type) {
        const meta = CROP_TYPES[c.type];
        if ((now - c.plantedAt) / 1000 >= meta.growTime) {
          STATE.silo[c.type] = (STATE.silo[c.type] || 0) + 1;
          STATE.farmXp = (STATE.farmXp || 0) + meta.xp;
          if (STATE.farmXp >= STATE.farmLevel * 40) { STATE.farmLevel++; STATE.farmXp = 0; showToast('Granjero nivel ' + STATE.farmLevel); }
          c.type = null; saveState(); showToast('Cosechaste ' + meta.name); return true;
        }
      } else { c.type = 'wheat'; c.plantedAt = Date.now(); saveState(); showToast('Sembraste trigo'); return true; }
    }
  }
  return false;
};
checkSocialTouch = function(sx, sy) {
  if (decorationResetActive()) { closeSocialModal(); return; }
  const w = screenToWorld(sx, sy);
  for (const p of simulatedPlayers) {
    if (Math.hypot(w.x - p.x, w.y - p.y) < p.radius * 1.8) { openSocialModal(p, sx, sy); return; }
  }
  closeSocialModal();
};
handleBuildGridTap = function(sx, sy) {
  if (decorationResetActive()) return;
  const w = screenToWorld(sx, sy);
  const plot = STATE.plot;
  if (w.x < plot.x || w.x > plot.x + plot.w || w.y < plot.y || w.y > plot.y + plot.h) return;
  const gx = Math.floor((w.x - plot.x) / TILE_SIZE);
  const gy = Math.floor((w.y - plot.y) / TILE_SIZE);
  STATE.plot.furniture = STATE.plot.furniture.filter(f => !(f.gx === gx && f.gy === gy));
  if (activeTool !== 'eraser') STATE.plot.furniture.push({ type: activeTool, gx: gx, gy: gy, gw: 1, gh: 1 });
  saveState();
};
window.KELO_LEGACY_RENDER_BRIDGE=Object.freeze({
  version:'engine-c-render-bridge-v1',
  drawFrame:function(){
    const reset = decorationResetActive();
    ctx.fillStyle = reset ? '#ffffff' : '#07090d'; ctx.fillRect(0, 0, screenW, screenH);
    const z = CONFIG.zoom || 1;
    ctx.save(); ctx.translate(screenW / 2, screenH / 2); ctx.scale(z, z); ctx.translate(-camera.x, -camera.y);
    if (window.KeloScreenFX && typeof window.KeloScreenFX.applyWorldTransform === 'function') window.KeloScreenFX.applyWorldTransform(ctx);
    let worldDrawn = false;
    if (window.KELO_WORLD_RENDERER && typeof window.KELO_WORLD_RENDERER.draw === 'function') {
      worldDrawn = window.KELO_WORLD_RENDERER.draw(ctx) === true;
    }
    if (!worldDrawn) {
      ctx.fillStyle = reset ? '#ffffff' : '#49c934'; ctx.fillRect(0, 0, CONFIG.worldWidth, CONFIG.worldHeight);
    }
    if (window.KeloVisualSystem) window.KeloVisualSystem.renderWorldLayer('groundFX', ctx);
    if (!reset) {
      ctx.strokeStyle = '#8b3a3a'; ctx.lineWidth = 4; ctx.strokeRect(0, 0, CONFIG.worldWidth, CONFIG.worldHeight);
      if (Array.isArray(obstacles)) obstacles.forEach(function(b){ if(b) b.noDraw = true; });
      if (typeof window.renderFarm === 'function') window.renderFarm(STATE.farm);
      renderPlot(STATE.plot, true);
      renderArena(arenaPvP);
    }
    for (const pt of particles) { ctx.fillStyle = pt.color; ctx.globalAlpha = pt.life / pt.maxLife; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (pt.life / pt.maxLife), 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (window.KeloVisualSystem) window.KeloVisualSystem.renderWorldLayer('belowActor', ctx);
    if (window.KELO_WORLD_RENDERER && typeof window.KELO_WORLD_RENDERER.drawPreActors === 'function') window.KELO_WORLD_RENDERER.drawPreActors(ctx);
    if (isPvPActive && arenaPvP.rival) renderAvatar(arenaPvP.rival, false);
    else if (!reset) simulatedPlayers.forEach(p => renderAvatar(p, false));
    renderAvatar(localPlayer, true);
    if (window.KeloVisualSystem) window.KeloVisualSystem.renderWorldLayer('worldFX', ctx);
    if (window.KELO_WORLD_RENDERER && typeof window.KELO_WORLD_RENDERER.drawPostActors === 'function') window.KELO_WORLD_RENDERER.drawPostActors(ctx);
    if (window.KeloVisualSystem) window.KeloVisualSystem.renderWorldLayer('foregroundFX', ctx);
    ctx.restore();
    if (window.KeloVisualSystem) window.KeloVisualSystem.renderScreenLayer('screenFX', ctx);
    if (input.touchActive && !isBuildMode) {
      ctx.save(); ctx.strokeStyle = 'rgba(231,197,106,0.35)'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(231,197,106,0.06)';
      ctx.beginPath(); ctx.arc(input.originX, input.originY, CONFIG.joystickRadius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const dx = input.currentX - input.originX, dy = input.currentY - input.originY;
      const dist = Math.hypot(dx, dy), clamped = Math.min(dist, CONFIG.joystickRadius), angle = Math.atan2(dy, dx);
      ctx.fillStyle = '#e7c56a'; ctx.beginPath();
      ctx.arc(input.originX + Math.cos(angle) * clamped, input.originY + Math.sin(angle) * clamped, 18, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
});
const _legacySimulationFrames=[];
window.KELO_LEGACY_SIMULATION_BRIDGE=Object.freeze({
  version:'engine-c-simulation-bridge-v1',
  before:function(){
    const modernPvp=window.KELO_COMBAT_ENABLED===true;
    const legacyBotState=modernPvp&&Array.isArray(simulatedPlayers)?simulatedPlayers.map(function(bot){
      return {bot:bot,x:bot.x,y:bot.y,targetX:bot.targetX,targetY:bot.targetY};
    }):null;
    _legacySimulationFrames.push(legacyBotState);
  },
  after:function(ctx){
    const legacyBotState=_legacySimulationFrames.pop()||null;
    if(legacyBotState)legacyBotState.forEach(function(entry){
      entry.bot.x=entry.x;entry.bot.y=entry.y;entry.bot.targetX=entry.targetX;entry.bot.targetY=entry.targetY;
    });
    const now=Date.now();
    if(STATE.farm.coop&&STATE.farm.coop.fedAt&&(now-STATE.farm.coop.fedAt)/1000>=STATE.farm.coop.duration){
      if(!STATE.farm.coop.ready){STATE.farm.coop.ready=true;STATE.silo.eggs=(STATE.silo.eggs||0)+2;STATE.farm.coop.fedAt=0;saveState();showToast('+2 huevos');}
    }
    if(STATE.farm.pen&&STATE.farm.pen.fedAt&&STATE.farm.pen.fedAt>0&&(now-STATE.farm.pen.fedAt)/1000>=STATE.farm.pen.duration){
      if(!STATE.farm.pen.ready){STATE.farm.pen.ready=true;STATE.silo.pork=(STATE.silo.pork||0)+1;STATE.farm.pen.fedAt=0;saveState();showToast('+1 cerdo');}
    }
    if(window.KeloVisualSystem&&typeof window.KeloVisualSystem.update==='function')window.KeloVisualSystem.update(ctx&&Number(ctx.dt)||0);
  }
});
window.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { closeMenu(); closeSocialOverlays(); document.querySelectorAll('.app-panel').forEach(function(p){ p.style.display = 'none'; }); }
});
const _feedAnimals = feedAnimals;
feedAnimals = function(type) { _feedAnimals(type); if (type === 'chickens' && STATE.farm.coop) STATE.farm.coop.ready = false; if (type === 'pigs' && STATE.farm.pen) STATE.farm.pen.ready = false; };
window.KELO_LEGACY_WORLD_DRAW_AUDIT = Object.freeze({
  version:'legacy-world-reset-guard-v4-render-simulation-bridges',
  get decorationReset(){ return decorationResetActive(); },
  farmSuppressed:true,
  plotSuppressed:true,
  arenaFrameSuppressed:true,
  simulatedPlayersSuppressed:true,
  pvpLegacyBotWanderingSuppressed:true,
  baseObstaclesSuppressed:true,
  renderWrapperRetired:true,
  renderBridge:'KELO_LEGACY_RENDER_BRIDGE',
  simulationWrapperRetired:true,
  simulationBridge:'KELO_LEGACY_SIMULATION_BRIDGE'
});