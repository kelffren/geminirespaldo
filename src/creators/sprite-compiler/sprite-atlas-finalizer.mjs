/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / ATLAS FINALIZER
 * owner: final GPU-safe atlas pixel pass
 * keys: SPRITE ATLAS EXTRUDE EDGE RGB BLEED TRANSPARENT PIXEL CELL
 * purpose: copy trustworthy edge RGB into transparent neighbor pixels per frame without changing alpha or crossing frame boundaries
 * public-api: extrudeTransparentRgbByCells, finalizeRuntimeAtlasPixels
 * state-owned: none; pure RGBA -> RGBA/report
 * online: N/A
 * do-not: expand alpha silhouettes, blur pixels, mix colors across frames or alter runtime geometry
 */
const F=Object.freeze;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const raw=data=>data?.data||data;
function assertPixels(data,width,height){const p=raw(data);if(!p||p.length<width*height*4)throw new Error('SPRITE_ATLAS_FINALIZER_PIXELS_REQUIRED');return p;}
const index=(x,y,w)=>(y*w+x)*4;

function nearestVisible(data,width,cell,x,y,radius,alphaThreshold){
  let best=null,bestScore=Infinity;
  const x0=cell.x,x1=cell.x+cell.width-1,y0=cell.y,y1=cell.y+cell.height-1;
  for(let oy=-radius;oy<=radius;oy++)for(let ox=-radius;ox<=radius;ox++){
    if(!ox&&!oy)continue;const nx=x+ox,ny=y+oy;if(nx<x0||nx>x1||ny<y0||ny>y1)continue;
    const i=index(nx,ny,width),a=data[i+3];if(a<=alphaThreshold)continue;
    const score=ox*ox+oy*oy;if(score<bestScore){bestScore=score;best={r:data[i],g:data[i+1],b:data[i+2]};}
  }
  return best;
}

export function extrudeTransparentRgbByCells(sourceData,width,height,cells,{radius=2,alphaThreshold=12}={}){
  const data=assertPixels(sourceData,width,height),out=new Uint8ClampedArray(data),r=Math.max(1,Math.min(4,Math.floor(Number(radius)||2)));let extruded=0,visited=0;
  for(const rawCell of cells||[]){
    const cell={x:clamp(Math.floor(rawCell.x),0,width-1),y:clamp(Math.floor(rawCell.y),0,height-1),width:Math.max(1,Math.min(width,Math.floor(rawCell.width))),height:Math.max(1,Math.min(height,Math.floor(rawCell.height)))};
    cell.width=Math.min(cell.width,width-cell.x);cell.height=Math.min(cell.height,height-cell.y);
    for(let y=cell.y;y<cell.y+cell.height;y++)for(let x=cell.x;x<cell.x+cell.width;x++){
      const i=index(x,y,width);if(data[i+3]>alphaThreshold)continue;visited++;
      const donor=nearestVisible(data,width,cell,x,y,r,alphaThreshold);if(!donor)continue;
      out[i]=donor.r;out[i+1]=donor.g;out[i+2]=donor.b;out[i+3]=0;extruded++;
    }
  }
  return F({data:out,report:F({schema:'kelo-atlas-extrude-v1',radius:r,alphaThreshold,extrudedPixels:extruded,transparentVisited:visited,alphaUnchanged:true,crossFrameIsolation:true})});
}

export function finalizeRuntimeAtlasPixels(sourceData,width,height,{columns=1,rows=1,frameWidth=null,frameHeight=null,frameCounts=null,radius=2,alphaThreshold=12}={}){
  columns=Math.max(1,Math.floor(Number(columns)||1));rows=Math.max(1,Math.floor(Number(rows)||1));const fw=Math.max(1,Math.floor(Number(frameWidth)||width/columns)),fh=Math.max(1,Math.floor(Number(frameHeight)||height/rows)),cells=[];
  for(let row=0;row<rows;row++){
    const count=Math.max(0,Math.min(columns,Math.floor(Number(frameCounts?.[row]??columns)||0)));
    for(let col=0;col<count;col++)cells.push(F({x:col*fw,y:row*fh,width:Math.min(fw,width-col*fw),height:Math.min(fh,height-row*fh),row,column:col}));
  }
  const result=extrudeTransparentRgbByCells(sourceData,width,height,cells,{radius,alphaThreshold});return F({...result,report:F({...result.report,columns,rows,frameWidth:fw,frameHeight:fh,frames:cells.length})});
}
