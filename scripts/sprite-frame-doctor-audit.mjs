import assert from 'node:assert/strict';
import {diagnoseSpriteFrames,buildSelectiveRepairTargets,replaceAtlasFramePixels} from '../src/creators/sprite-compiler/sprite-frame-doctor.mjs';
import {planLocalFrameGeometryRepairs} from '../src/creators/sprite-compiler/sprite-frame-geometry-repair.mjs';

const mk=(index,row,column,{w=20,h=28,pixels=360,clipped=false,dx=0}={})=>Object.freeze({index,row,column,pixels,edgePixels:clipped?4:0,clipped,cell:Object.freeze({x:column*32,y:row*32,width:32,height:32}),bounds:Object.freeze({x:column*32+6+dx,y:row*32+2,width:w,height:h,right:column*32+5+dx+w,bottom:row*32+29})});
const frames=[];for(let r=0;r<8;r++)for(let c=0;c<4;c++)frames.push(mk(r*4+c,r,c));
frames[6]=mk(6,1,2,{w:8,h:11,pixels:70});
frames[17]=mk(17,4,1,{clipped:true});
frames[28]=mk(28,7,0,{dx:7});

const diagnosis=diagnoseSpriteFrames(frames,{columns:4});
assert.equal(diagnosis.total,32);
assert.equal(diagnosis.defectiveCount,3);
assert.deepEqual(diagnosis.defective.map(x=>x.index).sort((a,b)=>a-b),[6,17,28]);
assert.ok(diagnosis.frames[6].reasons.includes('scale-outlier'));
assert.ok(diagnosis.frames[17].reasons.includes('clipped'));
assert.ok(diagnosis.frames[28].reasons.includes('center-drift'));
const targets=buildSelectiveRepairTargets(diagnosis,{maxTargets:2});
assert.equal(targets.length,2);
assert.equal(targets[0].index,17);
const localPlan=planLocalFrameGeometryRepairs(frames,diagnosis,{maxRepairs:8});
assert.deepEqual(localPlan.operations.map(x=>x.index).sort((a,b)=>a-b),[6,28]);
assert.deepEqual(localPlan.skipped.map(x=>x.index),[17]);

const W=8,H=4,C=2,R=1,atlas=new Uint8ClampedArray(W*H*4);
for(let i=0;i<atlas.length;i+=4){atlas[i]=10;atlas[i+1]=20;atlas[i+2]=30;atlas[i+3]=255;}
const rep=new Uint8ClampedArray(4*4*4);
for(let i=0;i<rep.length;i+=4){rep[i]=200;rep[i+1]=1;rep[i+2]=2;rep[i+3]=255;}
const patched=replaceAtlasFramePixels({atlasData:atlas,width:W,height:H,columns:C,rows:R,index:1,replacementData:rep,replacementWidth:4,replacementHeight:4});
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;if(x<4){assert.equal(patched.data[i],10);assert.equal(patched.data[i+1],20);}else{assert.equal(patched.data[i],200);assert.equal(patched.data[i+1],1);}}

console.log(JSON.stringify({ok:true,total:diagnosis.total,defective:diagnosis.defective.map(x=>({index:x.index,label:x.label,reasons:x.reasons})),selectiveTargets:targets.map(x=>x.index),localGeometryRepairs:localPlan.operations.map(x=>x.index),manualTargets:localPlan.skipped.map(x=>x.index),healthyPixelsPreserved:true}));
