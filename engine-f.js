/* KELO-INDEX
 * area: LEGACY ABILITY / INPUT
 * owner: legacy skill aim; input extension owned by KeloInput
 * keys: AIM DASH INPUT AFTER TRIGGERSTONE LEGACY
 * purpose: conserva dirección de aim y habilidades legacy sin envolver processInput
 * public-api: dashDirection/spawnDashTrail legacy
 * consumes: KeloInput, input, localPlayer, STATE, triggerStone
 * state-owned: aim legacy
 * extension-points: KeloInput.after para derivar aim de intención procesada
 * reuse: NO añadir abilities nuevas aquí; usar sistema moderno de abilities
 * legacy: triggerStone wrapper permanece pendiente de migración
 * do-not: NO volver a envolver processInput
 */
const aim = { x: 1, y: 0 };
if(!window.KeloInput) throw new Error('KeloInput unavailable before engine-f');
window.KeloInput.after('engine-f:legacy-aim', function(ctx) {
  const source=ctx&&ctx.input?ctx.input:input;
  if (Math.hypot(source.normX, source.normY) > 0.15) {
    const len = Math.hypot(source.normX, source.normY);
    aim.x = source.normX / len;
    aim.y = source.normY / len;
  }
}, 10);
function dashDirection() {
  const moveLen = Math.hypot(localPlayer.vx, localPlayer.vy);
  if (Math.hypot(input.normX, input.normY) > 0.12) {
    const len = Math.hypot(input.normX, input.normY);
    return { x: input.normX / len, y: input.normY / len };
  }
  if (moveLen > 12) return { x: localPlayer.vx / moveLen, y: localPlayer.vy / moveLen };
  return { x: aim.x, y: aim.y };
}
function spawnDashTrail(fromX, fromY, toX, toY, color) {
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    spawnParticle(fromX + (toX - fromX) * t, fromY + (toY - fromY) * t, color || '#00d2ff', 10 - t * 5, 0.28 + t * 0.15);
  }
}
const _triggerStone = triggerStone;
triggerStone = function(index) {
  const stone = STATE.equipped[index];
  if (!stone || stone.currentCd > 0) return;
  if (stone.typeId === 'dash') {
    stone.currentCd = stone.baseCd;
    const dir = dashDirection();
    const dist = 150;
    const fromX = localPlayer.x, fromY = localPlayer.y;
    localPlayer.x += dir.x * dist;
    localPlayer.y += dir.y * dist;
    localPlayer.x = Math.max(localPlayer.radius, Math.min(CONFIG.worldWidth - localPlayer.radius, localPlayer.x));
    localPlayer.y = Math.max(localPlayer.radius, Math.min(CONFIG.worldHeight - localPlayer.radius, localPlayer.y));
    for (const b of obstacles) {
      const res = resolveCircleAABB(localPlayer.x, localPlayer.y, localPlayer.radius, b);
      if (res.collided) { localPlayer.x += res.pushX; localPlayer.y += res.pushY; }
    }
    spawnDashTrail(fromX, fromY, localPlayer.x, localPlayer.y, stone.color);
    if (isPvPActive && arenaPvP.rival && Math.hypot(localPlayer.x - arenaPvP.rival.x, localPlayer.y - arenaPvP.rival.y) < 60) {
      applyPvPDamage(arenaPvP.rival, stone.dmg);
    }
    return;
  }
  if (stone.typeId === 'fireball' || stone.typeId === 'frostnova') {
    stone.currentCd = stone.baseCd;
    let angle;
    if (isPvPActive && arenaPvP.rival) {
      angle = Math.atan2(arenaPvP.rival.y - localPlayer.y, arenaPvP.rival.x - localPlayer.x);
    } else {
      const dir = dashDirection();
      angle = Math.atan2(dir.y, dir.x);
    }
    arenaPvP.projectiles.push({
      x: localPlayer.x, y: localPlayer.y,
      vx: Math.cos(angle) * 450, vy: Math.sin(angle) * 450,
      color: stone.color, radius: 10, dmg: stone.dmg, fromPlayer: true, life: 2
    });
    return;
  }
  _triggerStone(index);
};