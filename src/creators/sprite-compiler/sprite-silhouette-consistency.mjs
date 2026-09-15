/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / SILHOUETTE CONSISTENCY
 * owner: normalized cross-frame shape QA
 * keys: SPRITE SILHOUETTE MASK JACCARD MEDOID OUTLIER FRAME CONSISTENCY ASPECT FOOT ANCHOR
 * purpose: detect AI frames whose body mass changes implausibly after removing translation and uniform scale differences
 * public-api: normalizedFrameMask, silhouetteDistance, auditSilhouetteConsistency
 * state-owned: none; pure pixels/frames -> QA
 * online: N/A
 * do-not: auto-redraw anatomy, non-uniformly stretch masks, or treat normal pose changes as guaranteed defects
 */
const F=Object.freeze;
const raw=data=>data?.data||data;
function assertPixels(data,width,height){const p=raw(data);if(!p||p.length<width*height*4)throw new Error('SPRITE_SILHOUETTE_PIXELS_REQUIRED');return p;}
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export function normalizedFrameMask(sourceData,width,height,bounds,{sampleSize=24,alphaThreshold=12,padding=1}={}){
  const data=assertPixels(sourceData,width,height),size=Math.max(8,Math.min(64,Math.floor(sampleSize||24))),mask=new Uint8Array(size*size);
  if(!bounds?.width||!bounds?.height)return F({size,mask,occupancy:0,scale:1,projectedWidth:0,projectedHeight:0});
  const inner=Math.max(2,size-Math.max(0,Math.min(size-2,Math.floor(padding||0)))*2),scale=inner/Math.max(bounds.width,bounds.height),projectedWidth=bounds.width*scale,projectedHeight=bounds.height*scale;
  const x0=(size-projectedWidth)/2,y0=size-Math.max(0,Math.floor(padding||0))-projectedHeight;
  let filled=0;
  for(let sy=0;sy<size;sy++)for(let sx=0;sx<size;sx++){
    const localX=(sx+.5-x0)/scale,localY=(sy+.5-y0)/scale;
    if(localX<0||localY<0||localX>=bounds.width||localY>=bounds.height)continue;
    const px=clamp(Math.floor(bounds.x+localX),0,width-1),py=clamp(Math.floor(bounds.y+localY),0,height-1),a=data[(py*width+px)*4+3];
    if(a>alphaThreshold){mask[sy*size+sx]=1;filled++;}
  }
  return F({size,mask,occupancy:filled/(size*size),scale:Number(scale.toFixed(5)),projectedWidth:Number(projectedWidth.toFixed(3)),projectedHeight:Number(projectedHeight.toFixed(3)),anchor:'bottom-center',preserveAspectRatio:true});
}

export function silhouetteDistance(a,b){
  const am=a?.mask||a,bm=b?.mask||b;if(!am||!bm||am.length!==bm.length)return 1;
  let intersection=0,union=0;for(let i=0;i<am.length;i++){const av=!!am[i],bv=!!bm[i];if(av&&bv)intersection++;if(av||bv)union++;}
  return union?1-intersection/union:0;
}

export function auditSilhouetteConsistency(sourceData,width,height,frames,{sampleSize=24,alphaThreshold=12,outlierThreshold=.48,groupBy='row'}={}){
  const data=assertPixels(sourceData,width,height),usable=(frames||[]).filter(f=>f?.bounds),groups=new Map();
  for(const frame of usable){const key=groupBy==='all'?'all':String(frame?.[groupBy]??frame?.row??0);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(frame);}
  const results=[],groupReports=[];
  for(const [groupKey,items] of groups){
    const prepared=items.map(frame=>({frame,normalized:normalizedFrameMask(data,width,height,frame.bounds,{sampleSize,alphaThreshold})}));
    if(prepared.length===1){const only=prepared[0];results.push(F({index:only.frame.index,group:groupKey,baselineIndex:only.frame.index,distance:0,outlier:false,occupancy:only.normalized.occupancy}));groupReports.push(F({group:groupKey,baselineIndex:only.frame.index,count:1,maxDistance:0}));continue;}
    let medoid=prepared[0],best=Infinity;
    for(const candidate of prepared){let sum=0;for(const other of prepared)if(other!==candidate)sum+=silhouetteDistance(candidate.normalized,other.normalized);const avg=sum/Math.max(1,prepared.length-1);if(avg<best){best=avg;medoid=candidate;}}
    let maxDistance=0;
    for(const item of prepared){const distance=silhouetteDistance(item.normalized,medoid.normalized);maxDistance=Math.max(maxDistance,distance);results.push(F({index:item.frame.index,group:groupKey,baselineIndex:medoid.frame.index,distance:Number(distance.toFixed(4)),outlier:distance>outlierThreshold,occupancy:Number(item.normalized.occupancy.toFixed(4)),projectedWidth:item.normalized.projectedWidth,projectedHeight:item.normalized.projectedHeight}));}
    groupReports.push(F({group:groupKey,baselineIndex:medoid.frame.index,count:prepared.length,maxDistance:Number(maxDistance.toFixed(4)),meanPeerDistance:Number(best.toFixed(4))}));
  }
  const outliers=results.filter(x=>x.outlier);
  return F({schema:'kelo-silhouette-consistency-v1.1-aspect-safe',sampleSize,outlierThreshold,normalization:'uniform-scale-bottom-center',groups:F(groupReports),frames:F(results),outliers:F(outliers),outlierCount:outliers.length,pass:outliers.length===0});
}
