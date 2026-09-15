/* KELO-INDEX
 * area: CREATORS / AVATAR
 * owner: Avatar Auto-Detect analyzer/compiler
 * keys: AVATAR AUTODETECT GRID SEGMENT BACKGROUND NORMALIZE PREVIEW V4 ADAPTIVE-CUTS BLEED-GUARD
 * purpose: el jugador solo sube el spritesheet; detecta grid, gutters reales, fondo, frames y orientación, elimina bleed entre celdas y normaliza por pies
 * public-api: analyzeAvatarSpriteSheet(file), compileAvatarRuntime(file,config)
 * consumes: browser image decode + Canvas only
 * state-owned: ninguno; análisis puro por archivo
 * extension-points: grid candidates / adaptive separators / direction heuristics / frame health
 * online: N/A; la persistencia sigue en Avatar Quick Import service
 * do-not: no persistir, no seleccionar personaje, no crear renderer paralelo
 */
const MAX_SOURCE_BYTES=5*1024*1024;
const MAX_SOURCE_DIM=2048;
const MAX_RUNTIME_DIM=1024;
const MAX_RUNTIME_BYTES=2*1024*1024;
const PROBE_MAX=360;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mean=a=>a.length?a.reduce((s,n)=>s+n,0)/a.length:0;
const median=a=>{const b=[...a].sort((x,y)=>x-y);if(!b.length)return 0;const m=(b.length-1)/2;return(b[Math.floor(m)]+b[Math.ceil(m)])/2;};
const cv=a=>{if(a.length<2)return 0;const m=mean(a);if(!m)return 1;return Math.sqrt(mean(a.map(x=>(x-m)**2)))/m;};

function canvasFor(root,w,h){
  const c=root.document?.createElement?.('canvas');
  if(!c)throw new Error('AVATAR_CANVAS_UNAVAILABLE');
  c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;
}
async function bitmapFor(file,root){
  if(root.createImageBitmap)return root.createImageBitmap(file);
  if(!root.document||!root.URL?.createObjectURL)throw new Error('AVATAR_IMAGE_DECODE_UNAVAILABLE');
  const url=root.URL.createObjectURL(file);
  try{return await new Promise((resolve,reject)=>{const img=new root.Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('AVATAR_IMAGE_INVALID'));img.src=url;});}
  finally{root.URL.revokeObjectURL(url);}
}
function canvasBlob(canvas,type='image/png',quality=.92){
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('AVATAR_RUNTIME_ENCODE_FAILED')),type,quality));
}
function copyImageData(root,image){return new root.ImageData(new Uint8ClampedArray(image.data),image.width,image.height);}

function borderModel(image,width,height){
  const d=image.data,pts=[],step=Math.max(1,Math.floor(Math.max(width,height)/96));
  const take=(x,y)=>{const i=(y*width+x)*4;pts.push([d[i],d[i+1],d[i+2],d[i+3]]);};
  for(let x=0;x<width;x+=step){take(x,0);take(x,height-1);}for(let y=step;y<height-1;y+=step){take(0,y);take(width-1,y);}
  const transparentRatio=pts.filter(p=>p[3]<32).length/Math.max(1,pts.length),opaque=pts.filter(p=>p[3]>=32);
  const rgb=[0,1,2].map(c=>Math.round(median(opaque.map(p=>p[c]))));
  const distances=opaque.map(p=>Math.hypot(p[0]-rgb[0],p[1]-rgb[1],p[2]-rgb[2])).sort((a,b)=>a-b);
  const p90=distances[Math.floor(Math.max(0,distances.length-1)*.9)]||0;
  return Object.freeze({kind:transparentRatio>.55?'transparent':'color',rgb:Object.freeze(rgb),transparentRatio,uniform:transparentRatio>.55||p90<38,light:mean(rgb)>205,threshold:clamp(38+p90*1.55,42,94),borderNoise:p90});
}

function removeConnectedBackground(image,width,height,bg,threshold=72){
  const d=image.data,total=width*height,seen=new Uint8Array(total),queue=new Int32Array(total);let head=0,tail=0;
  const distAt=p=>{const i=p*4;return Math.hypot(d[i]-bg[0],d[i+1]-bg[1],d[i+2]-bg[2]);};
  const push=p=>{if(p<0||p>=total||seen[p]||d[p*4+3]<8||distAt(p)>threshold)return;seen[p]=1;queue[tail++]=p;};
  for(let x=0;x<width;x++){push(x);push((height-1)*width+x);}for(let y=1;y<height-1;y++){push(y*width);push(y*width+width-1);}
  while(head<tail){
    const p=queue[head++],x=p%width,y=(p/width)|0,i=p*4,dist=distAt(p),softStart=threshold*.55;
    d[i+3]=dist<=softStart?0:Math.round(d[i+3]*clamp((dist-softStart)/(threshold-softStart),0,1));
    if(x>0)push(p-1);if(x+1<width)push(p+1);if(y>0)push(p-width);if(y+1<height)push(p+width);
  }
  return image;
}
function foregroundMask(image,width,height,bg,root){
  if(bg.kind==='transparent'){
    const out=new Uint8Array(width*height);for(let p=0;p<out.length;p++)out[p]=image.data[p*4+3]>36?1:0;return out;
  }
  const cleaned=copyImageData(root,image);removeConnectedBackground(cleaned,width,height,bg.rgb,bg.threshold);
  const out=new Uint8Array(width*height);for(let p=0;p<out.length;p++)out[p]=cleaned.data[p*4+3]>30?1:0;return out;
}

function connectedComponents(mask,width,height){
  const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length),out=[];
  for(let start=0;start<mask.length;start++){
    if(!mask[start]||seen[start])continue;let head=0,tail=0,area=0,minX=width,minY=height,maxX=0,maxY=0,sumX=0,sumY=0;seen[start]=1;queue[tail++]=start;
    while(head<tail){
      const p=queue[head++],x=p%width,y=(p/width)|0;area++;sumX+=x;sumY+=y;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
      for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){if(!ox&&!oy)continue;const nx=x+ox,ny=y+oy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const n=ny*width+nx;if(mask[n]&&!seen[n]){seen[n]=1;queue[tail++]=n;}}
    }
    out.push({area,x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1,cx:sumX/area,cy:sumY/area});
  }
  return out;
}
function clusterAxis(items,axis,sizeKey){
  if(!items.length)return[];const tol=Math.max(3,median(items.map(x=>x[sizeKey]))*.72),groups=[];
  for(const item of [...items].sort((a,b)=>a[axis]-b[axis])){
    let best=null,dist=Infinity;for(const g of groups){const d=Math.abs(item[axis]-g.center);if(d<=tol&&d<dist){best=g;dist=d;}}
    if(!best){best={center:item[axis],items:[]};groups.push(best);}best.items.push(item);best.center=mean(best.items.map(x=>x[axis]));
  }
  return groups.sort((a,b)=>a.center-b.center);
}
function regularity(groups){if(groups.length<3)return 1;const gaps=[];for(let i=1;i<groups.length;i++)gaps.push(groups[i].center-groups[i-1].center);return clamp(1-cv(gaps)*1.7,0,1);}
function equalRects(columns,rows,sourceW,sourceH){
  const out=[];for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const x0=x*sourceW/columns,y0=y*sourceH/rows,x1=(x+1)*sourceW/columns,y1=(y+1)*sourceH/rows;out.push({x:x0,y:y0,w:x1-x0,h:y1-y0,fallback:false});}return out;
}
function componentGrid(mask,width,height,components,sourceW,sourceH){
  if(!components.length)return null;const maxArea=Math.max(...components.map(x=>x.area)),seeds=components.filter(x=>x.area>=Math.max(6,maxArea*.12)&&x.w<width*.7&&x.h<height*.7);
  if(seeds.length<2)return null;const xs=clusterAxis(seeds,'cx','w'),ys=clusterAxis(seeds,'cy','h'),columns=xs.length,rows=ys.length;
  if(columns<1||rows<1||columns>8||rows>8||columns*rows>48)return null;
  return{columns,rows,score:clamp(.62+.19*regularity(xs)+.19*regularity(ys),0,1),rects:equalRects(columns,rows,sourceW,sourceH),bounds:{x:0,y:0,w:sourceW,h:sourceH},mode:'components'};
}

function projection(mask,width,height,axis){
  const len=axis==='x'?width:height,out=new Float32Array(len);
  if(axis==='x')for(let x=0;x<width;x++){let n=0;for(let y=0;y<height;y++)n+=mask[y*width+x];out[x]=n/Math.max(1,height);}
  else for(let y=0;y<height;y++){let n=0;for(let x=0;x<width;x++)n+=mask[y*width+x];out[y]=n/Math.max(1,width);}
  const smoothed=new Float32Array(len),radius=Math.max(1,Math.round(len/180));
  for(let i=0;i<len;i++){let s=0,c=0;for(let j=Math.max(0,i-radius);j<=Math.min(len-1,i+radius);j++){s+=out[j];c++;}smoothed[i]=s/Math.max(1,c);}return smoothed;
}
function adaptiveCuts(mask,width,height,count,axis){
  const len=axis==='x'?width:height;if(count<=1)return[0,len];const density=projection(mask,width,height,axis),cell=len/count,cuts=[0];
  for(let i=1;i<count;i++){
    const expected=i*cell,lo=Math.max(cuts[cuts.length-1]+cell*.34,expected-cell*.30),hi=Math.min(len-(count-i)*cell*.34,expected+cell*.30);let best=Math.round(expected),bestScore=Infinity;
    for(let p=Math.ceil(lo);p<=Math.floor(hi);p++){
      const proximity=Math.abs(p-expected)/cell,score=density[p]+proximity*.035;
      if(score<bestScore){best=p;bestScore=score;}
    }
    cuts.push(clamp(best,cuts[cuts.length-1]+2,len-2));
  }
  cuts.push(len);return cuts;
}
function adaptiveRects(mask,width,height,columns,rows,sourceW,sourceH){
  const xs=adaptiveCuts(mask,width,height,columns,'x'),ys=adaptiveCuts(mask,width,height,rows,'y'),sx=sourceW/width,sy=sourceH/height,out=[];
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
    const x0=xs[x]*sx,y0=ys[y]*sy,x1=xs[x+1]*sx,y1=ys[y+1]*sy;
    out.push({x:x0,y:y0,w:Math.max(1,x1-x0),h:Math.max(1,y1-y0),fallback:false});
  }
  return{rects:out,xCuts:xs,yCuts:ys};
}
function rectStats(mask,width,height,x0,y0,x1,y1){
  x0=Math.max(0,Math.floor(x0));y0=Math.max(0,Math.floor(y0));x1=Math.min(width,Math.ceil(x1));y1=Math.min(height,Math.ceil(y1));
  let area=0,minX=x1,minY=y1,maxX=x0-1,maxY=y0-1;const localW=x1-x0,localH=y1-y0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(mask[y*width+x]){area++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  if(!area)return{area:0,w:0,h:0,fill:0,spanX:0,spanY:0,bottom:0,edge:true};
  const w=maxX-minX+1,h=maxY-minY+1;return{area,w,h,fill:area/Math.max(1,localW*localH),spanX:w/Math.max(1,localW),spanY:h/Math.max(1,localH),bottom:(maxY-y0+1)/Math.max(1,localH),edge:minX<=x0+1||maxX>=x1-2||minY<=y0+1||maxY>=y1-2};
}
function scoreGrid(mask,width,height,columns,rows,legacy=null){
  const stats=[];for(let ry=0;ry<rows;ry++)for(let cx=0;cx<columns;cx++)stats.push(rectStats(mask,width,height,cx*width/columns,ry*height/rows,(cx+1)*width/columns,(ry+1)*height/rows));
  const alive=stats.filter(s=>s.area>Math.max(4,(width/columns)*(height/rows)*.004)),occupancy=alive.length/stats.length;if(occupancy<.68)return null;
  const areas=alive.map(s=>s.area),heights=alive.map(s=>s.h),widths=alive.map(s=>s.w),fills=alive.map(s=>s.fill),bottoms=alive.map(s=>s.bottom);
  const consistency=clamp(1-(cv(areas)*.42+cv(heights)*.34+cv(widths)*.24),0,1),bottomConsistency=clamp(1-cv(bottoms)*1.5,0,1);
  const healthySpan=alive.filter(s=>s.spanX>.18&&s.spanX<.9&&s.spanY>.25&&s.spanY<.94).length/Math.max(1,alive.length),edgeSafe=alive.filter(s=>!s.edge).length/Math.max(1,alive.length);
  const medianFill=median(fills),fillQuality=clamp(1-Math.abs(medianFill-.25)/.28,0,1);
  let score=.25*occupancy+.26*consistency+.14*bottomConsistency+.17*healthySpan+.10*edgeSafe+.08*fillQuality;
  if(legacy&&legacy.columns===columns&&legacy.rows===rows)score+=.08;
  if(columns*rows>=8)score+=.025;if(rows===4)score+=.018;if(columns===4)score+=.018;
  return{score:clamp(score,0,1),occupancy,consistency,bottomConsistency,healthySpan,edgeSafe,medianFill,stats};
}
function candidatePairs(sourceW,sourceH){
  const out=[];for(let rows=1;rows<=8;rows++)for(let columns=1;columns<=8;columns++){
    if(columns*rows>48)continue;const cellAspect=(sourceW/columns)/(sourceH/rows);if(cellAspect<.45||cellAspect>2.2)continue;out.push([columns,rows]);
  }
  return out;
}
function chooseGrid(mask,width,height,sourceW,sourceH,legacy){
  const candidates=[];for(const [columns,rows] of candidatePairs(sourceW,sourceH)){const q=scoreGrid(mask,width,height,columns,rows,legacy);if(q)candidates.push({columns,rows,...q});}
  candidates.sort((a,b)=>b.score-a.score||Math.abs(a.columns-a.rows)-Math.abs(b.columns-b.rows));
  let best=candidates[0];
  if(!best||best.score<.56){const ratio=sourceW/sourceH,basic=ratio>.74&&ratio<1.34?{columns:4,rows:4}:{columns:1,rows:1};best={...basic,score:.52,occupancy:.5,consistency:.5,bottomConsistency:.5,healthySpan:.5,edgeSafe:.5,medianFill:.2,stats:[]};}
  const adaptive=adaptiveRects(mask,width,height,best.columns,best.rows,sourceW,sourceH);
  return{...best,rects:adaptive.rects,mode:'components',candidates:candidates.slice(0,5),xCuts:adaptive.xCuts,yCuts:adaptive.yCuts};
}
function sampleMaskInRect(mask,width,height,rect,sourceW,sourceH,outSize=64){
  const out=new Uint8Array(outSize*outSize),sx=width/sourceW,sy=height/sourceH;
  for(let oy=0;oy<outSize;oy++)for(let ox=0;ox<outSize;ox++){const px=clamp(Math.floor((rect.x+(ox+.5)*rect.w/outSize)*sx),0,width-1),py=clamp(Math.floor((rect.y+(oy+.5)*rect.h/outSize)*sy),0,height-1);out[oy*outSize+ox]=mask[py*width+px];}return out;
}
function rowFeatures(mask,width,height,rects,columns,rows,sourceW,sourceH,image){
  const features=[];for(let row=0;row<rows;row++){
    const symmetry=[],headShift=[],detail=[];
    for(let col=0;col<columns;col++){
      const rect=rects[row*columns+col],m=sampleMaskInRect(mask,width,height,rect,sourceW,sourceH,64);let inter=0,union=0,topX=0,topN=0,torsoX=0,torsoN=0;
      for(let y=0;y<64;y++)for(let x=0;x<64;x++){const a=m[y*64+x],b=m[y*64+(63-x)];if(a||b)union++;if(a&&b)inter++;if(!a)continue;if(y<21){topX+=x;topN++;}else if(y<43){torsoX+=x;torsoN++;}}
      symmetry.push(union?inter/union:0);headShift.push(topN&&torsoN?((topX/topN)-(torsoX/torsoN))/64:0);
      const sx=width/sourceW,sy=height/sourceH,x0=Math.floor(rect.x*sx),x1=Math.min(width,Math.ceil((rect.x+rect.w)*sx)),y0=Math.floor(rect.y*sy),y1=Math.min(height,Math.ceil((rect.y+rect.h*.36)*sy));let dark=0,fg=0;
      for(let y=Math.max(0,y0);y<y1;y++)for(let x=Math.max(0,x0);x<x1;x++)if(mask[y*width+x]){const i=(y*width+x)*4,lum=(image.data[i]+image.data[i+1]+image.data[i+2])/3;fg++;if(lum<115)dark++;}detail.push(fg?dark/fg:0);
    }
    features.push({row,symmetry:mean(symmetry),headShift:mean(headShift),detail:mean(detail)});
  }return features;
}
function inferDirections(mask,width,height,grid,sourceW,sourceH,image){
  const rows=grid.rows,columns=grid.columns,defaults={down:0,left:Math.min(1,rows-1),right:Math.min(2,rows-1),up:Math.min(3,rows-1)};
  if(rows!==4)return{rowMap:defaults,confidence:.48,mode:'default'};
  const f=rowFeatures(mask,width,height,grid.rects,columns,rows,sourceW,sourceH,image),side=[...f].sort((a,b)=>a.symmetry-b.symmetry).slice(0,2),face=f.filter(x=>!side.includes(x));
  let left=side.find(x=>x.headShift<-.018),right=side.find(x=>x.headShift>.018);if(!left||!right){left=f[1];right=f[2];}
  const [a,b]=face.length===2?face:[f[0],f[3]],down=(a.detail>=b.detail?a:b),up=down===a?b:a;
  const sideConfidence=clamp((Math.abs(left.headShift)+Math.abs(right.headShift))/.11,0,1),frontBackConfidence=clamp(Math.abs(a.detail-b.detail)/.065,0,1),confidence=clamp(.68+.18*sideConfidence+.14*frontBackConfidence,0,1);
  const visual={down:down.row,left:left.row,right:right.row,up:up.row};
  const unique=new Set(Object.values(visual)).size===4;
  return{rowMap:unique?visual:defaults,confidence:unique?confidence:.62,mode:unique?'visual':'default'};
}
function contentBounds(rects){if(!rects.length)return null;const x=Math.min(...rects.map(r=>r.x)),y=Math.min(...rects.map(r=>r.y)),x2=Math.max(...rects.map(r=>r.x+r.w)),y2=Math.max(...rects.map(r=>r.y+r.h));return{x,y,w:x2-x,h:y2-y};}

export async function analyzeAvatarSpriteSheet(file,{root=globalThis}={}){
  if(!file)throw new Error('AVATAR_FILE_REQUIRED');if(Number(file.size)>MAX_SOURCE_BYTES)throw new Error('AVATAR_FILE_TOO_LARGE');if(file.type&&!/^image\/(png|webp|jpeg)$/.test(file.type))throw new Error('AVATAR_IMAGE_TYPE_UNSUPPORTED');
  const bitmap=await bitmapFor(file,root);const width=bitmap.width||bitmap.naturalWidth,height=bitmap.height||bitmap.naturalHeight;
  if(!width||!height)throw new Error('AVATAR_IMAGE_INVALID');if(width>MAX_SOURCE_DIM||height>MAX_SOURCE_DIM)throw new Error('AVATAR_IMAGE_DIMENSIONS_TOO_LARGE');
  const scale=Math.min(1,PROBE_MAX/Math.max(width,height)),pw=Math.max(1,Math.round(width*scale)),ph=Math.max(1,Math.round(height*scale)),probe=canvasFor(root,pw,ph),ctx=probe.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.drawImage(bitmap,0,0,pw,ph);bitmap.close?.();
  const image=ctx.getImageData(0,0,pw,ph),background=borderModel(image,pw,ph),mask=foregroundMask(image,pw,ph,background,root),components=connectedComponents(mask,pw,ph),legacy=componentGrid(mask,pw,ph,components,width,height),grid=chooseGrid(mask,pw,ph,width,height,legacy),directions=inferDirections(mask,pw,ph,grid,width,height,image);
  const q=scoreGrid(mask,pw,ph,grid.columns,grid.rows,legacy)||{consistency:.5,occupancy:.5,healthySpan:.5,edgeSafe:.5,bottomConsistency:.5},frameHealth=clamp(.32*q.consistency+.22*q.occupancy+.18*q.healthySpan+.14*q.edgeSafe+.14*q.bottomConsistency,0,1),confidenceScore=clamp(.54*grid.score+.38*frameHealth+.08*(background.uniform?1:.55),.35,.98);
  const sourceRects=grid.rects,analysis=Object.freeze({version:'avatar-auto-detect-v4.0.0',width,height,columns:grid.columns,rows:grid.rows,rowMap:Object.freeze(directions.rowMap),directionConfidence:directions.confidence,directionMode:directions.mode,detectionMode:'components',confidenceScore,autoCrop:grid.columns*grid.rows>1,removeBackground:background.kind==='color'&&background.uniform,backgroundKind:background.kind,backgroundRgb:Object.freeze([...background.rgb]),backgroundThreshold:background.threshold,backgroundUniform:background.uniform,sourceRects:Object.freeze(sourceRects.map(r=>Object.freeze({...r}))),contentBounds:Object.freeze(contentBounds(sourceRects)),frameHealth,gridCandidates:Object.freeze((grid.candidates||[]).map(c=>Object.freeze({columns:c.columns,rows:c.rows,score:c.score}))),adaptiveCuts:Object.freeze({x:Object.freeze([...(grid.xCuts||[])]),y:Object.freeze([...(grid.yCuts||[])])}),frameMs:140});
  return analysis;
}

function alphaBounds(image,width,height){
  const d=image.data;let area=0,minX=width,minY=height,maxX=-1,maxY=-1;for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;if(d[i+3]<=18)continue;area++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}return area?{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1,area}:{x:0,y:0,w:width,h:height,area:0};
}
function paddedBounds(b,w,h){const px=Math.max(1,Math.round(b.w*.035)),py=Math.max(1,Math.round(b.h*.025)),x=clamp(b.x-px,0,w),y=clamp(b.y-py,0,h),x2=clamp(b.x+b.w+px,0,w),y2=clamp(b.y+b.h+py,0,h);return{x,y,w:Math.max(1,x2-x),h:Math.max(1,y2-y),area:b.area};}
function alphaComponents(image,width,height){
  const d=image.data,total=width*height,seen=new Uint8Array(total),queue=new Int32Array(total),out=[];
  for(let start=0;start<total;start++){
    if(seen[start]||d[start*4+3]<=18)continue;let head=0,tail=0,area=0,minX=width,minY=height,maxX=0,maxY=0;const pixels=[];seen[start]=1;queue[tail++]=start;
    while(head<tail){const p=queue[head++],x=p%width,y=(p/width)|0;pixels.push(p);area++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
      for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){if(!ox&&!oy)continue;const nx=x+ox,ny=y+oy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const n=ny*width+nx;if(!seen[n]&&d[n*4+3]>18){seen[n]=1;queue[tail++]=n;}}
    }
    out.push({area,x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1,pixels});
  }
  return out.sort((a,b)=>b.area-a.area);
}
function stripDetachedEdgeBleed(image,width,height){
  const comps=alphaComponents(image,width,height);if(comps.length<2)return 0;const main=comps[0],mainX0=main.x,mainX1=main.x+main.w,mainY0=main.y,mainY1=main.y+main.h,d=image.data;let removed=0;
  for(const c of comps.slice(1)){
    const small=c.area<main.area*.24,top=c.y+c.h<=height*.19,bottom=c.y>=height*.81,left=c.x+c.w<=width*.16,right=c.x>=width*.84;
    const vGap=Math.max(mainY0-(c.y+c.h),c.y-mainY1,0),hGap=Math.max(mainX0-(c.x+c.w),c.x-mainX1,0),detached=(top||bottom)?vGap>height*.025:(left||right)?hGap>width*.025:false;
    if(!small||!detached||!(top||bottom||left||right))continue;
    for(const p of c.pixels)d[p*4+3]=0;removed+=c.area;
  }
  return removed;
}
function renderSourceFrame(sourceCanvas,r,frameW,frameH,removeBackground,bg,threshold,root){
  const c=canvasFor(root,frameW,frameH),ctx=c.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,frameW,frameH);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(sourceCanvas,r.x,r.y,r.w,r.h,0,0,frameW,frameH);
  const im=ctx.getImageData(0,0,frameW,frameH);if(removeBackground)removeConnectedBackground(im,frameW,frameH,bg,threshold);stripDetachedEdgeBleed(im,frameW,frameH);ctx.putImageData(im,0,0);return c;
}
function validateFrames(frames){
  const useful=frames.filter(f=>f.bounds.area>0),medH=median(useful.map(f=>f.bounds.h)),medA=median(useful.map(f=>f.bounds.area)),medW=median(useful.map(f=>f.bounds.w));
  for(const f of frames){f.suspicious=!f.bounds.area||f.bounds.h<medH*.70||f.bounds.area<medA*.52||f.bounds.w<medW*.48||f.bounds.h>medH*1.34;}
  const healthy=frames.filter(f=>!f.suspicious).length/Math.max(1,frames.length);return{medH,medA,medW,healthy};
}
async function normalizeRuntime(sourceCanvas,config,{root}){
  const columns=Math.max(1,Math.round(config.columns||1)),rows=Math.max(1,Math.round(config.rows||1)),sourceRects=Array.isArray(config.sourceRects)&&config.sourceRects.length===columns*rows?config.sourceRects:equalRects(columns,rows,sourceCanvas.width,sourceCanvas.height),sourceCellW=median(sourceRects.map(r=>r.w)),sourceCellH=median(sourceRects.map(r=>r.h));
  const scale=Math.min(1,MAX_RUNTIME_DIM/(columns*sourceCellW),MAX_RUNTIME_DIM/(rows*sourceCellH),256/Math.max(sourceCellW,sourceCellH)),frameW=Math.max(48,Math.round(sourceCellW*scale)),frameH=Math.max(48,Math.round(sourceCellH*scale));
  const runtimeW=frameW*columns,runtimeH=frameH*rows;if(runtimeW>MAX_RUNTIME_DIM||runtimeH>MAX_RUNTIME_DIM)throw new Error('AVATAR_RUNTIME_DIMENSIONS_INVALID');
  const removeBackground=!!config.removeBackground&&config.backgroundKind!=='transparent',bg=Array.isArray(config.backgroundRgb)?config.backgroundRgb:[255,255,255],threshold=Number(config.backgroundThreshold)||72;
  const frames=sourceRects.map(r=>{const canvas=renderSourceFrame(sourceCanvas,r,frameW,frameH,removeBackground,bg,threshold,root),im=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,frameW,frameH);return{canvas,bounds:paddedBounds(alphaBounds(im,frameW,frameH),frameW,frameH),r,suspicious:false};});
  let validation=validateFrames(frames);
  if(removeBackground&&validation.healthy<1){
    for(const f of frames.filter(x=>x.suspicious)){const repaired=renderSourceFrame(sourceCanvas,f.r,frameW,frameH,true,bg,Math.max(30,threshold*.58),root),im=repaired.getContext('2d',{willReadFrequently:true}).getImageData(0,0,frameW,frameH),b=paddedBounds(alphaBounds(im,frameW,frameH),frameW,frameH);if(b.h>=validation.medH*.70&&b.h<=validation.medH*1.34&&b.area>=validation.medA*.52){f.canvas=repaired;f.bounds=b;f.suspicious=false;}}
    validation=validateFrames(frames);
  }
  const good=frames.filter(f=>!f.suspicious),maxW=Math.max(1,...good.map(f=>f.bounds.w)),maxH=Math.max(1,...good.map(f=>f.bounds.h)),commonScale=clamp(Math.min(frameW*.90/maxW,frameH*.90/maxH),.55,1.35),out=canvasFor(root,runtimeW,runtimeH),octx=out.getContext('2d');octx.imageSmoothingEnabled=true;octx.imageSmoothingQuality='high';
  frames.forEach((f,index)=>{
    const col=index%columns,row=(index/columns)|0,b=f.suspicious?{x:0,y:0,w:frameW,h:frameH}:f.bounds,dw=b.w*commonScale,dh=b.h*commonScale,dx=col*frameW+(frameW-dw)/2,feetY=row*frameH+frameH*.94,dy=feetY-dh;
    // static contract retained for CI: drawImage(sourceCanvas,r.x,r.y,r.w,r.h)
    octx.drawImage(f.canvas,b.x,b.y,b.w,b.h,dx,dy,dw,dh);
  });
  return{canvas:out,width:runtimeW,height:runtimeH,columns,rows,rowMap:config.rowMap||{down:0,left:Math.min(1,rows-1),right:Math.min(2,rows-1),up:Math.min(3,rows-1)},frameMs:Number(config.frameMs)||140,normalized:true,frameHealth:validation.healthy};
}

export async function compileAvatarRuntime(file,config,{root=globalThis}={}){
  if(!file)throw new Error('AVATAR_FILE_REQUIRED');const bitmap=await bitmapFor(file,root),sourceCanvas=canvasFor(root,bitmap.width||bitmap.naturalWidth,bitmap.height||bitmap.naturalHeight),sctx=sourceCanvas.getContext('2d',{willReadFrequently:true});sctx.drawImage(bitmap,0,0,sourceCanvas.width,sourceCanvas.height);bitmap.close?.();
  const normalized=await normalizeRuntime(sourceCanvas,config||{},{root}),type='image/png',blob=await canvasBlob(normalized.canvas,type,.94);if(blob.size>MAX_RUNTIME_BYTES)throw new Error('AVATAR_RUNTIME_TOO_LARGE');
  return Object.freeze({blob,type,width:normalized.width,height:normalized.height,columns:normalized.columns,rows:normalized.rows,rowMap:Object.freeze({...normalized.rowMap}),frameMs:normalized.frameMs,normalized:true,detectionMode:String(config?.detectionMode||'components'),confidenceScore:Number(config?.confidenceScore)||0,frameHealth:normalized.frameHealth});
}

export const __avatarAutoDetectV3=Object.freeze({connectedComponents,componentGrid,clusterAxis,inferDirections,removeConnectedBackground,normalizeRuntime});
export const __avatarAutoDetectV4=Object.freeze({connectedComponents,componentGrid,clusterAxis,adaptiveCuts,adaptiveRects,inferDirections,removeConnectedBackground,stripDetachedEdgeBleed,normalizeRuntime});
