/* KELO-INDEX
 * area: LEGACY ABILITY / MOVEMENT
 * owner: legacy skill aiming; movement extension owned by KeloMovement; render extension owned by KeloRender
 * keys: DASH AIM MOVEMENT INTERCEPT SKILL INDICATOR RENDER HOOK
 * purpose: conserva aiming/dash legacy y registra extensiones mediante owners Foundation
 * public-api: funciones legacy skill aim/renderActionBar
 * consumes: KeloMovement, KeloRender, STATE, localPlayer, obstacles
 * state-owned: skillAim + dashTween legacy
 * extension-points: KeloMovement.intercept + KeloRender.afterFrame
 * reuse: NO añadir habilidades nuevas aquí; usar sistema moderno de abilities
 * legacy: skill stack aún pendiente de migración
 * do-not: NO volver a envolver updateMovement ni render
 */
const skillAim = { active: false, index: -1, typeId: '', pointerId: null, originX: 0, originY: 0, currentX: 0, currentY: 0, dirX: 1, dirY: 0 };
const dashTween = { active: false, t: 0, dur: 0.16, fromX: 0, fromY: 0, toX: 0, toY: 0 };
function skillRange(typeId) {
  if (typeId === 'dash') return 160;
  if (typeId === 'fireball') return 280;
  if (typeId === 'frostnova') return 220;
  if (typeId === 'meteor') return 240;
  return 0;
}
function isAimSkill(typeId) {
  return typeId === 'dash' || typeId === 'fireball' || typeId === 'frostnova' || typeId === 'meteor';
}
function updateAimFromPointer(x, y) {
  const dx = x - skillAim.originX, dy = y - skillAim.originY, dist = Math.hypot(dx, dy);
  if (dist < 18) { skillAim.dirX = aim.x; skillAim.dirY = aim.y; return; }
  skillAim.dirX = dx / dist; skillAim.dirY = dy / dist; aim.x = skillAim.dirX; aim.y = skillAim.dirY;
}
function beginSkillAim(index, e) {
  const stone = STATE.equipped[index];
  if (!stone || stone.currentCd > 0) return;
  if (!isAimSkill(stone.typeId)) { triggerStone(index); return; }
  e.preventDefault(); e.stopPropagation();
  skillAim.active = true; skillAim.index = index; skillAim.typeId = stone.typeId; skillAim.pointerId = e.pointerId;
  skillAim.originX = e.clientX; skillAim.originY = e.clientY; skillAim.currentX = e.clientX; skillAim.currentY = e.clientY;
  skillAim.dirX = aim.x; skillAim.dirY = aim.y;
}
function endSkillAim(e) {
  if (!skillAim.active) return;
  if (e && skillAim.pointerId != null && e.pointerId !== skillAim.pointerId) return;
  const index = skillAim.index, typeId = skillAim.typeId, dirX = skillAim.dirX, dirY = skillAim.dirY;
  skillAim.active = false; skillAim.pointerId = null;
  castAimedSkill(index, typeId, dirX, dirY);
}
function castAimedSkill(index, typeId, dirX, dirY) {
  const stone = STATE.equipped[index];
  if (!stone || stone.currentCd > 0) return;
  stone.currentCd = stone.baseCd;
  const range = skillRange(typeId);
  const tx = localPlayer.x + dirX * range, ty = localPlayer.y + dirY * range;
  if (typeId === 'dash') {
    dashTween.active = true; dashTween.t = 0;
    dashTween.fromX = localPlayer.x; dashTween.fromY = localPlayer.y;
    dashTween.toX = Math.max(localPlayer.radius, Math.min(CONFIG.worldWidth - localPlayer.radius, tx));
    dashTween.toY = Math.max(localPlayer.radius, Math.min(CONFIG.worldHeight - localPlayer.radius, ty));
    localPlayer.vx = dirX * CONFIG.speed * 1.2; localPlayer.vy = dirY * CONFIG.speed * 1.2;
    aim.x = dirX; aim.y = dirY;
    spawnDashTrail(dashTween.fromX, dashTween.fromY, dashTween.toX, dashTween.toY, stone.color);
    return;
  }
  if (typeId === 'fireball' || typeId === 'frostnova') {
    arenaPvP.projectiles.push({ x: localPlayer.x, y: localPlayer.y, vx: dirX * 480, vy: dirY * 480, color: stone.color, radius: typeId === 'frostnova' ? 14 : 10, dmg: stone.dmg, fromPlayer: true, life: 1.6 });
    return;
  }
  if (typeId === 'meteor') {
    for (let i = 0; i < 24; i++) spawnParticle(tx + (Math.random() - 0.5) * 80, ty + (Math.random() - 0.5) * 80, stone.color, 20, 0.8);
    if (isPvPActive && arenaPvP.rival && Math.hypot(tx - arenaPvP.rival.x, ty - arenaPvP.rival.y) < 90) applyPvPDamage(arenaPvP.rival, stone.dmg);
  }
}
renderActionBar = function() {
  const container = document.getElementById('action-bar-container');
  if (!container) return;
  container.innerHTML = '';
  STATE.equipped.forEach((stone, idx) => {
    const slot = document.createElement('div');
    slot.className = 'stone-slot' + (stone.isUlt ? ' ultimate' : '');
    slot.id = 'action-slot-' + idx;
    slot.innerHTML = '<div class="cooldown-overlay" id="cd-bar-' + idx + '"></div><span style="font-size:' + (stone.isUlt ? 18 : 14) + 'px;">' + stone.icon + '</span><span>' + stone.name + '</span>';
    slot.addEventListener('pointerdown', (e) => beginSkillAim(idx, e));
    container.appendChild(slot);
  });
};
window.addEventListener('pointermove', (e) => {
  if (!skillAim.active || e.pointerId !== skillAim.pointerId) return;
  skillAim.currentX = e.clientX; skillAim.currentY = e.clientY; updateAimFromPointer(e.clientX, e.clientY);
}, { passive: true });
window.addEventListener('pointerup', endSkillAim);
window.addEventListener('pointercancel', endSkillAim);
if(!window.KeloMovement) throw new Error('KeloMovement unavailable before engine-g');
window.KeloMovement.intercept('engine-g:legacy-dash', function(ctx) {
  if (!dashTween.active) return false;
  dashTween.t += ctx.dt;
  const u = Math.min(1, dashTween.t / dashTween.dur);
  const ease = 1 - Math.pow(1 - u, 2);
  localPlayer.x = dashTween.fromX + (dashTween.toX - dashTween.fromX) * ease;
  localPlayer.y = dashTween.fromY + (dashTween.toY - dashTween.fromY) * ease;
  for (const b of obstacles) {
    const res = resolveCircleAABB(localPlayer.x, localPlayer.y, localPlayer.radius, b);
    if (res.collided) { localPlayer.x += res.pushX; localPlayer.y += res.pushY; }
  }
  if (isPvPActive && arenaPvP.rival && Math.hypot(localPlayer.x - arenaPvP.rival.x, localPlayer.y - arenaPvP.rival.y) < 52) {
    const stone = STATE.equipped.find(s => s.typeId === 'dash');
    applyPvPDamage(arenaPvP.rival, stone ? stone.dmg : 15);
  }
  if (u >= 1) dashTween.active = false;
  return true;
}, 10);
function drawSkillIndicator() {
  if (!skillAim.active) return;
  const z = CONFIG.zoom || 1, range = skillRange(skillAim.typeId);
  const tx = localPlayer.x + skillAim.dirX * range, ty = localPlayer.y + skillAim.dirY * range;
  ctx.save(); ctx.translate(screenW / 2, screenH / 2); ctx.scale(z, z); ctx.translate(-camera.x, -camera.y);
  ctx.strokeStyle = 'rgba(255,214,102,0.9)'; ctx.fillStyle = 'rgba(255,214,102,0.16)'; ctx.lineWidth = 3;
  if (skillAim.typeId === 'dash') {
    const ang = Math.atan2(skillAim.dirY, skillAim.dirX);
    ctx.translate(localPlayer.x, localPlayer.y); ctx.rotate(ang);
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(0, -14, range, 28, 12); else ctx.rect(0, -14, range, 28); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(range + 4, 0); ctx.lineTo(range - 16, -18); ctx.lineTo(range - 16, 18); ctx.closePath(); ctx.fill();
  } else if (skillAim.typeId === 'meteor') {
    ctx.beginPath(); ctx.moveTo(localPlayer.x, localPlayer.y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.beginPath(); ctx.arc(tx, ty, 70, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(localPlayer.x, localPlayer.y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.beginPath(); ctx.arc(tx, ty, 16, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.save(); ctx.strokeStyle = 'rgba(255,214,102,0.45)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(skillAim.originX, skillAim.originY, 46, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(skillAim.currentX, skillAim.currentY, 14, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
if(!window.KeloRender) throw new Error('KeloRender unavailable before engine-g');
window.KeloRender.afterFrame('engine-g:skill-indicator', drawSkillIndicator, 20);
renderActionBar();