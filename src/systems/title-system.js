/* KELO-INDEX
 * area: PROGRESSION / TITLES
 * owner: KeloTitles
 * keys: TITLES ACHIEVEMENTS UNLOCK EQUIP SNAPSHOT AUTHORITY UI TITLE BOOK
 * purpose: evalúa requisitos data-driven, posee títulos desbloqueados/equipado y sirve la UI integrada de Nobleza + Libro de títulos
 * public-api: KeloTitles.getCatalog/getTitle/getUnlocked/isUnlocked/getProgress/getEquipped/equip/unequip/ingestServerSnapshot/evaluate/refresh/openBook/closeBook/renderBook
 * consumes: KeloTitleCatalog, KeloPlayerStats, KeloEvents, KeloNetAuthority, KeloInputLocks, STATE/saveState
 * state-owned: unlocked IDs + equippedTitleId offline; snapshot read-only online; estado efímero de selección/apertura del Libro
 * extension-points: nuevas definiciones en title-catalog; nuevas stats desde KeloPlayerStats
 * reuse: identidad/prestigio, achievements y futuras recompensas visuales
 * legacy: sustituye localPlayer.title hardcodeado; Nobleza sigue siendo owner separado
 * do-not: NO resolver combate/kills; NO renderAvatar wrapper; NO aceptar unlock desde cliente online; NO segundo Title Engine
 */
(function (root) {
  'use strict';
  if (root.KeloTitles) return;
  if (!root.KeloTitleCatalog || !root.KeloPlayerStats) return;

  const VERSION = 'kelo-titles-v1.2-title-book';
  const catalog = root.KeloTitleCatalog;
  const stats = root.KeloPlayerStats;
  let serverSnapshot = null;
  let receivedServerSnapshot = false;
  let bookLockToken = null;
  let bookSelectedId = null;

  function worldState() {
    try { if (typeof STATE !== 'undefined') return STATE; } catch (e) {}
    return root.STATE || null;
  }
  function player() {
    try { if (typeof localPlayer !== 'undefined') return localPlayer; } catch (e) {}
    return root.localPlayer || null;
  }
  function online() { return !!(root.KeloNetAuthority && root.KeloNetAuthority.isOnline && root.KeloNetAuthority.isOnline()); }
  function ensureLocal() {
    const state = worldState(); if (!state) return null;
    if (!state.titles || typeof state.titles !== 'object' || Array.isArray(state.titles)) state.titles = { unlocked: [], equippedTitleId: null };
    const t = state.titles;
    t.unlocked = Array.from(new Set((Array.isArray(t.unlocked) ? t.unlocked : []).filter(function (id) { return !!catalog.get(id); })));
    if (t.equippedTitleId && (!catalog.get(t.equippedTitleId) || t.unlocked.indexOf(t.equippedTitleId) < 0)) t.equippedTitleId = null;
    return t;
  }
  function persist() { try { if (typeof saveState === 'function') saveState(); } catch (e) {} }
  function emit(name, payload) { if (root.KeloEvents && root.KeloEvents.emit) root.KeloEvents.emit(name, payload); }
  function currentState() {
    if (online()) return serverSnapshot || { unlocked: [], equippedTitleId: null, progress: {} };
    return ensureLocal() || { unlocked: [], equippedTitleId: null, progress: stats.snapshot() };
  }
  function getUnlocked() { return Object.freeze((currentState().unlocked || []).slice()); }
  function isUnlocked(id) { return getUnlocked().indexOf(String(id || '')) >= 0; }
  function getEquipped() { return currentState().equippedTitleId || null; }
  function requirementMet(requirement, value) {
    if (!requirement) return false;
    if (requirement.operator === 'gte') return Number(value) >= Number(requirement.value);
    return false;
  }
  function syncActor() {
    const p = player(); if (!p) return;
    p.equippedTitleId = getEquipped();
  }
  function notifyUnlock(title) {
    if (!title || typeof document === 'undefined') return;
    let toast = document.getElementById('kelo-title-unlock-toast');
    if (toast) toast.remove();
    toast = document.createElement('div');
    toast.id = 'kelo-title-unlock-toast';
    toast.className = 'title-unlock-toast rarity-' + title.rarity;
    toast.innerHTML = '<small>TÍTULO DESBLOQUEADO</small><strong>《' + escapeHtml(title.name) + '》</strong><span>' + escapeHtml(title.description) + '</span>';
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add('show'); });
    setTimeout(function () { toast.classList.remove('show'); setTimeout(function () { if (toast.parentNode) toast.remove(); }, 260); }, 3000);
  }

  // KELO-INDEX TITLES/EVALUATE solo corre cuando cambia una stat/carga; nunca dentro del frame loop.
  function evaluate(stat, options) {
    if (online()) return Object.freeze([]);
    const local = ensureLocal(); if (!local) return Object.freeze([]);
    const candidates = stat ? catalog.byStat(stat) : catalog.list();
    const unlocked = new Set(local.unlocked);
    const added = [];
    candidates.forEach(function (title) {
      if (unlocked.has(title.id)) return;
      const value = stats.get(title.requirement.stat);
      if (!requirementMet(title.requirement, value)) return;
      unlocked.add(title.id); added.push(title.id);
    });
    if (!added.length) return Object.freeze([]);
    local.unlocked = Array.from(unlocked); persist();
    added.forEach(function (id) {
      const title = catalog.get(id);
      emit('title:unlocked', Object.freeze({ titleId: id, title: title, source: 'local-evaluator' }));
      if (!(options && options.silent)) notifyUnlock(title);
    });
    return Object.freeze(added.slice());
  }
  function getProgress(id) {
    const title = catalog.get(id);
    if (!title) return null;
    const current = Math.max(0, stats.get(title.requirement.stat));
    const goal = Math.max(0, Number(title.requirement.value) || 0);
    return Object.freeze({ titleId: title.id, stat: title.requirement.stat, current: current, goal: goal, ratio: goal ? Math.min(1, current / goal) : 1, unlocked: isUnlocked(title.id) });
  }

  async function equip(id) {
    const titleId = String(id || '');
    if (!catalog.get(titleId)) return Object.freeze({ ok: false, error: 'UNKNOWN_TITLE' });
    if (online()) {
      if (!root.KeloNetAuthority || !root.KeloNetAuthority.equipTitle) return Object.freeze({ ok: false, error: 'SERVER_AUTHORITY_UNAVAILABLE' });
      try { const snapshot = await root.KeloNetAuthority.equipTitle(titleId); ingestServerSnapshot(snapshot); emit('title:equipped', { titleId: titleId, source: 'server' }); return Object.freeze({ ok: true, titleId: titleId }); }
      catch (err) { return Object.freeze({ ok: false, error: String(err && err.message || err) }); }
    }
    const local = ensureLocal();
    if (!local || local.unlocked.indexOf(titleId) < 0) return Object.freeze({ ok: false, error: 'TITLE_LOCKED' });
    local.equippedTitleId = titleId; persist(); syncActor(); emit('title:equipped', { titleId: titleId, source: 'local' });
    return Object.freeze({ ok: true, titleId: titleId });
  }
  async function unequip() {
    if (online()) {
      if (!root.KeloNetAuthority || !root.KeloNetAuthority.unequipTitle) return Object.freeze({ ok: false, error: 'SERVER_AUTHORITY_UNAVAILABLE' });
      try { const snapshot = await root.KeloNetAuthority.unequipTitle(); ingestServerSnapshot(snapshot); emit('title:unequipped', { source: 'server' }); return Object.freeze({ ok: true }); }
      catch (err) { return Object.freeze({ ok: false, error: String(err && err.message || err) }); }
    }
    const local = ensureLocal(); if (!local) return Object.freeze({ ok: false, error: 'STATE_UNAVAILABLE' });
    local.equippedTitleId = null; persist(); syncActor(); emit('title:unequipped', { source: 'local' }); return Object.freeze({ ok: true });
  }

  function ingestServerSnapshot(snapshot) {
    if (!snapshot || snapshot.version !== 'server-titles-v1') return false;
    const before = new Set(serverSnapshot && Array.isArray(serverSnapshot.unlocked) ? serverSnapshot.unlocked : []);
    const normalized = {
      version: 'server-titles-v1', source: snapshot.source || 'server-authoritative',
      equippedTitleId: catalog.get(snapshot.equippedTitleId) ? snapshot.equippedTitleId : null,
      unlocked: Array.from(new Set((Array.isArray(snapshot.unlocked) ? snapshot.unlocked : []).filter(function (id) { return !!catalog.get(id); }))),
      progress: snapshot.progress && typeof snapshot.progress === 'object' ? snapshot.progress : {}
    };
    if (normalized.equippedTitleId && normalized.unlocked.indexOf(normalized.equippedTitleId) < 0) normalized.equippedTitleId = null;
    serverSnapshot = normalized;
    stats.ingestServerSnapshot(normalized.progress);
    syncActor();
    if (receivedServerSnapshot) normalized.unlocked.forEach(function (id) { if (!before.has(id)) notifyUnlock(catalog.get(id)); });
    receivedServerSnapshot = true;
    const visible = typeof document !== 'undefined' ? document.querySelector('#kelo-nobility [data-title-pane-content]') : null;
    if (visible) refreshPane(visible.closest('#kelo-nobility'));
    if (isBookOpen()) renderBook();
    return true;
  }
  async function refresh() {
    if (!online() || !root.KeloNetAuthority || !root.KeloNetAuthority.getTitles) return null;
    try { const snapshot = await root.KeloNetAuthority.getTitles(); ingestServerSnapshot(snapshot); return snapshot; } catch (e) { return null; }
  }

  function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]; }); }
  function rarityLabel(r) { return ({ common:'Común', uncommon:'Poco común', rare:'Raro', epic:'Épico', legendary:'Legendario', mythic:'Mítico' })[r] || r; }
  function categoryLabel(c) { return ({ pvp:'PvP', pve:'PvE', bosses:'Jefes', exploration:'Exploración', gathering:'Recolección', commerce:'Comercio', economy:'Economía', professions:'Profesiones', construction:'Construcción', nobility:'Nobleza', clans:'Clanes', factions:'Facciones', caravans:'Caravanas', events:'Eventos', seasons:'Temporadas', secrets:'Secretos', collections:'Colecciones' })[c] || c; }
  function placeholderLabel(title) { return title && title.placeholder ? ' · Provisional' : ''; }
  function card(title) {
    const p = getProgress(title.id), unlocked = p.unlocked, equipped = getEquipped() === title.id;
    const percent = Math.round(p.ratio * 100);
    return '<article class="title-card rarity-' + escapeHtml(title.rarity) + (unlocked ? ' unlocked' : ' locked') + '">' +
      '<div class="title-card-top"><div><strong>《' + escapeHtml(title.name) + '》</strong><small>' + escapeHtml(categoryLabel(title.category)) + ' · ' + escapeHtml(rarityLabel(title.rarity)) + escapeHtml(placeholderLabel(title)) + '</small></div><span>' + (unlocked ? '✓' : '🔒') + '</span></div>' +
      '<p>' + escapeHtml(title.description) + '</p>' +
      '<div class="title-progress"><i style="width:' + percent + '%"></i></div><div class="title-progress-label"><span>' + p.current.toLocaleString('es-ES') + '</span><b>/ ' + p.goal.toLocaleString('es-ES') + '</b></div>' +
      (equipped ? '<button type="button" class="title-action equipped" data-title-unequip>Equipado · quitar</button>' : unlocked ? '<button type="button" class="title-action" data-title-equip="' + escapeHtml(title.id) + '">Equipar</button>' : '<button type="button" class="title-action" disabled>Bloqueado</button>') +
      '</article>';
  }
  function renderNobilityPane() {
    const equippedId = getEquipped(), equipped = equippedId && catalog.get(equippedId);
    const unlocked = catalog.list().filter(function (t) { return isUnlocked(t.id); });
    const locked = catalog.list().filter(function (t) { return !isUnlocked(t.id); });
    return '<div data-title-pane-content class="titles-pane">' +
      '<div class="titles-equipped"><span>Título equipado</span><strong>' + (equipped ? '《' + escapeHtml(equipped.name) + '》' : 'Ninguno') + '</strong>' +
      (equipped ? '<button type="button" data-title-unequip>Desequipar</button>' : '<small>Puedes mostrar un título desbloqueado bajo tu nombre.</small>') + '</div>' +
      '<h4>Desbloqueados</h4>' + (unlocked.length ? unlocked.map(card).join('') : '<div class="nob-empty">Todavía no has desbloqueado títulos.</div>') +
      '<h4>Por desbloquear</h4>' + (locked.length ? locked.map(card).join('') : '<div class="nob-empty">Has desbloqueado todos los títulos disponibles.</div>') +
      '<p class="nob-note">Los requisitos reales avanzan únicamente cuando su owner de gameplay reporta una stat válida. Los títulos marcados como Provisional son placeholders de contenido y pueden cambiar sin tocar el engine.</p></div>';
  }
  function refreshPane(rootEl) {
    if (!rootEl) return;
    const current = rootEl.querySelector('[data-title-pane-content]');
    if (!current) return;
    const holder = document.createElement('div'); holder.innerHTML = renderNobilityPane();
    current.replaceWith(holder.firstElementChild); bindNobilityPane(rootEl);
  }
  function bindNobilityPane(rootEl) {
    if (!rootEl) return;
    rootEl.querySelectorAll('[data-title-equip]').forEach(function (button) {
      if (button.dataset.boundTitle === '1') return; button.dataset.boundTitle = '1';
      button.addEventListener('click', async function () {
        button.disabled = true; const result = await equip(button.dataset.titleEquip);
        if (!result.ok && typeof showToast === 'function') showToast(result.error === 'TITLE_LOCKED' ? 'Título bloqueado' : 'No se pudo equipar el título');
        refreshPane(rootEl); if (isBookOpen()) renderBook();
      });
    });
    rootEl.querySelectorAll('[data-title-unequip]').forEach(function (button) {
      if (button.dataset.boundTitle === '1') return; button.dataset.boundTitle = '1';
      button.addEventListener('click', async function () { button.disabled = true; await unequip(); refreshPane(rootEl); if (isBookOpen()) renderBook(); });
    });
  }

  // KELO-INDEX TITLES/BOOK presentación reutilizable del catálogo; no posee progreso ni autoridad.
  function isBookOpen() {
    if (typeof document === 'undefined') return false;
    const el = document.getElementById('kelo-title-book');
    return !!(el && el.classList.contains('open'));
  }
  function claimBookLock() {
    if (bookLockToken || !root.KeloInputLocks || typeof root.KeloInputLocks.acquire !== 'function') return;
    bookLockToken = root.KeloInputLocks.acquire('titles-book', { surface: 'title-book' });
  }
  function releaseBookLock() {
    const token = bookLockToken; bookLockToken = null;
    if (token && root.KeloInputLocks && typeof root.KeloInputLocks.release === 'function') root.KeloInputLocks.release(token);
  }
  function normalizeBookSelection() {
    if (bookSelectedId && catalog.get(bookSelectedId)) return bookSelectedId;
    const equipped = getEquipped();
    if (equipped && catalog.get(equipped)) bookSelectedId = equipped;
    else bookSelectedId = catalog.list()[0] ? catalog.list()[0].id : null;
    return bookSelectedId;
  }
  function bookCard(title) {
    const p = getProgress(title.id), selected = normalizeBookSelection() === title.id;
    const percent = Math.round(p.ratio * 100), equipped = getEquipped() === title.id;
    return '<button type="button" class="title-book-card rarity-' + escapeHtml(title.rarity) + (selected ? ' selected' : '') + '" data-title-book-select="' + escapeHtml(title.id) + '" aria-pressed="' + String(selected) + '">' +
      '<span class="title-book-card-head"><strong>《' + escapeHtml(title.name) + '》</strong><b>' + (equipped ? 'EQUIPADO' : p.unlocked ? '✓' : '🔒') + '</b></span>' +
      '<small>' + escapeHtml(categoryLabel(title.category)) + ' · ' + escapeHtml(rarityLabel(title.rarity)) + (title.placeholder ? ' · PROVISIONAL' : '') + '</small>' +
      '<span class="title-book-mini-progress"><i style="width:' + percent + '%"></i></span>' +
      '<em>' + p.current.toLocaleString('es-ES') + ' / ' + p.goal.toLocaleString('es-ES') + '</em>' +
      '</button>';
  }
  function renderBookDetail(title) {
    if (!title) return '<div class="title-book-empty">No hay títulos registrados.</div>';
    const p = getProgress(title.id), percent = Math.round(p.ratio * 100), equipped = getEquipped() === title.id;
    return '<div class="title-book-detail-card rarity-' + escapeHtml(title.rarity) + '">' +
      '<div class="title-book-detail-meta"><span>' + escapeHtml(categoryLabel(title.category)) + '</span><span>' + escapeHtml(rarityLabel(title.rarity)) + '</span>' + (title.placeholder ? '<span class="provisional">PROVISIONAL</span>' : '') + '</div>' +
      '<h3>《' + escapeHtml(title.name) + '》</h3>' +
      '<section><small>CÓMO CONSEGUIRLO</small><p>' + escapeHtml(title.description) + '</p></section>' +
      '<section><small>PROGRESO</small><div class="title-book-big-progress"><i style="width:' + percent + '%"></i></div><div class="title-book-progress-copy"><strong>' + p.current.toLocaleString('es-ES') + '</strong><span>/ ' + p.goal.toLocaleString('es-ES') + '</span></div></section>' +
      (title.placeholder ? '<p class="title-book-placeholder-note">Este título es un placeholder. Su nombre, requisito y rareza pueden sustituirse después únicamente modificando DATA del catálogo.</p>' : '') +
      (equipped ? '<button type="button" class="title-book-action equipped" data-title-book-unequip>Desequipar</button>' : p.unlocked ? '<button type="button" class="title-book-action" data-title-book-equip="' + escapeHtml(title.id) + '">Equipar título</button>' : '<button type="button" class="title-book-action" disabled>Bloqueado</button>') +
      '</div>';
  }
  function renderBookMarkup() {
    const list = catalog.list();
    const selected = catalog.get(normalizeBookSelection());
    const equipped = getEquipped(), equippedTitle = equipped && catalog.get(equipped);
    return '<div class="title-book-summary"><div><small>COLECCIÓN</small><strong>' + getUnlocked().length + ' / ' + list.length + '</strong></div><div><small>EQUIPADO</small><strong>' + (equippedTitle ? '《' + escapeHtml(equippedTitle.name) + '》' : 'Ninguno') + '</strong></div></div>' +
      '<div class="title-book-layout"><aside class="title-book-list" data-title-book-list>' + list.map(bookCard).join('') + '</aside><main class="title-book-detail" data-title-book-detail>' + renderBookDetail(selected) + '</main></div>';
  }
  function ensureBook() {
    if (typeof document === 'undefined') return null;
    let book = document.getElementById('kelo-title-book');
    if (book) return book;
    book = document.createElement('section');
    book.id = 'kelo-title-book';
    book.setAttribute('role', 'dialog');
    book.setAttribute('aria-modal', 'true');
    book.setAttribute('aria-hidden', 'true');
    book.innerHTML = '<div class="title-book-backdrop" data-title-book-close></div><div class="title-book-shell"><header><div><small>IDENTIDAD Y PRESTIGIO</small><h2>LIBRO DE TÍTULOS</h2></div><button type="button" data-title-book-close aria-label="Cerrar Libro de títulos">×</button></header><div class="title-book-body" data-title-book-body></div></div>';
    document.body.appendChild(book);
    book.addEventListener('pointerdown', function (event) { event.stopPropagation(); });
    book.addEventListener('click', function (event) {
      if (event.target.closest('[data-title-book-close]')) { closeBook(); return; }
      const select = event.target.closest('[data-title-book-select]');
      if (select) {
        bookSelectedId = select.dataset.titleBookSelect;
        book.querySelectorAll('[data-title-book-select]').forEach(function (button) {
          const active = button.dataset.titleBookSelect === bookSelectedId;
          button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active));
        });
        const detail = book.querySelector('[data-title-book-detail]');
        if (detail) detail.innerHTML = renderBookDetail(catalog.get(bookSelectedId));
        return;
      }
      const equipButton = event.target.closest('[data-title-book-equip]');
      if (equipButton) {
        equipButton.disabled = true;
        equip(equipButton.dataset.titleBookEquip).then(function (result) {
          if (!result.ok && typeof root.showToast === 'function') root.showToast(result.error === 'TITLE_LOCKED' ? 'Título bloqueado' : 'No se pudo equipar el título');
          renderBook();
        });
        return;
      }
      const unequipButton = event.target.closest('[data-title-book-unequip]');
      if (unequipButton) { unequipButton.disabled = true; unequip().then(renderBook); }
    });
    return book;
  }
  function renderBook() {
    const book = ensureBook(); if (!book) return false;
    const body = book.querySelector('[data-title-book-body]'); if (!body) return false;
    body.innerHTML = renderBookMarkup();
    return true;
  }
  async function openBook() {
    const book = ensureBook(); if (!book) return false;
    normalizeBookSelection(); renderBook(); claimBookLock();
    book.classList.add('open'); book.setAttribute('aria-hidden', 'false');
    if (online()) { await refresh(); if (isBookOpen()) renderBook(); }
    return true;
  }
  function closeBook() {
    if (typeof document === 'undefined') return false;
    const book = document.getElementById('kelo-title-book');
    if (book) { book.classList.remove('open'); book.setAttribute('aria-hidden', 'true'); }
    releaseBookLock(); return true;
  }

  function installStyle() {
    if (typeof document === 'undefined' || document.getElementById('kelo-title-style')) return;
    const style = document.createElement('style'); style.id = 'kelo-title-style'; style.textContent = `
      .titles-pane{display:grid;gap:8px;padding-bottom:10px}.titles-pane h4{margin:8px 2px 2px;color:#d8c17c;font:800 11px Georgia,serif;text-transform:uppercase;letter-spacing:.09em}
      .titles-equipped{display:grid;gap:6px;text-align:center;padding:13px;border:1px solid rgba(231,197,106,.35);border-radius:12px;background:radial-gradient(circle at 50% 0,rgba(231,197,106,.12),rgba(255,255,255,.02))}.titles-equipped>span,.titles-equipped small{color:#87949f;font-size:9px}.titles-equipped strong{font:800 20px Georgia,serif;color:#f1d278}.titles-equipped button,.title-action{min-height:38px;border:1px solid #8b6a2d;border-radius:9px;background:linear-gradient(#493819,#261d0d);color:#f4d47e;font-weight:850}.title-card{display:grid;gap:7px;padding:10px;border:1px solid #34414c;border-radius:11px;background:rgba(255,255,255,.025)}.title-card.locked{opacity:.72}.title-card-top{display:flex;justify-content:space-between;gap:10px;align-items:center}.title-card-top strong{font:800 15px Georgia,serif}.title-card-top small{display:block;margin-top:2px;color:#8896a1;font-size:9px}.title-card p{margin:0;color:#aeb8c0;font-size:10px;line-height:1.4}.title-progress{height:5px;border-radius:99px;background:#151d24;overflow:hidden}.title-progress i{display:block;height:100%;background:linear-gradient(90deg,#8f6b27,#f0cf72)}.title-progress-label{display:flex;justify-content:flex-end;gap:4px;color:#8e9aa5;font-size:9px}.title-progress-label span{color:#e8cb78}.title-action:disabled{border-color:#333;background:#171d22;color:#6f7a83}.title-action.equipped{border-color:#627d67;background:#17241b;color:#a9deb2}
      .rarity-common strong{color:#d5dde3}.rarity-uncommon strong{color:#9edca8}.rarity-rare strong{color:#8bc5ff}.rarity-epic strong{color:#cf9cff}.rarity-legendary strong{color:#ffd36a}.rarity-mythic strong{color:#ff9f8f}
      #kelo-title-unlock-toast{position:fixed;left:50%;top:max(72px,calc(env(safe-area-inset-top) + 64px));z-index:420;width:min(360px,calc(100vw - 28px));transform:translate(-50%,-12px) scale(.97);opacity:0;pointer-events:none;display:grid;gap:3px;text-align:center;padding:14px 18px;border:1px solid rgba(231,197,106,.66);border-radius:14px;background:linear-gradient(180deg,rgba(28,24,14,.98),rgba(9,13,17,.98));box-shadow:0 16px 50px rgba(0,0,0,.55);transition:.24s ease}#kelo-title-unlock-toast.show{opacity:1;transform:translate(-50%,0) scale(1)}#kelo-title-unlock-toast small{font-size:9px;letter-spacing:.13em;color:#bca86d}#kelo-title-unlock-toast strong{font:900 21px Georgia,serif}#kelo-title-unlock-toast span{font-size:10px;color:#aeb9bf}
      #kelo-title-book{display:none;position:fixed;inset:0;z-index:405;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f7efd7}#kelo-title-book.open{display:flex;align-items:center;justify-content:center;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));pointer-events:auto}.title-book-backdrop{position:absolute;inset:0;background:rgba(2,7,9,.76);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}.title-book-shell{position:relative;width:min(920px,100%);height:min(720px,100%);min-height:0;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(231,197,106,.7);border-radius:24px;background:radial-gradient(circle at 50% 0,rgba(231,197,106,.08),transparent 28%),linear-gradient(155deg,#0b191b,#050d10 72%);box-shadow:0 28px 90px rgba(0,0,0,.65),inset 0 0 0 1px rgba(255,255,255,.03)}.title-book-shell>header{min-height:70px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px 10px 18px;border-bottom:1px solid rgba(231,197,106,.2)}.title-book-shell>header small{display:block;margin-bottom:3px;color:#8fa59c;font-size:8px;font-weight:800;letter-spacing:.16em}.title-book-shell>header h2{margin:0;color:#f0d27d;font:900 22px Georgia,serif;letter-spacing:.09em}.title-book-shell>header button{width:46px;height:46px;border-radius:14px;border:1px solid rgba(231,197,106,.45);background:#122023;color:#f2d57f;font-size:24px}.title-book-body{min-height:0;flex:1;display:flex;flex-direction:column;padding:12px;overflow:hidden}.title-book-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}.title-book-summary>div{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:8px 11px;border:1px solid rgba(231,197,106,.2);border-radius:12px;background:rgba(255,255,255,.025)}.title-book-summary small{color:#83968f;font-size:8px;font-weight:850;letter-spacing:.1em}.title-book-summary strong{color:#efd27f;font:800 12px Georgia,serif}.title-book-layout{min-height:0;flex:1;display:grid;grid-template-areas:"list detail";grid-template-columns:minmax(0,1.05fr) minmax(280px,.95fr);gap:10px}.title-book-list{grid-area:list;min-height:0;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-content:start;gap:8px;padding:1px 3px 6px 1px;scrollbar-width:none}.title-book-list::-webkit-scrollbar{display:none}.title-book-card{min-width:0;min-height:94px;display:grid;gap:6px;padding:10px;border:1px solid #2d3a40;border-radius:13px;background:linear-gradient(145deg,rgba(22,39,38,.72),rgba(8,18,21,.92));color:#e8ece9;text-align:left;touch-action:manipulation}.title-book-card.selected{border-color:rgba(231,197,106,.85);box-shadow:inset 0 0 0 1px rgba(231,197,106,.14)}.title-book-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:7px}.title-book-card-head strong{font:800 13px Georgia,serif;line-height:1.15}.title-book-card-head b{color:#a7b7af;font-size:7px;letter-spacing:.08em}.title-book-card>small{color:#82958d;font-size:8px;line-height:1.25}.title-book-card>em{justify-self:end;color:#9eadab;font-size:8px;font-style:normal}.title-book-mini-progress,.title-book-big-progress{display:block;height:5px;border-radius:99px;background:#131c20;overflow:hidden}.title-book-mini-progress i,.title-book-big-progress i{display:block;height:100%;background:linear-gradient(90deg,#886523,#f0cf72)}.title-book-detail{grid-area:detail;min-height:0;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none}.title-book-detail::-webkit-scrollbar{display:none}.title-book-detail-card{min-height:100%;display:flex;flex-direction:column;gap:14px;padding:18px;border:1px solid rgba(231,197,106,.26);border-radius:16px;background:radial-gradient(circle at 50% 0,rgba(231,197,106,.08),transparent 30%),rgba(255,255,255,.025)}.title-book-detail-card h3{margin:2px 0 6px;text-align:center;font:900 26px Georgia,serif}.title-book-detail-meta{display:flex;flex-wrap:wrap;justify-content:center;gap:6px}.title-book-detail-meta span{padding:5px 8px;border:1px solid #35444a;border-radius:999px;background:#101b1e;color:#aab7b1;font-size:8px;font-weight:800}.title-book-detail-meta .provisional{border-color:#785f2c;color:#e8c96f}.title-book-detail-card section{display:grid;gap:7px}.title-book-detail-card section>small{color:#d2b967;font-size:8px;font-weight:900;letter-spacing:.12em}.title-book-detail-card section p,.title-book-placeholder-note{margin:0;color:#b6c0bb;font-size:11px;line-height:1.55}.title-book-big-progress{height:7px}.title-book-progress-copy{display:flex;justify-content:flex-end;align-items:baseline;gap:4px}.title-book-progress-copy strong{color:#f0cf73;font-size:18px}.title-book-progress-copy span{color:#83938d;font-size:10px}.title-book-placeholder-note{padding:9px;border-left:2px solid #8a6b2a;background:rgba(138,107,42,.08);font-size:9px}.title-book-action{margin-top:auto;min-height:46px;border:1px solid #8b6a2d;border-radius:11px;background:linear-gradient(#493819,#261d0d);color:#f4d47e;font-weight:900}.title-book-action:disabled{border-color:#313a3e;background:#151d20;color:#66746e}.title-book-action.equipped{border-color:#5a7960;background:#17251c;color:#b0ddb8}
      @media(max-width:700px){#kelo-title-book.open{padding:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))}.title-book-shell{height:100%;border-radius:18px}.title-book-shell>header{min-height:60px;padding-left:14px}.title-book-shell>header h2{font-size:18px}.title-book-shell>header button{width:44px;height:44px}.title-book-body{padding:9px}.title-book-summary{grid-template-columns:1fr}.title-book-layout{grid-template-areas:"detail" "list";grid-template-columns:1fr;grid-template-rows:auto minmax(210px,1fr);overflow:auto}.title-book-detail{overflow:visible}.title-book-detail-card{min-height:0;padding:14px}.title-book-detail-card h3{font-size:22px}.title-book-list{grid-template-columns:1fr;overflow:visible}.title-book-card{min-height:82px}.title-book-action{min-height:48px}}
      @media(max-height:520px) and (orientation:landscape){.title-book-shell{height:100%;border-radius:16px}.title-book-shell>header{min-height:52px}.title-book-shell>header h2{font-size:17px}.title-book-body{padding:7px}.title-book-summary{display:none}.title-book-layout{grid-template-areas:"list detail";grid-template-columns:1fr 1fr;grid-template-rows:1fr;overflow:hidden}.title-book-list{grid-template-columns:1fr;overflow:auto}.title-book-detail{overflow:auto}.title-book-detail-card{padding:11px;gap:8px}.title-book-detail-card h3{font-size:19px}.title-book-action{min-height:42px}}
    `; document.head.appendChild(style);
  }

  ensureLocal(); installStyle(); evaluate(null, { silent: true }); syncActor();
  if (root.KeloEvents && root.KeloEvents.on) root.KeloEvents.on(stats.event || 'player:stat_changed', function (payload) { if (payload && payload.stat) evaluate(payload.stat); if (isBookOpen()) renderBook(); });
  if (typeof root.addEventListener === 'function') root.addEventListener('keydown', function (event) { if (event.key === 'Escape' && isBookOpen()) { event.preventDefault(); closeBook(); } });

  root.KeloTitles = Object.freeze({
    version: VERSION,
    getCatalog: catalog.list,
    getTitle: catalog.get,
    getUnlocked: getUnlocked,
    isUnlocked: isUnlocked,
    getProgress: getProgress,
    getEquipped: getEquipped,
    equip: equip,
    unequip: unequip,
    ingestServerSnapshot: ingestServerSnapshot,
    evaluate: evaluate,
    refresh: refresh,
    renderNobilityPane: renderNobilityPane,
    bindNobilityPane: bindNobilityPane,
    openBook: openBook,
    closeBook: closeBook,
    renderBook: renderBook,
    isBookOpen: isBookOpen,
    isAuthoritative: function () { return !!(online() && serverSnapshot); }
  });
  root.KELO_TITLES_AUDIT = Object.freeze({ version: VERSION, ready: true, catalogSize: catalog.list().length, indexedByStat: true, frameEvaluation: false, onlineClientUnlock: false, onlinePreSnapshotFailClosed: true, titleBook: true, inputLockOwner: 'KeloInputLocks' });
})(typeof globalThis !== 'undefined' ? globalThis : window);
