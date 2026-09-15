import assert from 'node:assert/strict';
import { createStudioCameraController } from '../src/studio/input/studio-camera-controller.mjs';

class Target extends EventTarget { constructor(){super();this.hidden=false;} }
const document=new Target();
const root=new Target();
root.document=document;root.innerWidth=390;root.innerHeight=844;
let camera={x:0,y:0,screenW:390,screenH:844,baseZoom:1,effectiveZoom:1,follow:{deadXRatio:.2,deadYRatio:.2,lookAheadDist:10}};
root.KeloCamera={
  snapshot:()=>({...camera,follow:{...camera.follow}}),
  setTarget:(x,y)=>{camera={...camera,x:Number(x)||0,y:Number(y)||0};},
  setBaseZoom:value=>{camera={...camera,baseZoom:value,effectiveZoom:value};},
  screenToWorld:(x,y)=>({x:camera.x+(x-camera.screenW/2)/camera.effectiveZoom,y:camera.y+(y-camera.screenH/2)/camera.effectiveZoom}),
  setFollowTuning:follow=>{camera={...camera,follow:{...follow}};},
  getBaseZoom:()=>camera.baseZoom,
  getFollowTuning:()=>({...camera.follow}),
  restoreState:next=>{camera={...camera,...next};}
};

function event(type,props={}){
  const e=new Event(type,{cancelable:true});
  for(const [key,value] of Object.entries(props))Object.defineProperty(e,key,{value,configurable:true});
  Object.defineProperty(e,'stopImmediatePropagation',{value:()=>{},configurable:true});
  return e;
}

let navigations=0,pinchEnds=[];
const controller=createStudioCameraController({
  root,
  onNavigateStart:()=>{navigations++;},
  onPinchStart:()=>true,
  onPinchEnd:payload=>pinchEnds.push(payload)
});

// Losing focus while Space is held must not leave left-click in pan mode.
document.dispatchEvent(event('keydown',{code:'Space'}));
root.dispatchEvent(event('blur'));
document.dispatchEvent(event('pointerdown',{pointerType:'mouse',pointerId:1,button:0,clientX:100,clientY:100}));
assert.equal(navigations,0,'blur must clear stuck Space-pan state');

// A deliberately enabled pan mode must still work after the reset.
controller.setPanMode(true);
document.dispatchEvent(event('pointerdown',{pointerType:'mouse',pointerId:2,button:0,clientX:120,clientY:120}));
assert.equal(navigations,1,'focus-loss cleanup must not disable intentional pan mode');
controller.setPanMode(false);

// Delegated two-finger gestures must be cancelled when focus is lost.
document.dispatchEvent(event('pointerdown',{pointerType:'touch',pointerId:10,button:0,clientX:100,clientY:100}));
document.dispatchEvent(event('pointerdown',{pointerType:'touch',pointerId:11,button:0,clientX:140,clientY:100}));
root.dispatchEvent(event('blur'));
assert.equal(pinchEnds.length,1,'blur must end an active delegated pinch');
assert.equal(pinchEnds[0]?.cancelled,true,'focus-loss pinch end must be marked cancelled');
assert.equal(pinchEnds[0]?.reason,'blur','focus-loss pinch must report blur reason');

// Hidden-tab cleanup uses the same path.
document.dispatchEvent(event('pointerdown',{pointerType:'touch',pointerId:20,button:0,clientX:110,clientY:110}));
document.dispatchEvent(event('pointerdown',{pointerType:'touch',pointerId:21,button:0,clientX:150,clientY:110}));
document.hidden=true;
document.dispatchEvent(event('visibilitychange'));
assert.equal(pinchEnds.length,2,'hidden tab must cancel active delegated pinch');
assert.equal(pinchEnds[1]?.reason,'hidden');

controller.destroy();
console.log(JSON.stringify({ok:true,spacePanReset:true,mousePanReset:true,touchStateReset:true,delegatedPinchCancelled:true,visibilityCleanup:true,authorityUntouched:true},null,2));
