/* KELO-INDEX
 * area: CREATORS / SPRITE ABILITY / FRAME POLICY
 * purpose: make frame-count/grid decisions explicit instead of letting low-confidence or geometrically implausible auto-fit silently guess
 */
const PRESETS=Object.freeze([
  Object.freeze({cols:8,rows:4,label:'8×4',frames:32}),
  Object.freeze({cols:6,rows:4,label:'6×4',frames:24}),
  Object.freeze({cols:4,rows:6,label:'4×6',frames:24}),
  Object.freeze({cols:4,rows:4,label:'4×4',frames:16}),
]);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const aspectPenalty=(w,h,cols,rows)=>Math.abs(Math.log(Math.max(.05,(w/Math.max(1,cols))/(h/Math.max(1,rows)))/.9));

export function spriteFrameCount(sheet={}){
  return Math.max(1,Math.round(Number(sheet.columns)||1)*Math.round(Number(sheet.rows)||1));
}

export function chooseSafeGrid({width=0,height=0,detected=null,confidenceThreshold=.45,geometryMargin=.34}={}){
  const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1);
  const d=detected&&Number.isFinite(Number(detected.cols))&&Number.isFinite(Number(detected.rows))?detected:null;
  let best=null;
  for(const p of PRESETS){
    const penalty=aspectPenalty(w,h,p.cols,p.rows),score=1/(1+penalty);
    if(!best||score>best.score)best={...p,score,penalty};
  }
  const confidence=d?clamp(Number(d.confidence)||0,0,1):0;
  if(d){
    const detectedPenalty=aspectPenalty(w,h,d.cols,d.rows);
    const geometryClearlyBetter=best.penalty+geometryMargin<detectedPenalty;
    if(confidence>=confidenceThreshold&&!geometryClearlyBetter){
      return Object.freeze({cols:d.cols,rows:d.rows,label:`${d.cols}×${d.rows}`,frames:d.cols*d.rows,source:'auto',confidence,reason:'detected'});
    }
    return Object.freeze({cols:best.cols,rows:best.rows,label:best.label,frames:best.frames,source:'preset-fallback',confidence,reason:confidence<confidenceThreshold?'low-confidence':'geometry-mismatch'});
  }
  return Object.freeze({cols:best.cols,rows:best.rows,label:best.label,frames:best.frames,source:'preset-fallback',confidence:0,reason:'no-detection'});
}

export function playbackLabel(sheet={}){
  const frames=spriteFrameCount(sheet),cols=Math.max(1,Math.round(Number(sheet.columns)||1)),rows=Math.max(1,Math.round(Number(sheet.rows)||1));
  const start=Math.max(0,Math.round(Number(sheet.startFrame)||0)),end=Math.max(start,Math.round(Number(sheet.endFrame)||frames-1));
  return `${frames} FRAMES · ${cols}×${rows} · ${start}→${end}`;
}

export const SPRITE_ABILITY_GRID_PRESETS=PRESETS;
