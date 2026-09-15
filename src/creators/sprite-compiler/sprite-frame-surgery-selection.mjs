/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / FRAME SURGERY / SELECTION
 * owner: deterministic finger-first selection masks
 * keys: SPRITE SURGERY MAGIC WAND COLOR TOLERANCE LASSO POLYGON CONTIGUOUS MASK
 * purpose: build exact pixel masks from color-aware contiguous wand or finger lasso paths
 * public-api: colorFloodSelectionMask, polygonSelectionMask, rgbaDistance, simplifyLassoPath
 * state-owned: none; pure RGBA/geometry -> Uint8Array mask
 * online: N/A
 * do-not: mutate source pixels, render UI, persist patches
 */
const F=Object.freeze;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));

export function rgbaDistance(data,a,b,{alphaWeight=.45}={}){
  const ai=a*4,bi=b*4,dr=data[ai]-data[bi],dg=data[ai+1]-data[bi+1],db=data[ai+2]-data[bi+2],da=(data[ai+3]-data[bi+3])*alphaWeight;
  return Math.hypot(dr,dg,db,da);
}

export function colorFloodSelectionMask(imageData,width,height,seedX,seedY,{tolerance=34,alphaThreshold=12,diagonal=true}={}){
  const data=imageData?.data||imageData;
  if(!data||data.length<width*height*4)throw new Error('SURGERY_SELECTION_PIXELS_REQUIRED');
  width=Math.max(1,Math.floor(width));height=Math.max(1,Math.floor(height));
  const sx=clamp(Math.floor(seedX),0,width-1),sy=clamp(Math.floor(seedY),0,height-1),seed=sy*width+sx,seedAlpha=data[seed*4+3];
  const threshold=Math.max(0,Number(tolerance)||0),mask=new Uint8Array(width*height),seen=new Uint8Array(width*height),queue=new Int32Array(width*height);
  let head=0,tail=1;queue[0]=seed;seen[seed]=1;
  const same=(index)=>{
    const alpha=data[index*4+3];
    if(seedAlpha<=alphaThreshold)return alpha<=Math.max(alphaThreshold,threshold*.65);
    if(alpha<=alphaThreshold)return false;
    return rgbaDistance(data,seed,index)<=threshold;
  };
  const offsets=diagonal?[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]:[[1,0],[-1,0],[0,1],[0,-1]];
  while(head<tail){const index=queue[head++];if(!same(index))continue;mask[index]=1;const x=index%width,y=(index/width)|0;for(const[dx,dy]of offsets){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=width||Y>=height)continue;const next=Y*width+X;if(seen[next])continue;seen[next]=1;if(same(next))queue[tail++]=next}}
  return mask;
}

function pointSegmentDistance(p,a,b){const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,len=vx*vx+vy*vy;if(!len)return Math.hypot(wx,wy);const t=clamp((wx*vx+wy*vy)/len,0,1),x=a.x+t*vx,y=a.y+t*vy;return Math.hypot(p.x-x,p.y-y)}
function rdp(points,epsilon){if(points.length<3)return points.slice();let max=0,index=0;for(let i=1;i<points.length-1;i++){const d=pointSegmentDistance(points[i],points[0],points.at(-1));if(d>max){max=d;index=i}}if(max<=epsilon)return[points[0],points.at(-1)];const left=rdp(points.slice(0,index+1),epsilon),right=rdp(points.slice(index),epsilon);return[...left.slice(0,-1),...right]}
export function simplifyLassoPath(points=[],epsilon=.004){const clean=[];for(const raw of points){const p=F({x:clamp(raw?.x,0,1),y:clamp(raw?.y,0,1)}),last=clean.at(-1);if(!last||Math.hypot(p.x-last.x,p.y-last.y)>=Math.max(.001,epsilon*.25))clean.push(p)}if(clean.length<3)return F(clean);const simple=rdp(clean,Math.max(.001,epsilon));return F(simple)}

function insidePolygon(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j],cross=(a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/((b.y-a.y)||1e-9)+a.x;if(cross)inside=!inside}return inside}
export function polygonSelectionMask(width,height,points=[]){width=Math.max(1,Math.floor(width));height=Math.max(1,Math.floor(height));const polygon=simplifyLassoPath(points);const mask=new Uint8Array(width*height);if(polygon.length<3)return mask;let minX=1,minY=1,maxX=0,maxY=0;for(const p of polygon){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y)}const x0=clamp(Math.floor(minX*width),0,width-1),x1=clamp(Math.ceil(maxX*width),0,width),y0=clamp(Math.floor(minY*height),0,height-1),y1=clamp(Math.ceil(maxY*height),0,height);for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(insidePolygon((x+.5)/width,(y+.5)/height,polygon))mask[y*width+x]=1;return mask}

export const __surgerySelectionInternals=F({insidePolygon,pointSegmentDistance,rdp});