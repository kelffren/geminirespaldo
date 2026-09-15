const RANKS = [
  { id: 'caballero', name: 'Caballero', color: '#c9d1d9', power: 100 },
  { id: 'baron', name: 'Baron', color: '#58a6ff', power: 180 },
  { id: 'conde', name: 'Conde', color: '#bc8cff', power: 260 },
  { id: 'duque', name: 'Duque', color: '#d29922', power: 340 },
  { id: 'principe', name: 'Principe', color: '#ff7b72', power: 420 },
  { id: 'rey', name: 'Rey', color: '#e7c56a', power: 500 }
];
if (!STATE.rankId) STATE.rankId = 'caballero';
if (!STATE.jewels) {
  STATE.jewels = {
    head: { name: 'Aro Simple', rarity: 'Common', color: '#8b949e' },
    chain: { name: 'Cadena Kelo', rarity: 'Rare', color: '#58a6ff' },
    earrings: { name: 'Pendiente', rarity: 'Common', color: '#c9d1d9' },
    watch: { name: 'Reloj Plaza', rarity: 'Epic', color: '#bc8cff' }
  };
}
simulatedPlayers.forEach(function(p, i) {
  p.title = i === 0 ? 'Duque' : 'Baron';
  p.rankId = i === 0 ? 'duque' : 'baron';
  p.jewels = {
    head: { rarity: i === 0 ? 'Legendary' : 'Rare', color: i === 0 ? '#d29922' : '#58a6ff' },
    chain: { rarity: 'Epic', color: '#bc8cff' },
    watch: { rarity: 'Rare', color: '#58a6ff' }
  };
});
function currentRank() { return RANKS.find(function(r){ return r.id === STATE.rankId; }) || RANKS[0]; }
function playerPower() {
  var base = currentRank().power;
  var jewelBonus = Object.values(STATE.jewels || {}).reduce(function(n, j) {
    var map = { Common: 8, Rare: 16, Epic: 28, Legendary: 42, Mythic: 58, Divine: 80 };
    return n + (map[j.rarity] || 0);
  }, 0);
  return base + jewelBonus + (STATE.equipped || []).length * 6;
}
function ensureInspectUI() {
  if (document.getElementById('inspect-sheet')) return;
  var box = document.createElement('div');
  box.id = 'inspect-sheet';
  box.style.cssText = 'position:absolute;top:52px;left:8px;width:min(340px,calc(100vw - 16px));max-height:80vh;overflow:auto;background:rgba(13,17,23,.96);border:1px solid #c9a24a;border-radius:12px;padding:12px;color:#c9d1d9;font-size:12px;z-index:70;display:none;pointer-events:auto';
  box.innerHTML = '<div id="inspect-body"></div>';
  document.body.appendChild(box);
  var btn = document.createElement('button');
  btn.className = 'btn-panel-toggle';
  btn.textContent = 'Yo';
  btn.onclick = function(){ inspectPlayer(localPlayer, true); };
  var bar = document.querySelector('.top-bar div:last-child');
  if (bar) bar.insertBefore(btn, bar.firstChild);
}
function closeInspect() {
  var el = document.getElementById('inspect-sheet');
  if (el) el.style.display = 'none';
}
function inspectPlayer(p, isSelf) {
  ensureInspectUI(); closeMenu();
  var rank = isSelf ? currentRank() : (RANKS.find(function(r){ return r.id === p.rankId; }) || RANKS[0]);
  var jewels = isSelf ? STATE.jewels : (p.jewels || {});
  var power = isSelf ? playerPower() : (rank.power + 40);
  var body = document.getElementById('inspect-body');
  var jewelRows = Object.keys(jewels).map(function(slot) {
    var j = jewels[slot];
    return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #21262d"><span style="color:#8b949e">' + slot + '</span><span style="color:' + (j.color || '#e7c56a') + '">' + (j.name || j.rarity) + '</span></div>';
  }).join('');
  var rankBtns = isSelf ? '<div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px">' + RANKS.map(function(r){ return '<button class="btn-sm" style="border-color:' + r.color + ';color:' + r.color + '" onclick="setLocalRank(\'' + r.id + '\')">' + r.name + '</button>'; }).join('') + '</div>' : '';
  body.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong style="color:' + rank.color + '">' + (p.name || 'KeloPioneer') + '</strong><span style="cursor:pointer" onclick="closeInspect()">X</span></div><div style="color:' + rank.color + ';font-weight:700;margin-bottom:6px">' + rank.name + ' · Poder ' + power + '</div><div style="font-size:11px;color:#8b949e;margin-bottom:10px">' + (isSelf ? 'Perfil local (Pages)' : 'Inspeccion de plaza') + '</div>' + jewelRows + rankBtns;
  document.getElementById('inspect-sheet').style.display = 'block';
}
function setLocalRank(id) {
  STATE.rankId = id;
  localPlayer.title = currentRank().name;
  saveState();
  inspectPlayer(localPlayer, true);
  showToast(currentRank().name);
}
var _socialAction = socialAction;
socialAction = function(action) {
  if (action === 'Ver Perfil' && activeSocialTarget) { inspectPlayer(activeSocialTarget, false); closeSocialModal(); return; }
  _socialAction(action);
};
function renderRankedAvatar(p, isSelf) {
  var jewels = isSelf ? STATE.jewels : (p.jewels || {});
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 14, p.radius * 0.9, p.radius * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(p.x, p.y);
  if (isSelf && Math.hypot(p.vx || 0, p.vy || 0) > 10) {
    var a = Math.atan2(p.vy, p.vx); ctx.rotate(a); ctx.scale(p.squashX || 1, p.squashY || 1); ctx.rotate(-a);
  }
  ctx.fillStyle = p.gear.bodyColor;
  ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = isSelf ? '#e7c56a' : '#ffffff'; ctx.lineWidth = isSelf ? 2.4 : 2; ctx.stroke();
  ctx.fillStyle = p.gear.armorColor; ctx.fillRect(-p.radius * 0.5, -p.radius * 0.15, p.radius, p.radius * 0.65);
  if (jewels.chain) {
    ctx.strokeStyle = jewels.chain.color || '#e7c56a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 6, 7, 0, Math.PI); ctx.stroke();
    ctx.fillStyle = jewels.chain.color || '#e7c56a'; ctx.beginPath(); ctx.arc(0, 13, 2.4, 0, Math.PI * 2); ctx.fill();
  }
  if (jewels.head) {
    ctx.fillStyle = jewels.head.color || '#e7c56a';
    ctx.beginPath(); ctx.moveTo(-8, -p.radius + 2); ctx.lineTo(-4, -p.radius - 6); ctx.lineTo(0, -p.radius + 2); ctx.lineTo(4, -p.radius - 6); ctx.lineTo(8, -p.radius + 2); ctx.closePath(); ctx.fill();
  }
  if (jewels.watch) { ctx.fillStyle = jewels.watch.color || '#58a6ff'; ctx.fillRect(p.radius - 2, 2, 5, 4); }
  ctx.fillStyle = p.gear.weaponColor; ctx.fillRect(p.radius * 0.6, -p.radius * 0.6, 6, 16);
  if (isSelf && localPlayer.activeShield) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, p.radius + 6, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  var rankName = isSelf ? currentRank().name : (p.title || 'Visitante');
  var found = RANKS.find(function(r){ return r.id === p.rankId; });
  var rankColor = isSelf ? currentRank().color : ((found && found.color) || '#fff');
  ctx.textAlign = 'center'; ctx.font = '9px sans-serif'; ctx.fillStyle = rankColor; ctx.fillText(rankName, p.x, p.y - p.radius - 18);
  ctx.font = '10px sans-serif'; ctx.fillStyle = isSelf ? '#e7c56a' : '#ffffff'; ctx.fillText(p.name, p.x, p.y - p.radius - 7);
}
if(!window.KeloAvatar) throw new Error('KeloAvatar unavailable before engine-d');
window.KeloAvatar.setBase('engine-d:rank-jewels', renderRankedAvatar);
function drawMinimap() {
  if (window.KELO_WORLD_DECORATION_RESET === true || window.KELO_WORLD_RENDERER?.decorationReset === true) return;
  var w = 92, h = 78, pad = 10, x = pad, y = screenH - h - pad - 8;
  ctx.save(); ctx.globalAlpha = 0.88; ctx.fillStyle = 'rgba(10,13,18,0.85)'; ctx.strokeStyle = 'rgba(231,197,106,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, 8); else ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
  function sx(px){ return x + 6 + (px / CONFIG.worldWidth) * (w - 12); }
  function sy(py){ return y + 6 + (py / CONFIG.worldHeight) * (h - 12); }
  ctx.fillStyle = 'rgba(231,197,106,0.25)'; ctx.fillRect(sx(1180), sy(1380), sx(1700) - sx(1180), sy(1900) - sy(1380));
  ctx.fillStyle = '#7ee787'; ctx.fillRect(sx(STATE.farm.x), sy(STATE.farm.y), 8, 6);
  ctx.fillStyle = '#ef476f'; ctx.fillRect(sx(arenaPvP.x), sy(arenaPvP.y), 8, 6);
  simulatedPlayers.forEach(function(p){ ctx.fillStyle = '#fff'; ctx.fillRect(sx(p.x) - 1, sy(p.y) - 1, 2, 2); });
  ctx.fillStyle = '#e7c56a'; ctx.beginPath(); ctx.arc(sx(localPlayer.x), sy(localPlayer.y), 2.4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
if(!window.KeloRender) throw new Error('KeloRender unavailable before engine-d');
window.KeloRender.afterFrame('engine-d:minimap', drawMinimap, 10);
checkSocialTouch = function(sx, sy) {
  if (window.KELO_WORLD_DECORATION_RESET === true || window.KELO_WORLD_RENDERER?.decorationReset === true) { closeSocialModal(); return; }
  var w = screenToWorld(sx, sy);
  if (Math.hypot(w.x - localPlayer.x, w.y - localPlayer.y) < localPlayer.radius * 1.6) { inspectPlayer(localPlayer, true); return; }
  for (var i = 0; i < simulatedPlayers.length; i++) {
    var p = simulatedPlayers[i];
    if (Math.hypot(w.x - p.x, w.y - p.y) < p.radius * 1.8) { openSocialModal(p, sx, sy); return; }
  }
  closeSocialModal();
};
var _updateHud = updateHud;
updateHud = function() {
  _updateHud();
  var el = document.getElementById('telemetry-bar');
  if (el) el.textContent = currentRank().name + ' · ' + playerPower() + ' · Oro ' + STATE.gold;
};
ensureInspectUI();
localPlayer.title = currentRank().name;
updateHud();
window.KELO_MINIMAP_AUDIT=Object.freeze({version:'legacy-minimap-reset-guard-v1',get decorationReset(){return window.KELO_WORLD_DECORATION_RESET===true||window.KELO_WORLD_RENDERER?.decorationReset===true;},suppressedDuringReset:true});