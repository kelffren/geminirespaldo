/* KELO-INDEX
 * area: CREATORS / SPRITE ABILITY / AUTO FIT
 * owner: Sprite Ability Builder import normalization
 * keys: SPRITESHEET AUTO DETECT GRID TRANSPARENCY BACKGROUND NORMALIZE SLICE SAFE GRID MANUAL CUT
 * purpose: acepta hojas con tamaños irregulares, detecta una rejilla probable y genera una hoja PNG exacta divisible por filas/columnas
 * does-not-own: animation timing, combat authority, publishing
 */
import { chooseSafeGrid } from './sprite-ability-frame-policy.mjs';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

function colorDistance(r,g,b,bg){
  const dr=r-bg.r,dg=g-bg.g,db=b-bg.b;
  return Math.sqrt(dr*dr+dg*dg+db*db);
}

function cornerBackground(data,width,height,{alphaThreshold=12,colorThreshold=28}={}){
  const pts=[[0,0],[width-1,0],[0,height-1],[width-1,height-1]];
  const colors=pts.map(([x,y])=>{const i=(y*width+x)*4;return{r:data[i],g:data[i+1],b:data[i+2],a:data[i+3]};});
  if(colors.some(c=>c.a<=alphaThreshold))return null;
  const avg={r:colors.reduce((s,c)=>s+c.r,0)/4,g:colors.reduce((s,c)=>s+c.g,0)/4,b:colors.reduce((s,c)=>s+c.b,0)/4,a:colors.reduce((s,c)=>s+c.a,0)/4};
  const spread=Math.max(...colors.map(c=>colorDistance(c.r,c.g,c.b,avg)));
  return spread<=colorThreshold*1.5?avg:null;
}

export function buildForegroundMask(imageData,width,height,{alphaThreshold=12,colorThreshold=28}={}){
  const data=imageData?.data||imageData;
  if(!data||data.length<width*height*4)throw new Error('SPRITESHEET_IMAGE_DATA_REQUIRED');
  const background=cornerBackground(data,width,height,{alphaThreshold,colorThreshold});
  const mask=new Uint8Array(width*height);
  let foreground=0;
  for(let p=0,i=0;p<mask.length;p++,i+=4){
    const a=data[i+3];
    let on=a>alphaThreshold;
    if(on&&background)on=colorDistance(data[i],data[i+1],data[i+2],background)>colorThreshold;
    if(on){mask[p]=1;foreground++;}
  }
  return Object.freeze({mask,background,foreground,backgroundMode:background?'solid-corner':'alpha'});
}

function boundaryEmptyRatio(mask,width,height,axis,parts){
  if(parts<=1)return .5;
  let empty=0,total=0;
  if(axis==='x'){
    const cell=width/parts,band=Math.max(1,Math.round(cell*.018));
    for(let k=1;k<parts;k++){
      const center=Math.round(k*cell);
      for(let x=Math.max(0,center-band);x<=Math.min(width-1,center+band);x++)for(let y=0;y<height;y+=2){total++;if(!mask[y*width+x])empty++;}
    }
  }else{
    const cell=height/parts,band=Math.max(1,Math.round(cell*.018));
    for(let k=1;k<parts;k++){
      const center=Math.round(k*cell);
      for(let y=Math.max(0,center-band);y<=Math.min(height-1,center+band);y++)for(let x=0;x<width;x+=2){total++;if(!mask[y*width+x])empty++;}
    }
  }
  return total?empty/total:0;
}

function cellOccupancy(mask,width,height,cols,rows){
  const values=[];
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const x0=Math.floor(c*width/cols),x1=Math.max(x0+1,Math.floor((c+1)*width/cols));
    const y0=Math.floor(r*height/rows),y1=Math.max(y0+1,Math.floor((r+1)*height/rows));
    const sx=Math.max(1,Math.floor((x1-x0)/36)),sy=Math.max(1,Math.floor((y1-y0)/36));
    let on=0,total=0;
    for(let y=y0;y<y1;y+=sy)for(let x=x0;x<x1;x+=sx){total++;if(mask[y*width+x])on++;}
    values.push(total?on/total:0);
  }
  const nonEmpty=values.filter(v=>v>.006).length/values.length;
  const mean=values.reduce((s,v)=>s+v,0)/Math.max(1,values.length);
  const variance=values.reduce((s,v)=>s+(v-mean)*(v-mean),0)/Math.max(1,values.length);
  const cv=mean>0?Math.sqrt(variance)/mean:9;
  return{nonEmpty,mean,cv};
}

export function scoreGrid(mask,width,height,cols,rows){
  const vertical=boundaryEmptyRatio(mask,width,height,'x',cols);
  const horizontal=boundaryEmptyRatio(mask,width,height,'y',rows);
  const occ=cellOccupancy(mask,width,height,cols,rows);
  const ratio=(width/cols)/(height/rows);
  const aspectScore=Math.exp(-Math.abs(Math.log(Math.max(.05,ratio)/.9))*.72);
  const balanceScore=1-clamp((occ.cv-.18)/1.8,0,1);
  const divisionBonus=clamp(((cols-1)+(rows-1))/13,0,1);
  const score=(vertical*.31)+(horizontal*.25)+(occ.nonEmpty*.19)+(aspectScore*.13)+(balanceScore*.07)+(divisionBonus*.05);
  return Object.freeze({cols,rows,score,vertical,horizontal,nonEmpty:occ.nonEmpty,aspectScore,balanceScore,cellRatio:ratio});
}

export function detectSpritesheetGrid(imageData,width,height,{minCols=2,maxCols=12,minRows=1,maxRows=8,alphaThreshold=12,colorThreshold=28}={}){
  width=Math.max(1,Math.round(finite(width,1)));height=Math.max(1,Math.round(finite(height,1)));
  const fg=buildForegroundMask(imageData,width,height,{alphaThreshold,colorThreshold});
  if(!fg.foreground)throw new Error('SPRITESHEET_NO_FOREGROUND');
  const candidates=[];
  for(let rows=minRows;rows<=maxRows;rows++)for(let cols=minCols;cols<=maxCols;cols++){
    if(cols*rows>72)continue;
    candidates.push(scoreGrid(fg.mask,width,height,cols,rows));
  }
  candidates.sort((a,b)=>b.score-a.score||Math.abs(a.cellRatio-.9)-Math.abs(b.cellRatio-.9)||b.cols*b.rows-a.cols*a.rows);
  const best=candidates[0],second=candidates[1]||{score:0};
  const separation=clamp((best.score-second.score)*3.2,0,1);
  const confidence=clamp((best.score-.48)/.42,0,1)*.72+separation*.28;
  return Object.freeze({cols:best.cols,rows:best.rows,confidence:clamp(confidence,0,1),score:best.score,background:fg.background,backgroundMode:fg.backgroundMode,candidates:Object.freeze(candidates.slice(0,8))});
}

function nextFriendly(value){
  value=Math.max(1,Math.round(value));
  return Math.max(1,Math.round(value/2)*2);
}

export function normalizedGridSize(width,height,cols,rows){
  const cellWidth=nextFriendly(width/cols),cellHeight=nextFriendly(height/rows);
  return Object.freeze({cellWidth,cellHeight,width:cellWidth*cols,height:cellHeight*rows});
}

export function normalizeSpritesheetPixels({sourceData,width,height,cols,rows,background=null,colorThreshold=28,createCanvas}){
  if(typeof createCanvas!=='function')throw new Error('SPRITESHEET_CANVAS_FACTORY_REQUIRED');
  const target=normalizedGridSize(width,height,cols,rows);
  const source=createCanvas(width,height),sctx=source.getContext('2d',{willReadFrequently:true});
  const raw=sctx.createImageData(width,height);raw.data.set(sourceData);sctx.putImageData(raw,0,0);
  if(background){
    const img=sctx.getImageData(0,0,width,height),d=img.data;
    for(let i=0;i<d.length;i+=4)if(d[i+3]&&colorDistance(d[i],d[i+1],d[i+2],background)<=colorThreshold)d[i+3]=0;
    sctx.putImageData(img,0,0);
  }
  const out=createCanvas(target.width,target.height),ctx=out.getContext('2d');ctx.clearRect(0,0,target.width,target.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const sx=c*width/cols,sy=r*height/rows,sw=width/cols,sh=height/rows;
    ctx.drawImage(source,sx,sy,sw,sh,c*target.cellWidth,r*target.cellHeight,target.cellWidth,target.cellHeight);
  }
  return Object.freeze({canvas:out,...target,cols,rows,backgroundRemoved:!!background});
}

function gridAspectPenalty(width,height,cols,rows){
  const cellRatio=(width/Math.max(1,cols))/(height/Math.max(1,rows));
  return Math.abs(Math.log(Math.max(.05,cellRatio)/.9));
}

export function resolveSpritesheetGrid(width,height,detected){
  const fallback=chooseSafeGrid({width,height,detected,confidenceThreshold:.45});
  if(!detected)return fallback;
  const detectedPenalty=gridAspectPenalty(width,height,detected.cols,detected.rows);
  const fallbackPenalty=gridAspectPenalty(width,height,fallback.cols,fallback.rows);
  const geometryClearlyBetter=fallback.source==='preset-fallback'&&fallbackPenalty+.34<detectedPenalty;
  if(Number(detected.confidence)<.45||geometryClearlyBetter)return Object.freeze({...fallback,reason:Number(detected.confidence)<.45?'low-confidence':'geometry-mismatch'});
  return Object.freeze({cols:detected.cols,rows:detected.rows,label:`${detected.cols}×${detected.rows}`,frames:detected.cols*detected.rows,source:'auto',confidence:detected.confidence,reason:'detected'});
}

export function consumeManualGridHint(root,width,height,{maxAgeMs=30000}={}){
  const hint=root?.__KELO_SPRITE_MANUAL_GRID;if(!hint)return null;
  try{delete root.__KELO_SPRITE_MANUAL_GRID;}catch{root.__KELO_SPRITE_MANUAL_GRID=null;}
  const columns=clamp(Math.round(finite(hint.columns,0)),1,12),rows=clamp(Math.round(finite(hint.rows,0)),1,8),age=Math.max(0,Date.now()-finite(hint.createdAt,0));
  if(columns*rows>72||age>maxAgeMs)return null;
  if(Math.round(finite(hint.width,-1))!==Math.round(width)||Math.round(finite(hint.height,-1))!==Math.round(height))return null;
  if(width%columns!==0||height%rows!==0)return null;
  return Object.freeze({columns,rows,frames:columns*rows,frameWidth:width/columns,frameHeight:height/rows});
}

export function analyzeAndNormalizeSpritesheet(root,image,{minCols=2,maxCols=12,minRows=1,maxRows=8}={}){
  const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
  const source=root.document.createElement('canvas');source.width=width;source.height=height;
  const sctx=source.getContext('2d',{willReadFrequently:true});sctx.clearRect(0,0,width,height);sctx.drawImage(image,0,0);
  const manual=consumeManualGridHint(root,width,height);
  if(manual)return Object.freeze({
    dataUrl:source.toDataURL('image/png'),sourceWidth:width,sourceHeight:height,width,height,
    frameWidth:manual.frameWidth,frameHeight:manual.frameHeight,columns:manual.columns,rows:manual.rows,frames:manual.frames,
    confidence:1,score:1,gridSource:'manual',gridReason:'manual-cuts',backgroundMode:'alpha',backgroundRemoved:false,candidates:Object.freeze([])
  });
  const pixels=sctx.getImageData(0,0,width,height);
  const detected=detectSpritesheetGrid(pixels,width,height,{minCols,maxCols,minRows,maxRows});
  const resolved=resolveSpritesheetGrid(width,height,detected);
  const normalized=normalizeSpritesheetPixels({sourceData:pixels.data,width,height,cols:resolved.cols,rows:resolved.rows,background:detected.background,createCanvas:(w,h)=>{const c=root.document.createElement('canvas');c.width=w;c.height=h;return c;}});
  return Object.freeze({
    dataUrl:normalized.canvas.toDataURL('image/png'),
    sourceWidth:width,sourceHeight:height,
    width:normalized.width,height:normalized.height,
    frameWidth:normalized.cellWidth,frameHeight:normalized.cellHeight,
    columns:resolved.cols,rows:resolved.rows,frames:resolved.frames,
    confidence:detected.confidence,score:detected.score,
    gridSource:resolved.source,gridReason:resolved.reason,
    backgroundMode:detected.backgroundMode,backgroundRemoved:normalized.backgroundRemoved,
    candidates:detected.candidates
  });
}
