/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / DONOR REPAIR
 * owner: safe donor-frame recommendation for Frame Surgery
 * keys: SPRITE DONOR FRAME REPAIR COPY PIECE SILHOUETTE CANDIDATE
 * purpose: find the best healthy sibling frame to borrow a missing visual piece from before invoking generative repair
 * public-api: planDonorRepairCandidates
 * state-owned: none; pure QA metadata -> reviewable repair suggestions
 * online: N/A
 * do-not: overwrite frames automatically or claim a donor can reconstruct unseen anatomy
 */
const F=Object.freeze;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

export function planDonorRepairCandidates(frames=[],silhouetteAudit=null,diagnosis=null,{maxCandidates=12}={}){
  const byIndex=new Map((frames||[]).map(f=>[f.index,f])),silhouetteByIndex=new Map((silhouetteAudit?.frames||[]).map(x=>[x.index,x])),diagnosisByIndex=new Map((diagnosis?.frames||[]).map(x=>[x.index,x])),candidates=[];
  const targets=new Set([...(silhouetteAudit?.outliers||[]).map(x=>x.index),...(diagnosis?.defective||[]).map(x=>x.index)]);
  for(const index of targets){
    if(candidates.length>=Math.max(1,Math.floor(finite(maxCandidates,12))))break;
    const target=byIndex.get(index),sil=silhouetteByIndex.get(index),diag=diagnosisByIndex.get(index)||diagnosis?.defective?.find?.(x=>x.index===index);if(!target?.bounds)continue;
    const reasons=Array.from(new Set([...(diag?.reasons||[]),...(sil?.outlier?['silhouette-outlier']:[])]));
    const baselineIndex=sil?.baselineIndex,baseline=byIndex.get(baselineIndex);
    const siblings=(frames||[]).filter(frame=>frame?.bounds&&frame.index!==index&&(frame.row===target.row||frame.direction===target.direction));
    const healthy=siblings.filter(frame=>!(diagnosisByIndex.get(frame.index)?.reasons||[]).includes('clipped'));
    let donor=baseline?.bounds?baseline:null;
    if(!donor&&healthy.length){donor=healthy.slice().sort((a,b)=>{
      const score=x=>Math.abs(x.bounds.width-target.bounds.width)+Math.abs(x.bounds.height-target.bounds.height)+Math.abs((x.column??0)-(target.column??0))*2;return score(a)-score(b);
    })[0];}
    if(!donor)continue;
    const geometryOnly=reasons.length>0&&reasons.every(r=>['scale-outlier','occupancy-outlier','center-drift'].includes(r)),missingArtRisk=reasons.some(r=>['clipped','silhouette-outlier'].includes(r));
    candidates.push(F({
      targetIndex:index,donorIndex:donor.index,group:target.row??target.direction??null,reasons:F(reasons),
      mode:geometryOnly?'geometry-reference':'piece-donor-reference',autoApply:false,
      confidence:Number(Math.max(.35,Math.min(.95,1-(sil?.distance??.25))).toFixed(3)),
      targetBounds:F({...target.bounds}),donorBounds:F({...donor.bounds}),
      recommendation:missingArtRisk?'OPEN_FRAME_SURGERY_AND_COPY_ONLY_THE_MISSING_REGION':'USE_DONOR_AS_ALIGNMENT_REFERENCE',
      generativeFallback:missingArtRisk?'ONLY_IF_DONOR_REGION_IS_NOT_SEMANTICALLY_COMPATIBLE':null
    }));
  }
  return F({schema:'kelo-donor-repair-plan-v1',candidates:F(candidates),count:candidates.length,autoApplied:0});
}
