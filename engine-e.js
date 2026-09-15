const PLAYER_SLOTS = ['head', 'chain', 'earrings', 'torso', 'watch'];
const JEWEL_CATALOG = {
  head: [
    { name: 'Aro Simple', rarity: 'Common', color: '#8b949e' },
    { name: 'Diadema Kelo', rarity: 'Rare', color: '#58a6ff' },
    { name: 'Corona Plaza', rarity: 'Legendary', color: '#d29922' },
    { name: 'Corona Rey', rarity: 'Divine', color: '#e7c56a' }
  ],
  chain: [
    { name: 'Cadena Fina', rarity: 'Common', color: '#c9d1d9' },
    { name: 'Cadena Kelo', rarity: 'Rare', color: '#58a6ff' },
    { name: 'Collar Negro Oro', rarity: 'Epic', color: '#bc8cff' },
    { name: 'Collar Flawless', rarity: 'Mythic', color: '#ff7b72' }
  ],
  earrings: [
    { name: 'Pendiente', rarity: 'Common', color: '#c9d1d9' },
    { name: 'Aro Diamante', rarity: 'Epic', color: '#bc8cff' }
  ],
  torso: [
    { name: 'Chaqueta Plaza', rarity: 'Common', color: '#ffd166' },
    { name: 'Saco Marmol', rarity: 'Rare', color: '#58a6ff' },
    { name: 'Abrigo Negro Oro', rarity: 'Legendary', color: '#d29922' }
  ],
  watch: [
    { name: 'Reloj Plaza', rarity: 'Rare', color: '#58a6ff' },
    { name: 'Reloj Kelo', rarity: 'Epic', color: '#bc8cff' },
    { name: 'Reloj Rey', rarity: 'Divine', color: '#e7c56a' }
  ]
};
function emptyJewels() {
  return { head: JEWEL_CATALOG.head[0], chain: JEWEL_CATALOG.chain[1], earrings: JEWEL_CATALOG.earrings[0], torso: JEWEL_CATALOG.torso[0], watch: JEWEL_CATALOG.watch[0] };
}
function computePower(player) {
  const rank = RANKS.find(r => r.id === player.rankId) || RANKS[0];
  const map = { Common: 8, Rare: 16, Epic: 28, Legendary: 42, Mythic: 58, Divine: 80 };
  const jewelBonus = Object.values(player.jewels || {}).reduce((n, j) => n + (map[j && j.rarity] || 0), 0);
  return rank.power + jewelBonus;
}
function applyState(player, patch) {
  Object.keys(patch || {}).forEach(k => { player[k] = patch[k]; });
  if (!player.jewels) player.jewels = emptyJewels();
  if (!player.rankId) player.rankId = 'caballero';
  const rank = RANKS.find(r => r.id === player.rankId) || RANKS[0];
  player.title = rank.name;
  player.power = computePower(player);
  return player;
}
function bindLocalIdentity() {
  applyState(localPlayer, {
    id: localPlayer.id || 'local_pioneer',
    name: localPlayer.name || 'KeloPioneer (Tu)',
    rankId: STATE.rankId || 'caballero',
    jewels: STATE.jewels || emptyJewels()
  });
  STATE.rankId = localPlayer.rankId;
  STATE.jewels = localPlayer.jewels;
  STATE.power = localPlayer.power;
}
simulatedPlayers.forEach((p, i) => {
  applyState(p, {
    rankId: p.rankId || (i === 0 ? 'duque' : 'baron'),
    jewels: p.jewels || {
      head: JEWEL_CATALOG.head[i === 0 ? 2 : 1],
      chain: JEWEL_CATALOG.chain[2],
      earrings: JEWEL_CATALOG.earrings[i === 0 ? 1 : 0],
      torso: JEWEL_CATALOG.torso[i === 0 ? 2 : 1],
      watch: JEWEL_CATALOG.watch[i === 0 ? 2 : 0]
    }
  });
});
bindLocalIdentity();
function persistIdentity() {
  STATE.rankId = localPlayer.rankId;
  STATE.jewels = localPlayer.jewels;
  STATE.power = localPlayer.power;
  saveState();
}
function cycleJewel(slot) {
  const list = JEWEL_CATALOG[slot];
  if (!list) return;
  const cur = (localPlayer.jewels[slot] && localPlayer.jewels[slot].name) || '';
  const idx = Math.max(0, list.findIndex(j => j.name === cur));
  localPlayer.jewels[slot] = list[(idx + 1) % list.length];
  applyState(localPlayer, {});
  persistIdentity();
  inspectPlayer(localPlayer, true);
  showToast(slot + ': ' + localPlayer.jewels[slot].name);
}
setLocalRank = function(id) {
  applyState(localPlayer, { rankId: id });
  persistIdentity();
  inspectPlayer(localPlayer, true);
  showToast(localPlayer.title);
};
inspectPlayer = function(p, isSelf) {
  ensureInspectUI(); closeMenu(); applyState(p, {});
  const rank = RANKS.find(r => r.id === p.rankId) || RANKS[0];
  const jewels = p.jewels || {};
  const body = document.getElementById('inspect-body');
  const jewelRows = PLAYER_SLOTS.map(slot => {
    const j = jewels[slot]; if (!j) return '';
    const btn = isSelf ? '<button class="btn-sm" onclick="cycleJewel(\'' + slot + '\')">Cambiar</button>' : '';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #21262d"><div><div style="color:#8b949e;font-size:10px">' + slot + '</div><div style="color:' + (j.color || '#e7c56a') + '">' + j.name + ' · ' + j.rarity + '</div></div>' + btn + '</div>';
  }).join('');
  const rankBtns = isSelf ? '<div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px">' + RANKS.map(r => '<button class="btn-sm" style="border-color:' + r.color + ';color:' + r.color + '" onclick="setLocalRank(\'' + r.id + '\')">' + r.name + '</button>').join('') + '</div>' : '';
  body.innerHTML = '<div style="display:flex;justify-content:space-between"><strong style="color:' + rank.color + '">' + p.name + '</strong><span style="cursor:pointer" onclick="closeInspect()">X</span></div><div style="color:' + rank.color + ';font-weight:700;margin:6px 0">' + p.title + ' · Poder ' + p.power + '</div><div style="font-size:10px;color:#8b949e;margin-bottom:8px">Contrato player unico</div>' + jewelRows + rankBtns;
  document.getElementById('inspect-sheet').style.display = 'block';
};
function renderIdentityAvatar(p, isSelf) {
  applyState(p, {});
  const jewels = p.jewels || {};
  const torso = jewels.torso;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 14, p.radius * 0.9, p.radius * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(p.x, p.y);
  if (isSelf && Math.hypot(p.vx || 0, p.vy || 0) > 10) { const a = Math.atan2(p.vy, p.vx); ctx.rotate(a); ctx.scale(p.squashX || 1, p.squashY || 1); ctx.rotate(-a); }
  ctx.fillStyle = p.gear.bodyColor; ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = isSelf ? '#e7c56a' : '#ffffff'; ctx.lineWidth = isSelf ? 2.4 : 2; ctx.stroke();
  ctx.fillStyle = (torso && torso.color) || p.gear.armorColor;
  ctx.fillRect(-p.radius * 0.52, -p.radius * 0.12, p.radius * 1.04, p.radius * 0.7);
  if (jewels.chain) { ctx.strokeStyle = jewels.chain.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 6, 7, 0, Math.PI); ctx.stroke(); ctx.fillStyle = jewels.chain.color; ctx.beginPath(); ctx.arc(0, 13, 2.5, 0, Math.PI * 2); ctx.fill(); }
  if (jewels.earrings) { ctx.fillStyle = jewels.earrings.color; ctx.beginPath(); ctx.arc(-p.radius + 3, 2, 2, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(p.radius - 3, 2, 2, 0, Math.PI * 2); ctx.fill(); }
  if (jewels.head) { ctx.fillStyle = jewels.head.color; ctx.beginPath(); ctx.moveTo(-8, -p.radius + 2); ctx.lineTo(-4, -p.radius - 6); ctx.lineTo(0, -p.radius + 1); ctx.lineTo(4, -p.radius - 6); ctx.lineTo(8, -p.radius + 2); ctx.closePath(); ctx.fill(); }
  if (jewels.watch) { ctx.fillStyle = jewels.watch.color; ctx.fillRect(p.radius - 2, 2, 5, 4); }
  ctx.fillStyle = p.gear.weaponColor; ctx.fillRect(p.radius * 0.6, -p.radius * 0.6, 6, 16);
  if (isSelf && localPlayer.activeShield) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, p.radius + 6, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  const rank = RANKS.find(r => r.id === p.rankId) || RANKS[0];
  ctx.textAlign = 'center'; ctx.font = '9px sans-serif'; ctx.fillStyle = rank.color; ctx.fillText(p.title, p.x, p.y - p.radius - 18);
  ctx.font = '10px sans-serif'; ctx.fillStyle = isSelf ? '#e7c56a' : '#ffffff'; ctx.fillText(p.name, p.x, p.y - p.radius - 7);
}
if(!window.KeloAvatar) throw new Error('KeloAvatar unavailable before engine-e');
window.KeloAvatar.setBase('engine-e:identity-jewels', renderIdentityAvatar);
updateHud = function() {
  applyState(localPlayer, {});
  const el = document.getElementById('telemetry-bar');
  if (el) el.textContent = localPlayer.title + ' · ' + localPlayer.power + ' · Oro ' + STATE.gold;
};
updateHud();
