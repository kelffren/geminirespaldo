(function(){
'use strict';
const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAUAAAACACAYAAAB6D7CqAAADxElEQVR42u3dT4iMYRwH8HcRYinCHtiWEBZJcZAikloUF7nsSSklf3KS5IDkIPmTUsrJRetAyZZCtvwp/w5YYjfWclg2iqVssU7U7MxYs7PvzvvM+/ncdmZ6Z+b3zPPd5/fMOzNRBAAAAAAAAAAAAAAAAAAAAAAAAAAMtgol6J/mhpU9vS+r3XhDPSEgQ5QAEIAAAhBAAAIIQAABCCAAAQQgQLCcuPufcp343BcnRoMVIIAABEiSYUqQW3vzpYyW9+uzk0Ufo7p2g5YYrAABBGDw7q1qjO6talQI0AKXrzFzdxR1PWAFCCAAAQQggAAEEIAAAhAgTk6D6eXJ3fM9cR97/pJ6nwgBK0AAAQggAAEGS+r3ALu/PMm559fxrnXA72vW3AU573P42Pn2BMEKEEAAAoTbAncduJLVWlbuXxdMq1c1Zfr/3fBngbcPROjjByUNwHy+P96UNbFGLbxgYgXC+KEFBhCAAAIQIDix7QFW7l9XUbt3yd/9oubDd+0TBcT4IQBjsKjhbVROk6p+6MtUvWDKbfwQgGXt3Ocfeb/dZfO4ERUeJwjAonW0XM2awCvOHcy6Ptdlf1TNWGOil4jxI428CQKk1oD9x861gihUKVYQ+b4MYTAl4csQQh0/sAIEEIAAAhCgTwO+Z3No6/KC95L2nblVsr0je4Bhjx9YAQIIQAABCCAAAfJJxGeBuzof9qR5EJL0/I/v221WIADToru7O+Pv16+ex36f02bO8coDLTCAAAQIrwVuajyVsX/VdPliwcdYc/tXYgpyelL895Gk59vbanMCAdh/uw4dC2ayk+1a3dGsy64uzWwUHt2/k3mDM7cUDi0wQKpXgKHb9mGWIoAAjMf4qdWqnnCf3rQrAgKQ/LbPrsp5+akXHYoDAlCwCHBINm+CAFaAFMZKCQSgYBHgoAUGsAJMCJv8QGoDMC0EPWiBAawArYAALXBKCHoQgBBFURR967z/z99X2dI2UZES7mzNx39eP3rC4opgA9AH7YGk8CYIIAAB0sYeIEFrbDjSowrpHvO6jXv6vScYewD2/j0JAC0wgAAEKA17gKRKX+eYIQCLkvWbsQBaYAABCFCeLTAkyfv2tqAff9fTE0Ufo3LezqBrMLm6JrkBuKxue8ZJiDXrF6027cpb2+UH11QBLTCAAAQQgADB8CYIZaXp5vWyej5VA3CM1paWoGsQ5+MXgJBgHSPXKoIWGEAAAmiBIYqK+zJMsAIEBCCAAAQQgAACEAAAAAAAAAAAAAAAAAAAAAAAAAAAAIBi/AZKGvW/SITt9QAAAABJRU5ErkJggg==';
const atlas=Object.freeze({id:'gardens-landmark-v1',width:320,height:128,tileSize:32,columns:10,mode:'layered-prefab-atlas-v1'});
const landmark=Object.freeze({id:'east-fountain',x:1696,y:2432,w:160,h:128,baseY:2536,frontSourceX:160});
if(typeof ctx==='undefined'||typeof renderAvatar!=='function'||!window.KeloRender||typeof window.KeloRender.afterFrame!=='function'){console.error('[Kelo gardens landmark] KeloRender hook unavailable');return;}
const img=new Image();let ready=false,failed=false;
const audit=window.KELO_GARDEN_LANDMARK_AUDIT={version:'gardens-landmark-v1.2-kelo-render-hook',ready:false,assetLoaded:false,failed:false,atlasMode:atlas.mode,atlasWidth:atlas.width,atlasHeight:atlas.height,prefabCount:1,renderMode:'kelo-render-after-frame-composite-v1',renderWrapped:true,wrapperRetired:true,hookRegistered:false,hookId:null,frontOcclusionActive:false,landmarkId:landmark.id,lastActorRedraws:0,lastFrontActorRedraws:0};
function sync(){audit.ready=ready&&!failed&&audit.hookRegistered}
function drawBack(g){if(!ready)return false;g.drawImage(img,0,0,landmark.w,landmark.h,landmark.x,landmark.y,landmark.w,landmark.h);return true}
function overlaps(p){if(!p)return false;const r=p.radius||20;return p.x+r>landmark.x-12&&p.x-r<landmark.x+landmark.w+12&&p.y+r>landmark.y-12&&p.y-r<landmark.y+landmark.h+28}
function inFront(p){return !!p&&(p.y||0)>=landmark.baseY}
function drawFront(g){if(!ready)return false;g.drawImage(img,landmark.frontSourceX,0,landmark.w,landmark.h,landmark.x,landmark.y,landmark.w,landmark.h);return true}
img.onload=()=>{if(img.naturalWidth!==atlas.width||img.naturalHeight!==atlas.height){failed=true;audit.failed=true;console.error('[Kelo gardens landmark] invalid atlas dimensions',img.naturalWidth,img.naturalHeight);sync();return}ready=true;audit.assetLoaded=true;sync()};
img.onerror=()=>{failed=true;audit.failed=true;console.error('[Kelo gardens landmark] atlas load failed');sync()};img.src=src;
function drawComposite(frame){
  if(!ready||typeof camera==='undefined'||typeof screenW==='undefined'||typeof screenH==='undefined')return;
  const g=frame&&frame.ctx?frame.ctx:ctx,actors=[];
  if(typeof localPlayer!=='undefined'&&localPlayer)actors.push(localPlayer);
  if(typeof simulatedPlayers!=='undefined'&&Array.isArray(simulatedPlayers))actors.push(...simulatedPlayers);
  if(typeof isPvPActive!=='undefined'&&isPvPActive&&typeof arenaPvP!=='undefined'&&arenaPvP?.rival)actors.push(arenaPvP.rival);
  const near=actors.filter(overlaps).sort((a,b)=>(a.y||0)-(b.y||0));
  const z=(typeof CONFIG!=='undefined'&&CONFIG.zoom)||1;
  g.save();g.translate(screenW/2,screenH/2);g.scale(z,z);g.translate(-camera.x,-camera.y);g.imageSmoothingEnabled=false;
  drawBack(g);
  for(const actor of near)renderAvatar(actor,actor===localPlayer);
  drawFront(g);
  let frontRedraws=0;
  for(const actor of near){if(inFront(actor)){renderAvatar(actor,actor===localPlayer);frontRedraws++;}}
  g.restore();
  audit.lastActorRedraws=near.length;audit.lastFrontActorRedraws=frontRedraws;
  audit.frontOcclusionActive=near.some(a=>!inFront(a));sync();
}
audit.hookId=window.KeloRender.afterFrame('gardens-landmark',drawComposite,40);
audit.hookRegistered=!!audit.hookId;sync();
window.KELO_GARDEN_LANDMARK=Object.freeze({drawBack,drawFront,landmark,atlas,get ready(){return audit.ready},get failed(){return failed}});
})();
