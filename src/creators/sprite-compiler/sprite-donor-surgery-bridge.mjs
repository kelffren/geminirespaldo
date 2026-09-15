/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / DONOR SURGERY BRIDGE
 * owner: deterministic handoff from compiler QA to Frame Surgery
 * keys: SPRITE DONOR SURGERY GHOST COPY REGION ESCALATION
 * purpose: turn runtime frame QA into a reviewable donor suggestion and safe selected-region overlay spec
 * public-api: buildDonorSurgeryPlanFromPixels, buildDonorSurgeryPlan, donorCandidateFor, donorOverlaySpec
 * state-owned: none; pure evidence -> non-destructive authoring suggestion
 * online: N/A
 * do-not: auto-replace a whole frame, invent missing pixels, or bypass review gates
 */
import {analyzeGridCells} from './sprite-compiler-core.mjs';
import {auditSilhouetteConsistency} from './sprite-silhouette-consistency.mjs';
import {planDonorRepairCandidates} from './sprite-donor-repair.mjs';

const F=Object.freeze;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));

export function donorCandidateFor(plan,index){
  const target=Number(index);
  return plan?.donorPlan?.candidates?.find?.(item=>Number(item.targetIndex)===target)||plan?.candidates?.find?.(item=>Number(item.targetIndex)===target)||null;
}

export function donorOverlaySpec(candidate,selection,{z=0,name=null}={}){
  if(!candidate||!Number.isInteger(Number(candidate.donorIndex)))return F({ok:false,reason:'DONOR_REQUIRED'});
  if(!selection||!(Number(selection.w)>0)||!(Number(selection.h)>0))return F({ok:false,reason:'SELECTION_REQUIRED',donorIndex:Number(candidate.donorIndex)});
  const rect=F({x:clamp(selection.x),y:clamp(selection.y),w:clamp(selection.w,.001,1),h:clamp(selection.h,.001,1)});
  return F({
    ok:true,
    overlay:F({
      kind:'frame',
      name:String(name||`DONOR FRAME ${Number(candidate.donorIndex)+1}`).slice(0,48),
      sourceFrame:Number(candidate.donorIndex),
      sourceRect:rect,
      frameRect:rect,
      x:0,y:0,scale:1,rotation:0,opacity:1,visible:true,locked:false,z:Math.floor(Number(z)||0),cutoutOriginal:false
    }),
    targetIndex:Number(candidate.targetIndex),
    donorIndex:Number(candidate.donorIndex),
    reversible:true,
    scope:'selected-region-only'
  });
}

export function buildDonorSurgeryPlanFromPixels(sourceData,width,height,{columns=1,rows=1,frameCounts=null,frameDoctor=null,outlierThreshold=.48,maxCandidates=12}={}){
  const data=sourceData?.data||sourceData;
  width=Math.max(1,Math.round(Number(width)||0));height=Math.max(1,Math.round(Number(height)||0));
  columns=Math.max(1,Math.round(Number(columns)||1));rows=Math.max(1,Math.round(Number(rows)||1));
  if(!data||data.length<width*height*4)throw new Error('DONOR_SURGERY_PIXELS_REQUIRED');
  const all=analyzeGridCells(data,width,height,{columns,rows,alphaThreshold:18});
  const counts=Array.isArray(frameCounts)&&frameCounts.length===rows?frameCounts.map(v=>Math.max(0,Math.min(columns,Math.round(Number(v)||0)))):new Array(rows).fill(columns);
  const frames=all.filter(frame=>frame.column<(counts[frame.row]??columns));
  const silhouette=auditSilhouetteConsistency(data,width,height,frames,{sampleSize:24,alphaThreshold:18,outlierThreshold,groupBy:'row'});
  const donorPlan=planDonorRepairCandidates(frames,silhouette,frameDoctor,{maxCandidates});
  const actionable=donorPlan.candidates.map(candidate=>F({...candidate,ghostRecommended:true,copyRequiresSelection:candidate.mode!=='geometry-reference',escalation:candidate.generativeFallback?'DONOR_THEN_GENERATIVE':'MECHANICAL_OR_DONOR'}));
  return F({
    schema:'kelo-donor-surgery-bridge-v1',
    silhouette,
    donorPlan:F({...donorPlan,candidates:F(actionable)}),
    candidateCount:actionable.length,
    targetIndexes:F(actionable.map(x=>x.targetIndex)),
    policy:F({autoReplaceWholeFrame:false,ghostAutoPreview:true,copySelectedRegionOnly:true,generativeLast:true})
  });
}

export function buildDonorSurgeryPlan(compiled,options={}){
  const canvas=compiled?.canvas;if(!canvas?.getContext)throw new Error('DONOR_SURGERY_COMPILED_CANVAS_REQUIRED');
  const width=Math.max(1,Math.round(Number(compiled.width||canvas.width)||0)),height=Math.max(1,Math.round(Number(compiled.height||canvas.height)||0));
  const ctx=canvas.getContext('2d',{willReadFrequently:true}),pixels=ctx.getImageData(0,0,width,height);
  return buildDonorSurgeryPlanFromPixels(pixels.data,width,height,{
    columns:compiled.columns,rows:compiled.rows,frameCounts:compiled.frameCounts,
    frameDoctor:compiled.frameDoctor||compiled.validation?.frameDoctor||null,...options
  });
}
