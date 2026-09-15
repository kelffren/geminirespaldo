skillAim.power = 1;
skillAim.castRange = 160;

const SKILL_MAX = { dash: 170, fireball: 300, frostnova: 230, meteor: 260 };
const SKILL_MIN_RATIO = { dash: 0.32, fireball: 0.45, frostnova: 0.45, meteor: 0.4 };

skillRange = function(typeId) {
  return SKILL_MAX[typeId] || 0;
};

function aimStickPower(px) {
  const maxStick = 88;
  return Math.max(0, Math.min(1, (px - 16) / maxStick));
}

function measuredRange(typeId, stickPower) {
  const max = SKILL_MAX[typeId] || 160;
  const minR = SKILL_MIN_RATIO[typeId] || 0.4;
  const t = minR + (1 - minR) * stickPower;
  return max * t;
}

updateAimFromPointer = function(x, y) {
  const dx = x - skillAim.originX;
  const dy = y - skillAim.originY;
  const dist = Math.hypot(dx, dy);
  skillAim.power = aimStickPower(dist);
  if (dist >= 16) {
    skillAim.dirX = dx / dist;
    skillAim.dirY = dy / dist;
    aim.x = skillAim.dirX;
    aim.y = skillAim.dirY;
  }
  skillAim.castRange = measuredRange(skillAim.typeId, skillAim.power);
};

const _castAimed = castAimedSkill;
castAimedSkill = function(index, typeId, dirX, dirY) {
  const stone = STATE.equipped[index];
  if (!stone || stone.currentCd > 0) return;
  const range = skillAim.castRange || measuredRange(typeId, skillAim.power || 1);
  stone.currentCd = stone.baseCd;
  const tx = localPlayer.x + dirX * range;
  const ty = localPlayer.y + dirY * range;
  if (typeId === 'dash') {
    dashTween.active = true;
    dashTween.t = 0;
    dashTween.dur = 0.10 + 0.10 * (range / (SKILL_MAX.dash || 170));
    dashTween.fromX = localPlayer.x;
    dashTween.fromY = localPlayer.y;
    dashTween.toX = Math.max(localPlayer.radius, Math.min(CONFIG.worldWidth - localPlayer.radius, tx));
    dashTween.toY = Math.max(localPlayer.radius, Math.min(CONFIG.worldHeight - localPlayer.radius, ty));
    localPlayer.vx = dirX * CONFIG.speed * 1.2;
    localPlayer.vy = dirY * CONFIG.speed * 1.2;
    aim.x = dirX; aim.y = dirY;
    spawnDashTrail(dashTween.fromX, dashTween.fromY, dashTween.toX, dashTween.toY, stone.color);
    return;
  }
  if (typeId === 'fireball' || typeId === 'frostnova') {
    const life = Math.max(0.35, range / 480);
    arenaPvP.projectiles.push({
      x: localPlayer.x, y: localPlayer.y,
      vx: dirX * 480, vy: dirY * 480,
      color: stone.color, radius: typeId === 'frostnova' ? 14 : 10,
      dmg: stone.dmg, fromPlayer: true, life: life
    });
    return;
  }
  if (typeId === 'meteor') {
    for (let i = 0; i < 24; i++) spawnParticle(tx + (Math.random() - 0.5) * 80, ty + (Math.random() - 0.5) * 80, stone.color, 20, 0.8);
    if (isPvPActive && arenaPvP.rival && Math.hypot(tx - arenaPvP.rival.x, ty - arenaPvP.rival.y) < 90) applyPvPDamage(arenaPvP.rival, stone.dmg);
  }
};

drawSkillIndicator = function() {
  if (!skillAim.active) return;
  const z = CONFIG.zoom || 1;
  const maxR = SKILL_MAX[skillAim.typeId] || 160;
  const range = skillAim.castRange || measuredRange(skillAim.typeId, skillAim.power || 1);
  const tx = localPlayer.x + skillAim.dirX * range;
  const ty = localPlayer.y + skillAim.dirY * range;

  ctx.save();
  ctx.translate(screenW / 2, screenH / 2);
  ctx.scale(z, z);
  ctx.translate(-camera.x, -camera.y);

  ctx.strokeStyle = 'rgba(255,214,102,0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(localPlayer.x, localPlayer.y, maxR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,214,102,0.92)';
  ctx.fillStyle = 'rgba(255,214,102,0.18)';
  ctx.lineWidth = 3;

  if (skillAim.typeId === 'dash') {
    ctx.save();
    const ang = Math.atan2(skillAim.dirY, skillAim.dirX);
    ctx.translate(localPlayer.x, localPlayer.y);
    ctx.rotate(ang);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(0, -13, range, 26, 12);
    else ctx.rect(0, -13, range, 26);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(range + 6, 0);
    ctx.lineTo(range - 14, -16);
    ctx.lineTo(range - 14, 16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (skillAim.typeId === 'meteor') {
    ctx.beginPath(); ctx.moveTo(localPlayer.x, localPlayer.y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.beginPath(); ctx.arc(tx, ty, 70, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(localPlayer.x, localPlayer.y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.beginPath(); ctx.arc(tx, ty, 16, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = '#ffd166';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(range) + ' / ' + maxR, tx, ty - 22);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(255,214,102,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(skillAim.originX, skillAim.originY, 50, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,214,102,0.2)';
  ctx.beginPath(); ctx.arc(skillAim.originX, skillAim.originY, 18, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.arc(skillAim.currentX, skillAim.currentY, 13, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
};
