/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / GRID DETECTION
 * owner: safe automatic grid detection for arbitrary sprite atlases
 * owns: candidate scoring, confidence, review-required gate
 * does-not-own: pixel repair, animation semantics, publishing
 */
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
function assertPixels(data,width,height){if(!data||data.length<width*height*4)throw new Error('SPRITE_COMPILER_GRID_PIXELS_REQUIRED');}
function isForeground(data,index,alphaThreshold){return data[index+3]>alphaThreshold;}

function boundaryEmptyRatio(data,width,height,axis,parts,alphaThreshold){
  if(parts<=1)return .5;
  let empty=0,total=0;
  const extent=axis==='x'?width:height;
  const other=axis==='x'?height:width;
  const cell=extent/parts;
  const band=Math.max(1,Math.round(cell*.035));
  const step=Math.max(1,Math.floor(other/96));
  for(let k=1;k<parts;k++){
    const center=Math.round(k*cell);
    for(let d=-band;d<=band;d++){
      const pos=clamp(center+d,0,extent-1);
      for(let o=0;o<other;o+=step){
        const x=axis==='x'?pos:o,y=axis==='x'?o:pos;
        total++;if(!isForeground(data,(y*width+x)*4,alphaThreshold))empty++;
      }
    }
  }
  return total?empty/total:0;
}

function cellOccupancy(data,width,height,cols,rows,alphaThreshold){
  const values=[];
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const x0=Math.floor(c*width/cols),x1=Math.max(x0+1,Math.floor((c+1)*width/cols));
    const y0=Math.floor(r*height/rows),y1=Math.max(y0+1,Math.floor((r+1)*height/rows));
    const sx=Math.max(1,Math.floor((x1-x0)/28)),sy=Math.max(1,Math.floor((y1-y0)/28));
    let on=0,total=0;
    for(let y=y0;y<y1;y+=sy)for(let x=x0;x<x1;x+=sx){total++;if(isForeground(data,(y*width+x)*4,alphaThreshold))on++;}
    values.push(total?on/total:0);
  }
  const nonEmpty=values.filter(v=>v>.004).length/values.length;
  const mean=values.reduce((s,v)=>s+v,0)/Math.max(1,values.length);
  const variance=values.reduce((s,v)=>s+(v-mean)*(v-mean),0)/Math.max(1,values.length);
  const cv=mean>0?Math.sqrt(variance)/mean:9;
  return{nonEmpty,mean,cv};
}

export function scoreSpriteGridCandidate(sourceData,width,height,cols,rows,{alphaThreshold=12}={}){
  const data=sourceData?.data||sourceData;assertPixels(data,width,height);
  const vertical=boundaryEmptyRatio(data,width,height,'x',cols,alphaThreshold);
  const horizontal=boundaryEmptyRatio(data,width,height,'y',rows,alphaThreshold);
  const occupancy=cellOccupancy(data,width,height,cols,rows,alphaThreshold);
  const cellRatio=(width/cols)/(height/rows);
  const aspectScore=Math.exp(-Math.abs(Math.log(Math.max(.04,cellRatio)))*1.45);
  const balanceScore=1-clamp((occupancy.cv-.1)/1.6,0,1);
  const boundaryScore=((cols>1?vertical:1)+(rows>1?horizontal:1))/2;
  const divisionBonus=clamp(((cols-1)+(rows-1))/17,0,1);
  const complexityPenalty=clamp((cols*rows-48)/120,0,.08);
  const score=clamp(boundaryScore*.38+aspectScore*.28+occupancy.nonEmpty*.17+balanceScore*.09+divisionBonus*.08-complexityPenalty,0,1);
  return Object.freeze({cols,rows,frames:cols*rows,score,boundaryScore,vertical,horizontal,cellRatio,aspectScore,nonEmpty:occupancy.nonEmpty,balanceScore,divisionBonus});
}

export function detectSpriteCompilerGrid(sourceData,width,height,{minCols=2,maxCols=12,minRows=1,maxRows=8,maxFrames=72,alphaThreshold=12,minConfidence=.5,minBoundary=.72}={}){
  const data=sourceData?.data||sourceData;assertPixels(data,width,height);
  width=Math.max(1,Math.round(finite(width,1)));height=Math.max(1,Math.round(finite(height,1)));
  const candidates=[];
  for(let rows=minRows;rows<=maxRows;rows++)for(let cols=minCols;cols<=maxCols;cols++){
    if(cols*rows>maxFrames)continue;
    candidates.push(scoreSpriteGridCandidate(data,width,height,cols,rows,{alphaThreshold}));
  }
  candidates.sort((a,b)=>b.score-a.score||b.boundaryScore-a.boundaryScore||Math.abs(a.cellRatio-1)-Math.abs(b.cellRatio-1)||a.frames-b.frames);
  const best=candidates[0];if(!best)throw new Error('SPRITE_COMPILER_GRID_NO_CANDIDATES');
  const runner=candidates.find(c=>c.cols!==best.cols||c.rows!==best.rows)||{score:0};
  const separation=clamp((best.score-runner.score)*3.5,0,1);
  const confidence=clamp(((best.score-.52)/.38)*.72+separation*.28,0,1);
  const reviewRequired=confidence<minConfidence||best.boundaryScore<minBoundary||best.nonEmpty<.72;
  return Object.freeze({
    columns:best.cols,rows:best.rows,frames:best.frames,confidence,score:best.score,
    boundaryScore:best.boundaryScore,reviewRequired,
    reason:confidence<minConfidence?'low-confidence':best.boundaryScore<minBoundary?'weak-boundaries':best.nonEmpty<.72?'empty-cells':'detected',
    candidates:Object.freeze(candidates.slice(0,8))
  });
}

export function selectSpriteCompilerGrid(detection,{fallbackColumns=4,fallbackRows=8}={}){
  if(!detection?.reviewRequired)return Object.freeze({columns:detection.columns,rows:detection.rows,source:'auto',reviewRequired:false,confidence:detection.confidence,reason:detection.reason});
  return Object.freeze({columns:fallbackColumns,rows:fallbackRows,source:'fallback-review',reviewRequired:true,confidence:detection?.confidence||0,reason:detection?.reason||'no-detection',suggested:detection?Object.freeze({columns:detection.columns,rows:detection.rows}):null});
}
