/* KELO-INDEX
 * area: CORE / CAMERA MIGRATION
 * owner: KeloCameraFollowShadow
 * owns: read-only parity evidence for legacy camera follow math
 * does-not-own: camera position, target, zoom, viewport, game loop, gameplay state
 * purpose: characterize engine-a camera follow before KeloCamera replaces the legacy implementation
 * public-api: KeloCameraFollowShadow.predict/snapshot/reset
 * extension-points: sample cadence and numeric tolerance only
 * reuse: legacy exit evidence for camera follow
 * legacy: wraps updateCamera briefly before KeloCamera captures it; legacy remains sole follow authority
 * do-not: NO timers, listeners, camera writes, player writes, second loop or visual side effects
 */
(function(root){
  'use strict';
  if(root.KeloCameraFollowShadow)return;
  const VERSION='kelo-camera-follow-shadow-v1';
  const TOLERANCE=1e-7;
  const SAMPLE_EVERY=8;
  let frames=0,comparisons=0,matches=0,divergences=0,last=null;
  const recent=[];

  function finite(value,fallback){const n=Number(value);return Number.isFinite(n)?n:(fallback||0);}
  function predict(s){
    const dt=Math.max(0,finite(s.dt));
    const lookFactor=1-Math.exp(-finite(s.lookAheadDecay)*dt);
    let lookOffsetX=finite(s.lookOffsetX)+(finite(s.inputX)*finite(s.lookAheadDist)-finite(s.lookOffsetX))*lookFactor;
    let lookOffsetY=finite(s.lookOffsetY)+(finite(s.inputY)*finite(s.lookAheadDist)-finite(s.lookOffsetY))*lookFactor;
    const deadW=finite(s.screenW)*finite(s.deadXRatio),deadH=finite(s.screenH)*finite(s.deadYRatio);
    let targetX=finite(s.targetX),targetY=finite(s.targetY);
    const deltaX=(finite(s.playerX)+lookOffsetX)-targetX,deltaY=(finite(s.playerY)+lookOffsetY)-targetY;
    if(Math.abs(deltaX)>deadW)targetX+=deltaX-Math.sign(deltaX)*deadW;
    if(Math.abs(deltaY)>deadH)targetY+=deltaY-Math.sign(deltaY)*deadH;
    const x=finite(s.x)+(targetX-finite(s.x))*(1-Math.exp(-finite(s.dampX)*dt));
    const y=finite(s.y)+(targetY-finite(s.y))*(1-Math.exp(-finite(s.dampY)*dt));
    return Object.freeze({lookOffsetX,lookOffsetY,targetX,targetY,x,y});
  }
  function capture(dt){
    if(typeof camera==='undefined'||typeof localPlayer==='undefined'||typeof input==='undefined'||typeof CONFIG==='undefined')return null;
    return {
      dt:finite(dt),x:finite(camera.x),y:finite(camera.y),targetX:finite(camera.targetX),targetY:finite(camera.targetY),
      lookOffsetX:finite(camera.lookOffsetX),lookOffsetY:finite(camera.lookOffsetY),playerX:finite(localPlayer.x),playerY:finite(localPlayer.y),
      inputX:finite(input.normX),inputY:finite(input.normY),screenW:typeof screenW!=='undefined'?finite(screenW):0,screenH:typeof screenH!=='undefined'?finite(screenH):0,
      dampX:finite(CONFIG.dampX),dampY:finite(CONFIG.dampY),deadXRatio:finite(CONFIG.deadXRatio),deadYRatio:finite(CONFIG.deadYRatio),
      lookAheadDist:finite(CONFIG.lookAheadDist),lookAheadDecay:finite(CONFIG.lookAheadDecay)
    };
  }
  function actual(){
    if(typeof camera==='undefined')return null;
    return {lookOffsetX:finite(camera.lookOffsetX),lookOffsetY:finite(camera.lookOffsetY),targetX:finite(camera.targetX),targetY:finite(camera.targetY),x:finite(camera.x),y:finite(camera.y)};
  }
  function compare(expected,observed){
    if(!expected||!observed)return null;
    const keys=['lookOffsetX','lookOffsetY','targetX','targetY','x','y'];
    let maxDelta=0,key=null;
    for(const k of keys){const d=Math.abs(finite(expected[k])-finite(observed[k]));if(d>maxDelta){maxDelta=d;key=k;}}
    const match=maxDelta<=TOLERANCE;
    comparisons++;if(match)matches++;else divergences++;
    last=Object.freeze({match,maxDelta,key,expected,observed});
    if(!match){recent.push(last);if(recent.length>10)recent.shift();}
    return last;
  }
  function snapshot(){return Object.freeze({version:VERSION,authority:'legacy-only',sampleEvery:SAMPLE_EVERY,tolerance:TOLERANCE,frames,comparisons,matches,divergences,last,recent:Object.freeze(recent.slice())});}
  function reset(){frames=0;comparisons=0;matches=0;divergences=0;last=null;recent.length=0;return snapshot();}

  const legacy=typeof root.updateCamera==='function'?root.updateCamera:null;
  if(typeof legacy!=='function'){
    root.KeloCameraFollowShadow=Object.freeze({version:VERSION,predict,snapshot,reset,installed:false});
    root.KELO_CAMERA_FOLLOW_SHADOW_AUDIT=Object.freeze({version:VERSION,installed:false,reason:'legacy-updateCamera-missing',authority:'legacy-only'});
    return;
  }

  // FOUNDATION-ALLOW: temporary read-only wrapper before KeloCamera captures legacy updateCamera; KeloCamera replaces the global owner immediately after boot.
  root.updateCamera=function(){
    frames++;
    const sampled=frames%SAMPLE_EVERY===0;
    const before=sampled?capture(arguments[0]):null;
    const expected=before?predict(before):null;
    const out=legacy.apply(this,arguments);
    if(expected)compare(expected,actual());
    return out;
  };

  root.KeloCameraFollowShadow=Object.freeze({version:VERSION,predict,snapshot,reset,installed:true});
  root.KELO_CAMERA_FOLLOW_SHADOW_AUDIT=Object.freeze({
    version:VERSION,installed:true,mode:'SHADOW',authority:'legacy-only',readOnly:true,sampleEvery:SAMPLE_EVERY,tolerance:TOLERANCE,
    noTimers:true,noListeners:true,noSecondLoop:true,get comparisons(){return comparisons;},get divergences(){return divergences;},snapshot
  });
})(typeof globalThis!=='undefined'?globalThis:window);
