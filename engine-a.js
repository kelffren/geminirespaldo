const TIERS = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Divine'];
const SKILL_TYPES = [
  { id: 'dash', name: 'Dash', icon: '\u26A1', baseCd: 3.5, color: '#00d2ff', isUlt: false, dmg: 15 },
  { id: 'shield', name: 'Escudo', icon: '\uD83D\uDEE1\uFE0F', baseCd: 8.0, color: '#ffd166', isUlt: false, dmg: 0 },
  { id: 'fireball', name: 'Fuego', icon: '\uD83D\uDD25', baseCd: 4.0, color: '#ef476f', isUlt: false, dmg: 35 },
  { id: 'frostnova', name: 'Nova Hielo', icon: '\u2744\uFE0F', baseCd: 6.0, color: '#118ab2', isUlt: false, dmg: 25 },
  { id: 'meteor', name: 'Meteoro', icon: '\u2604\uFE0F', baseCd: 10.0, color: '#ff9f1c', isUlt: true, dmg: 60 }
];
const CROP_TYPES = {
  wheat: { name: 'Trigo', growTime: 10, xp: 5, sellPrice: 12, icon: '\uD83C\uDF3E' },
  carrot: { name: 'Zanahoria', growTime: 25, xp: 15, sellPrice: 35, icon: '\uD83E\uDD55' }
};
const PRESETS = {
  A: { movementType: 'DIRECT', dampX: 22.0, dampY: 22.0, deadXRatio: 0.02, deadYRatio: 0.02, lookAheadDist: 20 },
  B: { movementType: 'MICRO_ACC', dampX: 8.0, dampY: 8.0, deadXRatio: 0.10, deadYRatio: 0.08, lookAheadDist: 60 },
  C: { movementType: 'MICRO_ACC', dampX: 4.5, dampY: 4.5, deadXRatio: 0.18, deadYRatio: 0.14, lookAheadDist: 0 }
};
let CONFIG = {
  movementType: 'MICRO_ACC', speed: 320, accelDecay: 18.0, decelDecay: 35.0,
  joystickRadius: 60, joystickDeadzone: 0.12, joystickCurve: 'POWER',
  dampX: 8.0, dampY: 8.0, deadXRatio: 0.10, deadYRatio: 0.08,
  lookAheadDist: 60, lookAheadDecay: 4.0, roundPixels: false,
  worldWidth: 3600, worldHeight: 3200
};
let STATE = {
  gold: 1500, kc: 200, fusionMastery: 1, fusionXp: 0, farmLevel: 1, farmXp: 0,
  investorXp: 0, investorRank: 1,
  silo: { wheat: 10, carrot: 4, eggs: 0, pork: 0 },
  equipped: [], inventory: [],
  marketListings: [
    { id: 'lst_1', seller: 'Merchant_Zack', type: 'stone', item: createStoneInstance('meteor', 'Epic'), price: 450 },
    { id: 'lst_2', seller: 'Farmer_Bob', type: 'resource', name: 'Lote de 20 Trigo', icon: '\uD83C\uDF3E', price: 180 }
  ],
  auctions: [
    { id: 'auc_1', seller: 'System_Vault', name: 'Piedra Divina: Colapso Estelar', icon: '\u2728', tier: 'Divine', currentBid: 1200, topBidder: 'Duelist_V', timeLeft: 120 }
  ],
  markets: [
    { id: 'm1', title: 'Volumen diario de Oro > 500k?', payout: 1.85, poolYes: 1200, poolNo: 800, myBet: null },
    { id: 'm2', title: 'Mas de 100 combates PvP hoy?', payout: 2.20, poolYes: 450, poolNo: 950, myBet: null }
  ],
  plot: { x: 2000, y: 1500, w: 400, h: 300, lastMaintenance: Date.now(), furniture: [
    { type: 'floor', gx: 0, gy: 0, gw: 10, gh: 8 },
    { type: 'wall', gx: 0, gy: 0, gw: 10, gh: 1 },
    { type: 'mannequin', gx: 3, gy: 3, gw: 1, gh: 1 },
    { type: 'showcase', gx: 6, gy: 3, gw: 1, gh: 1 }
  ]},
  farm: { x: 600, y: 1500, w: 480, h: 320, crops: [
    { id: 0, type: 'wheat', plantedAt: Date.now() - 12000, harvested: false },
    { id: 1, type: 'carrot', plantedAt: Date.now() - 5000, harvested: false },
    { id: 2, type: 'wheat', plantedAt: Date.now(), harvested: false },
    { id: 3, type: null, plantedAt: 0, harvested: false }
  ], coop: { type: 'chickens', fedAt: Date.now() - 15000, duration: 20, ready: false }, pen: { type: 'pigs', fedAt: 0, duration: 45, ready: false } }
};
let isBuildMode = false, isPvPActive = false, activeTool = 'floor', activeMarketTab = 'buy';
const TILE_SIZE = 32;
function saveState() { localStorage.setItem('kelo_world_state_v2_1', JSON.stringify(STATE)); updateHud(); }
function loadState() {
  const saved = localStorage.getItem('kelo_world_state_v2_1');
  if (saved) { try { STATE = JSON.parse(saved); } catch (e) {} }
  if (!STATE.inventory.length && !STATE.equipped.length) {
    STATE.equipped = [createStoneInstance('dash','Common'), createStoneInstance('shield','Common'), createStoneInstance('fireball','Common'), createStoneInstance('frostnova','Common'), createStoneInstance('meteor','Rare')];
    STATE.inventory = [createStoneInstance('dash','Common'), createStoneInstance('dash','Common'), createStoneInstance('fireball','Common')];
    saveState();
  }
}
function showToast(msg) {
  let cont = document.getElementById('toast-container');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'toast-container';
    cont.setAttribute('aria-live', 'polite');
    document.body.appendChild(cont);
  }
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; cont.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
function createStoneInstance(typeId, tier) {
  tier = tier || 'Common';
  const meta = SKILL_TYPES.find(s => s.id === typeId) || SKILL_TYPES[0];
  const posMods = ['+15% Dano', '-10% Cooldown', '+20% Area', '+12% Robo Vida'];
  const negMods = ['-5% Velocidad post-uso', '+1s Cooldown', '-8% Defensa temporal'];
  return { uid: 'st_' + Math.random().toString(36).substr(2,9), typeId: meta.id, name: meta.name, icon: meta.icon, tier: tier, isUlt: meta.isUlt, color: meta.color, baseCd: meta.baseCd, dmg: meta.dmg, currentCd: 0, positiveMod: posMods[Math.floor(Math.random()*posMods.length)], negativeMod: negMods[Math.floor(Math.random()*negMods.length)] };
}
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const localPlayer = { id: 'local_pioneer', name: 'KeloPioneer (Tu)', x: 1400, y: 1600, vx: 0, vy: 0, hp: 100, maxHp: 100, radius: 20, gear: { bodyColor: '#00d2ff', armorColor: '#ffd166', weaponColor: '#ef476f' }, squashX: 1, squashY: 1, activeShield: false, shieldTimer: 0 };
const camera = { x: localPlayer.x, y: localPlayer.y, targetX: localPlayer.x, targetY: localPlayer.y, lookOffsetX: 0, lookOffsetY: 0 };
const obstacles = [
  { x: 1150, y: 1400, w: 120, h: 400 }, { x: 1530, y: 1400, w: 120, h: 400 },
  { x: 1300, y: 1250, w: 200, h: 80 }, { x: 1300, y: 1870, w: 200, h: 80 }
];
const arenaPvP = { x: 1800, y: 600, w: 600, h: 400, rival: null, projectiles: [] };
const simulatedPlayers = [
  { id: 'p1', name: 'Duelist_V', x: 1540, y: 1700, targetX: 1540, targetY: 1700, hp: 100, maxHp: 100, plotX: 2000, plotY: 1100, radius: 20, gear: { bodyColor: '#e63946', armorColor: '#f1faee', weaponColor: '#a8dadc' } },
  { id: 'p2', name: 'Merchant_Zack', x: 1780, y: 1520, targetX: 1780, targetY: 1520, hp: 100, maxHp: 100, plotX: 2000, plotY: 1900, radius: 20, gear: { bodyColor: '#06d6a0', armorColor: '#118ab2', weaponColor: '#ffd166' } }
];
const particles = [];
function spawnParticle(x,y,color,size,duration){ particles.push({x,y,color,size,maxLife:duration,life:duration}); }
const input = { normX:0, normY:0, keys:{w:false,a:false,s:false,d:false,ArrowUp:false,ArrowLeft:false,ArrowDown:false,ArrowRight:false}, touchId:null, touchActive:false, originX:0, originY:0, currentX:0, currentY:0 };
let screenW=0, screenH=0;
function resize(){ screenW=window.innerWidth; screenH=window.innerHeight; canvas.width=screenW; canvas.height=screenH; }
window.addEventListener('resize', resize); resize();
window.addEventListener('keydown', (e)=>{ if(input.keys.hasOwnProperty(e.key)) input.keys[e.key]=true; if(input.keys.hasOwnProperty(e.key.toLowerCase())) input.keys[e.key.toLowerCase()]=true; });
window.addEventListener('keyup', (e)=>{ if(input.keys.hasOwnProperty(e.key)) input.keys[e.key]=false; if(input.keys.hasOwnProperty(e.key.toLowerCase())) input.keys[e.key.toLowerCase()]=false; });
window.addEventListener('pointerdown', (e)=>{
  if (e.target.closest('#ui-layer') || e.target.closest('.app-panel') || e.target.closest('#social-modal')) return;
  if (isBuildMode) { handleBuildGridTap(e.clientX, e.clientY); return; }
  if (e.clientX <= screenW * 0.55) {
    if (input.touchActive) return;
    input.touchActive=true; input.touchId=e.pointerId; input.originX=e.clientX; input.originY=e.clientY; input.currentX=e.clientX; input.currentY=e.clientY;
  } else {
    if (checkFarmTouch(e.clientX, e.clientY)) return;
    checkSocialTouch(e.clientX, e.clientY);
  }
});
window.addEventListener('pointermove', (e)=>{ if(!input.touchActive||e.pointerId!==input.touchId) return; input.currentX=e.clientX; input.currentY=e.clientY; });
function endTouch(e){ if(e.pointerId===input.touchId){ input.touchActive=false; input.touchId=null; input.normX=0; input.normY=0; } }
window.addEventListener('pointerup', endTouch); window.addEventListener('pointercancel', endTouch);
function processInput(){
  if (isBuildMode) { input.normX=0; input.normY=0; return; }
  let kx=0, ky=0;
  if (input.keys.w||input.keys.ArrowUp) ky-=1;
  if (input.keys.s||input.keys.ArrowDown) ky+=1;
  if (input.keys.a||input.keys.ArrowLeft) kx-=1;
  if (input.keys.d||input.keys.ArrowRight) kx+=1;
  if (kx||ky) { const len=Math.hypot(kx,ky); input.normX=kx/len; input.normY=ky/len; }
  else if (input.touchActive) {
    const dx=input.currentX-input.originX, dy=input.currentY-input.originY, dist=Math.hypot(dx,dy);
    if (dist < CONFIG.joystickRadius*CONFIG.joystickDeadzone) { input.normX=0; input.normY=0; }
    else {
      const maxR=CONFIG.joystickRadius, deadR=maxR*CONFIG.joystickDeadzone;
      let mag=(Math.min(dist,maxR)-deadR)/(maxR-deadR);
      if (CONFIG.joystickCurve==='POWER') mag=Math.pow(mag,1.35);
      input.normX=(dx/dist)*mag; input.normY=(dy/dist)*mag;
    }
  } else { input.normX=0; input.normY=0; }
}
function resolveCircleAABB(cx,cy,r,box){
  if (!window.KELO_COLLISION) throw new Error('KELO_COLLISION unavailable');
  return window.KELO_COLLISION.resolveCircleAABB(cx,cy,r,box);
}
function updateMovement(dt){
  const targetVx=input.normX*CONFIG.speed, targetVy=input.normY*CONFIG.speed;
  if (CONFIG.movementType==='DIRECT') { localPlayer.vx=targetVx; localPlayer.vy=targetVy; }
  else {
    const isAcc=targetVx||targetVy; const decay=isAcc?CONFIG.accelDecay:CONFIG.decelDecay; const factor=1-Math.exp(-decay*dt);
    localPlayer.vx+=(targetVx-localPlayer.vx)*factor; localPlayer.vy+=(targetVy-localPlayer.vy)*factor;
    if (!isAcc && Math.hypot(localPlayer.vx,localPlayer.vy)<2) { localPlayer.vx=0; localPlayer.vy=0; }
  }
  const currentSpeed=Math.hypot(localPlayer.vx,localPlayer.vy);
  localPlayer.squashX+=(1+(currentSpeed/CONFIG.speed)*0.08-localPlayer.squashX)*(1-Math.exp(-15*dt));
  localPlayer.squashY+=(1-(currentSpeed/CONFIG.speed)*0.06-localPlayer.squashY)*(1-Math.exp(-15*dt));
  localPlayer.x+=localPlayer.vx*dt;
  for (const b of obstacles) { if (!b || b.blocksMovement === false) continue; const res=resolveCircleAABB(localPlayer.x,localPlayer.y,localPlayer.radius,b); if(res.collided) localPlayer.x+=res.pushX; }
  localPlayer.y+=localPlayer.vy*dt;
  for (const b of obstacles) { if (!b || b.blocksMovement === false) continue; const res=resolveCircleAABB(localPlayer.x,localPlayer.y,localPlayer.radius,b); if(res.collided) localPlayer.y+=res.pushY; }
  localPlayer.x=Math.max(localPlayer.radius, Math.min(CONFIG.worldWidth-localPlayer.radius, localPlayer.x));
  localPlayer.y=Math.max(localPlayer.radius, Math.min(CONFIG.worldHeight-localPlayer.radius, localPlayer.y));
}
function updateCamera(dt){
  const lookFactor=1-Math.exp(-CONFIG.lookAheadDecay*dt);
  camera.lookOffsetX+=(input.normX*CONFIG.lookAheadDist-camera.lookOffsetX)*lookFactor;
  camera.lookOffsetY+=(input.normY*CONFIG.lookAheadDist-camera.lookOffsetY)*lookFactor;
  const deadW=screenW*CONFIG.deadXRatio, deadH=screenH*CONFIG.deadYRatio;
  const deltaX=(localPlayer.x+camera.lookOffsetX)-camera.targetX;
  const deltaY=(localPlayer.y+camera.lookOffsetY)-camera.targetY;
  if (Math.abs(deltaX)>deadW) camera.targetX+=deltaX-Math.sign(deltaX)*deadW;
  if (Math.abs(deltaY)>deadH) camera.targetY+=deltaY-Math.sign(deltaY)*deadH;
  camera.x+=(camera.targetX-camera.x)*(1-Math.exp(-CONFIG.dampX*dt));
  camera.y+=(camera.targetY-camera.y)*(1-Math.exp(-CONFIG.dampY*dt));
  const halfW=screenW/2, halfH=screenH/2;
  camera.x=Math.max(halfW, Math.min(CONFIG.worldWidth-halfW, camera.x));
  camera.y=Math.max(halfH, Math.min(CONFIG.worldHeight-halfH, camera.y));
}
function updateSimulation(dt){
  STATE.equipped.forEach((s,idx)=>{ if(s.currentCd>0){ s.currentCd=Math.max(0,s.currentCd-dt); const el=document.getElementById('cd-bar-'+idx); if(el) el.style.height=((s.currentCd/s.baseCd)*100)+'%'; } });
  if (localPlayer.activeShield) { localPlayer.shieldTimer-=dt; if(localPlayer.shieldTimer<=0) localPlayer.activeShield=false; }
  STATE.auctions.forEach(a=>{ if(a.timeLeft>0) a.timeLeft-=dt; });
  simulatedPlayers.forEach(bot=>{
    if (!isPvPActive || arenaPvP.rival!==bot) {
      if (Math.hypot(bot.targetX-bot.x, bot.targetY-bot.y)<10 || Math.random()<0.005) { bot.targetX=1400+(Math.random()-0.5)*600; bot.targetY=1600+(Math.random()-0.5)*400; }
      const angle=Math.atan2(bot.targetY-bot.y, bot.targetX-bot.x); bot.x+=Math.cos(angle)*80*dt; bot.y+=Math.sin(angle)*80*dt;
    }
  });
  for (let i=arenaPvP.projectiles.length-1;i>=0;i--){
    const p=arenaPvP.projectiles[i]; p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt;
    if (isPvPActive) {
      if (p.fromPlayer && arenaPvP.rival && Math.hypot(p.x-arenaPvP.rival.x,p.y-arenaPvP.rival.y)<arenaPvP.rival.radius+p.radius) { applyPvPDamage(arenaPvP.rival,p.dmg); spawnParticle(p.x,p.y,p.color,16,0.4); arenaPvP.projectiles.splice(i,1); continue; }
      if (!p.fromPlayer && Math.hypot(p.x-localPlayer.x,p.y-localPlayer.y)<localPlayer.radius+p.radius) { applyPvPDamage(localPlayer,p.dmg); spawnParticle(p.x,p.y,p.color,16,0.4); arenaPvP.projectiles.splice(i,1); continue; }
    }
    if (p.life<=0) arenaPvP.projectiles.splice(i,1);
  }
  if (isPvPActive && arenaPvP.rival) {
    const rival=arenaPvP.rival; const dist=Math.hypot(localPlayer.x-rival.x, localPlayer.y-rival.y);
    if (dist>180) { const angle=Math.atan2(localPlayer.y-rival.y, localPlayer.x-rival.x); rival.x+=Math.cos(angle)*160*dt; rival.y+=Math.sin(angle)*160*dt; }
    if (Math.random()<0.02) { const angle=Math.atan2(localPlayer.y-rival.y, localPlayer.x-rival.x); arenaPvP.projectiles.push({x:rival.x,y:rival.y,vx:Math.cos(angle)*380,vy:Math.sin(angle)*380,color:'#ef476f',radius:10,dmg:20,fromPlayer:false,life:2}); }
  }
  for (let i=particles.length-1;i>=0;i--){ particles[i].life-=dt; if(particles[i].life<=0) particles.splice(i,1); }
}
function renderActionBar(){
  const container=document.getElementById('action-bar-container');
  if (!container) return;
  container.innerHTML='';
  STATE.equipped.forEach((stone,idx)=>{
    const slot=document.createElement('div'); slot.className='stone-slot'+(stone.isUlt?' ultimate':'');
    slot.onclick=()=>triggerStone(idx);
    slot.innerHTML='<div class="cooldown-overlay" id="cd-bar-'+idx+'"></div><span style="font-size:'+(stone.isUlt?18:14)+'px;">'+stone.icon+'</span><span>'+stone.name+'</span>';
    container.appendChild(slot);
  });
}
function triggerStone(index){
  const stone=STATE.equipped[index]; if(!stone||stone.currentCd>0) return; stone.currentCd=stone.baseCd;
  if (stone.typeId==='dash') {
    const moveLen=Math.hypot(localPlayer.vx,localPlayer.vy); const dirX=moveLen>0?localPlayer.vx/moveLen:1; const dirY=moveLen>0?localPlayer.vy/moveLen:0;
    localPlayer.x+=dirX*140; localPlayer.y+=dirY*140;
    for(let i=0;i<8;i++) spawnParticle(localPlayer.x,localPlayer.y,stone.color,12,0.4);
    if (isPvPActive && arenaPvP.rival && Math.hypot(localPlayer.x-arenaPvP.rival.x,localPlayer.y-arenaPvP.rival.y)<60) applyPvPDamage(arenaPvP.rival, stone.dmg);
  } else if (stone.typeId==='shield') { localPlayer.activeShield=true; localPlayer.shieldTimer=4; }
  else if (stone.typeId==='fireball' || stone.typeId==='frostnova') {
    const target=isPvPActive&&arenaPvP.rival?arenaPvP.rival:{x:localPlayer.x+200,y:localPlayer.y};
    const angle=Math.atan2(target.y-localPlayer.y,target.x-localPlayer.x);
    arenaPvP.projectiles.push({x:localPlayer.x,y:localPlayer.y,vx:Math.cos(angle)*450,vy:Math.sin(angle)*450,color:stone.color,radius:10,dmg:stone.dmg,fromPlayer:true,life:2});
  } else if (stone.typeId==='meteor') {
    const targetX=isPvPActive&&arenaPvP.rival?arenaPvP.rival.x:localPlayer.x+100;
    const targetY=isPvPActive&&arenaPvP.rival?arenaPvP.rival.y:localPlayer.y;
    for(let i=0;i<24;i++) spawnParticle(targetX+(Math.random()-0.5)*80,targetY+(Math.random()-0.5)*80,stone.color,20,0.8);
    if (isPvPActive && arenaPvP.rival && Math.hypot(targetX-arenaPvP.rival.x,targetY-arenaPvP.rival.y)<90) applyPvPDamage(arenaPvP.rival, stone.dmg);
  }
}
function render(){
  ctx.fillStyle='#0b0d10'; ctx.fillRect(0,0,screenW,screenH);
  let camX=camera.x-screenW/2, camY=camera.y-screenH/2;
  if (CONFIG.roundPixels) { camX=Math.round(camX); camY=Math.round(camY); }
  ctx.save(); ctx.translate(-camX,-camY);
  ctx.strokeStyle='#1a222d'; ctx.lineWidth=1;
  const startX=Math.floor(camX/80)*80, endX=startX+screenW+80, startY=Math.floor(camY/80)*80, endY=startY+screenH+80;
  ctx.beginPath();
  for(let x=startX;x<=endX;x+=80){ if(x>=0&&x<=CONFIG.worldWidth){ ctx.moveTo(x,Math.max(0,startY)); ctx.lineTo(x,Math.min(CONFIG.worldHeight,endY)); } }
  for(let y=startY;y<=endY;y+=80){ if(y>=0&&y<=CONFIG.worldHeight){ ctx.moveTo(Math.max(0,startX),y); ctx.lineTo(Math.min(CONFIG.worldWidth,endX),y); } }
  ctx.stroke();
  ctx.strokeStyle='#e04040'; ctx.lineWidth=4; ctx.strokeRect(0,0,CONFIG.worldWidth,CONFIG.worldHeight);
  for (const b of obstacles) { ctx.fillStyle='#222b38'; ctx.fillRect(b.x,b.y,b.w,b.h); ctx.strokeStyle='#38465c'; ctx.lineWidth=2; ctx.strokeRect(b.x,b.y,b.w,b.h); }
  renderFarm(STATE.farm); renderPlot(STATE.plot,true); renderArena(arenaPvP);
  for (const pt of particles) { ctx.fillStyle=pt.color; ctx.globalAlpha=pt.life/pt.maxLife; ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.size*(pt.life/pt.maxLife),0,Math.PI*2); ctx.fill(); }
  ctx.globalAlpha=1;
  if (isPvPActive && arenaPvP.rival) renderAvatar(arenaPvP.rival,false); else simulatedPlayers.forEach(p=>renderAvatar(p,false));
  renderAvatar(localPlayer,true);
  ctx.restore();
  if (input.touchActive && !isBuildMode) {
    ctx.save(); ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.lineWidth=2; ctx.fillStyle='rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.arc(input.originX,input.originY,CONFIG.joystickRadius,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle='rgba(255,50,50,0.4)'; ctx.beginPath(); ctx.arc(input.originX,input.originY,CONFIG.joystickRadius*CONFIG.joystickDeadzone,0,Math.PI*2); ctx.stroke();
    const dx=input.currentX-input.originX, dy=input.currentY-input.originY, dist=Math.hypot(dx,dy), clamped=Math.min(dist,CONFIG.joystickRadius), angle=Math.atan2(dy,dx);
    ctx.fillStyle='#00d2ff'; ctx.beginPath(); ctx.arc(input.originX+Math.cos(angle)*clamped, input.originY+Math.sin(angle)*clamped, 20, 0,Math.PI*2); ctx.fill(); ctx.restore();
  }
}
function renderAvatar(p,isSelf){
  ctx.save(); ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(p.x,p.y+14,p.radius*0.9,p.radius*0.45,0,0,Math.PI*2); ctx.fill();
  ctx.translate(p.x,p.y);
  if (isSelf && Math.hypot(p.vx,p.vy)>10) { const a=Math.atan2(p.vy,p.vx); ctx.rotate(a); ctx.scale(p.squashX,p.squashY); ctx.rotate(-a); }
  ctx.fillStyle=p.gear.bodyColor; ctx.beginPath(); ctx.arc(0,0,p.radius,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle=p.gear.armorColor; ctx.fillRect(-p.radius*0.5,-p.radius*0.2,p.radius,p.radius*0.7);
  ctx.fillStyle=p.gear.weaponColor; ctx.fillRect(p.radius*0.6,-p.radius*0.6,6,16);
  if (isSelf && localPlayer.activeShield) { ctx.strokeStyle='#ffd166'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(0,0,p.radius+6,0,Math.PI*2); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle=isSelf?'#00d2ff':'#fff'; ctx.font='10px sans-serif'; ctx.textAlign='center'; ctx.fillText(p.name,p.x,p.y-p.radius-8);
}
function renderPlot(plot,isOwn){
  ctx.strokeStyle=isOwn?'#39d353':'#1f6feb'; ctx.lineWidth=2; ctx.setLineDash([6,4]); ctx.strokeRect(plot.x,plot.y,plot.w,plot.h); ctx.setLineDash([]);
  ctx.fillStyle=isOwn?'#39d353':'#58a6ff'; ctx.font='11px sans-serif'; ctx.textAlign='left'; ctx.fillText(isOwn?'Mi Parcela #104':'Parcela de Vecino', plot.x+8, plot.y-8);
  plot.furniture.forEach(f=>{
    const fx=plot.x+f.gx*TILE_SIZE, fy=plot.y+f.gy*TILE_SIZE, fw=f.gw*TILE_SIZE, fh=f.gh*TILE_SIZE;
    if (f.type==='floor') { ctx.fillStyle='#2d241e'; ctx.fillRect(fx,fy,fw,fh); }
    else if (f.type==='wall') { ctx.fillStyle='#4b5563'; ctx.fillRect(fx,fy,fw,fh); }
    else if (f.type==='mannequin') { ctx.fillStyle='#92400e'; ctx.fillRect(fx+6,fy+6,fw-12,fh-12); ctx.fillStyle=localPlayer.gear.armorColor; ctx.fillRect(fx+8,fy+8,fw-16,fh-16); }
    else if (f.type==='showcase') { ctx.fillStyle='rgba(0,210,255,0.25)'; ctx.fillRect(fx+4,fy+4,fw-8,fh-8); }
  });
}
