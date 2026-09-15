/* KELO-INDEX
 * area: STUDIO / TRANSFORM TOOL
 * owns: local single/group transform preview, magnetic smart guides, intelligent equal spacing and commit-on-release semantics
 * does-not-own: pointer transport or renderer
 * public-api: createTransformTool()
 * online: drag preview/guides are local; group commit becomes one CompositeCommand
 */

import { createMoveEntityCommand, createPatchEntityCommand } from '../document/document-commands.mjs';
import { createCompositeCommand } from '../document/composite-command.mjs';

const DEFAULT_MAGNET=10;
const DEFAULT_GUIDE_RANGE=256;
const SPACING_ALIGN_TOLERANCE=48;
const CANDIDATE_CACHE_MARGIN=96;

const rectIntersects=(a,b)=>a.x<a.x+a.w&&b.x<b.x+b.w&&a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const rectContains=(outer,inner)=>inner.x>=outer.x&&inner.y>=outer.y&&inner.x+inner.w<=outer.x+outer.w&&inner.y+inner.h<=outer.y+outer.h;

export function createTransformTool(kernel) {
  if (!kernel) throw new Error('STUDIO_TRANSFORM_KERNEL_REQUIRED');
  let state = null;
  const diagnostics={candidateQueries:0,candidateCacheHits:0};
  const find = id => kernel.document.entities.find(e => e.id === String(id)) || null;
  const n = value => Number(value) || 0;

  function rowRect(row,dx=0,dy=0){
    const spatial=kernel.spatial.get(row.entityId)?.rect,e=find(row.entityId),scale=Math.max(.1,Number(row.from?.scale ?? e?.transform?.scale ?? 1)||1);
    return{x:n(row.from.x)+dx,y:n(row.from.y)+dy,w:Math.max(1,Number(spatial?.w)||((Number(e?.bounds?.w)||1)*scale)),h:Math.max(1,Number(spatial?.h)||((Number(e?.bounds?.h)||1)*scale))};
  }
  function groupRect(rows,dx=0,dy=0){
    const rects=rows.map(row=>rowRect(row,dx,dy));if(!rects.length)return{x:0,y:0,w:1,h:1};
    const x=Math.min(...rects.map(r=>r.x)),y=Math.min(...rects.map(r=>r.y)),x2=Math.max(...rects.map(r=>r.x+r.w)),y2=Math.max(...rects.map(r=>r.y+r.h));return{x,y,w:x2-x,h:y2-y};
  }
  const marks=(rect,axis)=>axis==='x'?[{value:rect.x,kind:'start'},{value:rect.x+rect.w/2,kind:'center'},{value:rect.x+rect.w,kind:'end'}]:[{value:rect.y,kind:'start'},{value:rect.y+rect.h/2,kind:'center'},{value:rect.y+rect.h,kind:'end'}];
  const axisStart=(rect,axis)=>axis==='x'?rect.x:rect.y;
  const axisSize=(rect,axis)=>axis==='x'?rect.w:rect.h;
  const axisEnd=(rect,axis)=>axisStart(rect,axis)+axisSize(rect,axis);
  const crossStart=(rect,axis)=>axis==='x'?rect.y:rect.x;
  const crossSize=(rect,axis)=>axis==='x'?rect.h:rect.w;
  const crossCenter=(rect,axis)=>crossStart(rect,axis)+crossSize(rect,axis)/2;

  function bestAxisSnap(axis,moving,candidates,threshold){
    let best=null;const own=marks(moving,axis);
    for(const candidate of candidates){for(const source of own){for(const target of marks(candidate.rect,axis)){
      const delta=target.value-source.value,abs=Math.abs(delta);if(abs>threshold)continue;
      const sameKind=source.kind===target.kind?0:1,centerPair=source.kind==='center'&&target.kind==='center'?0:1,score=[abs,centerPair,sameKind];
      if(!best||score[0]<best.score[0]||(score[0]===best.score[0]&&score[1]<best.score[1])||(score[0]===best.score[0]&&score[1]===best.score[1]&&score[2]<best.score[2]))best={type:'align',axis,delta,position:target.value,sourceKind:source.kind,targetKind:target.kind,candidateId:candidate.id,candidateRect:candidate.rect,score};
    }}}
    return best;
  }
  function nearbyCandidates(moving,range){
    const selected=new Set(state.rows.map(row=>String(row.entityId))),pad=Math.max(DEFAULT_GUIDE_RANGE,Number(range)||DEFAULT_GUIDE_RANGE),requested={x:moving.x-pad,y:moving.y-pad,w:moving.w+pad*2,h:moving.h+pad*2};
    let rows;
    if(state.candidateCache&&rectContains(state.candidateCache.area,requested)){
      diagnostics.candidateCacheHits++;rows=state.candidateCache.rows;
    }else{
      const margin=Math.max(CANDIDATE_CACHE_MARGIN,pad*.25),area={x:requested.x-margin,y:requested.y-margin,w:requested.w+margin*2,h:requested.h+margin*2};
      rows=kernel.spatial.queryRect(area,{category:'entity'});diagnostics.candidateQueries++;state.candidateCache={area,rows};
    }
    return rows.filter(row=>!selected.has(String(row.id))&&row.rect&&rectIntersects(row.rect,requested));
  }
  function guideFromSnap(snap,moving){
    if(!snap||snap.type!=='align')return null;const target=snap.candidateRect;
    if(snap.axis==='x')return{axis:'x',position:snap.position,from:Math.min(moving.y,target.y)-18,to:Math.max(moving.y+moving.h,target.y+target.h)+18,kind:snap.sourceKind===snap.targetKind?snap.sourceKind:'edge'};
    return{axis:'y',position:snap.position,from:Math.min(moving.x,target.x)-18,to:Math.max(moving.x+moving.w,target.x+target.w)+18,kind:snap.sourceKind===snap.targetKind?snap.sourceKind:'edge'};
  }
  function crossCompatible(axis,moving,a,b=null){
    const rows=b?[a.rect,b.rect]:[a.rect];
    const tolerance=Math.max(SPACING_ALIGN_TOLERANCE,crossSize(moving,axis)*.75);
    return rows.every(rect=>Math.abs(crossCenter(rect,axis)-crossCenter(moving,axis))<=Math.max(tolerance,crossSize(rect,axis)*.75));
  }
  function spacingGuide(axis,from,to,moving,gap,slot){
    const cross=crossCenter(moving,axis)+(slot===0?-12:12);
    return{kind:'spacing',axis,from,to,cross,gap:Math.max(0,gap)};
  }
  function spacingSnapBetween(axis,moving,candidates,threshold){
    let best=null;
    const before=candidates.filter(row=>axisEnd(row.rect,axis)<=axisStart(moving,axis)+threshold&&crossCompatible(axis,moving,row));
    const after=candidates.filter(row=>axisStart(row.rect,axis)>=axisEnd(moving,axis)-threshold&&crossCompatible(axis,moving,row));
    for(const left of before){for(const right of after){
      const available=axisStart(right.rect,axis)-axisEnd(left.rect,axis)-axisSize(moving,axis);if(available<0)continue;
      const targetStart=axisEnd(left.rect,axis)+available/2,delta=targetStart-axisStart(moving,axis),abs=Math.abs(delta);if(abs>threshold)continue;
      const gap=available/2,score=[abs,Math.abs(crossCenter(left.rect,axis)-crossCenter(right.rect,axis))];
      if(!best||score[0]<best.score[0]||(score[0]===best.score[0]&&score[1]<best.score[1]))best={type:'spacing',mode:'between',axis,delta,gap,refs:[left.id,right.id],leftRect:left.rect,rightRect:right.rect,score};
    }}
    return best;
  }
  function spacingSnapRepeat(axis,moving,candidates,threshold){
    let best=null;
    const compatible=candidates.filter(row=>crossCompatible(axis,moving,row)).sort((a,b)=>axisStart(a.rect,axis)-axisStart(b.rect,axis));
    for(let i=0;i<compatible.length-1;i++){
      const first=compatible[i],second=compatible[i+1],gap=axisStart(second.rect,axis)-axisEnd(first.rect,axis);if(gap<0)continue;
      if(axisEnd(second.rect,axis)<=axisStart(moving,axis)+threshold){
        const targetStart=axisEnd(second.rect,axis)+gap,delta=targetStart-axisStart(moving,axis),abs=Math.abs(delta);if(abs<=threshold){
          const score=[abs,gap];if(!best||score[0]<best.score[0])best={type:'spacing',mode:'after',axis,delta,gap,refs:[first.id,second.id],firstRect:first.rect,secondRect:second.rect,score};
        }
      }
      if(axisStart(first.rect,axis)>=axisEnd(moving,axis)-threshold){
        const targetEnd=axisStart(first.rect,axis)-gap,targetStart=targetEnd-axisSize(moving,axis),delta=targetStart-axisStart(moving,axis),abs=Math.abs(delta);if(abs<=threshold){
          const score=[abs,gap];if(!best||score[0]<best.score[0])best={type:'spacing',mode:'before',axis,delta,gap,refs:[first.id,second.id],firstRect:first.rect,secondRect:second.rect,score};
        }
      }
    }
    return best;
  }
  function bestSpacingSnap(axis,moving,candidates,threshold){
    const between=spacingSnapBetween(axis,moving,candidates,threshold),repeat=spacingSnapRepeat(axis,moving,candidates,threshold);
    if(!between)return repeat;if(!repeat)return between;return between.score[0]<=repeat.score[0]?between:repeat;
  }
  function guidesFromSpacing(snap,moving){
    if(!snap||snap.type!=='spacing')return[];
    const start=axisStart(moving,snap.axis),end=axisEnd(moving,snap.axis),out=[];
    if(snap.mode==='between'){
      out.push(spacingGuide(snap.axis,axisEnd(snap.leftRect,snap.axis),start,moving,snap.gap,0));
      out.push(spacingGuide(snap.axis,end,axisStart(snap.rightRect,snap.axis),moving,snap.gap,1));
    }else if(snap.mode==='after'){
      out.push(spacingGuide(snap.axis,axisEnd(snap.firstRect,snap.axis),axisStart(snap.secondRect,snap.axis),moving,snap.gap,0));
      out.push(spacingGuide(snap.axis,axisEnd(snap.secondRect,snap.axis),start,moving,snap.gap,1));
    }else{
      out.push(spacingGuide(snap.axis,end,axisStart(snap.firstRect,snap.axis),moving,snap.gap,0));
      out.push(spacingGuide(snap.axis,axisEnd(snap.firstRect,snap.axis),axisStart(snap.secondRect,snap.axis),moving,snap.gap,1));
    }
    return out;
  }
  function chooseAxisSnap(align,spacing){
    if(!spacing)return align;if(!align)return spacing;
    return Math.abs(spacing.delta)<=Math.abs(align.delta)+2?spacing:align;
  }

  function begin(entityId,{useSelection=true}={}) {
    const entity=find(entityId);if(!entity)throw new Error('STUDIO_ENTITY_NOT_FOUND');
    const selected=kernel.selection.get(),ids=useSelection&&selected.includes(entity.id)&&selected.length>1?selected.slice():[entity.id];
    const rows=ids.map(id=>{const e=find(id);return e?{entityId:id,from:{...(e.transform||{})},preview:{...(e.transform||{})}}:null;}).filter(Boolean);
    const anchor=rows.find(row=>row.entityId===entity.id)||rows[0];state={entityId:entity.id,anchorFrom:{...anchor.from},rows,snapTarget:null,guides:[],candidateCache:null};return snapshot();
  }

  function previewMove(x,y,{snap=1,smart=true,magnet=DEFAULT_MAGNET,guideRange=DEFAULT_GUIDE_RANGE,spacing=true}={}){
    if(!state)return null;
    const s=Math.max(1,Number(snap)||1),tx=n(x),ty=n(y),anchorX=n(state.anchorFrom.x),anchorY=n(state.anchorFrom.y),rawDx=tx-anchorX,rawDy=ty-anchorY;
    const rawGroup=groupRect(state.rows,rawDx,rawDy),threshold=Math.max(0,Number(magnet)||0),candidates=smart&&threshold>0?nearbyCandidates(rawGroup,guideRange):[];
    const xAlign=bestAxisSnap('x',rawGroup,candidates,threshold),yAlign=bestAxisSnap('y',rawGroup,candidates,threshold),xSpacing=spacing?bestSpacingSnap('x',rawGroup,candidates,threshold):null,ySpacing=spacing?bestSpacingSnap('y',rawGroup,candidates,threshold):null;
    const xSnap=chooseAxisSnap(xAlign,xSpacing),ySnap=chooseAxisSnap(yAlign,ySpacing),finalTx=xSnap?tx+xSnap.delta:Math.round(tx/s)*s,finalTy=ySnap?ty+ySnap.delta:Math.round(ty/s)*s,dx=finalTx-anchorX,dy=finalTy-anchorY,previewGroup=groupRect(state.rows,dx,dy);
    state.snapTarget={x:finalTx,y:finalTy,snap:s,magneticX:!!xSnap,magneticY:!!ySnap,spacingX:xSnap?.type==='spacing',spacingY:ySnap?.type==='spacing'};
    state.guides=[guideFromSnap(xSnap,previewGroup),guideFromSnap(ySnap,previewGroup),...guidesFromSpacing(xSnap,previewGroup),...guidesFromSpacing(ySnap,previewGroup)].filter(Boolean);
    for(const row of state.rows){row.preview.x=n(row.from.x)+dx;row.preview.y=n(row.from.y)+dy;}
    return snapshot();
  }

  function previewRotate(rotation){if(!state)return null;const row=state.rows.find(x=>x.entityId===state.entityId)||state.rows[0];row.preview.rotation=Number(rotation)||0;return snapshot();}
  function cancel(){state=null;}
  function snapshot(){if(!state)return null;return{entityId:state.entityId,rows:state.rows.map(row=>({entityId:row.entityId,from:{...row.from},preview:{...row.preview}})),guides:state.guides.map(guide=>({...guide})),snapTarget:state.snapTarget?{...state.snapTarget}:null,...((state.rows.find(x=>x.entityId===state.entityId)||state.rows[0])?.preview||{})};}

  async function commit(){
    if(!state)throw new Error('STUDIO_TRANSFORM_NOT_ACTIVE');const current=state;state=null;const commands=[];
    const snap=current.snapTarget,anchorX=n(current.anchorFrom.x),anchorY=n(current.anchorFrom.y),snapDx=snap?Number(snap.x)-anchorX:null,snapDy=snap?Number(snap.y)-anchorY:null;
    for(const row of current.rows){
      const finalX=snap?n(row.from.x)+snapDx:n(row.preview.x),finalY=snap?n(row.from.y)+snapDy:n(row.preview.y);
      const moved=Number(row.from.x)!==finalX||Number(row.from.y)!==finalY;if(moved)commands.push(createMoveEntityCommand(row.entityId,{x:finalX,y:finalY}));
      const rotated=Number(row.from.rotation||0)!==Number(row.preview.rotation||0);if(rotated){const e=find(row.entityId);commands.push(createPatchEntityCommand(row.entityId,{transform:{...(e?.transform||{}),rotation:row.preview.rotation}}));}
    }
    if(!commands.length)return{entityIds:current.rows.map(x=>x.entityId),commands:0};
    if(commands.length===1)await kernel.execute(commands[0]);else await kernel.execute(createCompositeCommand(commands,{type:'entity.batch.transform',label:`Move ${current.rows.length} object${current.rows.length===1?'':'s'}`}));
    return{entityIds:current.rows.map(x=>x.entityId),commands:commands.length};
  }

  return Object.freeze({id:'transform',begin,previewMove,previewRotate,commit,cancel,getPreview:snapshot,getPreviews:()=>state?state.rows.map(row=>({entityId:row.entityId,...row.preview})):[],getGuides:()=>state?state.guides.map(guide=>({...guide})):[],getDiagnostics:()=>({...diagnostics})});
}
