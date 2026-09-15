/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / FRAME NORMALIZATION
 * owner: lossless frame canvas, scale, center, foot-anchor and Frame Surgery composition
 * keys: SPRITE NORMALIZE CANVAS SCALE CENTER FOOT ANCHOR SURGERY ROTATE MASK OVERLAY CROP CLONE FILL PIXEL-PERFECT BRIDGE
 * purpose: repack detected frames into runtime atlas and apply reversible per-frame surgery patches
 * public-api: planSpriteFrameNormalization, normalizeSpriteFrameGroups
 * consumes: sprite foreground pixels + resolved sprite rig groups + optional non-destructive frame patches
 * state-owned: none; deterministic pixels/layout -> runtime canvas and metrics
 * online: N/A
 * do-not: detect layouts, assign semantics, persist content or mutate source pixels
 */
import {normalizeSurgeryPatch} from './sprite-frame-surgery-model.mjs';

const F = Object.freeze;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = (sorted.length - 1) / 2;
  return (sorted[Math.floor(middle)] + sorted[Math.ceil(middle)]) / 2;
};
const cv = values => {
  if (values.length < 2) return 0;
  const average = mean(values);
  return average ? Math.sqrt(mean(values.map(value => (value - average) ** 2))) / average : 1;
};

function frameBounds(frame) {
  const bounds = frame?.bounds;
  if (!bounds) return null;
  const w = Math.max(1, Number(bounds.w ?? bounds.width) || 1);
  const h = Math.max(1, Number(bounds.h ?? bounds.height) || 1);
  return {x: Number(bounds.x) || 0, y: Number(bounds.y) || 0, w, h};
}
function sourceRect(frame, bounds, width, height) {
  const source = frame?.sourceRect || bounds;
  const x = clamp(Math.floor(source.x), 0, width - 1), y = clamp(Math.floor(source.y), 0, height - 1);
  const right = clamp(Math.ceil(source.x + (source.w ?? source.width)), x + 1, width);
  const bottom = clamp(Math.ceil(source.y + (source.h ?? source.height)), y + 1, height);
  return {x, y, w: right - x, h: bottom - y};
}
function cropSourceRect(source, crop, width, height) {
  const left = source.w * Number(crop?.left || 0), right = source.w * Number(crop?.right || 0);
  const top = source.h * Number(crop?.top || 0), bottom = source.h * Number(crop?.bottom || 0);
  const x0 = clamp(Math.floor(source.x + left), 0, width - 1), y0 = clamp(Math.floor(source.y + top), 0, height - 1);
  const x1 = clamp(Math.ceil(source.x + source.w - right), x0 + 1, width), y1 = clamp(Math.ceil(source.y + source.h - bottom), y0 + 1, height);
  return {x:x0, y:y0, w:x1-x0, h:y1-y0};
}
function percentile(values, q) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.round(clamp(q) * (sorted.length - 1))];
}
function spread(values) { return values.length ? Math.max(...values) - Math.min(...values) : 0; }
function sourceMetrics(groups) {
  const frames = groups.flat().filter(frame => frameBounds(frame));
  const heights = frames.map(frame => frameBounds(frame).h), widths = frames.map(frame => frameBounds(frame).w);
  const areas = frames.map(frame => Number(frame.area) || frameBounds(frame).w * frameBounds(frame).h);
  const feetOffsets = groups.flatMap(group => {
    const feet = group.map(frame => { const bounds = frameBounds(frame); return bounds ? bounds.y + bounds.h : null; }).filter(Number.isFinite);
    const center = median(feet); return feet.map(value => Math.abs(value - center));
  });
  const centerOffsets = frames.map(frame => {
    const bounds = frameBounds(frame), cell = frame.cell; if (!cell) return 0;
    const cellWidth = Number(cell.w ?? cell.width) || 1;
    return Math.abs((bounds.x + bounds.w / 2) - (Number(cell.x) + cellWidth / 2)) / cellWidth;
  });
  return {heightVariation:cv(heights),widthVariation:cv(widths),visualScaleVariation:cv(areas.map(Math.sqrt)),
    footAnchorDispersionPx:feetOffsets.length?Math.max(...feetOffsets):0,footAnchorDispersion:median(heights)?mean(feetOffsets)/median(heights):0,
    centerDrift:mean(centerOffsets),clippingFrames:frames.filter(frame=>frame.touchesCanvasEdge||frame.boundaryRatio>.012).length,frames:frames.length};
}

export function planSpriteFrameNormalization(rig, {
  sourceWidth, sourceHeight, maxRuntimeDimension = 1024, maxCellDimension = 256, minCellDimension = 48,
  safeScaleMin = .84, safeScaleMax = 1.18, scaleDeadZone = .035, footAnchor = .92, horizontalAnchor = .5, framePatches = null
} = {}) {
  if (!rig?.groups?.length) throw new Error('SPRITE_NORMALIZER_RIG_REQUIRED');
  const rows = rig.groups.length, columns = Math.max(1, ...rig.groups.map(group => group.length));
  const usable = rig.groups.flat().filter(frame => frameBounds(frame)); if (!usable.length) throw new Error('SPRITE_NORMALIZER_FRAMES_REQUIRED');
  const medianHeight = median(usable.map(frame => frameBounds(frame).h)), framePlans = [], allFrames = rig.groups.flat();
  for (let row = 0; row < rig.groups.length; row++) for (let column = 0; column < rig.groups[row].length; column++) {
    const frame = rig.groups[row][column], rawPatch = framePatches?.[row * columns + column] || {}, patch = normalizeSurgeryPatch(rawPatch);
    const sourceFrame = patch.copyFrom !== null && Number.isInteger(Number(patch.copyFrom)) ? (allFrames[Number(patch.copyFrom)] || frame) : frame;
    const bounds = frameBounds(sourceFrame); if (!bounds) continue;
    const rawCorrection = medianHeight / Math.max(1, bounds.h), withinDeadZone = Math.abs(rawCorrection - 1) <= scaleDeadZone;
    const correction = withinDeadZone ? 1 : clamp(rawCorrection, safeScaleMin, safeScaleMax), scaleOutlier = rawCorrection < safeScaleMin || rawCorrection > safeScaleMax;
    framePlans.push({row,column,direction:rig.directionKeys?.[row]||`row${row+1}`,frame,sourceFrame,patch,bounds,correction,rawCorrection,scaleOutlier,
      correctedWidth:bounds.w*correction,correctedHeight:bounds.h*correction});
  }
  const desiredWidth = Math.max(minCellDimension, Math.ceil(percentile(framePlans.map(plan=>plan.correctedWidth),.96)/.82));
  const desiredHeight = Math.max(minCellDimension, Math.ceil(percentile(framePlans.map(plan=>plan.correctedHeight),.96)/.84));
  const atlasScale = Math.min(1,maxCellDimension/Math.max(desiredWidth,desiredHeight),maxRuntimeDimension/Math.max(1,desiredWidth*columns),maxRuntimeDimension/Math.max(1,desiredHeight*rows));
  const frameWidth=Math.max(minCellDimension,Math.round(desiredWidth*atlasScale)),frameHeight=Math.max(minCellDimension,Math.round(desiredHeight*atlasScale));
  const baseline=frameHeight*clamp(footAnchor,.72,.98),centerX=frameWidth*clamp(horizontalAnchor,.2,.8);
  const plans = framePlans.map(plan=>{
    const patch=plan.patch, patchScale=patch.scale, scale=plan.correction*atlasScale*patchScale;
    const boundsCenterInSource=plan.bounds.x+plan.bounds.w/2,boundsBottomInSource=plan.bounds.y+plan.bounds.h;
    const uncropped=sourceRect(plan.sourceFrame||plan.frame,plan.bounds,sourceWidth,sourceHeight),source=cropSourceRect(uncropped,patch.crop,sourceWidth,sourceHeight);
    let dx=plan.column*frameWidth+centerX-(boundsCenterInSource-source.x)*scale+patch.x;
    let dy=plan.row*frameHeight+baseline-(boundsBottomInSource-source.y)*scale+patch.y;
    if(patch.pixelSnap){dx=Math.round(dx);dy=Math.round(dy);}
    return F({...plan,source:F(source),scale,destination:F({x:dx,y:dy,w:source.w*scale,h:source.h*scale}),
      surgery:F({rotation:patch.rotation,erase:patch.erase,restore:patch.restore,clone:patch.clone,fill:patch.fill,overlays:patch.overlays,crop:patch.crop,layerVisibility:patch.layerVisibility})});
  });
  const outputHeights=plans.map(plan=>plan.bounds.h*plan.scale),outputWidths=plans.map(plan=>plan.bounds.w*plan.scale),source=sourceMetrics(rig.groups);
  const artDefects=plans.filter(plan=>plan.frame.touchesCanvasEdge&&!(plan.patch.overlays?.some(x=>x.visible!==false))).map(plan=>F({row:plan.row,column:plan.column,direction:plan.direction,code:'ART_DEFECT_REGENERATION_REQUIRED',reason:'source pixels touch the outer canvas; add a real replacement/piece or regenerate the missing artwork'}));
  const repairedEdgeFrames=plans.filter(plan=>plan.frame.touchesCanvasEdge&&plan.patch.overlays?.some(x=>x.visible!==false)).map(plan=>plan.row*columns+plan.column);
  const suspicious=plans.filter(plan=>plan.scaleOutlier||plan.frame.boundaryRatio>.012).map(plan=>F({row:plan.row,column:plan.column,direction:plan.direction,scaleDelta:plan.rawCorrection-1,
    feetOffsetPx:(()=>{const peers=rig.groups[plan.row].map(frame=>{const bounds=frameBounds(frame);return bounds?bounds.y+bounds.h:null}).filter(Number.isFinite);return(plan.bounds.y+plan.bounds.h)-median(peers)})(),
    reasons:F([...(plan.scaleOutlier?['SCALE_OUTLIER']:[]),...(plan.frame.boundaryRatio>.012?['REGION_BOUNDARY_CONTACT']:[])])}));
  return F({version:'sprite-frame-normalizer-v2.1.3-bridge-anchor-safe',rows,columns,frameCounts:F(rig.groups.map(group=>group.length)),directionKeys:F([...(rig.directionKeys||[])]),rowMap:rig.rowMap,
    frameWidth,frameHeight,width:frameWidth*columns,height:frameHeight*rows,baseline,centerX,atlasScale,plans:F(plans),sourceMetrics:F(source),
    outputMetrics:F({heightVariation:cv(outputHeights),widthVariation:cv(outputWidths),visualScaleVariation:cv(outputHeights),footAnchorDispersionPx:0,footAnchorDispersion:0,centerDrift:0,
      clippingFrames:artDefects.length,frames:plans.length,minOccupancy:Math.min(...plans.map(plan=>(plan.bounds.w*plan.scale)*(plan.bounds.h*plan.scale)/Math.max(1,frameWidth*frameHeight))),
      maxOccupancy:Math.max(...plans.map(plan=>(plan.bounds.w*plan.scale)*(plan.bounds.h*plan.scale)/Math.max(1,frameWidth*frameHeight)))}),suspicious:F(suspicious),artDefects:F(artDefects),repairedEdgeFrames:F(repairedEdgeFrames),
    safeScalePolicy:F({min:safeScaleMin,max:safeScaleMax,deadZone:scaleDeadZone}),footAnchor,horizontalAnchor});
}

function makeCanvas(root,width,height){const canvas=root.document?.createElement?.('canvas');if(!canvas)throw new Error('SPRITE_NORMALIZER_CANVAS_REQUIRED');canvas.width=Math.max(1,Math.round(width));canvas.height=Math.max(1,Math.round(height));return canvas}
function putPixels(root,canvas,data,width,height){const context=canvas.getContext('2d',{willReadFrequently:true}),image=context.createImageData(width,height);image.data.set(data);context.putImageData(image,0,0)}
function localAlphaBounds(data,width,height){let minX=width,minY=height,maxX=-1,maxY=-1;for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>18){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}return maxX>=0?{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1}:null}
function patchHasExplicitSurgery(patch){const crop=patch?.crop||{};return Math.abs(Number(patch?.x)||0)>.001||Math.abs(Number(patch?.y)||0)>.001||Math.abs((Number(patch?.scale)||1)-1)>.001||Math.abs(Number(patch?.rotation)||0)>.001||['left','right','top','bottom'].some(k=>Math.abs(Number(crop[k])||0)>.001)||(patch?.erase?.length||0)>0||(patch?.restore?.length||0)>0||(patch?.clone?.length||0)>0||(patch?.fill?.length||0)>0||(patch?.overlays?.some(item=>item?.visible!==false))}
function thinBoundaryRepair(root,source,rect,frame){
  if(!frame||frame.touchesCanvasEdge||!(Number(frame.boundaryPixels)>0||Number(frame.boundaryRatio)>.012))return null;
  const temp=makeCanvas(root,rect.w,rect.h),ctx=temp.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);const image=ctx.getImageData(0,0,rect.w,rect.h),data=image.data;
  const active=(x,y)=>data[(y*rect.w+x)*4+3]>18,countColumn=x=>{let n=0;for(let y=0;y<rect.h;y++)if(active(x,y))n++;return n},countRow=y=>{let n=0;for(let x=0;x<rect.w;x++)if(active(x,y))n++;return n},clearColumn=x=>{let n=0;for(let y=0;y<rect.h;y++)if(active(x,y)){data[(y*rect.w+x)*4+3]=0;n++}return n},clearRow=y=>{let n=0;for(let x=0;x<rect.w;x++)if(active(x,y)){data[(y*rect.w+x)*4+3]=0;n++}return n};
  let originalPixels=0;for(let y=0;y<rect.h;y++)for(let x=0;x<rect.w;x++)if(active(x,y))originalPixels++;if(!originalPixels)return null;
  const xThin=Math.max(2,Math.round(rect.h*.032)),yThin=Math.max(2,Math.round(rect.w*.032)),maxX=Math.max(2,Math.floor(rect.w*.38)),maxY=Math.max(2,Math.floor(rect.h*.28));
  const attempt=(axis,fromEnd=false)=>{const before=new Uint8ClampedArray(data),isX=axis==='x',length=isX?rect.w:rect.h,edge=fromEnd?length-1:0,threshold=isX?xThin:yThin,count=isX?countColumn:countRow,clear=isX?clearColumn:clearRow,maxDepth=isX?maxX:maxY,edgeCount=count(edge);if(edgeCount<1||edgeCount>threshold)return 0;let removed=0,changed=false,encounteredBody=false;for(let depth=0;depth<maxDepth;depth++){const pos=fromEnd?length-1-depth:depth,n=count(pos);if(n>threshold){encounteredBody=true;break}if(n===0&&depth>2)break;if(n){removed+=clear(pos);changed=true}}if(!changed||!encounteredBody){data.set(before);return 0}return removed};
  const removedPixels=attempt('x',false)+attempt('x',true)+attempt('y',false)+attempt('y',true);if(!removedPixels)return null;const maxRemoval=Math.max(16,Math.round(originalPixels*.04));if(removedPixels>maxRemoval)return null;const bounds=localAlphaBounds(data,rect.w,rect.h);if(!bounds)return null;ctx.putImageData(image,0,0);return F({canvas:temp,bounds:F(bounds),removedPixels,originalPixels,removedRatio:removedPixels/originalPixels})
}
function linePoints(a,b){let x0=a.x|0,y0=a.y|0,x1=b.x|0,y1=b.y|0,dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy,out=[];for(;;){out.push({x:x0,y:y0});if(x0===x1&&y0===y1)break;const e2=2*err;if(e2>=dy){err+=dy;x0+=sx}if(e2<=dx){err+=dx;y0+=sy}}return out}
function rasterizeStrokePoints(stroke,width,height){const input=(stroke?.points||[]).map(p=>({x:clamp(Math.round(p.x*(width-1)),0,width-1),y:clamp(Math.round(p.y*(height-1)),0,height-1)}));if(!input.length)return[];const out=[],seen=new Set;for(let i=0;i<input.length;i++){const segment=i?linePoints(input[i-1],input[i]):[input[i]];for(const p of segment){const k=p.y*width+p.x;if(!seen.has(k)){seen.add(k);out.push(p)}}}return out}
function brushOffsets(radius){const r=Math.max(1,Math.round(radius)),out=[];for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)if(x*x+y*y<=r*r)out.push({x,y});return out}
function paintStroke(context,stroke,width,height,operation='destination-out'){
  if(!stroke?.points?.length||operation!=='destination-out')return;const image=context.getImageData(0,0,width,height),data=image.data;
  const radius=Math.max(1,stroke.radius*Math.min(width,height)),offsets=brushOffsets(radius);
  for(const p of rasterizeStrokePoints(stroke,width,height))for(const o of offsets){const x=p.x+o.x,y=p.y+o.y;if(x<0||y<0||x>=width||y>=height)continue;const i=(y*width+x)*4;data[i]=0;data[i+1]=0;data[i+2]=0;data[i+3]=0}
  context.putImageData(image,0,0)
}
function restoreStroke(context,base,stroke,width,height){if(!stroke?.points?.length)return;const image=context.getImageData(0,0,width,height),data=image.data,src=base.getContext('2d',{willReadFrequently:true}).getImageData(0,0,width,height).data;
  const radius=Math.max(1,stroke.radius*Math.min(width,height)),offsets=brushOffsets(radius);for(const p of rasterizeStrokePoints(stroke,width,height))for(const o of offsets){const x=p.x+o.x,y=p.y+o.y;if(x<0||y<0||x>=width||y>=height)continue;const i=(y*width+x)*4;data[i]=src[i];data[i+1]=src[i+1];data[i+2]=src[i+2];data[i+3]=src[i+3]}context.putImageData(image,0,0)}
function cloneStroke(context,base,stroke,width,height){if(!stroke?.points?.length||!stroke.source)return;const image=context.getImageData(0,0,width,height),data=image.data,src=base.getContext('2d',{willReadFrequently:true}).getImageData(0,0,width,height).data;
  const points=rasterizeStrokePoints(stroke,width,height);if(!points.length)return;const first=points[0],anchor={x:Math.round(stroke.source.x*(width-1)),y:Math.round(stroke.source.y*(height-1))};
  const radius=Math.max(1,stroke.radius*Math.min(width,height)),offsets=brushOffsets(radius);for(const p of points){const sx0=anchor.x+(p.x-first.x),sy0=anchor.y+(p.y-first.y);for(const o of offsets){const tx=p.x+o.x,ty=p.y+o.y,sx=sx0+o.x,sy=sy0+o.y;if(tx<0||ty<0||tx>=width||ty>=height||sx<0||sy<0||sx>=width||sy>=height)continue;const ti=(ty*width+tx)*4,si=(sy*width+sx)*4;data[ti]=src[si];data[ti+1]=src[si+1];data[ti+2]=src[si+2];data[ti+3]=src[si+3]}}context.putImageData(image,0,0)}
function findEnclosedTransparentComponent(data,width,height,sx,sy,maxArea=128){if(sx<0||sy<0||sx>=width||sy>=height||data[(sy*width+sx)*4+3]>24)return[];const seen=new Uint8Array(width*height),q=new Int32Array(Math.min(width*height,maxArea+2));let a=0,b=1,touchesEdge=false;q[0]=sy*width+sx;seen[q[0]]=1;const out=[];while(a<b){const n=q[a++],x=n%width,y=n/width|0;out.push(n);if(x===0||y===0||x===width-1||y===height-1)touchesEdge=true;if(out.length>maxArea)return[];for(const[ox,oy]of[[1,0],[-1,0],[0,1],[0,-1]]){const X=x+ox,Y=y+oy;if(X<0||Y<0||X>=width||Y>=height)continue;const j=Y*width+X;if(!seen[j]&&data[j*4+3]<=24){seen[j]=1;if(b>=q.length)return[];q[b++]=j}}}return touchesEdge?[]:out}
function smartFillSmallGap(context,stroke,width,height){if(!stroke?.points?.length)return;const image=context.getImageData(0,0,width,height),data=image.data,snapshot=new Uint8ClampedArray(data);const radius=Math.max(1,Math.round(stroke.radius*Math.min(width,height))),maxArea=Math.max(4,Math.min(256,Math.round(Math.PI*radius*radius*1.5)));
  for(const point of stroke.points){const cx=clamp(Math.round(point.x*(width-1)),0,width-1),cy=clamp(Math.round(point.y*(height-1)),0,height-1),component=findEnclosedTransparentComponent(snapshot,width,height,cx,cy,maxArea);if(!component.length)continue;for(const n of component){const x=n%width,y=n/width|0,i=n*4;let best=-1,bestD=Infinity;for(let r=1;r<=4&&best<0;r++)for(let oy=-r;oy<=r;oy++)for(let ox=-r;ox<=r;ox++){const X=x+ox,Y=y+oy;if(X<0||Y<0||X>=width||Y>=height)continue;const j=(Y*width+X)*4;if(snapshot[j+3]<=64)continue;const d=ox*ox+oy*oy;if(d<bestD){bestD=d;best=j}}if(best>=0){data[i]=snapshot[best];data[i+1]=snapshot[best+1];data[i+2]=snapshot[best+2];data[i+3]=snapshot[best+3]}}}context.putImageData(image,0,0)}

function frameSourceForIndex(plan,rig,index,sourceWidth,sourceHeight){const flat=rig.groups.flat(),frame=flat[index],bounds=frameBounds(frame);if(!frame||!bounds)return null;return sourceRect(frame,bounds,sourceWidth,sourceHeight)}
function drawOverlay(root,context,overlay,{sourceCanvas,rig,plan,sourceWidth,sourceHeight,frameWidth,frameHeight,imageSmoothing}){if(overlay.visible===false)return;let image=overlay.canvas||overlay.image||null,source=null;if(!image&&Number.isInteger(overlay.sourceFrame)){image=sourceCanvas;source=frameSourceForIndex(plan,rig,overlay.sourceFrame,sourceWidth,sourceHeight)}if(!image)return;
  const imageWidth=image.naturalWidth||image.width||frameWidth,imageHeight=image.naturalHeight||image.height||frameHeight;let sx=0,sy=0,sw=imageWidth,sh=imageHeight;if(source){sx=source.x;sy=source.y;sw=source.w;sh=source.h}if(overlay.sourceRect){sx+=sw*overlay.sourceRect.x;sy+=sh*overlay.sourceRect.y;sw*=overlay.sourceRect.w;sh*=overlay.sourceRect.h}
  const targetW=overlay.frameRect?overlay.frameRect.w*frameWidth*overlay.scale:sw*(frameWidth/Math.max(1,plan.source.w))*overlay.scale,targetH=overlay.frameRect?overlay.frameRect.h*frameHeight*overlay.scale:sh*(frameHeight/Math.max(1,plan.source.h))*overlay.scale;
  const baseX=overlay.frameRect?(overlay.frameRect.x+overlay.frameRect.w/2)*frameWidth:frameWidth/2,baseY=overlay.frameRect?(overlay.frameRect.y+overlay.frameRect.h/2)*frameHeight:frameHeight*.92-targetH/2,cx=baseX+overlay.x,cy=baseY+overlay.y;
  context.save();context.globalAlpha=overlay.opacity;context.imageSmoothingEnabled=!!imageSmoothing;context.translate(cx,cy);context.rotate(overlay.rotation);context.drawImage(image,sx,sy,sw,sh,-targetW/2,-targetH/2,targetW,targetH);context.restore()}
function composeFrame(root,sourceCanvas,plan,rig,options){const{frameWidth,frameHeight,sourceWidth,sourceHeight}=options,cell=makeCanvas(root,frameWidth,frameHeight),context=cell.getContext('2d',{willReadFrequently:true});context.clearRect(0,0,frameWidth,frameHeight);context.imageSmoothingEnabled=!!options.imageSmoothing;
  const destination=plan.destination,localX=destination.x-plan.column*frameWidth,localY=destination.y-plan.row*frameHeight,cx=localX+destination.w/2,cy=localY+destination.h/2;
  let autoBridgeRepair=null;
  if(plan.patch.layerVisibility?.character!==false){const repaired=!patchHasExplicitSurgery(plan.patch)?thinBoundaryRepair(root,sourceCanvas,plan.source,plan.frame):null;if(repaired){const b=repaired.bounds,anchorX=localX+(plan.bounds.x+plan.bounds.w/2-plan.source.x)*plan.scale,anchorY=localY+(plan.bounds.y+plan.bounds.h-plan.source.y)*plan.scale,rw=b.w*plan.scale,rh=b.h*plan.scale,rx=anchorX-rw/2,ry=anchorY-rh;context.drawImage(repaired.canvas,b.x,b.y,b.w,b.h,rx,ry,rw,rh);autoBridgeRepair=F({removedPixels:repaired.removedPixels,removedRatio:repaired.removedRatio,bounds:b,anchorX,anchorY})}else{context.save();context.translate(cx,cy);context.rotate(plan.patch.rotation||0);context.drawImage(sourceCanvas,plan.source.x,plan.source.y,plan.source.w,plan.source.h,-destination.w/2,-destination.h/2,destination.w,destination.h);context.restore()}}
  if(plan.patch.layerVisibility?.pieces!==false){for(const overlay of plan.patch.overlays||[])if(overlay.visible!==false&&overlay.cutoutOriginal&&(overlay.canvas||overlay.image)&&overlay.frameRect){const image=overlay.canvas||overlay.image,x=overlay.frameRect.x*frameWidth,y=overlay.frameRect.y*frameHeight,w=overlay.frameRect.w*frameWidth,h=overlay.frameRect.h*frameHeight,iw=image.naturalWidth||image.width||w,ih=image.naturalHeight||image.height||h;context.save();context.globalCompositeOperation='destination-out';context.drawImage(image,0,0,iw,ih,x,y,w,h);context.restore()}for(const overlay of plan.patch.overlays||[])drawOverlay(root,context,overlay,{sourceCanvas,rig,plan,sourceWidth,sourceHeight,frameWidth,frameHeight,imageSmoothing:options.imageSmoothing})}
  const base=makeCanvas(root,frameWidth,frameHeight);base.getContext('2d').drawImage(cell,0,0);if(plan.patch.layerVisibility?.mask!==false){for(const stroke of plan.patch.erase||[])paintStroke(context,stroke,frameWidth,frameHeight,'destination-out');for(const stroke of plan.patch.restore||[])restoreStroke(context,base,stroke,frameWidth,frameHeight)}if(plan.patch.layerVisibility?.patches!==false){for(const stroke of plan.patch.clone||[])cloneStroke(context,base,stroke,frameWidth,frameHeight);for(const stroke of plan.patch.fill||[])smartFillSmallGap(context,stroke,frameWidth,frameHeight)}cell.__keloAutoBridgeRepair=autoBridgeRepair;return cell}

export function normalizeSpriteFrameGroups(root,foreground,rig,options={}){if(!foreground?.cleanedData)throw new Error('SPRITE_NORMALIZER_FOREGROUND_REQUIRED');const plan=planSpriteFrameNormalization(rig,{...options,sourceWidth:foreground.width,sourceHeight:foreground.height}),source=makeCanvas(root,foreground.width,foreground.height);putPixels(root,source,foreground.cleanedData,foreground.width,foreground.height);
  const output=makeCanvas(root,plan.width,plan.height),context=output.getContext('2d',{willReadFrequently:true}),imageSmoothing=options.imageSmoothing===true;context.clearRect(0,0,output.width,output.height);context.imageSmoothingEnabled=imageSmoothing;let thinBoundaryRepairs=0,thinBoundaryRemovedPixels=0;
  for(const frame of plan.plans){const cell=composeFrame(root,source,frame,rig,{frameWidth:plan.frameWidth,frameHeight:plan.frameHeight,sourceWidth:foreground.width,sourceHeight:foreground.height,imageSmoothing});if(cell.__keloAutoBridgeRepair){thinBoundaryRepairs++;thinBoundaryRemovedPixels+=cell.__keloAutoBridgeRepair.removedPixels||0}context.drawImage(cell,frame.column*plan.frameWidth,frame.row*plan.frameHeight)}return F({canvas:output,sourceCanvas:source,plan,thinBoundaryRepairs,thinBoundaryRemovedPixels,...plan})}

export const __spriteFrameNormalizerInternals=F({cv,frameBounds,percentile,sourceMetrics,spread,cropSourceRect,localAlphaBounds,patchHasExplicitSurgery,thinBoundaryRepair,rasterizeStrokePoints,findEnclosedTransparentComponent,paintStroke,restoreStroke,cloneStroke,smartFillSmallGap,composeFrame});