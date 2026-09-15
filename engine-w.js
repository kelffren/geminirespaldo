/* KELO-INDEX
 * area: AVATAR / LEGACY BASE
 * owner: engine-w legacy pixel hero base; identity text delegates to KeloActorNameplate when available
 * keys: AVATAR BASE PIXEL HERO NAMEPLATE DELEGATION
 * purpose: dibuja el avatar base legacy sin competir con el owner moderno de identidad
 * consumes: KeloAvatar; optional KeloActorNameplate
 * do-not: NO duplicar nombre/título/nobleza cuando KeloActorNameplate está LIVE
 */
(function () {
  function px(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  function faceOf(p) {
    const vx = p.vx || 0;
    const vy = p.vy || 0;
    const tx = (p.targetX != null) ? p.targetX - p.x : vx;
    const ty = (p.targetY != null) ? p.targetY - p.y : vy;
    if (Math.hypot(vx, vy) < 8 && Math.hypot(tx, ty) < 8) return p._face || 'down';
    const f = Math.abs(tx) > Math.abs(ty) ? (tx > 0 ? 'right' : 'left') : (ty > 0 ? 'down' : 'up');
    p._face = f;
    return f;
  }

  function drawHero(ctx, p, isSelf) {
    const x = p.x, y = p.y;
    const moving = Math.hypot(p.vx || 0, p.vy || 0) > 12;
    const face = faceOf(p);
    const fr = moving ? (Math.floor(Date.now() / 120) % 4) : 0;
    const step = moving ? [-2, 1, 2, -1][fr] : 0;
    const body = (p.gear && p.gear.bodyColor) || '#2d6d8a';
    const gold = (p.gear && p.gear.armorColor) || '#e7c56a';
    const skin = '#e2b48a';
    const hair = '#1a1210';
    const shade = '#1a1520';

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + 18, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    px(ctx, x - 8, y + 8 + (step > 0 ? 2 : 0), 6, 12, shade);
    px(ctx, x + 2, y + 8 + (step < 0 ? 2 : 0), 6, 12, shade);
    px(ctx, x - 7, y + 18 + (step > 0 ? 2 : 0), 5, 3, '#3a3230');
    px(ctx, x + 2, y + 18 + (step < 0 ? 2 : 0), 5, 3, '#3a3230');

    px(ctx, x - 10, y - 10, 20, 20, body);
    px(ctx, x - 10, y + 2, 20, 5, gold);
    px(ctx, x - 11, y - 8, 3, 10, gold);
    px(ctx, x + 8, y - 8, 3, 10, gold);

    if (face === 'left') {
      px(ctx, x - 14, y - 6, 4, 10, gold);
      px(ctx, x - 7, y - 22, 14, 14, skin);
      px(ctx, x - 5, y - 18, 3, 3, '#2a1a12');
      px(ctx, x - 8, y - 24, 16, 6, hair);
    } else if (face === 'right') {
      px(ctx, x + 10, y - 6, 4, 10, gold);
      px(ctx, x - 7, y - 22, 14, 14, skin);
      px(ctx, x + 2, y - 18, 3, 3, '#2a1a12');
      px(ctx, x - 8, y - 24, 16, 6, hair);
    } else if (face === 'up') {
      px(ctx, x - 7, y - 22, 14, 14, skin);
      px(ctx, x - 9, y - 25, 18, 8, hair);
    } else {
      px(ctx, x - 7, y - 22, 14, 14, skin);
      px(ctx, x - 4, y - 18, 3, 3, '#2a1a12');
      px(ctx, x + 1, y - 18, 3, 3, '#2a1a12');
      px(ctx, x - 3, y - 14, 6, 2, '#b45');
      px(ctx, x - 9, y - 25, 18, 7, hair);
    }
    if (isSelf) px(ctx, x - 5, y - 28, 10, 4, gold);

    // Transitional fallback only. Once the modern identity consumer is LIVE,
    // it owns name/title/nobility presentation and this base must stay silent.
    if (!window.KeloActorNameplate) {
      ctx.fillStyle = isSelf ? '#e7c56a' : '#f3eee4';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name || 'Kelo', x, y - 34);
    }
    ctx.restore();
  }

  function renderLegacyPixelHero(p, isSelf) {
    if (!p) return;
    drawHero(ctx, p, !!isSelf);
  }

  if(!window.KeloAvatar) throw new Error('KeloAvatar unavailable before engine-w');
  window.KeloAvatar.setBase('engine-w:legacy-pixel-hero', renderLegacyPixelHero);
  window.KELO_ENGINE_W_AUDIT = Object.freeze({
    version: 'engine-w-v2-nameplate-delegation',
    avatarBase: true,
    identityFallbackOnly: true,
    delegatesIdentityWhenNameplateLive: true
  });
})();
