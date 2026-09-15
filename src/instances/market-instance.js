/* KELO-INDEX
 * area: INSTANCES / COMMERCE
 * owner: KeloMarketWorld; transition position owned by KeloPlayerPosition
 * keys: MARKET INSTANCE STALL CARPET SELLING CAMERA POSITION RENDER INPUT OFFLINE ONLINE
 * purpose: zona de mercado separada, caminable y reutilizable; dibuja puestos y expone interacción sin poseer economía
 * public-api: KeloMarketWorld.enter/leave/getStalls/getStall/startSelling/stopSelling
 * consumes: KELO_INSTANCES, KELO_SCENE_CONTEXT, KeloPlayerPosition, KeloCamera, KeloRender, KeloSimulation, KeloCommerceAuthority, KeloInputLocks
 * state-owned: snapshot temporal de posición/cámara y modo vendedor local; NO posee listings, oro ni trades
 * online: la instancia y puestos consumen snapshots de KeloCommerceAuthority; el servidor puede sustituir autoridad sin cambiar este renderer
 * legacy: clampPlayer conserva writers x/y continuos hasta su propia migración
 * do-not: no mover items/oro, no crear otro render loop, no escribir camera.* directamente, no usar x/y directos fuera del clamp legacy
 */
(function(root){
'use strict';
const VERSION='market-instance-v1.1.0-position-owner';
const I=root.KELO_INSTANCES;
const cameraOwner=root.KeloCamera;
const positionOwner=root.KeloPlayerPosition;
const renderOwner=root.KeloRender;
const simulationOwner=root.KeloSimulation;
if(!I||!cameraOwner||!positionOwner||!renderOwner||!simulationOwner){console.error('[Kelo market world] Foundation owners missing');return;}
const RESOURCE_ID='central-market';
const BOUNDS=Object.freeze({x:0,y:0,w:1280,h:820});
const SPAWN=Object.freeze({x:640,y:690});
const STALLS=Object.freeze([
  Object.freeze({stallId:'stall_01',x:180,y:205,facing:'down'}),
  Object.freeze({stallId:'stall_02',x:430,y:205,facing:'down'}),
  Object.freeze({stallId:'stall_03',x:680,y:205,facing:'down'}),
  Object.freeze({stallId:'stall_04',x:930,y:205,facing:'down'}),
  Object.freeze({stallId:'stall_05',x:180,y:505,facing:'up'}),
  Object.freeze({stallId:'stall_06',x:430,y:505,facing:'up'}),
  Object.freeze({stallId:'stall_07',x:680,y:505,facing:'up'}),
  Object.freeze({stallId:'stall_08',x:930,y:505,facing:'up'})
]);
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
let worldState=null;
let sellingStallId=null;
let sellingLockToken=null;
let pointerInstalled=false;
function current(){const x=I.current?.();return x?.type==='market'?x:null;}
function active(){return !!current();}
function commerceSnapshot(){try{return root.KeloCommerceAuthority?.snapshot?.()||null;}catch(_){return null;}}
function claimFor(stallId){return (commerceSnapshot()?.stalls||[]).find(x=>x&&x.stallId===stallId)||null;}
function stallById(stallId){return STALLS.find(s=>s.stallId===String(stallId||''))||null;}
function stallCarpetRect(stall){return{x:stall.x-70,y:stall.y+(stall.facing==='down'?52:-104),w:140,h:70};}
function hitStall(wx,wy){for(const stall of STALLS){const r=stallCarpetRect(stall);if(wx>=r.x&&wx<=r.x+r.w&&wy>=r.y&&wy<=r.y+r.h)return stall;}return null;}
function captureWorld(){if(worldState)return;worldState={player:positionOwner.capture(),camera:cameraOwner.snapshot()};}
function clearMotion(){if(typeof localPlayer!=='undefined'&&localPlayer){localPlayer.vx=0;localPlayer.vy=0;}if(typeof input!=='undefined'&&input){input.normX=0;input.normY=0;input.touchActive=false;input.touchId=null;}}
function centerOn(x,y){positionOwner.teleport(x,y,{source:'market-instance:center',stopMotion:true});cameraOwner.setTarget(x,y,{snap:true,source:'market-instance:center'});clearMotion();}
function restoreWorld(){stopSelling();if(worldState){if(worldState.player)positionOwner.restore(worldState.player,{source:'market-instance:leave',stopMotion:true});clearMotion();if(worldState.camera)cameraOwner.restoreState(worldState.camera,{source:'market-instance:leave'});}worldState=null;document.body.classList.remove('kelo-market-instance');}
function sellerPosition(stall){return{x:stall.x,y:stall.y+(stall.facing==='down'?-28:28)};}
function startSelling(stallId){
  const stall=stallById(stallId);if(!stall)return{ok:false,error:'STALL_NOT_FOUND'};
  const claim=claimFor(stall.stallId);const me=root.KeloCommerceAuthority?.playerId?.()||'local_pioneer';if(!claim||String(claim.ownerId)!==String(me)&&String(claim.ownerId)!=='local_pioneer')return{ok:false,error:'STALL_NOT_OWNED'};
  stopSelling();sellingStallId=stall.stallId;const p=sellerPosition(stall);centerOn(p.x,p.y);if(root.KeloInputLocks?.acquire)sellingLockToken=root.KeloInputLocks.acquire('commerce-stall',{stallId:stall.stallId,reason:'selling'});document.body.classList.add('kelo-stall-selling');return{ok:true,stallId:stall.stallId};
}
function stopSelling(){if(sellingLockToken&&root.KeloInputLocks?.release)root.KeloInputLocks.release(sellingLockToken);else root.KeloInputLocks?.releaseOwner?.('commerce-stall');sellingLockToken=null;sellingStallId=null;document.body.classList.remove('kelo-stall-selling');return true;}
function drawStoneFloor(g){
  g.fillStyle='#071012';g.fillRect(BOUNDS.x,BOUNDS.y,BOUNDS.w,BOUNDS.h);
  const tile=64;for(let y=BOUNDS.y;y<BOUNDS.y+BOUNDS.h;y+=tile){for(let x=BOUNDS.x;x<BOUNDS.x+BOUNDS.w;x+=tile){const alt=((x/tile+y/tile)&1)===0;g.fillStyle=alt?'#12201f':'#0f1b1b';g.fillRect(x,y,tile,tile);g.strokeStyle='rgba(231,197,106,.035)';g.lineWidth=1;g.strokeRect(x+.5,y+.5,tile-1,tile-1);}}
  g.strokeStyle='rgba(231,197,106,.48)';g.lineWidth=8;g.strokeRect(BOUNDS.x+8,BOUNDS.y+8,BOUNDS.w-16,BOUNDS.h-16);
  g.strokeStyle='rgba(255,244,214,.08)';g.lineWidth=1;g.strokeRect(BOUNDS.x+22,BOUNDS.y+22,BOUNDS.w-44,BOUNDS.h-44);
  g.fillStyle='rgba(231,197,106,.06)';g.fillRect(555,330,170,150);g.strokeStyle='rgba(231,197,106,.22)';g.lineWidth=3;g.strokeRect(555,330,170,150);
  g.fillStyle='#e7c56a';g.font='900 16px Georgia,serif';g.textAlign='center';g.fillText('MERCADO CENTRAL',640,392);g.fillStyle='rgba(238,243,239,.58)';g.font='700 9px -apple-system,sans-serif';g.fillText('COMERCIO · TRUEQUE · PUESTOS',640,412);
}
function drawVendorFigure(g,stall,claim){if(!claim)return;const p=sellerPosition(stall);g.save();g.fillStyle=claim.demo?'#6eb9a1':'#d5b85d';g.beginPath();g.arc(p.x,p.y-12,12,0,Math.PI*2);g.fill();g.fillStyle=claim.demo?'#24483f':'#55461e';g.fillRect(p.x-13,p.y,26,25);g.restore();}
function drawStall(g,stall){
  const claim=claimFor(stall.stallId),own=!!(claim&&!claim.demo&&(String(claim.ownerId)==='local_pioneer'||String(claim.ownerId)===String(root.KeloCommerceAuthority?.playerId?.()))),carpet=stallCarpetRect(stall);
  g.save();
  drawVendorFigure(g,stall,claim);
  g.fillStyle='#3c2418';g.fillRect(stall.x-58,stall.y-18,116,42);g.fillStyle='#5f3922';g.fillRect(stall.x-66,stall.y-24,132,10);g.fillStyle='#1a1410';g.fillRect(stall.x-61,stall.y+24,9,44);g.fillRect(stall.x+52,stall.y+24,9,44);
  g.fillStyle=own?'#8d7225':'#294b43';g.fillRect(stall.x-70,stall.y-54,140,24);g.strokeStyle=own?'#f0d77b':'rgba(231,197,106,.45)';g.lineWidth=2;g.strokeRect(stall.x-70,stall.y-54,140,24);
  g.fillStyle=own?'rgba(190,151,42,.38)':'rgba(35,94,79,.48)';g.fillRect(carpet.x,carpet.y,carpet.w,carpet.h);g.strokeStyle=own?'rgba(240,215,123,.95)':'rgba(231,197,106,.42)';g.lineWidth=2;g.strokeRect(carpet.x,carpet.y,carpet.w,carpet.h);
  g.fillStyle='#f3e8c0';g.textAlign='center';g.font='900 10px -apple-system,sans-serif';g.fillText(claim?String(claim.sellerName||'Mercader'):'PUESTO LIBRE',stall.x,stall.y-38);
  g.fillStyle=claim?'#c6d4ce':'#8fa39b';g.font='700 8px -apple-system,sans-serif';const msg=claim?String(claim.message||'Toca la alfombra').slice(0,30):'TOCA PARA RECLAMAR';g.fillText(msg,stall.x,carpet.y+carpet.h/2+3);
  g.restore();
}
function drawJoystick(g){if(typeof input==='undefined'||!input.touchActive||typeof CONFIG==='undefined')return;g.save();g.strokeStyle='rgba(231,197,106,.35)';g.lineWidth=2;g.fillStyle='rgba(231,197,106,.06)';g.beginPath();g.arc(input.originX,input.originY,CONFIG.joystickRadius,0,Math.PI*2);g.fill();g.stroke();const dx=input.currentX-input.originX,dy=input.currentY-input.originY,dist=Math.hypot(dx,dy),clamped=Math.min(dist,CONFIG.joystickRadius),angle=Math.atan2(dy,dx);g.fillStyle='#e7c56a';g.beginPath();g.arc(input.originX+Math.cos(angle)*clamped,input.originY+Math.sin(angle)*clamped,18,0,Math.PI*2);g.fill();g.restore();}
function drawMarket(context){
  if(!active())return false;const g=context.ctx;if(!g)return true;g.save();g.fillStyle='#05090b';g.fillRect(0,0,context.screenW,context.screenH);g.restore();
  const z=context.config?.zoom||1,c=context.camera;g.save();g.translate(context.screenW/2,context.screenH/2);g.scale(z,z);g.translate(-c.x,-c.y);drawStoneFloor(g);STALLS.forEach(s=>drawStall(g,s));if(typeof renderAvatar==='function'&&typeof localPlayer!=='undefined'&&localPlayer)renderAvatar(localPlayer,true);g.restore();drawJoystick(g);return true;
}
function clampPlayer(){if(!active()||typeof localPlayer==='undefined'||!localPlayer)return;if(sellingStallId){const stall=stallById(sellingStallId);if(stall){const p=sellerPosition(stall);localPlayer.x=p.x;localPlayer.y=p.y;localPlayer.vx=0;localPlayer.vy=0;}return;}const pad=Math.max(24,Number(localPlayer.radius)||20);localPlayer.x=Math.max(BOUNDS.x+pad,Math.min(BOUNDS.x+BOUNDS.w-pad,Number(localPlayer.x)||SPAWN.x));localPlayer.y=Math.max(BOUNDS.y+pad,Math.min(BOUNDS.y+BOUNDS.h-pad,Number(localPlayer.y)||SPAWN.y));}
function pointerDown(e){if(!active()||e.defaultPrevented)return;const w=cameraOwner.screenToWorld(e.clientX,e.clientY),stall=hitStall(w.x,w.y);if(!stall)return;e.preventDefault();e.stopPropagation();clearMotion();root.KeloCommerceUI?.openStall?.(stall.stallId);}
function installPointer(){if(pointerInstalled)return;const target=typeof canvas!=='undefined'?canvas:null;if(!target)return;target.addEventListener('pointerdown',pointerDown,{capture:true});pointerInstalled=true;}
I.registerType('market',{async create(ctx){const instance={ownerId:'system',maxPlayers:Math.max(20,Number(ctx.options?.maxPlayers)||80),config:{bounds:clone(BOUNDS),spawn:clone(SPAWN)},permissions:{enter:true,trade:true,stall:true},runtimeState:{},authoritySource:root.KeloCommerceAuthority?.getMode?.()||'local-offline'};instance.onEnter=async()=>{captureWorld();document.body.classList.add('kelo-market-instance');centerOn(SPAWN.x,SPAWN.y);installPointer();};instance.onExit=async()=>restoreWorld();instance.onDestroy=async()=>restoreWorld();return instance;}});
async function enter(){const existing=current();if(existing)return existing;const other=I.current?.();if(other&&other.type!=='market')throw new Error('LEAVE_CURRENT_INSTANCE_FIRST');const me=root.KeloCommerceAuthority?.playerId?.()||'local_pioneer';return I.enter('market',RESOURCE_ID,{id:me,role:'visitor'},{ownerId:'system',maxPlayers:80,authoritySource:root.KeloCommerceAuthority?.getMode?.()||'local-offline'});}
async function leave(){try{const snap=root.KeloCommerceAuthority?.snapshot?.();if(snap?.activeTrade)await root.KeloCommerceAuthority.cancelTrade();}catch(_){ }stopSelling();return I.leaveCurrent(root.KeloCommerceAuthority?.playerId?.()||'local_pioneer',{idleTTL:0});}
renderOwner.intercept('market-instance:exclusive-render',drawMarket,260);
simulationOwner.after('market-instance:bounds',clampPlayer,860);
installPointer();
root.KeloMarketWorld=Object.freeze({version:VERSION,resourceId:RESOURCE_ID,bounds:clone(BOUNDS),spawn:clone(SPAWN),enter,leave,isActive:active,getStalls:()=>STALLS.map(clone),getStall:stallId=>clone(stallById(stallId)),getClaim:stallId=>clone(claimFor(stallId)),startSelling,stopSelling,getSellingStall:()=>sellingStallId,hitTest:(x,y)=>clone(hitStall(x,y))});
root.KELO_MARKET_WORLD_AUDIT=Object.freeze({version:VERSION,instanceType:'market',offline:true,serverReplaceable:true,exclusiveRenderOwner:'KeloRender',simulationOwner:'KeloSimulation',positionTransitionOwner:'KeloPlayerPosition',cameraOwner:'KeloCamera',economyOwner:'KeloCommerceAuthority',stallCarpets:true,freeStallClaimInteraction:true,sellingMovementLock:true,dprSafeCanvasTransform:true,directInventoryMutation:false,directGoldMutation:false});
})(typeof globalThis!=='undefined'?globalThis:window);