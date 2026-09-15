/* KELO-INDEX
 * area: LEGACY ABILITY PRESENTATION
 * owner: legacy skill shots; extension owners KeloSimulation + KeloRender
 * keys: SKILL SHOTS SIMULATION RENDER FOUNDATION
 * purpose: conserva proyectiles visuales legacy sin envolver core
 * public-api: window.skillShots + castAimedSkill compatibility
 * consumes: KeloSimulation, KeloRender, STATE, localPlayer, simulatedPlayers
 * state-owned: skillShots legacy
 * extension-points: KeloSimulation.after + KeloRender.afterFrame
 * reuse: no añadir abilities nuevas aquí
 * legacy: skill shot stack pendiente de retirada
 * do-not: NO envolver updateSimulation ni render
 */
(function () {
  window.skillShots = window.skillShots || [];

  function land() {
    const range = skillAim.castRange || 160;
    const dx = skillAim.dirX || 1;
    const dy = skillAim.dirY || 0;
    return { x: localPlayer.x + dx * range, y: localPlayer.y + dy * range, range: range, dx: dx, dy: dy };
  }

  function boom(x, y, color, n, size) {
    if (typeof spawnParticle !== 'function') return;
    for (let i = 0; i < n; i++) {
      spawnParticle(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40, color, size, 0.4 + Math.random() * 0.45);
    }
  }

  const _castAll = castAimedSkill;
  castAimedSkill = function(index, typeId, dirX, dirY) {
    const stone = STATE.equipped[index];
    if (!stone || stone.currentCd > 0) return;
    const p = land();
    if (typeId === 'dash') {
      _castAll(index, typeId, dirX, dirY);
      return;
    }
    if (typeId === 'fireball' || typeId === 'frostnova') {
      stone.currentCd = stone.baseCd;
      skillShots.push({
        kind: 'bolt',
        x: localPlayer.x,
        y: localPlayer.y,
        tx: p.x,
        ty: p.y,
        vx: p.dx * 520,
        vy: p.dy * 520,
        color: stone.color,
        r: typeId === 'frostnova' ? 13 : 9,
        life: Math.max(0.28, p.range / 520)
      });
      boom(localPlayer.x, localPlayer.y, stone.color, 8, 10);
      return;
    }
    if (typeId === 'meteor') {
      stone.currentCd = stone.baseCd;
      skillShots.push({
        kind: 'meteor',
        x: p.x,
        y: p.y - 180,
        tx: p.x,
        ty: p.y,
        vx: 0,
        vy: 420,
        color: stone.color,
        r: 16,
        life: 0.45
      });
      return;
    }
    _castAll(index, typeId, dirX, dirY);
  };

  function updateSkillShots(context) {
    const dt=context.dt;
    for (let i = skillShots.length - 1; i >= 0; i--) {
      const s = skillShots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      const arrived = Math.hypot(s.x - s.tx, s.y - s.ty) < 18 || s.life <= 0;
      if (arrived) {
        boom(s.tx, s.ty, s.color, s.kind === 'meteor' ? 26 : 14, s.kind === 'meteor' ? 22 : 14);
        if (typeof simulatedPlayers !== 'undefined') {
          simulatedPlayers.forEach(function (bot) {
            if (Math.hypot(s.tx - bot.x, s.ty - bot.y) < (s.kind === 'meteor' ? 80 : 36)) {
              spawnParticle(bot.x, bot.y, '#fff', 12, 0.3);
            }
          });
        }
        skillShots.splice(i, 1);
      }
    }
  }

  function drawShots() {
    if (!skillShots.length) return;
    const z = CONFIG.zoom || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(z, z);
    ctx.translate(-camera.x, -camera.y);
    skillShots.forEach(function (s) {
      ctx.fillStyle = s.color;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (s.kind === 'meteor') {
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(s.tx, s.ty, 64, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(s.x - s.vx * 0.08, s.y - s.vy * 0.08);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });
    ctx.restore();
  }

  if(!window.KeloSimulation) throw new Error('KeloSimulation unavailable before engine-m');
  if(!window.KeloRender) throw new Error('KeloRender unavailable before engine-m');
  window.KeloSimulation.after('engine-m:skill-shots', updateSkillShots, 10);
  window.KeloRender.afterFrame('engine-m:skill-shots', drawShots, 50);
})();
