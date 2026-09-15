/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / LOCAL FRAME GEOMETRY REPAIR
 * owner: free deterministic repair of isolated scale and center drift defects
 * owns: safe repair planning and canvas application while preserving healthy cells
 * does-not-own: missing-body-part reconstruction, art generation, publishing
 */
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const median=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};

export function planLocalFrameGeometryRepairs(frames,diagnosis,{maxRepairs=8}={}){
  const rowBaseline=new Map((diagnosis?.rowBaselines||[]).map(x=>[x.row,x]));
  const byRow=new Map();for(const f of frames){const row=Number.isFinite(f?.row)?f.row:0;if(!byRow.has(row))byRow.set(row,[]);byRow.get(row).push(f);}
  const operations=[],skipped=[];
  for(const item of diagnosis?.defective||[]){
    if(operations.length>=Math.max(1,Math.floor(finite(maxRepairs,8))))break;
    const frame=frames[item.index],reasons=item.reasons||[],onlyGeometry=reasons.every(r=>r==='scale-outlier'||r==='occupancy-outlier'||r==='center-drift'),hasScale=reasons.includes('scale-outlier'),centerOnly=reasons.length===1&&reasons[0]==='center-drift';
    if(!frame?.bounds||!frame?.cell||!onlyGeometry||(!hasScale&&!centerOnly)){skipped.push(Object.freeze({...item,skipReason:'manual-or-generative-repair-required'}));continue;}
    const base=rowBaseline.get(item.row)||diagnosis?.medians||{},siblings=(byRow.get(item.row)||[]).filter(f=>f.bounds&&f.index!==item.index&&!diagnosis.frames?.[f.index]?.reasons?.includes('clipped'));
    const bottomGap=median(siblings.map(f=>f.cell.y+f.cell.height-1-f.bounds.bottom));
    const width=centerOnly?frame.bounds.width:Math.max(1,Math.round(base.width||frame.bounds.width)),height=centerOnly?frame.bounds.height:Math.max(1,Math.round(base.height||frame.bounds.height));
    const x=Math.round(frame.cell.x+(frame.cell.width-width)/2),y=Math.round(frame.cell.y+frame.cell.height-1-bottomGap-height+1);
    operations.push(Object.freeze({index:item.index,row:item.row,column:item.column,label:item.label,reasons:item.reasons,source:Object.freeze({...frame.bounds}),destination:Object.freeze({x,y,width,height}),cell:frame.cell}));
  }
  return Object.freeze({operations:Object.freeze(operations),skipped:Object.freeze(skipped)});
}

export function applyFrameGeometryRepairs(root,canvas,operations,{imageSmoothing=false,profile='pixel-art'}={}){
  if(!root?.document||!canvas?.getContext)throw new Error('SPRITE_FRAME_GEOMETRY_CANVAS_REQUIRED');
  const ctx=canvas.getContext('2d',{willReadFrequently:true}),applied=[],smoothing=profile==='pixel-art'?false:!!imageSmoothing;
  for(const op of operations||[]){
    const temp=root.document.createElement('canvas');temp.width=op.source.width;temp.height=op.source.height;const tctx=temp.getContext('2d');tctx.clearRect(0,0,temp.width,temp.height);tctx.imageSmoothingEnabled=false;tctx.drawImage(canvas,op.source.x,op.source.y,op.source.width,op.source.height,0,0,temp.width,temp.height);
    ctx.clearRect(op.cell.x,op.cell.y,op.cell.width,op.cell.height);ctx.imageSmoothingEnabled=smoothing;ctx.drawImage(temp,0,0,temp.width,temp.height,op.destination.x,op.destination.y,op.destination.width,op.destination.height);applied.push(op.index);
  }
  return Object.freeze({canvas,applied:Object.freeze(applied),imageSmoothing:smoothing,profile});
}
