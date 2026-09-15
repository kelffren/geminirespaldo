/* KELO-INDEX
 * area: INSTANCES
 * owner: Instance runtime for scene switching; transition position owned by KeloPlayerPosition; camera state owned by KeloCamera
 * keys: SCENE RUNTIME HOUSE WORLD CAMERA POSITION BOUNDS FOUNDATION
 * purpose: cambia el runtime visual entre mundo e instancia sin cambiar el loop principal y delega transiciones/cámara a owners
 * public-api: KELO_INSTANCE_RUNTIME
 * consumes: KeloPlayerPosition, KeloCamera, KELO_ENVIRONMENT_LAYERS, scene/property context
 * state-owned: snapshot local de jugador/cámara previo a entrar y clamp de instancia
 * extension-points: KeloPlayerPosition.teleport/restore + KeloCamera.setTarget/restoreState
 * reuse: transición mundo↔instancia sin crear cámaras paralelas
 * legacy: clamp usa timer y sigue escribiendo x/y hasta migración a simulation/position owner
 * do-not: NO escribir camera.x/y/targetX/targetY directamente; NO usar x/y directos fuera del clamp legacy
 */
(function(){
  'use strict';
  const L=window.KELO_ENVIRONMENT_LAYERS;
  const cameraOwner=window.KeloCamera;
  const positionOwner=window.KeloPlayerPosition;
  if(!cameraOwner)throw new Error('KeloCamera unavailable before instance runtime');
  if(!positionOwner)throw new Error('KeloPlayerPosition unavailable before instance runtime');
  let worldState=null,clampTimer=null;
  const clone=v=>JSON.parse(JSON.stringify(v));
  function captureWorld(){if(worldState)return;worldState={player:positionOwner.capture(),camera:cameraOwner.snapshot()};}
  function centerOn(x,y){positionOwner.teleport(x,y,{source:'instance-runtime:center',stopMotion:true});cameraOwner.setTarget(x,y,{snap:true,source:'instance-runtime:center'});}
  function stopClamp(){if(clampTimer){clearInterval(clampTimer);clampTimer=null;}}
  function startClamp(instance){stopClamp();clampTimer=setInterval(()=>{try{if(!window.KELO_SCENE_CONTEXT?.isInstance('house'))return;const b=instance?.config?.bounds;if(!b||typeof localPlayer==='undefined'||!localPlayer)return;const pad=18;localPlayer.x=Math.max(b.x+pad,Math.min(b.x+b.w-pad,Number(localPlayer.x)||b.x+b.w/2));localPlayer.y=Math.max(b.y+pad,Math.min(b.y+b.h-pad,Number(localPlayer.y)||b.y+b.h/2));}catch(err){console.error('[Kelo house runtime] clamp',err);}},50);}
  async function enter(instance){captureWorld();const b=instance?.config?.bounds||{x:0,y:0,w:800,h:600};const spawn=instance?.config?.spawn||{x:b.x+b.w/2,y:b.y+b.h-72};document.body.classList.add('kelo-house-instance');centerOn(spawn.x,spawn.y);startClamp(instance);try{window.KELO_PROPERTY_SYSTEM?.refreshSceneColliders?.();}catch(e){}return clone(worldState);}
  async function leave(){stopClamp();document.body.classList.remove('kelo-house-instance');if(worldState){if(worldState.player)positionOwner.restore(worldState.player,{source:'instance-runtime:leave',stopMotion:true});if(worldState.camera)cameraOwner.restoreState(worldState.camera,{source:'instance-runtime:leave'});}worldState=null;try{window.KELO_PROPERTY_SYSTEM?.refreshSceneColliders?.();}catch(e){}return true;}
  function drawHouse(g){if(!window.KELO_SCENE_CONTEXT?.isInstance('house'))return;const i=window.KELO_INSTANCES?.current?.();const b=i?.config?.bounds;if(!b)return;g.save();g.fillStyle='#071012';g.fillRect(b.x-2200,b.y-2200,b.w+4400,b.h+4400);g.fillStyle='#182423';g.fillRect(b.x,b.y,b.w,b.h);g.fillStyle='#263531';g.fillRect(b.x+14,b.y+14,b.w-28,b.h-28);g.strokeStyle='rgba(231,197,106,.45)';g.lineWidth=10;g.strokeRect(b.x+8,b.y+8,b.w-16,b.h-16);g.strokeStyle='rgba(255,244,214,.08)';g.lineWidth=1;for(let x=b.x+32;x<b.x+b.w;x+=32){g.beginPath();g.moveTo(x,b.y+18);g.lineTo(x,b.y+b.h-18);g.stroke();}for(let y=b.y+32;y<b.y+b.h;y+=32){g.beginPath();g.moveTo(b.x+18,y);g.lineTo(b.x+b.w-18,y);g.stroke();}const doorW=96;g.fillStyle='#071012';g.fillRect(b.x+b.w/2-doorW/2,b.y+b.h-18,doorW,28);g.restore();}
  if(L&&typeof L.register==='function')L.register({id:'house-instance-backdrop',phase:'props_back',priority:-500,required:false,ready:()=>true,draw:drawHouse,ownership:'instance-runtime-v1',bounds:()=>[]});
  window.KELO_INSTANCE_RUNTIME=Object.freeze({version:'instance-runtime-bridge-v1.2-position-owner',enter,leave,get worldState(){return clone(worldState);}});
})();
