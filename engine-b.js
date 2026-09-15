function renderFarm(farm) {
  ctx.fillStyle = 'rgba(46, 117, 89, 0.15)';
  ctx.fillRect(farm.x, farm.y, farm.w, farm.h);
  ctx.strokeStyle = '#2e7559'; ctx.lineWidth = 2; ctx.strokeRect(farm.x, farm.y, farm.w, farm.h);
  const now = Date.now();
  farm.crops.forEach((c, idx) => {
    const cx = farm.x + 20 + (idx % 2) * 110;
    const cy = farm.y + 30 + Math.floor(idx / 2) * 110;
    ctx.fillStyle = '#3a271d'; ctx.fillRect(cx, cy, 90, 90);
    if (c.type) {
      const meta = CROP_TYPES[c.type];
      const elapsed = (now - c.plantedAt) / 1000;
      ctx.textAlign = 'center';
      ctx.font = elapsed >= meta.growTime ? '24px sans-serif' : '16px sans-serif';
      ctx.fillText(elapsed >= meta.growTime ? meta.icon : '\uD83C\uDF31', cx + 45, cy + 50);
    }
  });
}
function renderArena(arena) {
  ctx.fillStyle = 'rgba(239, 71, 111, 0.12)'; ctx.fillRect(arena.x, arena.y, arena.w, arena.h);
  ctx.strokeStyle = '#ef476f'; ctx.lineWidth = 3; ctx.strokeRect(arena.x, arena.y, arena.w, arena.h);
  ctx.fillStyle = '#ef476f'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('ARENA 1V1', arena.x + 12, arena.y - 10);
  for (const p of arena.projectiles) { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill(); }
}
function checkFarmTouch(sx, sy) {
  const wx = sx + (camera.x - screenW / 2), wy = sy + (camera.y - screenH / 2);
  const farm = STATE.farm, now = Date.now();
  for (let i = 0; i < farm.crops.length; i++) {
    const c = farm.crops[i];
    const cx = farm.x + 20 + (i % 2) * 110;
    const cy = farm.y + 30 + Math.floor(i / 2) * 110;
    if (wx >= cx && wx <= cx + 90 && wy >= cy && wy <= cy + 90) {
      if (c.type) {
        const meta = CROP_TYPES[c.type];
        if ((now - c.plantedAt) / 1000 >= meta.growTime) {
          STATE.silo[c.type] = (STATE.silo[c.type] || 0) + 1; c.type = null; saveState(); showToast('Cosechaste ' + meta.name); return true;
        }
      } else { c.type = 'wheat'; c.plantedAt = Date.now(); saveState(); showToast('Sembraste Trigo.'); return true; }
    }
  }
  return false;
}
function checkSocialTouch(screenX, screenY) {
  const worldTapX = screenX + (camera.x - screenW / 2), worldTapY = screenY + (camera.y - screenH / 2);
  for (const p of simulatedPlayers) {
    if (Math.hypot(worldTapX - p.x, worldTapY - p.y) < p.radius * 1.8) { openSocialModal(p, screenX, screenY); return; }
  }
  closeSocialModal();
}
let activeSocialTarget = null;
function openSocialModal(player, sx, sy) {
  activeSocialTarget = player;
  document.getElementById('social-target-name').textContent = player.name;
  const modal = document.getElementById('social-modal');
  modal.style.display = 'block';
  modal.style.left = Math.min(sx, screenW - 180) + 'px';
  modal.style.top = Math.min(sy, screenH - 160) + 'px';
}
function closeSocialModal() { document.getElementById('social-modal').style.display = 'none'; activeSocialTarget = null; }
function socialAction(action) {
  if (action === 'Desafiar 1v1') startPvP(activeSocialTarget);
  else if (action === 'Visitar Casa') { camera.targetX = activeSocialTarget.plotX; camera.targetY = activeSocialTarget.plotY; localPlayer.x = activeSocialTarget.plotX - 60; localPlayer.y = activeSocialTarget.plotY; }
  else showToast(action + ' sobre ' + activeSocialTarget.name);
  closeSocialModal();
}
function toggleBuildMode() {
  isBuildMode = !isBuildMode;
  const btn = document.getElementById('btn-toggle-editor');
  const bar = document.getElementById('build-mode-bar');
  const actBar = document.getElementById('action-bar-container');
  if (isBuildMode) { btn.style.background = '#da3633'; btn.textContent = 'Salir Edicion'; bar.style.display = 'flex'; actBar.style.display = 'none'; teleportToPlot(); }
  else { btn.style.background = '#238636'; btn.textContent = 'Construir'; bar.style.display = 'none'; actBar.style.display = 'grid'; saveState(); }
}
function selectTool(tool) {
  activeTool = tool;
  document.querySelectorAll('.build-tool-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tool-' + tool).classList.add('active');
}
function handleBuildGridTap(sx, sy) {
  const wx = sx + (camera.x - screenW / 2), wy = sy + (camera.y - screenH / 2), plot = STATE.plot;
  if (wx < plot.x || wx > plot.x + plot.w || wy < plot.y || wy > plot.y + plot.h) return;
  const gx = Math.floor((wx - plot.x) / TILE_SIZE), gy = Math.floor((wy - plot.y) / TILE_SIZE);
  STATE.plot.furniture = STATE.plot.furniture.filter(f => !(f.gx === gx && f.gy === gy));
  if (activeTool !== 'eraser') STATE.plot.furniture.push({ type: activeTool, gx: gx, gy: gy, gw: 1, gh: 1 });
  saveState();
}
function teleportToPlot() {
  camera.targetX = STATE.plot.x + STATE.plot.w / 2; camera.targetY = STATE.plot.y + STATE.plot.h / 2;
  localPlayer.x = STATE.plot.x + STATE.plot.w / 2; localPlayer.y = STATE.plot.y + STATE.plot.h + 40;
}
function teleportToFarm() {
  camera.targetX = STATE.farm.x + STATE.farm.w / 2; camera.targetY = STATE.farm.y + STATE.farm.h / 2;
  localPlayer.x = STATE.farm.x + STATE.farm.w / 2; localPlayer.y = STATE.farm.y + STATE.farm.h + 40;
}
function startPvP(targetPlayer) {
  isPvPActive = true;
  arenaPvP.rival = Object.assign({}, targetPlayer, { x: arenaPvP.x + arenaPvP.w - 100, y: arenaPvP.y + arenaPvP.h / 2, hp: 100, maxHp: 100 });
  localPlayer.x = arenaPvP.x + 100; localPlayer.y = arenaPvP.y + arenaPvP.h / 2; localPlayer.hp = localPlayer.maxHp;
  camera.targetX = arenaPvP.x + arenaPvP.w / 2; camera.targetY = arenaPvP.y + arenaPvP.h / 2;
  document.getElementById('pvp-hud').style.display = 'flex';
  document.getElementById('rival-name').textContent = arenaPvP.rival.name;
  updatePvPHud();
}
function applyPvPDamage(target, dmg) {
  if (target === localPlayer && localPlayer.activeShield) dmg = Math.round(dmg * 0.35);
  target.hp = Math.max(0, target.hp - dmg); updatePvPHud();
  if (target.hp <= 0) {
    if (target === localPlayer) showToast('Derrota en la Arena PvP.');
    else { STATE.gold += 200; saveState(); showToast('Victoria PvP +200 Oro'); }
    endPvP();
  }
}
function updatePvPHud() {
  document.getElementById('player-hp-fill').style.width = ((localPlayer.hp / localPlayer.maxHp) * 100) + '%';
  if (arenaPvP.rival) document.getElementById('rival-hp-fill').style.width = ((arenaPvP.rival.hp / arenaPvP.rival.maxHp) * 100) + '%';
}
function surrenderPvP() { showToast('Te has rendido.'); endPvP(); }
function endPvP() {
  isPvPActive = false; arenaPvP.rival = null; arenaPvP.projectiles = [];
  document.getElementById('pvp-hud').style.display = 'none';
  localPlayer.x = 1400; localPlayer.y = 1600; camera.targetX = localPlayer.x; camera.targetY = localPlayer.y;
}
function toggleMovementType() {
  CONFIG.movementType = (CONFIG.movementType === 'DIRECT') ? 'MICRO_ACC' : 'DIRECT';
  document.getElementById('val-movetype').textContent = CONFIG.movementType === 'DIRECT' ? 'Directo' : 'Micro-Acc';
}
function toggleJoystickCurve() {
  CONFIG.joystickCurve = (CONFIG.joystickCurve === 'POWER') ? 'LINEAR' : 'POWER';
  document.getElementById('val-curve').textContent = CONFIG.joystickCurve === 'POWER' ? 'Potencia 1.35' : 'Lineal';
}
function applyPreset(name) {
  const p = PRESETS[name];
  CONFIG.movementType = p.movementType; CONFIG.dampX = p.dampX; CONFIG.dampY = p.dampY;
  CONFIG.deadXRatio = p.deadXRatio; CONFIG.deadYRatio = p.deadYRatio; CONFIG.lookAheadDist = p.lookAheadDist;
  document.getElementById('val-movetype').textContent = p.movementType === 'DIRECT' ? 'Directo' : 'Micro-Acc';
  document.getElementById('val-lookahead').textContent = p.lookAheadDist + ' px';
  showToast('Preset ' + name + ' aplicado.');
}
function togglePanel(id) {
  const panels = ['panel-physlab', 'panel-build', 'panel-fusion', 'panel-house', 'panel-farm', 'panel-exchange', 'panel-market'];
  panels.forEach(p => {
    const el = document.getElementById(p);
    if (!el) return;
    el.style.display = (p === 'panel-' + id) ? (el.style.display === 'block' ? 'none' : 'block') : 'none';
  });
  if (id === 'build') renderBuildPanel();
  if (id === 'fusion') renderFusionPanel();
  if (id === 'farm') renderFarmPanel();
  if (id === 'exchange') renderExchangePanel();
  if (id === 'market') renderMarketContent();
}
function updateHud() {
  const el = document.getElementById('telemetry-bar');
  if (el) el.textContent = 'Oro: ' + STATE.gold + ' | KC: ' + STATE.kc + ' | Forja Lv.' + STATE.fusionMastery + ' | Granjero Lv.' + STATE.farmLevel;
}
function renderFarmPanel() {
  document.getElementById('farm-mastery-text').textContent = 'Granjero Nivel ' + STATE.farmLevel + ' (' + STATE.farmXp + ' XP)';
  document.getElementById('farm-resources').innerHTML =
    '<div>Trigo: <strong>' + (STATE.silo.wheat || 0) + '</strong></div>' +
    '<div>Zanahorias: <strong>' + (STATE.silo.carrot || 0) + '</strong></div>' +
    '<div>Huevos: <strong>' + (STATE.silo.eggs || 0) + '</strong></div>' +
    '<div>Cerdos: <strong>' + (STATE.silo.pork || 0) + '</strong></div>';
}
function renderBuildPanel() {
  const eqList = document.getElementById('equipped-list');
  const invList = document.getElementById('inventory-list');
  eqList.innerHTML = ''; invList.innerHTML = '';
  STATE.equipped.forEach((stone, idx) => {
    const card = document.createElement('div'); card.className = 'item-card tier-' + stone.tier;
    card.innerHTML = '<div><strong>' + stone.icon + ' [' + stone.tier + '] ' + stone.name + '</strong></div><button class="btn-sm" onclick="unequipStone(' + idx + ')">Desequipar</button>';
    eqList.appendChild(card);
  });
  STATE.inventory.forEach((stone, idx) => {
    const card = document.createElement('div'); card.className = 'item-card tier-' + stone.tier;
    card.innerHTML = '<div><strong>' + stone.icon + ' [' + stone.tier + '] ' + stone.name + '</strong></div><button class="btn-sm" onclick="equipStone(' + idx + ')">Equipar</button>';
    invList.appendChild(card);
  });
}
function equipStone(invIdx) {
  if (STATE.equipped.length >= 5) { showToast('Ranuras llenas'); return; }
  STATE.equipped.push(STATE.inventory.splice(invIdx, 1)[0]); saveState(); renderBuildPanel(); renderActionBar();
}
function unequipStone(eqIdx) {
  STATE.inventory.push(STATE.equipped.splice(eqIdx, 1)[0]); saveState(); renderBuildPanel(); renderActionBar();
}
function addTestStones() {
  STATE.inventory.push(createStoneInstance('dash', 'Common'), createStoneInstance('shield', 'Common'), createStoneInstance('fireball', 'Common'));
  saveState(); renderBuildPanel();
}
let fusionSelection = [];
function renderFusionPanel() {
  const slotsCont = document.getElementById('fusion-slots'); slotsCont.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const s = fusionSelection[i]; const box = document.createElement('div');
    box.style.cssText = 'height:60px;border:1px dashed #30363d;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#161b22;cursor:pointer;font-size:10px;';
    if (s) { box.className = 'tier-' + s.tier; box.innerHTML = '<span>' + s.icon + '</span><strong>' + s.tier + '</strong>'; box.onclick = function(){ removeFusionSelection(i); }; }
    else box.innerHTML = '<span style="color:#484f58;">Slot ' + (i+1) + '</span>';
    slotsCont.appendChild(box);
  }
  const oddsEl = document.getElementById('fusion-odds'); const btn = document.getElementById('btn-fuse');
  if (fusionSelection.length === 3) {
    const tier = fusionSelection[0].tier;
    if (!fusionSelection.every(st => st.tier === tier)) { oddsEl.textContent = 'Las 3 piedras deben ser del mismo tier.'; btn.disabled = true; return; }
    const nextTierIdx = TIERS.indexOf(tier) + 1;
    if (nextTierIdx >= TIERS.length) { oddsEl.textContent = 'Calidad maxima.'; btn.disabled = true; return; }
    const successOdds = Math.max(20, 75 - nextTierIdx * 12 + STATE.fusionMastery * 2);
    const breakOdds = Math.min(40, nextTierIdx * 8);
    oddsEl.innerHTML = 'Exito [' + TIERS[nextTierIdx] + ']: <strong>' + successOdds + '%</strong><br>Fallo: <strong>' + (100 - successOdds - breakOdds) + '%</strong><br>Destruccion: <strong>' + breakOdds + '%</strong>';
    btn.disabled = false;
  } else { oddsEl.textContent = 'Selecciona piedras del inventario.'; btn.disabled = true; }
  let selectList = document.getElementById('fusion-inv-list');
  if (!selectList) { selectList = document.createElement('div'); selectList.id = 'fusion-inv-list'; document.getElementById('panel-fusion').appendChild(selectList); }
  selectList.innerHTML = '<strong>Inventario:</strong>';
  STATE.inventory.forEach((stone, idx) => {
    if (fusionSelection.some(sel => sel.uid === stone.uid)) return;
    const card = document.createElement('div'); card.className = 'item-card tier-' + stone.tier;
    card.innerHTML = '<div>' + stone.icon + ' [' + stone.tier + '] ' + stone.name + '</div><button class="btn-sm" onclick="selectForFusion(' + idx + ')">Anadir</button>';
    selectList.appendChild(card);
  });
}
function selectForFusion(invIdx) { if (fusionSelection.length >= 3) return; fusionSelection.push(STATE.inventory[invIdx]); renderFusionPanel(); }
function removeFusionSelection(idx) { fusionSelection.splice(idx, 1); renderFusionPanel(); }
function executeFusion() {
  if (fusionSelection.length !== 3 || STATE.gold < 100) { if (STATE.gold < 100) showToast('Oro insuficiente'); return; }
  STATE.gold -= 100;
  const tier = fusionSelection[0].tier; const nextTier = TIERS[TIERS.indexOf(tier) + 1];
  const uids = fusionSelection.map(s => s.uid);
  STATE.inventory = STATE.inventory.filter(s => uids.indexOf(s.uid) === -1);
  const roll = Math.random() * 100;
  const successOdds = Math.max(20, 75 - (TIERS.indexOf(tier) + 1) * 12 + STATE.fusionMastery * 2);
  const breakOdds = Math.min(40, (TIERS.indexOf(tier) + 1) * 8);
  const logEl = document.getElementById('fusion-log');
  if (roll < successOdds) {
    const newStone = createStoneInstance(fusionSelection[0].typeId, nextTier);
    STATE.inventory.push(newStone); STATE.fusionXp += 25;
    if (STATE.fusionXp >= 100) { STATE.fusionMastery++; STATE.fusionXp = 0; }
    logEl.style.color = '#39d353'; logEl.textContent = 'EXITO: [' + nextTier + '] ' + newStone.name;
  } else if (roll < successOdds + breakOdds) { logEl.style.color = '#ff7b72'; logEl.textContent = 'FALLO CRITICO'; }
  else { STATE.inventory.push(fusionSelection[0]); logEl.style.color = '#ffd166'; logEl.textContent = 'Fallo regular: 1 piedra recuperada'; }
  fusionSelection = []; saveState(); renderFusionPanel();
}
function resetDecayTimer() {
  if (STATE.gold < 50) { showToast('Oro insuficiente'); return; }
  STATE.gold -= 50; STATE.plot.lastMaintenance = Date.now(); saveState(); showToast('Mantenimiento pagado.');
}
function plantAll(cropType) { STATE.farm.crops.forEach(c => { c.type = cropType; c.plantedAt = Date.now(); }); saveState(); renderFarmPanel(); }
function feedAnimals(type) {
  if (type === 'chickens') { if ((STATE.silo.wheat || 0) < 2) { showToast('Necesitas 2 de Trigo'); return; } STATE.silo.wheat -= 2; STATE.farm.coop.fedAt = Date.now(); }
  else if (type === 'pigs') { if ((STATE.silo.carrot || 0) < 2) { showToast('Necesitas 2 Zanahorias'); return; } STATE.silo.carrot -= 2; STATE.farm.pen.fedAt = Date.now(); }
  saveState(); renderFarmPanel();
}
function sellAllHarvest() {
  let earned = (STATE.silo.wheat || 0) * CROP_TYPES.wheat.sellPrice + (STATE.silo.carrot || 0) * CROP_TYPES.carrot.sellPrice + (STATE.silo.eggs || 0) * 18 + (STATE.silo.pork || 0) * 120;
  if (!earned) { showToast('El Silo esta vacio.'); return; }
  STATE.gold += earned; STATE.silo = { wheat: 0, carrot: 0, eggs: 0, pork: 0 }; saveState(); renderFarmPanel(); showToast('Cosecha +' + earned + ' Oro');
}
function switchMarketTab(tab) {
  activeMarketTab = tab;
  ['buy','sell','auction'].forEach(t => { const el = document.getElementById('tab-mkt-' + t); if (el) el.classList.toggle('active', t === tab); });
  renderMarketContent();
}
function renderMarketContent() {
  const cont = document.getElementById('market-content'); cont.innerHTML = '';
  if (activeMarketTab === 'buy') {
    STATE.marketListings.forEach((lst, idx) => {
      const card = document.createElement('div'); card.className = 'item-card';
      if (lst.type === 'stone') card.innerHTML = '<div><strong>' + lst.item.icon + ' [' + lst.item.tier + '] ' + lst.item.name + '</strong><div style="font-size:9px;">' + lst.seller + '</div></div><button class="btn-sm" style="background:#238636;" onclick="buyMarketItem(' + idx + ')">Comprar (' + lst.price + ')</button>';
      else card.innerHTML = '<div><strong>' + lst.icon + ' ' + lst.name + '</strong></div><button class="btn-sm" style="background:#238636;" onclick="buyMarketItem(' + idx + ')">Comprar (' + lst.price + ')</button>';
      cont.appendChild(card);
    });
  } else if (activeMarketTab === 'sell') {
    STATE.inventory.forEach((st, idx) => {
      const card = document.createElement('div'); card.className = 'item-card tier-' + st.tier;
      card.innerHTML = '<div>' + st.icon + ' [' + st.tier + '] ' + st.name + '</div><button class="btn-sm" onclick="listStoneForSale(' + idx + ')">Publicar</button>';
      cont.appendChild(card);
    });
  } else {
    STATE.auctions.forEach((auc, idx) => {
      const card = document.createElement('div'); card.className = 'item-card';
      card.innerHTML = '<div><strong>' + auc.icon + ' [' + auc.tier + '] ' + auc.name + '</strong><div style="font-size:9px;">Puja: ' + auc.currentBid + ' (' + auc.topBidder + ')</div></div><button class="btn-sm" onclick="bidAuction(' + idx + ')">Pujar +100</button>';
      cont.appendChild(card);
    });
  }
}
function buyMarketItem(idx) {
  const lst = STATE.marketListings[idx];
  if (STATE.gold < lst.price) { showToast('Oro insuficiente'); return; }
  STATE.gold -= lst.price;
  if (lst.type === 'stone') STATE.inventory.push(lst.item); else STATE.silo.wheat = (STATE.silo.wheat || 0) + 20;
  STATE.marketListings.splice(idx, 1); saveState(); renderMarketContent(); showToast('Comprado');
}
function listStoneForSale(invIdx) {
  if (STATE.gold < 15) { showToast('Tasa 15 Oro'); return; }
  STATE.gold -= 15;
  const stone = STATE.inventory.splice(invIdx, 1)[0];
  STATE.marketListings.push({ id: 'lst_' + Math.random().toString(36).substr(2,6), seller: 'KeloPioneer (Tu)', type: 'stone', item: stone, price: 150 });
  saveState(); renderMarketContent(); showToast('Listado');
}
function bidAuction(aucIdx) {
  const auc = STATE.auctions[aucIdx]; const newBid = auc.currentBid + 100;
  if (STATE.gold < newBid) { showToast('Oro insuficiente'); return; }
  STATE.gold -= 100; auc.currentBid = newBid; auc.topBidder = 'KeloPioneer (Tu)'; saveState(); renderMarketContent(); showToast('Puja ' + newBid);
}
function renderExchangePanel() {
  document.getElementById('investor-rank-text').textContent = 'Inversor Rango ' + STATE.investorRank + ' (' + STATE.investorXp + ' XP)';
  const cont = document.getElementById('markets-container'); cont.innerHTML = '';
  STATE.markets.forEach(m => {
    const card = document.createElement('div');
    card.style.cssText = 'background:#161b22;border:1px solid #30363d;border-radius:6px;padding:8px;margin-bottom:8px;';
    card.innerHTML = '<div style="font-weight:700;">' + m.title + '</div><div style="font-size:10px;">Payout ' + m.payout + 'x</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;"><button class="btn-sm" style="background:#238636;" onclick="placePrediction(\'' + m.id + '\',\'YES\')">SI 100</button><button class="btn-sm" style="background:#da3633;" onclick="placePrediction(\'' + m.id + '\',\'NO\')">NO 100</button></div>' + (m.myBet ? '<div style="font-size:9px;color:#39d353;">Posicion: ' + m.myBet + '</div>' : '');
    cont.appendChild(card);
  });
}
function placePrediction(marketId, option) {
  if (STATE.gold < 100) { showToast('Oro insuficiente'); return; }
  const market = STATE.markets.find(m => m.id === marketId);
  if (market.myBet) { showToast('Ya tienes posicion'); return; }
  STATE.gold -= 100; market.myBet = option; STATE.investorXp += 20;
  if (STATE.investorXp >= STATE.investorRank * 100) { STATE.investorRank++; showToast('Subiste a Rango ' + STATE.investorRank); }
  saveState(); renderExchangePanel(); showToast('Posicion ' + option);
}
let lastTime = performance.now();
function gameLoop(currentTime) {
  const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;
  processInput(); updateMovement(dt); updateCamera(dt); updateSimulation(dt); render();
  requestAnimationFrame(gameLoop);
}
loadState(); renderActionBar(); updateHud();
function armKeloGameLoop(){
  if(window.__keloGameLoopStarted)return;
  window.__keloGameLoopStarted=true;
  lastTime=performance.now();
  requestAnimationFrame(gameLoop);
}
if(window.__keloHoldGameLoop && !window.__keloBootReady){
  window.addEventListener('kelo:boot-ready', armKeloGameLoop, {once:true});
}else{
  armKeloGameLoop();
}
