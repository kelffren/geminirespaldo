(function () {
  function ensureStyle(){
    if(document.getElementById('kelo-boutique-style'))return;
    var s=document.createElement('style');
    s.id='kelo-boutique-style';
    s.textContent='#kelo-boutique{display:none;position:absolute;left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));top:max(60px,calc(env(safe-area-inset-top) + 52px));z-index:132;max-width:350px;max-height:calc(100vh - 130px);overflow:auto;margin:auto;padding:13px;border-radius:17px;background:linear-gradient(180deg,rgba(10,25,25,.985),rgba(8,17,20,.985));border:1px solid rgba(231,197,106,.52);color:#f5efd9;pointer-events:auto}.lx-b-head{display:flex;justify-content:space-between;gap:10px;padding-bottom:10px;border-bottom:1px solid rgba(231,197,106,.16)}.lx-b-title{font-family:Georgia,serif;color:#e7c56a;font-size:19px;font-weight:700}.lx-b-close{width:34px;height:34px;border-radius:11px;border:1px solid rgba(231,197,106,.28);background:rgba(255,255,255,.03);color:#e7c56a}.lx-b-note{margin:9px 1px;color:#91a79d;font-size:10px}.lx-b-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.lx-b-card{min-height:106px;padding:10px;border-radius:14px;border:1px solid rgba(231,197,106,.18);background:rgba(15,26,29,.9);color:#f5efd9;text-align:left}.lx-b-name{display:block;font-size:11px;font-weight:800}.lx-b-type{display:block;margin-top:2px;font-size:9px;color:#90a89e}.lx-b-price{display:inline-block;margin-top:7px;color:#e7c56a;font-size:9px;font-weight:800}';
    document.head.appendChild(s);
  }
  function buy(it) {
    if (typeof STATE === 'undefined') return;
    if ((STATE.gold || 0) < it.c) {
      if (typeof showToast === 'function') showToast('Oro insuficiente');
      return;
    }
    STATE.gold -= it.c;
    if (!Array.isArray(STATE.inventory)) STATE.inventory = [];
    STATE.inventory.push({ id: 'jewel_' + it.k, name: it.n, kind: 'jewelry', price: it.c });
    if (typeof saveState === 'function') saveState();
    if (typeof showToast === 'function') showToast(it.n + ' · -' + it.c + ' oro');
    var g = document.getElementById('lx-gold');
    if (g) g.textContent = 'Oro ' + STATE.gold;
    var note = document.getElementById('lx-b-note');
    if (note) note.textContent = 'Oro: ' + STATE.gold + ' · piezas: ' + STATE.inventory.filter(function (x) { return x.kind === 'jewelry'; }).length;
  }
  function panel() {
    var p = document.getElementById('kelo-boutique');
    if (p) return p;
    ensureStyle();
    p = document.createElement('div');
    p.id = 'kelo-boutique';
    p.innerHTML = '<div class="lx-b-head"><div class="lx-b-title">Luxe Boutique</div><button class="lx-b-close" id="lx-b-x">×</button></div><div class="lx-b-note" id="lx-b-note">Las compras descuentan oro.</div><div class="lx-b-grid" id="lx-b-list"></div>';
    document.body.appendChild(p);
    document.getElementById('lx-b-x').onclick = function () { p.style.display = 'none'; };
    var items = [
      { k:'chain', n:'Cadena de oro', t:'Joyeria', c:400 },
      { k:'watch', n:'Reloj clasico', t:'Relojeria', c:900 },
      { k:'ear', n:'Aretes', t:'Joyeria', c:250 },
      { k:'crown', n:'Corona Rey', t:'Coleccion', c:5000 }
    ];
    var list = document.getElementById('lx-b-list');
    items.forEach(function (it) {
      var card = document.createElement('button');
      card.className = 'lx-b-card';
      card.innerHTML = '<span class="lx-b-name">'+it.n+'</span><span class="lx-b-type">'+it.t+'</span><span class="lx-b-price">'+it.c+' oro</span>';
      card.onclick = function () { buy(it); };
      list.appendChild(card);
    });
    return p;
  }
  function open() {
    var p = panel();
    p.style.display = p.style.display === 'block' ? 'none' : 'block';
    var note = document.getElementById('lx-b-note');
    if (note && typeof STATE !== 'undefined') note.textContent = 'Oro: ' + (STATE.gold || 0);
  }
  function hook() {
    var b = document.getElementById('lx-shop');
    if (!b || b._boutiqueBuy) return;
    b._boutiqueBuy = true;
    b.onclick = open;
  }
  hook();
  setTimeout(hook, 200);
  window.KELO_BOUTIQUE = { open: open, version: 'buy-v1' };
})();
