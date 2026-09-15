/* KELO-INDEX
 * area: NOBILITY / AUTHORITY
 * owner: KeloNobility authority adapter
 * keys: NOBILITY SERVER DONATION RANKING TITLES AUTHORITY
 * purpose: sustituye Nobleza local por snapshots server cuando online y delega Títulos a KeloTitles
 * public-api: KeloNobility.open/refresh/ingestServerSnapshot + base API
 * consumes: KeloNetAuthority, KeloTitles, base KeloNobility
 * state-owned: snapshot Nobleza server en cliente (read-only)
 * extension-points: server snapshot; title pane delegated
 * reuse: online Nobleza UI
 * legacy: local base sigue como fallback offline
 * do-not: NO decidir rango/power/title unlock en navegador
 */
(function () {
  'use strict';

  const base = window.KeloNobility;
  if (!base) return;
  let serverSnapshot = null;

  function online() {
    return !!(window.KeloNetAuthority && typeof window.KeloNetAuthority.isOnline === 'function' && window.KeloNetAuthority.isOnline());
  }

  function fmt(value) { return Math.floor(Number(value) || 0).toLocaleString('es-ES'); }
  function panel() { return document.getElementById('kelo-nobility'); }
  function titlesPane() { return window.KeloTitles && window.KeloTitles.renderNobilityPane ? window.KeloTitles.renderNobilityPane() : '<div class="nob-empty">Títulos todavía cargando.</div>'; }

  function syncPlayer(snapshot) {
    if (!snapshot || typeof localPlayer === 'undefined') return;
    localPlayer.nobilityRank = snapshot.rank?.id || 'none';
    localPlayer.nobilityPower = Number(snapshot.rank?.power) || 0;
    localPlayer.nobilityTitle = snapshot.rank?.name || 'Sin título';
  }

  function renderServer() {
    const root = panel();
    if (!root || !serverSnapshot) return;
    const s = serverSnapshot;
    const rank = s.rank || { id: 'none', name: 'Sin título', power: 0 };
    const next = s.next || { type: 'fixed', amount: 0, label: 'Siguiente rango' };
    const board = Array.isArray(s.board) ? s.board : [];
    const rows = board.map((row, index) => `<div class="nob-row${row.isPlayer ? ' self' : ''}"><span>#${row.position || index + 1}</span><b>${String(row.name || 'Kelo').replace(/[<>&]/g, '')}</b><span>${fmt(row.donation)}</span></div>`).join('');
    root.innerHTML = `<div class="nob-shell">
      <div class="nob-head"><div><span class="nob-crown">♛</span><strong>Nobleza</strong><small>Servidor autoritativo · ${s.source === 'supabase-authoritative' ? 'Supabase' : 'RAM de desarrollo'}</small></div><button type="button" class="nob-close" data-nob-close>×</button></div>
      <div class="nob-summary"><div class="nob-rank-card"><span>Rango actual</span><strong>${rank.name}</strong><span>Potencia PvP +${rank.power}%</span></div><div class="nob-stat"><span>Donación acumulada</span><b>${fmt(s.donation)}</b></div><div class="nob-stat"><span>Posición global</span><b>#${s.position || '-'}</b></div><div class="nob-stat"><span>Donado hoy</span><b>${fmt(s.donatedToday)}</b></div></div>
      <div class="nob-next"><span>${next.label}</span><strong>${next.type === 'max' ? 'Rango máximo' : fmt(next.amount) + ' de donación'}</strong></div>
      <div class="nob-ranks"><div><b>Caballero</b><span>30.000.000</span><em>+1%</em></div><div><b>Barón</b><span>100.000.000</span><em>+3%</em></div><div><b>Conde</b><span>200.000.000</span><em>+5%</em></div><div><b>Duque</b><span>Top 50</span><em>+7%</em></div><div><b>Príncipe</b><span>Top 15</span><em>+9%</em></div><div><b>Rey</b><span>Top 3</span><em>+12%</em></div></div>
      <div class="nob-tabs"><button class="active" data-nob-tab="donate">Donar</button><button data-nob-tab="ranking">Ranking</button><button data-nob-tab="titles">Títulos</button><button data-nob-tab="history">Servidor</button></div>
      <div class="nob-pane active" data-nob-pane="donate">
        <div class="nob-donate-block"><label>Donar Oro <small>1 Oro = 1 de donación</small></label><div><input inputmode="numeric" pattern="[0-9]*" data-nob-gold placeholder="Cantidad"><button data-nob-donate-gold>Donar</button></div><small>Saldo autoritativo: ${fmt(s.wallet?.gold)} Oro</small></div>
        <div class="nob-donate-block"><label>Donar KC <small>1 KC = ${fmt(base.kcToDonation)} de donación</small></label><div><input inputmode="numeric" pattern="[0-9]*" data-nob-kc placeholder="Cantidad"><button data-nob-donate-kc>Donar</button></div><small>Saldo autoritativo: ${fmt(s.wallet?.kc)} KC</small></div>
        <p class="nob-note">La donación se valida y descuenta en el servidor. El navegador no decide rango, saldo ni potencia.</p>
      </div>
      <div class="nob-pane" data-nob-pane="ranking"><div class="nob-board-head"><span>Puesto</span><span>Jugador</span><span>Donación</span></div><div class="nob-board">${rows || '<div class="nob-empty">Sin jugadores clasificados.</div>'}</div></div>
      <div class="nob-pane" data-nob-pane="titles">${titlesPane()}</div>
      <div class="nob-pane" data-nob-pane="history"><div class="nob-empty">Fuente: ${s.source}. Bonus de daño resuelto por servidor: ×${Number(s.damageMultiplier || 1).toFixed(2)}.</div></div>
    </div>`;
    bindServer(root);
  }

  function bindServer(root) {
    root.querySelector('[data-nob-close]')?.addEventListener('click', function() { root.style.display = 'none'; });
    root.querySelectorAll('[data-nob-tab]').forEach(btn => btn.addEventListener('click', function() {
      root.querySelectorAll('[data-nob-tab]').forEach(x => x.classList.toggle('active', x === btn));
      root.querySelectorAll('[data-nob-pane]').forEach(x => x.classList.toggle('active', x.dataset.nobPane === btn.dataset.nobTab));
    }));
    async function donate(currency, inputSelector, button) {
      const input = root.querySelector(inputSelector);
      const amount = Math.floor(Number(input?.value));
      if (!Number.isSafeInteger(amount) || amount <= 0) { if (typeof showToast === 'function') showToast('Cantidad inválida'); return; }
      if (!window.KeloNetAuthority || !online()) { if (typeof showToast === 'function') showToast('Servidor de Nobleza desconectado'); return; }
      button.disabled = true;
      try {
        const result = await window.KeloNetAuthority.donateNobility(currency, amount);
        ingestServerSnapshot(result.snapshot);
        if (typeof showToast === 'function') showToast('Donación +' + fmt(result.donationAdded) + ' · ' + (result.snapshot?.rank?.name || 'Nobleza'));
      } catch (err) {
        const code = String(err && err.message || err);
        const text = code.includes('INSUFFICIENT_GOLD') ? 'No tienes suficiente Oro en el servidor' : code.includes('INSUFFICIENT_KC') ? 'No tienes suficientes KC en el servidor' : 'No se pudo completar la donación';
        if (typeof showToast === 'function') showToast(text);
      } finally { button.disabled = false; }
    }
    const goldButton = root.querySelector('[data-nob-donate-gold]');
    const kcButton = root.querySelector('[data-nob-donate-kc]');
    goldButton?.addEventListener('click', function() { donate('gold', '[data-nob-gold]', goldButton); });
    kcButton?.addEventListener('click', function() { donate('kc', '[data-nob-kc]', kcButton); });
    if (window.KeloTitles && window.KeloTitles.bindNobilityPane) window.KeloTitles.bindNobilityPane(root);
  }

  function ingestServerSnapshot(snapshot) {
    if (!snapshot || snapshot.version !== 'server-nobility-v1') return;
    serverSnapshot = snapshot;
    syncPlayer(snapshot);
    const root = panel();
    if (root && getComputedStyle(root).display !== 'none') renderServer();
    window.KELO_NOBILITY_AUTHORITY_AUDIT = {
      version: 'nobility-authority-v1.1', ready: true, online: online(), source: snapshot.source,
      rank: snapshot.rank?.id || 'none', power: Number(snapshot.rank?.power) || 0,
      position: Number(snapshot.position) || 0, damageMultiplier: Number(snapshot.damageMultiplier) || 1, titlesDelegated: true
    };
  }

  async function refresh() {
    if (!online()) return null;
    const snapshot = await window.KeloNetAuthority.getNobility();
    ingestServerSnapshot(snapshot);
    return snapshot;
  }

  function open() {
    base.open();
    if (serverSnapshot && online()) renderServer();
    if (online()) {
      refresh().catch(function() {});
      if (window.KeloTitles && window.KeloTitles.refresh) window.KeloTitles.refresh().catch(function() {});
    }
  }

  const menuButton = document.getElementById('kelo-nobility-menu-btn');
  if (menuButton) menuButton.addEventListener('click', function() {
    setTimeout(function() {
      if (serverSnapshot && online()) renderServer(); else if (online()) refresh().catch(function() {});
      if (online() && window.KeloTitles && window.KeloTitles.refresh) window.KeloTitles.refresh().catch(function() {});
    }, 0);
  });

  window.KeloNobility = Object.freeze({
    ...base,
    version: 'nobility-v1.4',
    open,
    refresh,
    ingestServerSnapshot,
    getRank: function() { return serverSnapshot && online() ? serverSnapshot.rank : base.getRank(); },
    getPosition: function() { return serverSnapshot && online() ? serverSnapshot.position : base.getPosition(); },
    amountToNextRank: function() { return serverSnapshot && online() ? serverSnapshot.next : base.amountToNextRank(); },
    getBattlePowerBonus: function() { return serverSnapshot && online() ? Number(serverSnapshot.rank?.power) || 0 : base.getBattlePowerBonus(); },
    getDonation: function() { return serverSnapshot && online() ? Number(serverSnapshot.donation) || 0 : base.getDonation(); },
    getDamageMultiplier: function() { return serverSnapshot && online() ? Number(serverSnapshot.damageMultiplier) || 1 : 1 + ((Number(base.getBattlePowerBonus()) || 0) / 100); },
    getBoardSource: function() { return serverSnapshot && online() ? serverSnapshot.source : 'local-prototype-v1'; },
    isAuthoritative: function() { return !!(serverSnapshot && online()); }
  });

  window.KELO_NOBILITY_AUTHORITY_AUDIT = { version: 'nobility-authority-v1.1', ready: true, online: false, source: 'local-fallback', rank: base.getRank().id, power: base.getBattlePowerBonus(), position: base.getPosition(), damageMultiplier: 1 + (base.getBattlePowerBonus() / 100), titlesDelegated: true };
})();
