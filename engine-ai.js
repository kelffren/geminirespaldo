/* KELO-INDEX
 * area: LEGACY ZONE / CAFE
 * owner: cafe feature; movement extension owned by KeloMovement; camera commands owned by KeloCamera; render extension owned by KeloRender
 * keys: CAFE ZONE MOVEMENT CLAMP CAMERA RENDER LEGACY
 * purpose: conserva entrada/salida del café y limita movimiento/render mediante owners Foundation
 * public-api: enterCafe/exitCafe + keloCafe/keloZone legacy
 * consumes: KeloMovement, KeloCamera, KeloRender, localPlayer, obstacles
 * state-owned: estado legacy de zona café
 * extension-points: KeloMovement.after + KeloCamera.setTarget + KeloRender.afterFrame
 * reuse: NO usar como patrón de nuevas instancias; usar InstanceSystem
 * legacy: teleport del jugador sigue siendo feature legacy; cámara ya migrada al owner
 * do-not: NO volver a envolver updateMovement/render ni escribir camera.* directamente
 */
(function () {
  const T = window.KELO_TILE || 32;
  const OX = 1024, OY = 1216;
  const box = { x: OX + 18 * T, y: OY + 14 * T, w: 5 * T, h: 3 * T };
  const door = { x: box.x + box.w / 2, y: box.y + box.h };
  const room = { x: box.x + 10, y: box.y + 18, w: box.w - 20, h: box.h - 8 };
  const spawnIn = { x: door.x, y: box.y + 50 };
  const spawnOut = { x: door.x, y: door.y + 50 };
  window.keloZone = 'plaza';
  window.keloCafe = { box: box, door: door, room: room };

  function cafeSolid(on) {
    obstacles.forEach(function (o) {
      if (Math.abs(o.x - box.x) < 8 && Math.abs(o.y - box.y) < 8) {
        if (!on) { if (o._ow == null) { o._ow = o.w; o._oh = o.h; } o.w = 0; o.h = 0; }
        else if (o._ow != null) { o.w = o._ow; o.h = o._oh; }
      }
    });
  }

  function snap() {
    localPlayer.vx = 0;
    localPlayer.vy = 0;
    if (input) { input.normX = 0; input.normY = 0; }
    if (!window.KeloCamera) throw new Error('KeloCamera unavailable before cafe snap');
    window.KeloCamera.setTarget(localPlayer.x, localPlayer.y, { snap: true, source: 'engine-ai:cafe-snap' });
  }

  function enterCafe() {
    window.keloZone = 'cafe';
    cafeSolid(false);
    localPlayer.x = spawnIn.x;
    localPlayer.y = spawnIn.y;
    snap();
    var bar = document.getElementById('action-bar-container');
    if (bar) bar.style.display = 'none';
    var b = document.getElementById('kelo-cafe-btn');
    if (b) b.textContent = 'Salir';
  }

  function exitCafe() {
    window.keloZone = 'plaza';
    cafeSolid(true);
    localPlayer.x = spawnOut.x;
    localPlayer.y = spawnOut.y;
    snap();
    var bar = document.getElementById('action-bar-container');
    if (bar) bar.style.display = '';
    var b = document.getElementById('kelo-cafe-btn');
    if (b) b.textContent = 'Cafe';
  }

  window.enterCafe = enterCafe;
  window.exitCafe = exitCafe;

  function ensureBtn() {
    if (document.getElementById('kelo-cafe-btn')) return;
    var btn = document.createElement('button');
    btn.className = 'btn-panel-toggle';
    btn.id = 'kelo-cafe-btn';
    btn.textContent = 'Cafe';
    btn.style.cssText = 'pointer-events:auto;margin-right:6px';
    btn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (window.keloZone === 'cafe') exitCafe();
      else enterCafe();
    };
    var host = document.querySelector('.top-bar div:last-child') || document.querySelector('.top-bar');
    if (host) host.insertBefore(btn, host.firstChild);
  }
  ensureBtn();
  setTimeout(ensureBtn, 300);

  if(!window.KeloMovement) throw new Error('KeloMovement unavailable before engine-ai');
  window.KeloMovement.after('engine-ai:cafe-room-clamp', function () {
    if (window.keloZone !== 'cafe') return;
    localPlayer.x = Math.max(room.x + 12, Math.min(room.x + room.w - 12, localPlayer.x));
    localPlayer.y = Math.max(room.y + 12, Math.min(room.y + room.h - 8, localPlayer.y));
  }, 40);

  function drawCafeOverlay() {
    var z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    if (window.keloZone === 'cafe') {
      ctx.fillStyle = '#1a120c';
      ctx.fillRect(box.x - 8, box.y - 12, box.w + 16, box.h + 24);
      ctx.fillStyle = '#3a2a1c';
      ctx.fillRect(room.x, room.y, room.w, room.h);
      ctx.strokeStyle = '#c9a24a';
      ctx.strokeRect(room.x, room.y, room.w, room.h);
      ctx.fillStyle = '#e7c56a';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Cafe Oro', box.x + box.w / 2, box.y - 16);
      ctx.font = '10px sans-serif';
      ctx.fillText('boton Salir', box.x + box.w / 2, door.y + 16);
    }
    ctx.restore();
  }
  if(!window.KeloRender) throw new Error('KeloRender unavailable before engine-ai');
  window.KeloRender.afterFrame('engine-ai:cafe-overlay', drawCafeOverlay, 140);
})();