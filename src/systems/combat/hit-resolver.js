/* KELO-INDEX
 * area: COMBAT
 * owner: KeloHitResolver
 * keys: HIT GEOMETRY RANGE CIRCLE SECTOR CONE SEGMENT CAPSULE RECTANGLE SWEPT
 * purpose: resuelve geometría pura reusable para melee, skillshots y validación server-compatible
 * public-api: point/distance/withinRange/withinCircle/withinSector/withinCone/segmentCircleHitT/withinCapsule/withinOrientedRect/sweptCircle/resolveMelee
 * state-owned: ninguno; todas las operaciones son puras
 * online: las mismas primitivas pueden ejecutarse client prediction y server authority
 * do-not: NO mutar HP/cooldowns/VFX/UI
 */
(function (root) {
  'use strict';
  const VERSION = 'hit-resolver-v2.0.0-action-combat';
  const EPS = 1e-7;

  function point(entity) { return { x:Number(entity && entity.x) || 0, y:Number(entity && entity.y) || 0 }; }
  function radiusOf(entity, fallback) { return Math.max(0, Number(entity && entity.radius) || Number(fallback) || 0); }
  function distance(a,b) { const p=point(a),q=point(b); return Math.hypot(p.x-q.x,p.y-q.y); }
  function normalize(value, fallback) {
    let x=Number(value&&value.x),y=Number(value&&value.y);
    if(!Number.isFinite(x)||!Number.isFinite(y)||Math.hypot(x,y)<EPS){x=Number(fallback&&fallback.x)||1;y=Number(fallback&&fallback.y)||0;}
    const len=Math.hypot(x,y)||1;return{x:x/len,y:y/len};
  }
  function clamp01(n){return Math.max(0,Math.min(1,n));}

  function withinRange(attacker,target,range) {
    const r=Math.max(0,Number(range)||0),d=distance(attacker,target);
    return Object.freeze({ hit:d<=r, distance:d, range:r, reason:d<=r?null:'OUT_OF_RANGE' });
  }

  function withinCircle(center,radius,target,targetRadius) {
    const r=Math.max(0,Number(radius)||0)+radiusOf(target,targetRadius),d=distance(center,target);
    return Object.freeze({hit:d<=r,distance:d,range:r,reason:d<=r?null:'OUT_OF_CIRCLE'});
  }

  function sectorMath(origin,direction,target,range,arcDegrees,targetRadius,forwardOffset) {
    const dir=normalize(direction),o=point(origin),off=Number(forwardOffset)||0;
    const cx=o.x+dir.x*off,cy=o.y+dir.y*off,t=point(target),tr=radiusOf(target,targetRadius);
    const dx=t.x-cx,dy=t.y-cy,d=Math.hypot(dx,dy),maxRange=Math.max(0,Number(range)||0)+tr;
    if(d>maxRange)return{hit:false,distance:d,range:maxRange,angleDegrees:180,reason:'OUT_OF_RANGE'};
    if(d<EPS)return{hit:true,distance:0,range:maxRange,angleDegrees:0,reason:null};
    const cos=Math.max(-1,Math.min(1,(dx*dir.x+dy*dir.y)/d));
    const angle=Math.acos(cos)*180/Math.PI;
    const padding=tr>0?Math.asin(Math.min(1,tr/Math.max(d,tr)))*180/Math.PI:0;
    const half=Math.max(0,Number(arcDegrees)||0)/2;
    const hit=angle<=half+padding;
    return{hit,distance:d,range:maxRange,angleDegrees:angle,reason:hit?null:'OUT_OF_ARC'};
  }
  function withinSector(origin,direction,target,range,arcDegrees,targetRadius,forwardOffset){return Object.freeze(sectorMath(origin,direction,target,range,arcDegrees,targetRadius,forwardOffset));}
  function withinCone(origin,direction,target,range,arcDegrees,targetRadius,forwardOffset){return withinSector(origin,direction,target,range,arcDegrees,targetRadius,forwardOffset);}

  function segmentCircleHitT(start,end,target,radius,targetRadius) {
    const a=point(start),b=point(end),c=point(target),r=Math.max(0,Number(radius)||0)+radiusOf(target,targetRadius);
    const dx=b.x-a.x,dy=b.y-a.y,fx=a.x-c.x,fy=a.y-c.y;
    const A=dx*dx+dy*dy;
    if(A<EPS)return fx*fx+fy*fy<=r*r?0:null;
    const C=fx*fx+fy*fy-r*r;if(C<=0)return 0;
    const B=2*(fx*dx+fy*dy),disc=B*B-4*A*C;if(disc<0)return null;
    const s=Math.sqrt(disc),t1=(-B-s)/(2*A),t2=(-B+s)/(2*A);
    if(t1>=0&&t1<=1)return t1;if(t2>=0&&t2<=1)return t2;return null;
  }

  function closestSegmentDistance(start,end,target) {
    const a=point(start),b=point(end),c=point(target),dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
    const t=den<EPS?0:clamp01(((c.x-a.x)*dx+(c.y-a.y)*dy)/den);
    const x=a.x+dx*t,y=a.y+dy*t;return{distance:Math.hypot(c.x-x,c.y-y),t,x,y};
  }
  function withinCapsule(start,end,radius,target,targetRadius) {
    const r=Math.max(0,Number(radius)||0)+radiusOf(target,targetRadius),q=closestSegmentDistance(start,end,target),hit=q.distance<=r;
    return Object.freeze({hit,distance:q.distance,radius:r,t:q.t,reason:hit?null:'OUT_OF_CAPSULE'});
  }

  function withinOrientedRect(origin,direction,length,width,target,targetRadius,forwardOffset) {
    const o=point(origin),dir=normalize(direction),right={x:-dir.y,y:dir.x},t=point(target),tr=radiusOf(target,targetRadius),off=Number(forwardOffset)||0;
    const dx=t.x-o.x,dy=t.y-o.y,localForward=dx*dir.x+dy*dir.y,localSide=dx*right.x+dy*right.y;
    const min=off-tr,max=off+Math.max(0,Number(length)||0)+tr,half=Math.max(0,Number(width)||0)/2+tr;
    const hit=localForward>=min&&localForward<=max&&Math.abs(localSide)<=half;
    return Object.freeze({hit,forward:localForward,side:localSide,length:Math.max(0,Number(length)||0),width:Math.max(0,Number(width)||0),reason:hit?null:'OUT_OF_RECT'});
  }

  function sweptCircle(start,end,movingRadius,target,targetRadius) {
    const hitT=segmentCircleHitT(start,end,target,movingRadius,targetRadius);
    return Object.freeze({hit:hitT!=null,t:hitT,reason:hitT!=null?null:'NO_SWEEP_HIT'});
  }

  function resolveMelee(attacker,target,direction,profile) {
    const p=profile||{},shape=String(p.hitShape||'range'),range=Math.max(0,Number(p.range)||0),tr=radiusOf(target,0);
    if(shape==='sector'||shape==='arc'||shape==='cone')return withinSector(attacker,direction,target,range,Number(p.arcDegrees)||90,tr,Number(p.forwardOffset)||0);
    if(shape==='circle')return withinCircle(attacker,range,target,tr);
    if(shape==='capsule'){
      const dir=normalize(direction),o=point(attacker),off=Number(p.forwardOffset)||0,start={x:o.x+dir.x*off,y:o.y+dir.y*off},end={x:start.x+dir.x*range,y:start.y+dir.y*range};
      return withinCapsule(start,end,Number(p.hitRadius)||18,target,tr);
    }
    if(shape==='rectangle'||shape==='oriented_rect')return withinOrientedRect(attacker,direction,range,Number(p.hitWidth)||60,target,tr,Number(p.forwardOffset)||0);
    return withinRange(attacker,target,range+tr);
  }

  root.KELO_HIT_RESOLVER_AUDIT={version:VERSION,ready:true,pure:true,gameplayMutation:false,aim360:true,shapes:['circle','sector','cone','segment','capsule','oriented_rect','swept_circle']};
  root.KeloHitResolver=Object.freeze({version:VERSION,point,distance,normalize,withinRange,withinCircle,withinSector,withinCone,segmentCircleHitT,withinCapsule,withinOrientedRect,sweptCircle,resolveMelee});
})(typeof globalThis !== 'undefined' ? globalThis : window);
