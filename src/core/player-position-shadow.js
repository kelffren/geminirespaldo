/* KELO-INDEX
 * area: CORE / PLAYER POSITION / LEGACY MODERNIZATION
 * owner: KeloPlayerPositionShadow
 * keys: PLAYER POSITION X Y SHADOW OBSERVABILITY TELEPORT MOVEMENT CONTEXT
 * purpose: observe localPlayer position changes at the end of the existing simulation pipeline before x/y ownership migration
 * public-api: KeloPlayerPositionShadow.snapshot/reset
 * consumes: localPlayer + KeloSimulation.after + optional PvP/instance context
 * state-owned: counters + bounded diagnostic event ring only
 * authority: read-only SHADOW; legacy position writers remain authoritative
 * do-not: NO x/y writes, NO timer, NO event listener, NO requestAnimationFrame, NO second loop, NO stack traces
 */
(function(root){
  'use strict';
  if(root.KeloPlayerPositionShadow)return;
  const VERSION='kelo-player-position-shadow-v1';
  const simulation=root.KeloSimulation;
  if(typeof localPlayer==='undefined'||!localPlayer||!simulation||typeof simulation.after!=='function'){
    root.KELO_PLAYER_POSITION_SHADOW_AUDIT=Object.freeze({version:VERSION,installed:false,reason:'position-or-simulation-missing'});
    return;
  }
  const EVENT_CAP=32,LARGE_MOVE_PX=96;
  let lastX=Number(localPlayer.x)||0,lastY=Number(localPlayer.y)||0,lastContext=null;
  let frames=0,changedFrames=0,continuousMoves=0,largeMoves=0,contextTransitions=0,maxDelta=0,lastDelta=0,lastKind='stationary';
  const events=[];
  function finite(v,fallback){const n=Number(v);return Number.isFinite(n)?n:fallback;}
  function context(){
    try{
      const pvp=root.KeloPvPWorld&&root.KeloPvPWorld.state&&root.KeloPvPWorld.state.mode;
      if(pvp&&pvp!=='social')return 'pvp:'+String(pvp);
      const instance=root.KELO_INSTANCES&&typeof root.KELO_INSTANCES.current==='function'&&root.KELO_INSTANCES.current();
      if(instance&&instance.type)return 'instance:'+String(instance.type);
      if(root.document&&root.document.body&&root.document.body.classList){
        if(root.document.body.classList.contains('kelo-property-editing'))return 'property-editor';
        if(root.document.body.classList.contains('kelo-house-instance'))return 'instance:house';
        if(root.document.body.classList.contains('kelo-market-instance'))return 'instance:market';
      }
    }catch(_){ }
    return 'world';
  }
  lastContext=context();
  function pushEvent(event){events.push(Object.freeze(event));if(events.length>EVENT_CAP)events.shift();}
  function sample(simContext){
    frames++;
    const x=finite(localPlayer.x,lastX),y=finite(localPlayer.y,lastY),dx=x-lastX,dy=y-lastY,delta=Math.hypot(dx,dy),nextContext=context(),contextChanged=nextContext!==lastContext;
    lastDelta=delta;if(delta>maxDelta)maxDelta=delta;
    if(delta>.001){changedFrames++;if(delta>LARGE_MOVE_PX){largeMoves++;lastKind='large-move';}else{continuousMoves++;lastKind='continuous';}}else lastKind='stationary';
    if(contextChanged)contextTransitions++;
    if(delta>LARGE_MOVE_PX||contextChanged){
      pushEvent({frame:frames,kind:delta>LARGE_MOVE_PX?'large-move':'context',fromX:lastX,fromY:lastY,toX:x,toY:y,delta:delta,fromContext:lastContext,toContext:nextContext,dt:finite(simContext&&simContext.dt,0)});
    }
    lastX=x;lastY=y;lastContext=nextContext;
  }
  function snapshot(){return Object.freeze({version:VERSION,mode:'SHADOW',authority:'legacy-only',frames,changedFrames,continuousMoves,largeMoves,contextTransitions,maxDelta,lastDelta,lastKind,lastX,lastY,lastContext,eventCount:events.length,events:Object.freeze(events.slice())});}
  function reset(){frames=0;changedFrames=0;continuousMoves=0;largeMoves=0;contextTransitions=0;maxDelta=0;lastDelta=0;lastKind='stationary';events.length=0;lastX=finite(localPlayer.x,0);lastY=finite(localPlayer.y,0);lastContext=context();return snapshot();}
  const hookId=simulation.after('player-position-shadow',sample,10000);
  root.KeloPlayerPositionShadow=Object.freeze({version:VERSION,snapshot,reset,hookId});
  root.KELO_PLAYER_POSITION_SHADOW_AUDIT=Object.freeze({version:VERSION,installed:true,mode:'SHADOW',authority:'legacy-only',readOnly:true,hookOwner:'KeloSimulation',hookPhase:'after',hookPriority:10000,hookId:hookId,timers:0,listeners:0,gameLoop:false,stackTraces:false,eventCap:EVENT_CAP,largeMovePx:LARGE_MOVE_PX,get frames(){return frames;},get largeMoves(){return largeMoves;},get contextTransitions(){return contextTransitions;}});
})(typeof globalThis!=='undefined'?globalThis:window);
