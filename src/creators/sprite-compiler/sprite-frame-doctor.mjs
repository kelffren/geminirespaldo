/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / FRAME DOCTOR
 * owner: per-frame defect isolation and selective atlas patching
 * owns: defect scores, exact repair targets, cell replacement without touching healthy cells
 * does-not-own: image generation provider, animation semantics, publishing
 */
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const median=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
const ratioDistance=(value,reference)=>reference>0&&value>0?Math.abs(Math.log(value/reference)):Infinity;

export function diagnoseSpriteFrames(frames,{columns=4,directions=['N','NE','E','SE','S','SW','W','NW'],emptyPixelFloor=20,sizeTolerance=.38,pixelTolerance=.62,centerTolerance=.14,feetTolerancePx=3}={}){
  const usable=frames.filter(f=>f?.bounds&&finite(f.pixels)>emptyPixelFloor);
  const globalBaseline=Object.freeze({width:median(usable.map(f=>f.bounds.width)),height:median(usable.map(f=>f.bounds.height)),pixels:median(usable.map(f=>f.pixels)),aspect:median(usable.map(f=>f.bounds.width/Math.max(1,f.bounds.height))),feet:median(usable.map(f=>f.bounds.bottom+1))});
  const rowBaselines=new Map();
  const rowCount=Math.max(1,Math.ceil(frames.length/Math.max(1,columns)));
  for(let row=0;row<rowCount;row++){const rowFrames=frames.filter((f,i)=>(Number.isFinite(f?.row)?f.row:Math.floor(i/columns))===row&&f?.bounds&&finite(f.pixels)>emptyPixelFloor);rowBaselines.set(row,Object.freeze({width:median(rowFrames.map(f=>f.bounds.width))||globalBaseline.width,height:median(rowFrames.map(f=>f.bounds.height))||globalBaseline.height,pixels:median(rowFrames.map(f=>f.pixels))||globalBaseline.pixels,aspect:median(rowFrames.map(f=>f.bounds.width/Math.max(1,f.bounds.height)))||globalBaseline.aspect,feet:median(rowFrames.map(f=>f.bounds.bottom+1))||globalBaseline.feet}));}
  const findings=frames.map((frame,index)=>{
    const row=Number.isFinite(frame?.row)?frame.row:Math.floor(index/columns),column=Number.isFinite(frame?.column)?frame.column:index%columns;
    const direction=directions[row]||`ROW_${row+1}`,phase=column+1,reasons=[];let severity=0;
    let verticalScaleDelta=0,feetOffsetPx=0,centerOffsetPx=0;
    if(!frame?.bounds||finite(frame.pixels)<=emptyPixelFloor){reasons.push('empty');severity=1;}
    else{
      if(frame.clipped||finite(frame.edgePixels)>0){reasons.push('clipped');severity=Math.max(severity,.95);}
      const baseline=rowBaselines.get(row)||globalBaseline,wd=ratioDistance(frame.bounds.width,baseline.width),hd=ratioDistance(frame.bounds.height,baseline.height),pd=ratioDistance(frame.pixels,baseline.pixels),aspect=frame.bounds.width/Math.max(1,frame.bounds.height),ad=ratioDistance(aspect,baseline.aspect);
      verticalScaleDelta=baseline.height?frame.bounds.height/baseline.height-1:0;feetOffsetPx=(frame.bounds.bottom+1)-baseline.feet;
      if(wd>sizeTolerance||hd>sizeTolerance){reasons.push('scale-outlier');severity=Math.max(severity,clamp(Math.max(wd,hd),.45,.9));}
      if(pd>pixelTolerance){reasons.push('occupancy-outlier');severity=Math.max(severity,clamp(pd*.72,.4,.85));}
      if(ad>sizeTolerance*1.15){reasons.push('shape-outlier');severity=Math.max(severity,clamp(ad*.68,.4,.82));}
      if(Math.abs(feetOffsetPx)>feetTolerancePx){reasons.push('feet-offset');severity=Math.max(severity,clamp(Math.abs(feetOffsetPx)/Math.max(8,baseline.height*.22),.3,.78));}
      const cell=frame.cell;if(cell){const center=frame.bounds.x+frame.bounds.width/2,expected=cell.x+cell.width/2;centerOffsetPx=center-expected;const offset=Math.abs(centerOffsetPx)/Math.max(1,cell.width);if(offset>centerTolerance){reasons.push('center-drift');severity=Math.max(severity,clamp(offset*2.4,.35,.8));}}
    }
    return Object.freeze({index,row,column,direction,phase,healthy:reasons.length===0,severity:Number(severity.toFixed(3)),reasons:Object.freeze(reasons),verticalScaleDelta:Number(verticalScaleDelta.toFixed(4)),feetOffsetPx:Number(feetOffsetPx.toFixed(2)),centerOffsetPx:Number(centerOffsetPx.toFixed(2)),classification:reasons.includes('clipped')?'ART DEFECT — REGENERATION REQUIRED':reasons.length?'MECHANICAL REPAIR':'OK',label:`${direction} · frame ${phase}`});
  });
  const defective=findings.filter(x=>!x.healthy).sort((a,b)=>b.severity-a.severity||a.index-b.index);
  return Object.freeze({pass:defective.length===0,total:frames.length,defectiveCount:defective.length,healthyCount:frames.length-defective.length,medians:globalBaseline,rowBaselines:Object.freeze([...rowBaselines.entries()].map(([row,value])=>Object.freeze({row,...value}))),frames:Object.freeze(findings),defective:Object.freeze(defective)});
}

export function buildSelectiveRepairTargets(diagnosis,{maxTargets=8}={}){
  const selected=(diagnosis?.defective||[]).slice(0,Math.max(1,Math.floor(finite(maxTargets,8))));
  return Object.freeze(selected.map(item=>Object.freeze({index:item.index,row:item.row,column:item.column,direction:item.direction,phase:item.phase,severity:item.severity,reasons:item.reasons,label:item.label})));
}

function assertAtlas(data,width,height){if(!data||data.length<width*height*4)throw new Error('SPRITE_FRAME_DOCTOR_ATLAS_REQUIRED');}
export function replaceAtlasFramePixels({atlasData,width,height,columns,rows,index,replacementData,replacementWidth,replacementHeight}){
  assertAtlas(atlasData,width,height);assertAtlas(replacementData,replacementWidth,replacementHeight);
  columns=Math.max(1,Math.floor(finite(columns,1)));rows=Math.max(1,Math.floor(finite(rows,1)));index=Math.floor(finite(index,-1));if(index<0||index>=columns*rows)throw new Error('SPRITE_FRAME_DOCTOR_INDEX_INVALID');
  const col=index%columns,row=Math.floor(index/columns),x0=Math.floor(col*width/columns),x1=Math.floor((col+1)*width/columns),y0=Math.floor(row*height/rows),y1=Math.floor((row+1)*height/rows),cellW=x1-x0,cellH=y1-y0;
  if(replacementWidth!==cellW||replacementHeight!==cellH)throw new Error('SPRITE_FRAME_DOCTOR_REPLACEMENT_SIZE_MISMATCH');
  const out=new Uint8ClampedArray(atlasData);
  for(let y=0;y<cellH;y++)for(let x=0;x<cellW;x++){const si=(y*cellW+x)*4,di=((y0+y)*width+x0+x)*4;out[di]=replacementData[si];out[di+1]=replacementData[si+1];out[di+2]=replacementData[si+2];out[di+3]=replacementData[si+3];}
  return Object.freeze({data:out,index,row,column:col,cell:Object.freeze({x:x0,y:y0,width:cellW,height:cellH})});
}
