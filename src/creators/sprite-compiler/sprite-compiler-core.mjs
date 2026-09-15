/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / CORE
 * owner: deterministic sprite repair planning and browser canvas adapter
 * owns: background cleanup, pixel grammar, silhouette QA, donor planning, cell bounds, common scale, feet anchoring, repair QA
 * does-not-own: generative AI inference, animation semantics, publishing authority
 */
import {preparePixelArtPixels} from './sprite-pixel-grammar.mjs';
import {auditSilhouetteConsistency} from './sprite-silhouette-consistency.mjs';
import {planDonorRepairCandidates} from './sprite-donor-repair.mjs';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const dist=(r,g,b,c)=>Math.hypot(r-c.r,g-c.g,b-c.b);
function assertPixels(data,width,height){if(!data||data.length<width*height*4)throw new Error('SPRITE_COMPILER_PIXELS_REQUIRED');}
export function estimateCornerBackground(sourceData,width,height,{alphaThreshold=12,patch=3,maxSpread=36,quantum=24,minDominance=.45}={}){
  const data=sourceData?.data||sourceData;assertPixels(data,width,height);
  const points=[[0,0],[width-1,0],[0,height-1],[width-1,height-1]],samples=[];let transparent=0;
  for(const [cx,cy] of points)for(let oy=-patch;oy<=patch;oy++)for(let ox=-patch;ox<=patch;ox++){
    const x=clamp(cx+ox,0,width-1),y=clamp(cy+oy,0,height-1),i=(y*width+x)*4;
    if(data[i+3]<=alphaThreshold){transparent++;continue;}samples.push({r:data[i],g:data[i+1],b:data[i+2],a:data[i+3]});
  }
  const total=samples.length+transparent;if(!samples.length||transparent/Math.max(1,total)>.5)return null;
  const bins=new Map();for(const c of samples){const key=`${Math.round(c.r/quantum)}:${Math.round(c.g/quantum)}:${Math.round(c.b/quantum)}`;const group=bins.get(key)||[];group.push(c);bins.set(key,group);}
  const dominant=[...bins.values()].sort((a,b)=>b.length-a.length)[0]||[];if(dominant.length/samples.length<minDominance)return null;
  const avg={r:dominant.reduce((s,c)=>s+c.r,0)/dominant.length,g:dominant.reduce((s,c)=>s+c.g,0)/dominant.length,b:dominant.reduce((s,c)=>s+c.b,0)/dominant.length,a:dominant.reduce((s,c)=>s+c.a,0)/dominant.length};
  const spread=Math.max(...dominant.map(c=>dist(c.r,c.g,c.b,avg)));return spread<=maxSpread?Object.freeze({...avg,spread,dominance:dominant.length/samples.length}):null;
}
export function cleanBackgroundPixels(sourceData,width,height,{background='auto',alphaThreshold=12,colorThreshold=34,softEdge=14}={}){
  const raw=sourceData?.data||sourceData;assertPixels(raw,width,height);
  const bg=background==='auto'?estimateCornerBackground(raw,width,height,{alphaThreshold}):background;
  const out=new Uint8ClampedArray(raw);if(!bg)return Object.freeze({data:out,background:null,removed:0,mode:'alpha'});
  let removed=0;const soft=Math.max(0,finite(softEdge,14));
  for(let i=0;i<out.length;i+=4){if(out[i+3]<=alphaThreshold)continue;const d=dist(out[i],out[i+1],out[i+2],bg);
    if(d<=colorThreshold){out[i+3]=0;removed++;continue;}
    if(soft&&d<colorThreshold+soft){const ratio=clamp((d-colorThreshold)/soft,0,1),next=Math.round(out[i+3]*ratio);if(next<out[i+3])removed++;out[i+3]=next;}
  }
  return Object.freeze({data:out,background:bg,removed,mode:'solid-corner'});
}
export function analyzeGridCells(sourceData,width,height,{columns=4,rows=8,alphaThreshold=12}={}){
  const data=sourceData?.data||sourceData;assertPixels(data,width,height);columns=Math.max(1,Math.round(finite(columns,4)));rows=Math.max(1,Math.round(finite(rows,8)));
  const frames=[];for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    const x0=Math.floor(column*width/columns),x1=Math.max(x0+1,Math.floor((column+1)*width/columns)),y0=Math.floor(row*height/rows),y1=Math.max(y0+1,Math.floor((row+1)*height/rows));
    let minX=x1,minY=y1,maxX=-1,maxY=-1,pixels=0,edgePixels=0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const a=data[(y*width+x)*4+3];if(a<=alphaThreshold)continue;pixels++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);if(x===x0||x===x1-1||y===y0||y===y1-1)edgePixels++;}
    const bounds=maxX>=0?Object.freeze({x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1,right:maxX,bottom:maxY}):null;
    frames.push(Object.freeze({index:row*columns+column,row,column,cell:Object.freeze({x:x0,y:y0,width:x1-x0,height:y1-y0}),bounds,pixels,edgePixels,clipped:edgePixels>0}));
  }return Object.freeze(frames);
}
export function planFrameNormalization(frames,{targetWidth=64,targetHeight=64,padding=4,maxUpscale=2,anchor='feet-center'}={}){
  const usable=frames.filter(f=>f.bounds&&f.pixels>0);if(!usable.length)return Object.freeze({frames:Object.freeze([]),scale:1,targetWidth,targetHeight,padding,anchor,baseline:null,empty:true});
  const maxW=Math.max(...usable.map(f=>f.bounds.width)),maxH=Math.max(...usable.map(f=>f.bounds.height)),availableW=Math.max(1,targetWidth-padding*2),availableH=Math.max(1,targetHeight-padding*2);
  const scale=Math.min(maxUpscale,availableW/maxW,availableH/maxH),baseline=targetHeight-padding;
  const planned=frames.map(frame=>{if(!frame.bounds)return Object.freeze({...frame,destination:null});const width=Math.max(1,Math.round(frame.bounds.width*scale)),height=Math.max(1,Math.round(frame.bounds.height*scale)),x=Math.round((targetWidth-width)/2),y=anchor==='center'?Math.round((targetHeight-height)/2):baseline-height;return Object.freeze({...frame,destination:Object.freeze({x,y,width,height,feetY:y+height,centerX:x+width/2})});});
  return Object.freeze({frames:Object.freeze(planned),scale,targetWidth,targetHeight,padding,anchor,baseline,maxSourceWidth:maxW,maxSourceHeight:maxH,empty:false});
}
export function buildRepairReport({sourceFrames=[],outputFrames=[],plan=null,backgroundCleanup=null,pixelGrammar=null,silhouette=null,donorPlan=null}={}){
  const sourceNonEmpty=sourceFrames.filter(f=>f.bounds).length,outputNonEmpty=outputFrames.filter(f=>f.bounds).length,clippedBefore=sourceFrames.filter(f=>f.clipped).length,clippedAfter=outputFrames.filter(f=>f.clipped).length;
  const feet=(plan?.frames||[]).map(f=>f.destination?.feetY).filter(Number.isFinite),feetSpread=feet.length?Math.max(...feet)-Math.min(...feet):0;
  const occupancy=(plan?.frames||[]).map(f=>f.destination?f.destination.width*f.destination.height/(plan.targetWidth*plan.targetHeight):0).filter(v=>v>0),minOccupancy=occupancy.length?Math.min(...occupancy):0,maxOccupancy=occupancy.length?Math.max(...occupancy):0,frameCount=sourceFrames.length;
  const geometryPass=frameCount>0&&sourceNonEmpty===frameCount&&outputNonEmpty===frameCount&&clippedAfter===0&&feetSpread<=1,pixelPass=pixelGrammar?.pass!==false;
  return Object.freeze({pass:geometryPass&&pixelPass,geometryPass,pixelPass,frameCount,sourceNonEmpty,outputNonEmpty,clippedBefore,clippedAfter,feetSpread,commonScale:plan?.scale??1,minOccupancy,maxOccupancy,backgroundMode:backgroundCleanup?.mode||'unknown',backgroundPixelsRemoved:backgroundCleanup?.removed||0,pixelGrammar:pixelGrammar||null,silhouette:silhouette||null,donorPlan:donorPlan||null});
}
export function repairSpritesheetImage(root,image,{columns=4,rows=8,targetWidth=64,targetHeight=64,padding=4,removeBackground=true,colorThreshold=34,softEdge=14,imageSmoothing=false,profile='pixel-art',pixelGrammar=true,paletteMaxColors=null,silhouetteQA=true,silhouetteThreshold=.48}={}){
  if(!root?.document)throw new Error('SPRITE_COMPILER_DOM_REQUIRED');const width=Math.max(1,Math.round(image.naturalWidth||image.width||0)),height=Math.max(1,Math.round(image.naturalHeight||image.height||0));if(!width||!height)throw new Error('SPRITE_COMPILER_IMAGE_DIMENSIONS_REQUIRED');
  const makeCanvas=(w,h)=>{const c=root.document.createElement('canvas');c.width=w;c.height=h;return c;};const source=makeCanvas(width,height),sctx=source.getContext('2d',{willReadFrequently:true});sctx.clearRect(0,0,width,height);sctx.drawImage(image,0,0,width,height);const raw=sctx.getImageData(0,0,width,height);
  const cleanup=removeBackground?cleanBackgroundPixels(raw.data,width,height,{background:'auto',colorThreshold,softEdge}):Object.freeze({data:new Uint8ClampedArray(raw.data),background:null,removed:0,mode:'preserve'});
  const prepared=pixelGrammar&&profile==='pixel-art'?preparePixelArtPixels(cleanup.data,width,height,{paletteMaxColors}):Object.freeze({data:cleanup.data,report:null}),cleaned=sctx.createImageData(width,height);cleaned.data.set(prepared.data);sctx.putImageData(cleaned,0,0);
  const sourceFrames=analyzeGridCells(prepared.data,width,height,{columns,rows}),silhouette=silhouetteQA?auditSilhouetteConsistency(prepared.data,width,height,sourceFrames,{outlierThreshold:silhouetteThreshold}):null,donorPlan=silhouette?planDonorRepairCandidates(sourceFrames,silhouette,null):null,plan=planFrameNormalization(sourceFrames,{targetWidth,targetHeight,padding}),output=makeCanvas(columns*targetWidth,rows*targetHeight),ctx=output.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,output.width,output.height);ctx.imageSmoothingEnabled=profile==='pixel-art'?false:!!imageSmoothing;
  for(const frame of plan.frames){if(!frame.bounds||!frame.destination)continue;const dest=frame.destination,dx=frame.column*targetWidth+dest.x,dy=frame.row*targetHeight+dest.y;ctx.drawImage(source,frame.bounds.x,frame.bounds.y,frame.bounds.width,frame.bounds.height,dx,dy,dest.width,dest.height);}
  const outPixels=ctx.getImageData(0,0,output.width,output.height),outputFrames=analyzeGridCells(outPixels.data,output.width,output.height,{columns,rows}),report=buildRepairReport({sourceFrames,outputFrames,plan,backgroundCleanup:cleanup,pixelGrammar:prepared.report,silhouette,donorPlan});
  return Object.freeze({canvas:output,report,plan,sourceFrames,outputFrames,pixelGrammar:prepared.report,silhouette,donorPlan,columns,rows,frameWidth:targetWidth,frameHeight:targetHeight,sourceWidth:width,sourceHeight:height});
}
