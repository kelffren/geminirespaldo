/* KELO-INDEX
 * area: LEGACY SOCIAL WORLD
 * owner: social-world legacy; extension owners KeloSimulation + KeloRender
 * keys: SOCIAL BOTS CHAT BUBBLES SIMULATION RENDER FOUNDATION
 * purpose: conserva bots/chat/burbujas legacy sin wrappers core
 * public-api: KeloSocialUI, keloSay, keloBubbles
 * consumes: KeloSimulation, KeloRender, simulatedPlayers, localPlayer
 * state-owned: bubbles + walkT + legacy social UI
 * extension-points: KeloSimulation.before/after + KeloRender.afterFrame
 * reuse: no añadir sistemas sociales nuevos aquí
 * legacy: social prototype
 * do-not: NO envolver updateSimulation ni render
 */
(function () {
  const EXTRA = [
    { id: 'b3', name: 'Andrea', x: 1460, y: 1500, targetX: 1460, targetY: 1500, hp: 100, maxHp: 100, radius: 16, gear: { bodyColor: '#d4a5c9', armorColor: '#fff', weaponColor: '#e7c56a' } }
  ];
  if (typeof simulatedPlayers !== 'undefined') {
    simulatedPlayers.length = Math.min(simulatedPlayers.length, 1);
    EXTRA.forEach(function (p) { simulatedPlayers.push(p); });
    if (simulatedPlayers.length > 2) simulatedPlayers.length = 2;
  }

  const bubbles = [];
  const BOT_LINES = ['esa vitrina', 'voy al cafe', 'quien es el Rey'];
  let walkT = 0;
  window.keloBubbles = bubbles;
  function resetActive(){return window.KELO_WORLD_DECORATION_RESET===true||window.KELO_WORLD_RENDERER?.decorationReset===true;}
  window.KELO_SOCIAL_WORLD_AUDIT={version:'social-world-foundation-v2',decorationReset:true,legacyFountainDrawCount:0,botWorldBubblesSuppressed:true,renderOwner:'KeloRender',simulationOwner:'KeloSimulation'};

  function worldFromEvent(e) {
    const z = CONFIG.zoom || 1;
    return { x: camera.x + (e.clientX - screenW / 2) / z, y: camera.y + (e.clientY - screenH / 2) / z };
  }

  window.addEventListener('pointerup', function (e) {
    if (resetActive()) return;
    if (e.target && e.target.closest && (e.target.closest('#ui-layer') || e.target.closest('.stone-slot') || e.target.closest('#kelo-chat'))) return;
    const w = worldFromEvent(e);
    if (typeof simulatedPlayers !== 'undefined') {
      simulatedPlayers.forEach(function (bot) {
        if (Math.hypot(w.x - bot.x, w.y - bot.y) < 22 && typeof inspectPlayer === 'function') inspectPlayer(bot, false);
      });
    }
  });

  function say(who, text) {
    bubbles.push({ name: who, text: text, x: 0, y: 0, t: 3.2 });
    const log = document.getElementById('kelo-chat-log');
    if (log) {
      const row = document.createElement('div');
      row.textContent = who + ': ' + text;
      log.appendChild(row);
      log.scrollTop = log.scrollHeight;
    }
  }
  window.keloSay = say;

  function ensureChat() {
    if (!document.getElementById('kelo-chat')) {
      const wrap = document.createElement('div');
      wrap.id = 'kelo-chat';
      wrap.style.cssText = 'position:absolute;left:8px;bottom:10px;width:min(210px,44vw);z-index:90;pointer-events:auto;font-size:11px';
      wrap.innerHTML = '<div id="kelo-chat-log" style="max-height:54px;overflow:auto;background:rgba(8,10,14,.55);color:#ddd;padding:4px 6px;border-radius:8px;margin-bottom:4px"></div><form id="kelo-chat-form" style="display:flex;gap:4px"><input id="kelo-chat-in" maxlength="80" placeholder="Escribir..." style="flex:1;background:rgba(10,13,18,.85);border:1px solid #3a465c;color:#eee;border-radius:8px;padding:6px 8px"><button style="background:#9e6a03;border:0;color:#fff;border-radius:8px;padding:6px 8px">OK</button></form>';
      document.body.appendChild(wrap);
      document.getElementById('kelo-chat-form').addEventListener('submit', function (e) {
        e.preventDefault();
        const inp = document.getElementById('kelo-chat-in');
        const t = (inp.value || '').trim();
        if (!t) return;
        say(localPlayer.name || 'Tu', t);
        inp.value = '';
      });
    }

    if (!document.getElementById('kelo-bag')) {
      const panel = document.createElement('div');
      panel.id = 'kelo-bag';
      panel.style.cssText = 'display:none;position:absolute;top:max(74px,calc(env(safe-area-inset-top) + 62px));right:12px;width:min(300px,calc(100vw - 24px));z-index:121;background:rgba(13,17,23,.98);border:1px solid rgba(231,197,106,.5);border-radius:16px;padding:12px;color:#ddd;font-size:12px;pointer-events:auto;box-shadow:0 18px 50px rgba(0,0,0,.45)';
      panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="color:#e7c56a">MOCHILA</b><button id="kelo-bag-close" style="border:0;background:transparent;color:#8b949e;font-size:20px">×</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div style="border:1px solid #30363d;border-radius:10px;padding:10px">💎 Gema <b>x1</b></div><div style="border:1px solid #30363d;border-radius:10px;padding:10px">⌚ Reloj <b>x1</b></div></div>';
      document.body.appendChild(panel);
      document.getElementById('kelo-bag-close').onclick = closeBag;
    }
  }

  function openBag() {
    ensureChat();
    if (typeof closeMenu === 'function') closeMenu();
    const panel = document.getElementById('kelo-bag');
    if (panel) panel.style.display = 'block';
  }

  function closeBag() {
    const panel = document.getElementById('kelo-bag');
    if (panel) panel.style.display = 'none';
  }

  window.KeloSocialUI = Object.freeze({ openBag: openBag, closeBag: closeBag });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureChat);
  else ensureChat();

  function beforeSocialSimulation() {
    if (simulatedPlayers) simulatedPlayers.forEach(function (b) { b._px = b.x; b._py = b.y; });
  }

  function afterSocialSimulation(context) {
    const dt=context.dt;
    if (simulatedPlayers) {
      simulatedPlayers.forEach(function (b) {
        const dx = b.x - (b._px || b.x);
        const dy = b.y - (b._py || b.y);
        b.x = (b._px || b.x) + dx * 0.32;
        b.y = (b._py || b.y) + dy * 0.32;
      });
    }
    walkT += dt;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      bubbles[i].t -= dt;
      if (bubbles[i].t <= 0) bubbles.splice(i, 1);
    }
    if (!resetActive() && Math.random() < 0.0012 && simulatedPlayers.length) {
      const b = simulatedPlayers[Math.floor(Math.random() * simulatedPlayers.length)];
      say(b.name, BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)]);
    }
  }

  function drawSocialWorld() {
    if (resetActive()) {
      window.KELO_SOCIAL_WORLD_AUDIT.decorationReset=true;
      return;
    }
    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    const fountainX = 1440, fountainY = 1510;
    ctx.fillStyle = '#1a3048';
    ctx.beginPath();
    ctx.arc(fountainX, fountainY, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(142,202,230,' + (0.35 + Math.sin(walkT * 3) * 0.12) + ')';
    ctx.beginPath();
    ctx.arc(fountainX, fountainY, 16 + Math.sin(walkT * 4) * 2, 0, Math.PI * 2);
    ctx.fill();
    window.KELO_SOCIAL_WORLD_AUDIT.legacyFountainDrawCount++;
    bubbles.forEach(function (bu) {
      let x = localPlayer.x, y = localPlayer.y - 38;
      const who = simulatedPlayers.find(function (p) { return p.name === bu.name; });
      if (who) { x = who.x; y = who.y - 38; }
      if (bu.name === (localPlayer.name || 'Tu') || (bu.name && bu.name.indexOf('Pioneer') >= 0)) {
        x = localPlayer.x; y = localPlayer.y - 38;
      }
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(x - 40, y - 16, 80, 16);
      ctx.fillStyle = '#111';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(bu.text.slice(0, 18), x, y - 4);
    });
    ctx.restore();
  }

  if(!window.KeloSimulation) throw new Error('KeloSimulation unavailable before engine-s');
  if(!window.KeloRender) throw new Error('KeloRender unavailable before engine-s');
  window.KeloSimulation.before('engine-s:social-bot-snapshot', beforeSocialSimulation, 50);
  window.KeloSimulation.after('engine-s:social-world', afterSocialSimulation, 50);
  window.KeloRender.afterFrame('engine-s:social-world', drawSocialWorld, 80);
})();