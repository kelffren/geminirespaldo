/* KELO-INDEX
 * area: CORE / PLAYER POSITION
 * owner: KeloPlayerPosition
 * keys: PLAYER POSITION TRANSITION TELEPORT RESTORE CAPTURE FOUNDATION
 * purpose: centraliza cambios discontinuos de posición (teleport/spawn/restore) sin poseer movimiento continuo por frame
 * public-api: KeloPlayerPosition.capture/teleport/restore/snapshot
 * state-owned: contador + ring buffer acotado de transiciones; NO movimiento continuo
 * authority: NEW solo para rutas de transición migradas; x/y continuo sigue legacy
 * do-not: NO game loop, NO timer, NO RAF, NO listener, NO clamp por frame, NO dash, NO physics
 */
(function(root){
  'use strict';
  if(root.KeloPlayerPosition)return;
  const VERSION='kelo-player-position-transition-v1.0.0';
  const EVENT_CAP=32;
  let sequence=1,transitions=0,restores=0,last=null;
  const events=[];

  function player(){
    try{return typeof localPlayer!=='undefined'&&localPlayer?localPlayer:null;}catch(_){return null;}
  }
  function finite(value,label){
    const n=Number(value);
    if(!Number.isFinite(n))throw new TypeError('KeloPlayerPosition invalid '+label);
    return n;
  }
  function capture(){
    const p=player();
    if(!p)return null;
    return Object.freeze({x:Number(p.x)||0,y:Number(p.y)||0});
  }
  function push(event){events.push(Object.freeze(event));if(events.length>EVENT_CAP)events.shift();last=event;}
  function apply(x,y,options){
    const p=player();
    if(!p)throw new Error('KeloPlayerPosition localPlayer unavailable');
    const opts=options||{},nextX=finite(x,'x'),nextY=finite(y,'y'),source=String(opts.source||'unspecified'),fromX=Number(p.x)||0,fromY=Number(p.y)||0;
    // FOUNDATION-ALLOW: transition-only x/y writer. Continuous movement remains outside this owner until a later migration.
    localPlayer.x=nextX;
    localPlayer.y=nextY;
    if(opts.stopMotion===true){
      if(Number.isFinite(Number(p.vx)))p.vx=0;
      if(Number.isFinite(Number(p.vy)))p.vy=0;
    }
    transitions++;
    const event={id:'position-transition-'+sequence++,source,kind:String(opts.kind||'teleport'),fromX,fromY,x:nextX,y:nextY,distance:Math.hypot(nextX-fromX,nextY-fromY),stopMotion:opts.stopMotion===true};
    push(event);
    try{if(root.KeloEvents&&typeof root.KeloEvents.emit==='function')root.KeloEvents.emit('PLAYER_POSITION_TRANSITION',event);}catch(_){ }
    return Object.freeze({...event});
  }
  function teleport(x,y,options){return apply(x,y,{...(options||{}),kind:(options&&options.kind)||'teleport'});}
  function restore(point,options){
    if(!point)throw new TypeError('KeloPlayerPosition restore point required');
    restores++;
    return apply(point.x,point.y,{...(options||{}),kind:(options&&options.kind)||'restore'});
  }
  function snapshot(){
    return Object.freeze({version:VERSION,owner:'KeloPlayerPosition',scope:'transition-only',transitions,restores,last:last?Object.freeze({...last}):null,eventCount:events.length,events:Object.freeze(events.map(e=>Object.freeze({...e})))});
  }

  root.KeloPlayerPosition=Object.freeze({version:VERSION,capture,teleport,restore,snapshot});
  root.KELO_PLAYER_POSITION_AUDIT=Object.freeze({version:VERSION,installed:true,owner:'KeloPlayerPosition',scope:'transition-only',continuousMovementAuthority:false,teleportAuthority:true,restoreAuthority:true,eventCap:EVENT_CAP,timers:0,listeners:0,raf:0,gameLoop:false});
})(typeof globalThis!=='undefined'?globalThis:window);
