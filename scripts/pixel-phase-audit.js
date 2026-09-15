/* KELO-INDEX
 * area: RENDER
 * keys: AVATAR CAMERA PIXEL PHASE DPR ZOOM JITTER BENCHMARK CONTRACT
 * hace: compara redondeo world-space actual contra snap físico adaptativo y verifica el contrato LIVE
 * online: N/A; audit determinista de presentación cliente
 */
'use strict';
const fs=require('fs');

const appearance=fs.readFileSync('src/characters/character-appearance.js','utf8');
const requiredSource=[
  "adaptivePhysicalPixelSnap: true",
  "const rawDx=layout.footRootX-anchorX*scale",
  "if (z*dpr>=1)",
  "cameraApi.worldToScreen(rawDx,rawDy)",
  "pixelSnapMode='physical'",
  "worldPixelFallbackCount"
];
for(const token of requiredSource){if(!appearance.includes(token)) throw new Error('production pixel-phase contract missing: '+token);}

const viewports = [
  {name:'portrait-phone', w:390, h:844, dprs:[2,3]},
  {name:'landscape-phone', w:844, h:390, dprs:[2,3]},
  {name:'desktop-16x9', w:1920, h:1080, dprs:[1,2]}
];
const hzList=[60,90,120];
const mags=[0.48,0.70,1.0];
const dirs=[
  {name:'RIGHT',x:1,y:0},
  {name:'LEFT',x:-1,y:0},
  {name:'DIAGONAL',x:Math.SQRT1_2,y:Math.SQRT1_2}
];
const baseZoom=1;
const speedForMag=m=>{
  if(m<=0.04) return 0;
  if(m<0.7) return 110+(172-110)*Math.pow((m-0.04)/(0.70-0.04),1.15);
  return 172+(185.28-172)*((m-0.70)/(1-0.70));
};
const effectiveZoom=(w,h)=>w>=h?baseZoom*(h/w):baseZoom;
const phaseErr=physical=>Math.abs(physical-Math.round(physical));
const percentile=(arr,p)=>{const a=[...arr].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor((a.length-1)*p))]||0;};

function samplePolicy(rawWorld,cameraWorld,screenSpan,z,dpr,policy){
  const current=Math.round(rawWorld);
  if(policy==='A') return current;
  if(policy==='B') return rawWorld;
  const physicalScale=z*dpr;
  if(physicalScale < 1) return current;
  const css=(rawWorld-cameraWorld)*z+screenSpan/2;
  const snappedCss=Math.round(css*dpr)/dpr;
  return cameraWorld+(snappedCss-screenSpan/2)/z;
}

const metrics={A:[],B:[],C:[]};
for(const vp of viewports){
  const z=effectiveZoom(vp.w,vp.h);
  for(const dpr of vp.dprs){
    for(const hz of hzList){
      const dt=1/hz;
      for(const mag of mags){
        const speed=speedForMag(mag);
        for(const dir of dirs){
          let x=1400.37,y=1600.61;
          let camX=1400.11,camY=1600.19;
          for(let i=0;i<Math.round(hz*1.5);i++){
            x+=dir.x*speed*dt; y+=dir.y*speed*dt;
            camX+=(x-camX)*0.08; camY+=(y-camY)*0.08;
            for(const policy of ['A','B','C']){
              const dx=samplePolicy(x-18.37,camX,vp.w,z,dpr,policy);
              const dy=samplePolicy(y-72.43,camY,vp.h,z,dpr,policy);
              const sx=(dx-camX)*z+vp.w/2;
              const sy=(dy-camY)*z+vp.h/2;
              const err=Math.hypot(phaseErr(sx*dpr),phaseErr(sy*dpr));
              const rawSx=((x-18.37)-camX)*z+vp.w/2;
              const rawSy=((y-72.43)-camY)*z+vp.h/2;
              const positionError=Math.hypot(sx-rawSx,sy-rawSy);
              metrics[policy].push({err,positionError,physicalScale:z*dpr,vp:vp.name,dpr,hz,mag,dir:dir.name});
            }
          }
        }
      }
    }
  }
}

function summarize(rows){
  return {
    phaseP95:+percentile(rows.map(r=>r.err),0.95).toFixed(4),
    phaseMax:+Math.max(...rows.map(r=>r.err)).toFixed(4),
    positionErrorP95Css:+percentile(rows.map(r=>r.positionError),0.95).toFixed(4),
    positionErrorMaxCss:+Math.max(...rows.map(r=>r.positionError)).toFixed(4)
  };
}
const out={A_CURRENT:summarize(metrics.A),B_RAW:summarize(metrics.B),C_ADAPTIVE_PHYSICAL:summarize(metrics.C)};
const highDprA=metrics.A.filter(r=>r.physicalScale>=1);
const highDprC=metrics.C.filter(r=>r.physicalScale>=1);
out.highDprCurrent=summarize(highDprA);
out.highDprAdaptive=summarize(highDprC);
out.lowScaleFallbackSamples=metrics.C.filter(r=>r.physicalScale<1).length;
out.productionContractVerified=true;
console.log(JSON.stringify(out,null,2));

if(!(out.C_ADAPTIVE_PHYSICAL.phaseP95 < out.A_CURRENT.phaseP95)) throw new Error('adaptive snap did not improve global physical pixel phase P95');
if(!(out.highDprAdaptive.phaseP95 < out.highDprCurrent.phaseP95)) throw new Error('adaptive snap did not reduce physical pixel phase error where physicalScale>=1');
if(out.C_ADAPTIVE_PHYSICAL.positionErrorMaxCss > out.A_CURRENT.positionErrorMaxCss + 0.001) throw new Error('adaptive snap worsened max CSS position error');
if(out.lowScaleFallbackSamples<1) throw new Error('audit did not exercise low-scale world-rounding fallback');
console.log('PIXEL_PHASE_AUDIT_OK');
