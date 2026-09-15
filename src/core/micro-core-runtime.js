/* KELO-INDEX
 * area: LAB / MICRO CORE
 * owner: MicroCore experimental runtime
 * keys: ZERO BOOT PLAYER INPUT MOVEMENT CAMERA RENDER SINGLE LOOP IOS SAFARI
 * purpose: demostrar un núcleo compatible mínimo sin cargar engine-a/b/c; solo jugador, input, movimiento, cámara y render básico
 * consumes: optional KELO_COLLISION + KeloInput/KeloMovement wrappers loaded after this file
 * state-owned: experimental lab globals only
 * do-not: NO production import, NO farm, NO market, NO bots, NO PvP, NO editor, NO second loop
 */
'use strict';
var KELO_MICRO_CORE_VERSION='kelo-micro-core-v1';
var CONFIG={movementType:'DIRECT',speed:300,joystickRadius:58,joystickDeadzone:.12,worldWidth:3600,worldHeight:3200};
var STATE={gold:0,kc:0,equipped:[],inventory:[]};
var canvas=document.getElementById('game-canvas');
var ctx=canvas.getContext('2d',{alpha:false});
var localPlayer={id:'local_micro',name:'Kelo',x:1400,y:1600,vx:0,vy:0,hp:100,maxHp:100,radius:18,gear:{bodyColor:'#173f36',armorColor:'#e7c56a',weaponColor:'#fff4d6'},squashX:1,squashY:1,activeShield:false,shieldTimer:0};
var camera={x:localPlayer.x,y:localPlayer.y,targetX:localPlayer.x,targetY:localPlayer.y,lookOffsetX:0,lookOffsetY:0};
var obstacles=[];
var input={normX:0,normY:0,keys:{w:false,a:false,s:false,d:false,ArrowUp:false,ArrowLeft:false,ArrowDown:false,ArrowRight:false},touchId:null,touchActive:false,active:false,originX:0,originY:0,currentX:0,currentY:0};
var screenW=0,screenH=0;
var isBuildMode=false,isPvPActive=false;
var particles=[];
var arenaPvP={x:1800,y:600,w:600,h:400,rival:null,projectiles:[]};
var simulatedPlayers=[];
var TILE_SIZE=32;
var __microLast=performance.now();
var __microRunning=true;
var __microFrames=0;
var __microStartedAt=performance.now();

function resize(){screenW=innerWidth;screenH=innerHeight;var dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(screenW*dpr));canvas.height=Math.max(1,Math.round(screenH*dpr));canvas.style.width=screenW+'px';canvas.style.height=screenH+'px';ctx.setTransform(dpr,0,0,dpr,0,0);}
function showToast(msg){console.info('[MicroCore]',msg);}
function saveState(){return true;}
function loadState(){return true;}
function updateHud(){}
function closeMenu(){}
function closeSocialModal(){}
function renderFarm(){}
function renderPlot(){}
function renderArena(){}
function feedAnimals(){}
function socialAction(){}
function spawnParticle(){}
function applyPvPDamage(){}
function teleportToFarm(){}
function teleportToPlot(){}
function checkFarmTouch(){return false;}
function checkSocialTouch(){return false;}
function handleBuildGridTap(){}
function triggerStone(){}
function renderActionBar(){}

function processInput(){
  var kx=0,ky=0,keys=input.keys;
  if(keys.w||keys.ArrowUp)ky-=1;if(keys.s||keys.ArrowDown)ky+=1;if(keys.a||keys.ArrowLeft)kx-=1;if(keys.d||keys.ArrowRight)kx+=1;
  if(kx||ky){var kl=Math.hypot(kx,ky)||1;input.normX=kx/kl;input.normY=ky/kl;input.active=true;return;}
  if(input.touchActive){
    var dx=input.currentX-input.originX,dy=input.currentY-input.originY,dist=Math.hypot(dx,dy),dead=CONFIG.joystickRadius*CONFIG.joystickDeadzone;
    if(dist<=dead){input.normX=0;input.normY=0;input.active=false;return;}
    var mag=Math.min(1,(dist-dead)/(CONFIG.joystickRadius-dead)),len=dist||1;input.normX=dx/len*mag;input.normY=dy/len*mag;input.active=true;return;
  }
  input.normX=0;input.normY=0;input.active=false;
}
function resolveCircleAABB(cx,cy,r,box){
  if(window.KELO_COLLISION&&typeof window.KELO_COLLISION.resolveCircleAABB==='function')return window.KELO_COLLISION.resolveCircleAABB(cx,cy,r,box);
  var nx=Math.max(box.x,Math.min(cx,box.x+box.w)),ny=Math.max(box.y,Math.min(cy,box.y+box.h)),dx=cx-nx,dy=cy-ny,d2=dx*dx+dy*dy;
  if(d2>=r*r)return{collided:false,pushX:0,pushY:0};var d=Math.sqrt(d2)||.0001,p=(r-d)/d;return{collided:true,pushX:dx*p,pushY:dy*p};
}
function updateMovement(dt){
  localPlayer.vx=input.normX*CONFIG.speed;localPlayer.vy=input.normY*CONFIG.speed;
  localPlayer.x+=localPlayer.vx*dt;for(var i=0;i<obstacles.length;i++){var bx=obstacles[i];if(!bx||bx.blocksMovement===false)continue;var rx=resolveCircleAABB(localPlayer.x,localPlayer.y,localPlayer.radius,bx);if(rx.collided)localPlayer.x+=rx.pushX;}
  localPlayer.y+=localPlayer.vy*dt;for(var j=0;j<obstacles.length;j++){var by=obstacles[j];if(!by||by.blocksMovement===false)continue;var ry=resolveCircleAABB(localPlayer.x,localPlayer.y,localPlayer.radius,by);if(ry.collided)localPlayer.y+=ry.pushY;}
  localPlayer.x=Math.max(localPlayer.radius,Math.min(CONFIG.worldWidth-localPlayer.radius,localPlayer.x));localPlayer.y=Math.max(localPlayer.radius,Math.min(CONFIG.worldHeight-localPlayer.radius,localPlayer.y));
}
function updateCamera(dt){
  camera.targetX=localPlayer.x;camera.targetY=localPlayer.y;var f=1-Math.exp(-14*dt);camera.x+=(camera.targetX-camera.x)*f;camera.y+=(camera.targetY-camera.y)*f;
}
function updateSimulation(){}
function renderAvatar(p){ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle=p.gear.bodyColor;ctx.beginPath();ctx.arc(0,0,p.radius,0,Math.PI*2);ctx.fill();ctx.strokeStyle=p.gear.armorColor;ctx.lineWidth=3;ctx.stroke();ctx.restore();}
function render(){
  ctx.fillStyle='#071013';ctx.fillRect(0,0,screenW,screenH);ctx.save();ctx.translate(screenW/2-camera.x,screenH/2-camera.y);ctx.fillStyle='#173f36';ctx.fillRect(0,0,CONFIG.worldWidth,CONFIG.worldHeight);ctx.strokeStyle='rgba(231,197,106,.12)';ctx.lineWidth=1;
  var sx=Math.floor((camera.x-screenW/2)/128)*128,ex=camera.x+screenW/2+128,sy=Math.floor((camera.y-screenH/2)/128)*128,ey=camera.y+screenH/2+128;ctx.beginPath();for(var x=sx;x<ex;x+=128){ctx.moveTo(x,Math.max(0,sy));ctx.lineTo(x,Math.min(CONFIG.worldHeight,ey));}for(var y=sy;y<ey;y+=128){ctx.moveTo(Math.max(0,sx),y);ctx.lineTo(Math.min(CONFIG.worldWidth,ex),y);}ctx.stroke();renderAvatar(localPlayer);ctx.restore();
  if(input.touchActive){var dx=input.currentX-input.originX,dy=input.currentY-input.originY,dist=Math.hypot(dx,dy),cl=Math.min(dist,CONFIG.joystickRadius),a=Math.atan2(dy,dx);ctx.strokeStyle='rgba(255,255,255,.28)';ctx.beginPath();ctx.arc(input.originX,input.originY,CONFIG.joystickRadius,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#e7c56a';ctx.beginPath();ctx.arc(input.originX+Math.cos(a)*cl,input.originY+Math.sin(a)*cl,16,0,Math.PI*2);ctx.fill();}
}
function microFrame(now){
  if(!__microRunning)return;var dt=Math.min(.05,Math.max(0,(now-__microLast)/1000));__microLast=now;processInput();updateMovement(dt);updateCamera(dt);updateSimulation(dt);render();__microFrames++;requestAnimationFrame(microFrame);
}
function endTouch(e){if(e.pointerId!==input.touchId)return;input.touchId=null;input.touchActive=false;input.active=false;input.normX=0;input.normY=0;}
addEventListener('resize',resize,{passive:true});addEventListener('keydown',function(e){if(Object.prototype.hasOwnProperty.call(input.keys,e.key))input.keys[e.key]=true;var k=String(e.key||'').toLowerCase();if(Object.prototype.hasOwnProperty.call(input.keys,k))input.keys[k]=true;});addEventListener('keyup',function(e){if(Object.prototype.hasOwnProperty.call(input.keys,e.key))input.keys[e.key]=false;var k=String(e.key||'').toLowerCase();if(Object.prototype.hasOwnProperty.call(input.keys,k))input.keys[k]=false;});
canvas.addEventListener('pointerdown',function(e){if(input.touchActive)return;input.touchId=e.pointerId;input.touchActive=true;input.originX=input.currentX=e.clientX;input.originY=input.currentY=e.clientY;},{passive:true});canvas.addEventListener('pointermove',function(e){if(e.pointerId!==input.touchId)return;input.currentX=e.clientX;input.currentY=e.clientY;},{passive:true});canvas.addEventListener('pointerup',endTouch,{passive:true});canvas.addEventListener('pointercancel',endTouch,{passive:true});
resize();requestAnimationFrame(function(now){__microLast=now;requestAnimationFrame(microFrame);});
window.KELO_MICRO_CORE=Object.freeze({version:KELO_MICRO_CORE_VERSION,stop:function(){__microRunning=false;},snapshot:function(){return Object.freeze({version:KELO_MICRO_CORE_VERSION,x:Math.round(localPlayer.x),y:Math.round(localPlayer.y),frames:__microFrames,uptimeMs:Math.round(performance.now()-__microStartedAt)});}});
window.KELO_MICRO_CORE_AUDIT=Object.freeze({version:KELO_MICRO_CORE_VERSION,singleLoop:true,farm:false,market:false,bots:false,pvp:false,editor:false,assets:false,networkRequests:0});
