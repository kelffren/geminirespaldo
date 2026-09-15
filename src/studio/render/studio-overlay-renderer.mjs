/* KELO-INDEX
 * area: STUDIO / OVERLAY RENDERER
 * owns: transient editor-only selection/ghost/gizmo/surface/collision/prefab/smart-guide/spacing/paint-copy/build primitives
 * does-not-own: world rendering, terrain textures, gameplay sprites or physics
 * public-api: createStudioOverlayRenderer(), resolveRoomPreviewGroups()
 * online: local-only
 */

export function resolveRoomPreviewGroups(rows=[]){
  const walls=[],floors=[],other=[];
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const row of rows||[]){
    const piece=row?.components?.buildingPiece||{},type=piece.type;
    if(type==='floor'&&piece.roomGenerated===true){
      floors.push(row);
      const x=Number(row.transform?.x)||0,y=Number(row.transform?.y)||0,w=Math.max(1,Number(row.bounds?.w)||1),h=Math.max(1,Number(row.bounds?.h)||1);
      minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x+w);maxY=Math.max(maxY,y+h);
    }else if(type==='wall'&&piece.roomGenerated===true)walls.push(row);
    else other.push(row);
  }
  const floorBounds=floors.length?{x:minX,y:minY,w:Math.max(1,maxX-minX),h:Math.max(1,maxY-minY)}:null;
  return{walls,floors,other,floorBounds};
}

export function createStudioOverlayRenderer({ kernel, tools, assetPreview } = {}) {
  if (!kernel) throw new Error('STUDIO_OVERLAY_KERNEL_REQUIRED');

  // BUG-0003 isolation switch. Paint Copies remains OFF by default. The renderer now
  // has a zero-copy preview path, but activation stays deliberate until mobile QA.
  let paintCopiesQueryEnabled=false;
  try{
    const q=new URLSearchParams(globalThis?.location?.search||'');
    paintCopiesQueryEnabled=q.get('paintCopies')==='1'||q.get('paintCopies')==='on';
  }catch(_error){}
  if(typeof globalThis!=='undefined'&&typeof globalThis.KELO_PAINT_COPIES_ENABLED!=='boolean'){
    globalThis.KELO_PAINT_COPIES_ENABLED=paintCopiesQueryEnabled;
  }
  const paintCopiesDiagnostics={
    enabled:paintCopiesQueryEnabled,
    previewCalls:0,
    zeroCopyReads:0,
    fallbackCloneReads:0,
    drawCalls:0,
    skippedFrames:0,
    lastRows:0,
    lastMs:0,
    maxMs:0,
    errors:0
  };
  if(typeof globalThis!=='undefined')globalThis.KELO_PAINT_COPIES_DIAGNOSTICS=paintCopiesDiagnostics;
  function isPaintCopiesEnabled(){
    return typeof globalThis!=='undefined'&&globalThis.KELO_PAINT_COPIES_ENABLED===true;
  }
  function drawRect(ctx, rect, { dashed = false, alpha = 1 } = {}) { ctx.save(); ctx.globalAlpha *= alpha; if (dashed) ctx.setLineDash([6,4]); ctx.strokeRect(rect.x, rect.y, rect.w, rect.h); ctx.restore(); }
  function drawSurfaceCell(ctx,cell,{alpha=.24,dashed=false}={}){ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=cell.erase?'#ff7777':cell.role==='path'?'#e7c56a':'#70c46a';ctx.fillRect(cell.x,cell.y,cell.w,cell.h);ctx.restore();drawRect(ctx,cell,{dashed,alpha:.65});}
  function drawPlacement(ctx,placement){
    const rect={x:placement.transform.x,y:placement.transform.y,w:placement.bounds.w,h:placement.bounds.h};
    const snap=tools?.quickBuild?.active?tools.quickBuild.getSnapState?.():null;
    const state=snap?.state||'valid';
    const stroke=state==='snapped'?'rgba(140,240,180,.98)':state==='invalid'?'rgba(255,115,104,.98)':'rgba(131,235,175,.95)';
    const drew=assetPreview?.drawAsset?.(ctx,placement.prefabId,rect.x,rect.y,{rotation:placement.transform.rotation,alpha:state==='invalid'?.42:.72,placeholder:false});
    if(!drew){ctx.save();ctx.globalAlpha=state==='invalid'?.10:.18;ctx.fillRect(rect.x,rect.y,rect.w,rect.h);ctx.restore();}
    ctx.save();ctx.strokeStyle=stroke;ctx.lineWidth=state==='snapped'?3:2;drawRect(ctx,rect,{dashed:state!=='snapped'});
    const target=snap?.connection?.target;
    if(state==='snapped'&&target){ctx.fillStyle='rgba(140,240,180,.98)';ctx.beginPath();ctx.arc(Number(target.x)||0,Number(target.y)||0,5,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
  function drawBuildRow(ctx,row,{outline=true,alpha=.52,outlineAlpha=.9}={}){
    const rect={x:Number(row.transform?.x)||0,y:Number(row.transform?.y)||0,w:Math.max(1,Number(row.bounds?.w)||1),h:Math.max(1,Number(row.bounds?.h)||1)};
    const drew=assetPreview?.drawAsset?.(ctx,row.prefabId,rect.x,rect.y,{rotation:Number(row.transform?.rotation)||0,alpha,placeholder:false});
    if(!drew){ctx.save();ctx.globalAlpha=outline?.14:.09;ctx.fillRect(rect.x,rect.y,rect.w,rect.h);ctx.restore();}
    if(outline)drawRect(ctx,rect,{dashed:true,alpha:outlineAlpha});
  }
  function drawBuildDrag(ctx,rows){
    if(!rows?.length)return;
    ctx.save();ctx.strokeStyle='rgba(140,240,180,.98)';
    for(const row of rows)drawBuildRow(ctx,row);
    ctx.restore();
  }
  function drawRoomBuildDrag(ctx,rows){
    if(!rows?.length)return;
    const {walls,floors,other,floorBounds}=resolveRoomPreviewGroups(rows);
    ctx.save();
    for(const row of floors)drawBuildRow(ctx,row,{outline:false,alpha:.44});
    if(floorBounds){ctx.strokeStyle='rgba(120,210,180,.72)';drawRect(ctx,floorBounds,{dashed:true,alpha:.62});}
    ctx.strokeStyle='rgba(140,240,180,.98)';
    for(const row of [...walls,...other])drawBuildRow(ctx,row);
    ctx.restore();
  }
  function drawRoomMeasurement(ctx,measurement){
    if(!measurement)return;
    const x=Number(measurement.x)||0,y=Number(measurement.y)||0,w=Math.max(1,Number(measurement.width)||1),h=Math.max(1,Number(measurement.height)||1);
    const label=`${Math.round(w)} × ${Math.round(h)}  •  ${Number(measurement.modulesX)||0}×${Number(measurement.modulesY)||0} modules`;
    ctx.save();ctx.font='700 11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    const cx=x+w/2,cy=y+h/2,pad=5,textW=Math.max(72,ctx.measureText?.(label)?.width||72);
    ctx.fillStyle='rgba(5,14,16,.86)';ctx.fillRect(cx-textW/2-pad,cy-10,textW+pad*2,20);
    ctx.fillStyle='rgba(191,247,212,.98)';ctx.fillText(label,cx,cy);
    ctx.restore();
  }
  function drawCreatorPrefab(ctx,preview){
    const def=tools?.prefabStamp?.get?.(preview.prefabId);let drew=false;
    if(def?.children?.length){for(const child of def.children)drew=assetPreview?.drawAsset?.(ctx,child.prefabId,preview.x+(Number(child.dx)||0),preview.y+(Number(child.dy)||0),{rotation:Number(child.rotation)||0,alpha:.68,placeholder:false})||drew;}
    if(!drew){ctx.save();ctx.globalAlpha=.14;ctx.fillStyle='#e7c56a';ctx.fillRect(preview.x,preview.y,preview.w,preview.h);ctx.restore();}
    ctx.save();ctx.strokeStyle='rgba(231,197,106,.95)';drawRect(ctx,preview,{dashed:true});ctx.restore();
  }
  function drawPaintCopies(ctx,rows){
    if(!rows?.length)return;
    paintCopiesDiagnostics.drawCalls++;
    ctx.save();ctx.strokeStyle='rgba(131,235,175,.88)';
    for(const row of rows){
      const scale=Math.max(.1,Number(row.transform?.scale)||1),rect={x:Number(row.transform?.x)||0,y:Number(row.transform?.y)||0,w:Math.max(1,(Number(row.bounds?.w)||1)*scale),h:Math.max(1,(Number(row.bounds?.h)||1)*scale)};
      const drew=assetPreview?.drawAsset?.(ctx,row.prefabId,rect.x,rect.y,{rotation:Number(row.transform?.rotation)||0,alpha:.56,placeholder:false});
      if(!drew){ctx.save();ctx.globalAlpha=.12;ctx.fillRect(rect.x,rect.y,rect.w,rect.h);ctx.restore();}
      drawRect(ctx,rect,{dashed:true,alpha:.6});
    }
    ctx.restore();
  }
  function readPaintRows(){
    const tool=tools?.paintCopies;
    if(typeof tool?.getPreviewRefs==='function'){
      paintCopiesDiagnostics.zeroCopyReads++;
      return tool.getPreviewRefs()||[];
    }
    paintCopiesDiagnostics.fallbackCloneReads++;
    return tool?.getPreviews?.()||[];
  }
  function drawSpacingGuide(ctx,guide){
    const from=Number(guide.from)||0,to=Number(guide.to)||0,cross=Number(guide.cross)||0,mid=(from+to)/2,label=`${Math.round(Number(guide.gap)||0)}px`,tick=4;
    ctx.save();ctx.strokeStyle='rgba(244,221,141,.98)';ctx.fillStyle='rgba(244,221,141,.98)';ctx.lineWidth=1.4;ctx.setLineDash([]);ctx.beginPath();
    if(guide.axis==='x'){
      ctx.moveTo(from,cross);ctx.lineTo(to,cross);ctx.moveTo(from,cross-tick);ctx.lineTo(from,cross+tick);ctx.moveTo(to,cross-tick);ctx.lineTo(to,cross+tick);
    }else{
      ctx.moveTo(cross,from);ctx.lineTo(cross,to);ctx.moveTo(cross-tick,from);ctx.lineTo(cross+tick,from);ctx.moveTo(cross-tick,to);ctx.lineTo(cross+tick,to);
    }
    ctx.stroke();ctx.font='700 9px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';
    if(guide.axis==='x')ctx.fillText(label,mid,cross-3);else{ctx.save();ctx.translate(cross-3,mid);ctx.rotate(-Math.PI/2);ctx.fillText(label,0,0);ctx.restore();}
    ctx.restore();
  }
  function drawSmartGuides(ctx,guides){
    if(!guides?.length)return;
    for(const guide of guides){
      if(guide.kind==='spacing'){drawSpacingGuide(ctx,guide);continue;}
      ctx.save();ctx.strokeStyle='rgba(244,221,141,.96)';ctx.fillStyle='rgba(244,221,141,.96)';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.beginPath();
      if(guide.axis==='x'){ctx.moveTo(guide.position,guide.from);ctx.lineTo(guide.position,guide.to);}else{ctx.moveTo(guide.from,guide.position);ctx.lineTo(guide.to,guide.position);}ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(guide.axis==='x'?guide.position:guide.from,guide.axis==='x'?guide.from:guide.position,2.5,0,Math.PI*2);ctx.fill();ctx.restore();
    }
  }
  function draw(ctx) {
    if (!ctx) return;ctx.save();ctx.lineWidth = 2;
    for (const id of kernel.selection.get()) { const row = kernel.spatial.get(id); if (row?.rect) drawRect(ctx, row.rect); }
    const marquee=tools?.marquee?.getPreview?.();if(marquee){ctx.save();ctx.fillStyle='rgba(231,197,106,.10)';ctx.fillRect(marquee.x,marquee.y,marquee.w,marquee.h);ctx.strokeStyle='rgba(231,197,106,.85)';drawRect(ctx,marquee,{dashed:true});ctx.restore();}
    drawBuildDrag(ctx,tools?.quickBuild?.getDragPreviews?.()||[]);
    drawRoomBuildDrag(ctx,tools?.roomBuild?.getPreviews?.()||[]);
    drawRoomMeasurement(ctx,tools?.roomBuild?.getMeasurement?.());
    const placement = tools?.placement?.getPreview?.();if (placement) drawPlacement(ctx,placement);
    const prefab = tools?.prefabStamp?.getPreview?.();if(prefab)drawCreatorPrefab(ctx,prefab);
    if(isPaintCopiesEnabled()){
      const started=typeof performance!=='undefined'&&performance.now?performance.now():Date.now();
      try{
        paintCopiesDiagnostics.enabled=true;
        paintCopiesDiagnostics.previewCalls++;
        const paintRows=readPaintRows();
        paintCopiesDiagnostics.lastRows=paintRows.length;
        drawPaintCopies(ctx,paintRows);
      }catch(error){
        paintCopiesDiagnostics.errors++;
        console.error('[BUG-0003 Paint Copies]',error);
      }finally{
        const ended=typeof performance!=='undefined'&&performance.now?performance.now():Date.now();
        paintCopiesDiagnostics.lastMs=Math.max(0,ended-started);
        paintCopiesDiagnostics.maxMs=Math.max(paintCopiesDiagnostics.maxMs,paintCopiesDiagnostics.lastMs);
      }
    }else{
      paintCopiesDiagnostics.enabled=false;
      paintCopiesDiagnostics.skippedFrames++;
      paintCopiesDiagnostics.lastRows=0;
      paintCopiesDiagnostics.lastMs=0;
    }
    const transforms=tools?.transform?.getPreviews?.()||[];if(transforms.length){for(const transform of transforms){const row=kernel.spatial.get(transform.entityId);if(row?.rect)drawRect(ctx,{...row.rect,x:transform.x??row.rect.x,y:transform.y??row.rect.y},{dashed:true,alpha:.7});}drawSmartGuides(ctx,tools?.transform?.getGuides?.()||[]);}
    const stroke=tools?.terrain?.getStrokePreview?.();if(stroke?.cells?.length){for(const cell of stroke.cells)drawSurfaceCell(ctx,cell,{alpha:.20});}
    const terrain=tools?.terrain?.getPreview?.();if(terrain){const cells=terrain.cells?.length?terrain.cells:[terrain];for(const cell of cells)drawSurfaceCell(ctx,cell,{alpha:.28,dashed:true});}
    if (tools?.collision?.visible) { ctx.save();ctx.strokeStyle='rgba(255,105,105,.72)';ctx.fillStyle='rgba(255,80,80,.10)';for(const row of tools.collision.list?.()||[]){ctx.fillRect(row.x,row.y,row.w,row.h);drawRect(ctx,row,{alpha:.75});}const collision=tools.collision.getPreview?.();if(collision){ctx.globalAlpha=.28;ctx.fillRect(collision.x,collision.y,collision.w,collision.h);drawRect(ctx,collision,{dashed:true,alpha:1});}ctx.restore(); }
    ctx.restore();
  }
  return Object.freeze({ draw });
}
