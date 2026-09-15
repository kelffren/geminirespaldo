skillAim.slotX = 0;
skillAim.slotY = 0;

const STICK_RADIUS = 72;

function slotCenter(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

beginSkillAim = function(index, e) {
  const stone = STATE.equipped[index];
  if (!stone || stone.currentCd > 0) return;
  if (!isAimSkill(stone.typeId)) { triggerStone(index); return; }
  e.preventDefault();
  e.stopPropagation();
  const el = e.currentTarget || document.getElementById('action-slot-' + index);
  const c = slotCenter(el);
  try { el.setPointerCapture(e.pointerId); } catch (err) {}
  skillAim.active = true;
  skillAim.index = index;
  skillAim.typeId = stone.typeId;
  skillAim.pointerId = e.pointerId;
  skillAim.slotX = c.x;
  skillAim.slotY = c.y;
  skillAim.originX = c.x;
  skillAim.originY = c.y;
  skillAim.currentX = e.clientX;
  skillAim.currentY = e.clientY;
  skillAim.dirX = aim.x;
  skillAim.dirY = aim.y;
  skillAim.power = 0.45;
  skillAim.castRange = measuredRange(stone.typeId, skillAim.power);
  updateAimFromButton(e.clientX, e.clientY);
};

function updateAimFromButton(x, y) {
  const dx = x - skillAim.slotX;
  const dy = y - skillAim.slotY;
  const dist = Math.hypot(dx, dy);
  skillAim.currentX = x;
  skillAim.currentY = y;
  if (dist > 8) {
    skillAim.dirX = dx / dist;
    skillAim.dirY = dy / dist;
    aim.x = skillAim.dirX;
    aim.y = skillAim.dirY;
  }
  const p = Math.max(0, Math.min(1, dist / STICK_RADIUS));
  skillAim.power = p;
  skillAim.castRange = measuredRange(skillAim.typeId, Math.max(0.28, p));
}

updateAimFromPointer = function(x, y) {
  updateAimFromButton(x, y);
};

const prevMove = function(e) {
  if (!skillAim.active || e.pointerId !== skillAim.pointerId) return;
  updateAimFromButton(e.clientX, e.clientY);
};
window.addEventListener('pointermove', prevMove, { passive: true });

drawSkillIndicator = function() {
  if (!skillAim.active) return;
  const z = CONFIG.zoom || 1;
  const maxR = (typeof SKILL_MAX !== 'undefined' && SKILL_MAX[skillAim.typeId]) || 170;
  const range = skillAim.castRange || maxR * 0.5;
  const tx = localPlayer.x + skillAim.dirX * range;
  const ty = localPlayer.y + skillAim.dirY * range;

  ctx.save();
  ctx.translate(screenW / 2, screenH / 2);
  ctx.scale(z, z);
  ctx.translate(-camera.x, -camera.y);

  ctx.strokeStyle = 'rgba(255,214,102,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(localPlayer.x, localPlayer.y, maxR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,214,102,0.95)';
  ctx.fillStyle = 'rgba(255,214,102,0.2)';
  ctx.lineWidth = 3;
  ctx.save();
  const ang = Math.atan2(skillAim.dirY, skillAim.dirX);
  ctx.translate(localPlayer.x, localPlayer.y);
  ctx.rotate(ang);
  if (skillAim.typeId === 'dash') {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(0, -12, range, 24, 11);
    else ctx.rect(0, -12, range, 24);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(range + 7, 0);
    ctx.lineTo(range - 12, -15);
    ctx.lineTo(range - 12, 15);
    ctx.closePath();
    ctx.fill();
  } else if (skillAim.typeId === 'meteor') {
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(localPlayer.x, localPlayer.y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.beginPath(); ctx.arc(tx, ty, 68, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.save();
  } else {
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(localPlayer.x, localPlayer.y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.beginPath(); ctx.arc(tx, ty, 15, 0, Math.PI * 2); ctx.fill();
    ctx.save();
  }
  ctx.restore();

  ctx.fillStyle = '#ffd166';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(range) + ' / ' + maxR, tx, ty - 20);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(255,214,102,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(skillAim.slotX, skillAim.slotY, STICK_RADIUS, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(skillAim.slotX, skillAim.slotY, 16, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.arc(skillAim.currentX, skillAim.currentY, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1408';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('skill', skillAim.currentX, skillAim.currentY + 4);
  ctx.restore();
};
