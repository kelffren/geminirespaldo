/* KELO-INDEX
 * area: AUDIT / CREATORS IMAGE TREATMENT
 * owner: deterministic Image Treatment Engine audit
 * purpose: verifies alpha safety, transparent-RGB cleanup, halo repair and edge-aware illustration denoise
 */
import assert from 'node:assert/strict';
import {analyzeImagePixels,resolveImageTreatmentProfile,treatImagePixels} from '../src/creators/core/image-treatment-engine.mjs';

const make=(w,h,r=0,g=0,b=0,a=0)=>{const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<data.length;i+=4){data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=a;}return data;};
const set=(data,w,x,y,r,g,b,a)=>{const i=(y*w+x)*4;data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=a;};
const get=(data,w,x,y)=>{const i=(y*w+x)*4;return Array.from(data.slice(i,i+4));};

// Hidden RGB must be cleaned without changing alpha or visible pixel content in pixel-art mode.
{
  const w=3,h=3,data=make(w,h,80,40,20,255);set(data,w,0,0,245,231,219,0);const beforeVisible=get(data,w,1,1);
  const result=treatImagePixels(data,w,h,{profile:'pixel-art'});
  assert.deepEqual(get(result.data,w,0,0),[0,0,0,0]);
  assert.deepEqual(get(result.data,w,1,1),beforeVisible);
  assert.equal(result.report.operations.transparentRgbSanitized,1);
  assert.equal(result.report.alphaPreserved,true);
  assert.equal(result.report.operations.denoisedPixels,0);
}

// A bright fringe pixel surrounded by opaque dark interior should inherit interior RGB, never alpha.
{
  const w=3,h=3,data=make(w,h,30,36,44,255);set(data,w,1,1,245,245,245,128);
  const result=treatImagePixels(data,w,h,{profile:'sprite',haloThreshold:30,interiorAlpha:220});
  const center=get(result.data,w,1,1);
  assert.deepEqual(center,[30,36,44,128]);
  assert.equal(result.report.operations.haloPixelsRepaired,1);
  assert.equal(result.report.alphaPreserved,true);
}

// Illustration denoise must reduce a small in-surface color fluctuation while preserving a hard edge.
{
  const w=7,h=5,data=make(w,h,96,100,104,255);
  for(let y=0;y<h;y++)for(let x=4;x<w;x++)set(data,w,x,y,205,208,212,255);
  set(data,w,2,2,116,87,111,255);
  const result=treatImagePixels(data,w,h,{profile:'illustration',denoiseStrength:.55,colorSigma:38,sharpenStrength:0});
  const noisyBefore=[116,87,111],noisyAfter=get(result.data,w,2,2).slice(0,3);
  const beforeDistance=Math.hypot(...noisyBefore.map((v,i)=>v-[96,100,104][i]));
  const afterDistance=Math.hypot(...noisyAfter.map((v,i)=>v-[96,100,104][i]));
  assert.ok(afterDistance<beforeDistance,`denoise did not reduce local noise: ${beforeDistance} -> ${afterDistance}`);
  const hardEdge=get(result.data,w,4,2).slice(0,3);assert.ok(hardEdge[0]>190,'hard edge was blurred across regions');
  assert.equal(result.report.alphaPreserved,true);
  assert.ok(result.report.operations.denoisedPixels>0);
}

// Analyzer/profile resolver remain deterministic and explicit profiles never auto-switch.
{
  const data=make(8,8,0,0,0,0);for(let y=2;y<6;y++)for(let x=2;x<6;x++)set(data,8,x,y,40,70,110,255);
  const a=analyzeImagePixels(data,8,8);assert.equal(a.width,8);assert.equal(a.height,8);assert.ok(['sprite','pixel-art','illustration','ui'].includes(a.suggestedProfile));
  assert.equal(resolveImageTreatmentProfile('sprite',a).name,'sprite');
  assert.equal(resolveImageTreatmentProfile('illustration',a).name,'illustration');
}

console.log(JSON.stringify({ok:true,engine:'image-treatment-v1.0.0',checks:['transparent-rgb','alpha-preservation','halo-repair','edge-aware-denoise','profile-resolution']}));
