/* KELO-INDEX
 * area: NOBILITY
 * owner: KeloNobility
 * keys: NOBILITY DONATION RANKING RANK POWER PANEL TITLES
 * purpose: posee donación/rango de Nobleza local; integra la vista de KeloTitles sin apropiarse de sus unlocks
 * public-api: KeloNobility.open/close/render/donateGold/donateKC/getRank/getPosition
 * consumes: STATE/saveState, KeloTitles como consumer UI delegado
 * state-owned: donation, donatedToday, history y cálculo local fallback de rango
 * extension-points: KeloNobility API; KeloTitles.renderNobilityPane para identidad personal
 * reuse: UI principal y authority wrapper
 * legacy: ranking local es prototipo; online lo sustituye nobility-authority
 * do-not: NO poseer achievement titles; NO cambiar autoridad online
 */
(function () {
  'use strict';

  const KC_TO_DONATION = 50000;
  const LOWER_RANKS = [
    { id: 'none', name: 'Sin título', minDonation: 0, power: 0 },
    { id: 'knight', name: 'Caballero', minDonation: 30000000, power: 1 },
    { id: 'baron', name: 'Barón', minDonation: 100000000, power: 3 },
    { id: 'earl', name: 'Conde', minDonation: 200000000, power: 5 }
  ];
  const RANKED_RANKS = [
    { id: 'duke', name: 'Duque', top: 50, power: 7 },
    { id: 'prince', name: 'Príncipe', top: 15, power: 9 },
    { id: 'king', name: 'Rey', top: 3, power: 12 }
  ];

  const BOARD_NAMES = [
    'Aurelius','Valeria','Draven','Seraph','Midas','Cassian','Nyx','Orion','Vesper','Darius',
    'Lyra','Kael','Solenne','Riven','Astra','Magnus','Cyrus','Elara','Thorne','Octavia',
    'Lucian','Sable','Rowan','Isolde','Corvin','Selene','Atlas','Freya','Ragnar','Mira',
    'Leoric','Nerissa','Galen','Vega','Bastian','Iris','Talon','Amara','Evander','Zara',
    'Cedric','Noctis','Helena','Kieran','Liora','Varian','Evelyn','Marek','Sabine','Theron',
    'Alden','Fiora','Nolan','Petra','Quill','Rhea','Silas','Tessa','Ulric','Wren'
  ];

  function seededDonation(index) {
    if (index < 3) return [3200000000, 2940000000, 2715000000][index];
    if (index < 15) return 2300000000 - ((index - 3) * 95000000);
    if (index < 50) return 1120000000 - ((index - 15) * 22000000);
    return Math.max(210000000, 345000000 - ((index - 50) * 11500000));
  }
  const seedBoard = BOARD_NAMES.map((name, i) => ({ id: 'realm_' + (i + 1), name, donation: seededDonation(i) }));

  function ensureState() {
    if (typeof STATE === 'undefined') return null;
    if (!STATE.nobility || typeof STATE.nobility !== 'object') STATE.nobility = { donation: 0, donatedToday: 0, donationDay: '', history: [] };
    const n = STATE.nobility;
    n.donation = Math.max(0, Number(n.donation) || 0);
    n.donatedToday = Math.max(0, Number(n.donatedToday) || 0);
    n.history = Array.isArray(n.history) ? n.history : [];
    const day = new Date().toISOString().slice(0, 10);
    if (n.donationDay !== day) { n.donationDay = day; n.donatedToday = 0; }
    return n;
  }
  function playerBoard() {
    const n = ensureState();
    const player = { id: 'local_pioneer', name: (typeof localPlayer !== 'undefined' && localPlayer.name) ? localPlayer.name.replace(' (Tu)', '') : 'Kelo', donation: n ? n.donation : 0, isPlayer: true };
    return seedBoard.concat(player).sort((a, b) => b.donation - a.donation || a.name.localeCompare(b.name));
  }
  function getPosition() { return playerBoard().findIndex(row => row.isPlayer) + 1; }
  function getRank() {
    const n = ensureState();
    const donation = n ? n.donation : 0;
    const position = getPosition();
    if (position <= 3) return RANKED_RANKS[2];
    if (position <= 15) return RANKED_RANKS[1];
    if (position <= 50) return RANKED_RANKS[0];
    let rank = LOWER_RANKS[0];
    for (const candidate of LOWER_RANKS) if (donation >= candidate.minDonation) rank = candidate;
    return rank;
  }
  function amountToNextRank() {
    const n = ensureState();
    const donation = n ? n.donation : 0;
    const position = getPosition();
    const rivals = playerBoard().filter(x => !x.isPlayer);
    if (position <= 3) return { type: 'max', amount: 0, label: 'Ya estás en el Top 3' };
    if (position <= 15) return { type: 'ranking', amount: Math.max(0, rivals[2].donation - donation + 1), label: 'Para entrar al Top 3' };
    if (position <= 50) return { type: 'ranking', amount: Math.max(0, rivals[14].donation - donation + 1), label: 'Para entrar al Top 15' };
    if (donation < 30000000) return { type: 'fixed', amount: 30000000 - donation, label: 'Para Caballero' };
    if (donation < 100000000) return { type: 'fixed', amount: 100000000 - donation, label: 'Para Barón' };
    if (donation < 200000000) return { type: 'fixed', amount: 200000000 - donation, label: 'Para Conde' };
    return { type: 'ranking', amount: Math.max(0, rivals[49].donation - donation + 1), label: 'Para entrar al Top 50' };
  }
  function pushHistory(currency, spent, donationValue) {
    const n = ensureState();
    n.history.unshift({ at: Date.now(), currency, spent, donationValue });
    n.history = n.history.slice(0, 30);
  }
  function donateGold(amount) {
    const n = ensureState(), value = Math.floor(Number(amount));
    if (!n || !Number.isFinite(value) || value <= 0) return { ok: false, error: 'Cantidad inválida' };
    if ((Number(STATE.gold) || 0) < value) return { ok: false, error: 'No tienes suficiente Oro' };
    STATE.gold -= value; n.donation += value; n.donatedToday += value; pushHistory('gold', value, value);
    if (typeof saveState === 'function') saveState(); syncPlayerTitle();
    return { ok: true, donationAdded: value, rank: getRank() };
  }
  function donateKC(amount) {
    const n = ensureState(), value = Math.floor(Number(amount));
    if (!n || !Number.isFinite(value) || value <= 0) return { ok: false, error: 'Cantidad inválida' };
    if ((Number(STATE.kc) || 0) < value) return { ok: false, error: 'No tienes suficientes KC' };
    const donationValue = value * KC_TO_DONATION;
    STATE.kc -= value; n.donation += donationValue; n.donatedToday += donationValue; pushHistory('kc', value, donationValue);
    if (typeof saveState === 'function') saveState(); syncPlayerTitle();
    return { ok: true, donationAdded: donationValue, rank: getRank() };
  }
  function syncPlayerTitle() {
    if (typeof localPlayer === 'undefined') return;
    const rank = getRank();
    localPlayer.nobilityRank = rank.id;
    localPlayer.nobilityPower = rank.power;
    localPlayer.nobilityTitle = rank.name;
  }
  function fmt(value) { return Math.floor(Number(value) || 0).toLocaleString('es-ES'); }
  function panel() { return document.getElementById('kelo-nobility'); }
  function titlesPane() { return window.KeloTitles && window.KeloTitles.renderNobilityPane ? window.KeloTitles.renderNobilityPane() : '<div class="nob-empty">Títulos todavía cargando.</div>'; }

  function render() {
    const root = panel(); if (!root) return;
    const n = ensureState(), rank = getRank(), position = getPosition(), next = amountToNextRank();
    const table = playerBoard().slice(0, 50).map((row, i) => `<div class="nob-row${row.isPlayer ? ' self' : ''}"><span>#${i + 1}</span><b>${row.name}</b><span>${fmt(row.donation)}</span></div>`).join('');
    const history = n.history.length ? n.history.slice(0, 8).map(h => `<div class="nob-history-row"><span>${h.currency === 'kc' ? 'KC' : 'Oro'} × ${fmt(h.spent)}</span><b>+${fmt(h.donationValue)}</b></div>`).join('') : '<div class="nob-empty">Todavía no has donado.</div>';
    root.innerHTML = `<div class="nob-shell">
      <div class="nob-head"><div><span class="nob-crown">♛</span><strong>Nobleza</strong><small>Donación imperial acumulativa</small></div><button type="button" class="nob-close" data-nob-close>×</button></div>
      <div class="nob-summary"><div class="nob-rank-card"><span>Rango actual</span><strong>${rank.name}</strong><span>Potencia de Nobleza +${rank.power}</span></div><div class="nob-stat"><span>Donación acumulada</span><b>${fmt(n.donation)}</b></div><div class="nob-stat"><span>Posición del reino</span><b>#${position}</b></div><div class="nob-stat"><span>Donado hoy</span><b>${fmt(n.donatedToday)}</b></div></div>
      <div class="nob-next"><span>${next.label}</span><strong>${next.type === 'max' ? 'Rango máximo' : fmt(next.amount) + ' de donación'}</strong></div>
      <div class="nob-ranks"><div><b>Caballero</b><span>30.000.000</span><em>+1</em></div><div><b>Barón</b><span>100.000.000</span><em>+3</em></div><div><b>Conde</b><span>200.000.000</span><em>+5</em></div><div><b>Duque</b><span>Top 50</span><em>+7</em></div><div><b>Príncipe</b><span>Top 15</span><em>+9</em></div><div><b>Rey</b><span>Top 3</span><em>+12</em></div></div>
      <div class="nob-tabs"><button class="active" data-nob-tab="donate">Donar</button><button data-nob-tab="ranking">Ranking</button><button data-nob-tab="titles">Títulos</button><button data-nob-tab="history">Historial</button></div>
      <div class="nob-pane active" data-nob-pane="donate"><div class="nob-donate-block"><label>Donar Oro <small>1 Oro = 1 de donación</small></label><div><input inputmode="numeric" pattern="[0-9]*" data-nob-gold placeholder="Cantidad"><button data-nob-donate-gold>Donar</button></div><small>Disponible: ${fmt(STATE.gold)} Oro</small></div><div class="nob-donate-block"><label>Donar KC <small>1 KC = ${fmt(KC_TO_DONATION)} de donación</small></label><div><input inputmode="numeric" pattern="[0-9]*" data-nob-kc placeholder="Cantidad"><button data-nob-donate-kc>Donar</button></div><small>Disponible: ${fmt(STATE.kc)} KC</small></div><p class="nob-note">La donación es permanente y no se devuelve. Duque, Príncipe y Rey dependen de la clasificación.</p></div>
      <div class="nob-pane" data-nob-pane="ranking"><div class="nob-board-head"><span>Puesto</span><span>Jugador</span><span>Donación</span></div><div class="nob-board">${table}</div><p class="nob-note">Ranking local de prototipo; preparado para sustituirse por el ranking autoritativo del servidor.</p></div>
      <div class="nob-pane" data-nob-pane="titles">${titlesPane()}</div>
      <div class="nob-pane" data-nob-pane="history">${history}</div>
    </div>`;
    bind(root);
  }

  function bind(root) {
    root.querySelector('[data-nob-close]')?.addEventListener('click', close);
    root.querySelectorAll('[data-nob-tab]').forEach(btn => btn.addEventListener('click', () => {
      root.querySelectorAll('[data-nob-tab]').forEach(x => x.classList.toggle('active', x === btn));
      root.querySelectorAll('[data-nob-pane]').forEach(x => x.classList.toggle('active', x.dataset.nobPane === btn.dataset.nobTab));
    }));
    root.querySelector('[data-nob-donate-gold]')?.addEventListener('click', () => {
      const result = donateGold(root.querySelector('[data-nob-gold]')?.value);
      if (!result.ok) { if (typeof showToast === 'function') showToast(result.error); return; }
      if (typeof showToast === 'function') showToast('Donación +' + fmt(result.donationAdded) + ' · ' + result.rank.name); render();
    });
    root.querySelector('[data-nob-donate-kc]')?.addEventListener('click', () => {
      const result = donateKC(root.querySelector('[data-nob-kc]')?.value);
      if (!result.ok) { if (typeof showToast === 'function') showToast(result.error); return; }
      if (typeof showToast === 'function') showToast('Donación +' + fmt(result.donationAdded) + ' · ' + result.rank.name); render();
    });
    if (window.KeloTitles && window.KeloTitles.bindNobilityPane) window.KeloTitles.bindNobilityPane(root);
  }

  function open() {
    if (typeof closeMenu === 'function') closeMenu();
    if (typeof closeSocialOverlays === 'function') closeSocialOverlays();
    const root = panel(); if (!root) return;
    render(); root.style.display = 'block';
  }
  function close() { const root = panel(); if (root) root.style.display = 'none'; }

  function installUI() {
    if (!document.getElementById('kelo-nobility-style')) {
      const style = document.createElement('style');
      style.id = 'kelo-nobility-style';
      style.textContent = `
      #kelo-nobility{display:none;position:fixed;inset:max(58px,env(safe-area-inset-top)) 8px max(10px,env(safe-area-inset-bottom)) 8px!important;width:auto!important;max-height:none!important;padding:0!important;border:0!important;background:transparent!important;z-index:180!important;overflow:hidden!important;color:#f5e7be;font-size:12px}
      .nob-shell{height:100%;overflow:auto;background:linear-gradient(180deg,rgba(17,25,32,.985),rgba(8,13,18,.99));border:2px solid #b78a36;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.65),inset 0 0 0 2px rgba(231,197,106,.12);padding:12px}
      .nob-head{display:flex;align-items:center;justify-content:space-between;padding:4px 2px 12px;border-bottom:1px solid rgba(231,197,106,.25)}.nob-head>div{display:grid;grid-template-columns:auto 1fr;column-gap:8px;align-items:center}.nob-head strong{font-family:Georgia,serif;font-size:25px;color:#f2ce70}.nob-head small{grid-column:2;color:#8e9aa6;font-size:10px}.nob-crown{grid-row:1/3;font-size:34px;color:#e7c56a}.nob-close{width:38px;height:38px;border-radius:10px;border:1px solid #8c6120;background:#3b1c12;color:#ffd36a;font-size:27px}
      .nob-summary{display:grid;grid-template-columns:1.4fr 1fr;gap:8px;margin-top:10px}.nob-rank-card{grid-row:span 3;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:145px;border:1px solid #73552b;border-radius:13px;background:radial-gradient(circle at 50% 35%,rgba(116,47,126,.35),rgba(15,24,32,.9) 62%)}.nob-rank-card strong{font-family:Georgia,serif;font-size:25px;color:#e8c761;margin:8px 0}.nob-rank-card span{color:#a8b0b9;font-size:10px}.nob-stat,.nob-next,.nob-donate-block{border:1px solid #3b4650;border-radius:10px;background:rgba(255,255,255,.025);padding:9px}.nob-stat{display:flex;flex-direction:column;justify-content:center}.nob-stat span,.nob-next span{font-size:9px;color:#8f9ba6}.nob-stat b,.nob-next strong{font-size:14px;color:#f0cc69;margin-top:3px}.nob-next{display:flex;justify-content:space-between;gap:8px;align-items:center;margin:8px 0}.nob-next strong{text-align:right}
      .nob-ranks{display:grid;gap:4px}.nob-ranks>div{display:grid;grid-template-columns:1fr 1fr 38px;align-items:center;padding:7px 8px;background:rgba(255,255,255,.025);border-left:2px solid rgba(231,197,106,.35)}.nob-ranks span{color:#aeb8c1;text-align:right}.nob-ranks em{font-style:normal;color:#f4c756;text-align:right;font-weight:800}
      .nob-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0}.nob-tabs button{padding:9px 3px;border:1px solid #37434e;border-radius:9px;background:#121b23;color:#aab4bd;font-weight:800;font-size:10px}.nob-tabs button.active{border-color:#b78a36;color:#f0cd6d;background:#262319}.nob-pane{display:none}.nob-pane.active{display:block}.nob-donate-block{margin-bottom:8px}.nob-donate-block label{display:flex;justify-content:space-between;font-weight:800;color:#e8d7a2}.nob-donate-block label small,.nob-donate-block>small{font-size:9px;color:#82909c}.nob-donate-block>div{display:grid;grid-template-columns:1fr 82px;gap:7px;margin:7px 0}.nob-donate-block input{min-width:0;padding:10px;border:1px solid #40505e;border-radius:8px;background:#090f14;color:#fff;font-size:14px}.nob-donate-block button{border:1px solid #a77b2f;border-radius:8px;background:linear-gradient(#5a451c,#30250f);color:#f4d37d;font-weight:800}.nob-note{font-size:9px;line-height:1.45;color:#7f8c98;padding:5px 2px}.nob-board{max-height:310px;overflow:auto}.nob-board-head,.nob-row{display:grid;grid-template-columns:50px 1fr 110px;gap:6px;padding:7px}.nob-board-head{color:#8c99a4;font-size:9px}.nob-row{border-top:1px solid rgba(255,255,255,.05)}.nob-row>span:last-child{text-align:right;color:#d3b96f}.nob-row.self{background:rgba(231,197,106,.1);color:#f4d37d}.nob-history-row{display:flex;justify-content:space-between;padding:10px;border-bottom:1px solid rgba(255,255,255,.06)}.nob-history-row b{color:#f0c963}.nob-empty{text-align:center;padding:25px;color:#7f8b96}
      @media (min-width:700px){#kelo-nobility{left:50%!important;right:auto!important;width:min(760px,calc(100vw - 32px))!important;transform:translateX(-50%)}.nob-summary{grid-template-columns:1.5fr repeat(3,1fr)}.nob-rank-card{grid-row:auto}.nob-ranks{grid-template-columns:1fr 1fr}.nob-board{max-height:360px}}
      `;
      document.head.appendChild(style);
    }
    let root = document.getElementById('kelo-nobility');
    if (!root) { root = document.createElement('div'); root.id = 'kelo-nobility'; root.className = 'app-panel'; document.body.appendChild(root); }
    const grid = document.querySelector('#menu-sheet .menu-grid');
    if (grid && !document.getElementById('kelo-nobility-menu-btn')) {
      const button = document.createElement('button');
      button.id = 'kelo-nobility-menu-btn'; button.className = 'menu-btn'; button.type = 'button';
      button.innerHTML = '<span class="menu-icon">♛</span><span>Nobleza</span>';
      button.addEventListener('click', open); grid.appendChild(button);
    }
  }

  ensureState(); installUI(); syncPlayerTitle();

  window.KeloNobility = Object.freeze({
    version: 'nobility-v1.3', kcToDonation: KC_TO_DONATION,
    ranks: Object.freeze(LOWER_RANKS.concat(RANKED_RANKS).map(x => Object.freeze({ ...x }))),
    open, close, render, donateGold, donateKC, getRank, getPosition, amountToNextRank,
    getBattlePowerBonus: () => getRank().power, getDonation: () => ensureState()?.donation || 0,
    boardSource: 'local-prototype-v1'
  });

  window.KELO_NOBILITY_AUDIT = { version: 'nobility-v1.3', ready: !!panel(), menuButton: !!document.getElementById('kelo-nobility-menu-btn'), kcToDonation: KC_TO_DONATION, fixedRanks: [30000000,100000000,200000000], rankedTiers: [50,15,3], boardSource: 'local-prototype-v1', titlesDelegated: true };
})();
