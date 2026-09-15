/* KELO-INDEX
 * area: CREATORS / IMAGE LAB / CONVERTER
 * owner: Kelo Creator Assets image derivative renderer
 * keys: IMAGE CONVERT PNG JPEG WEBP NONDESTRUCTIVE TRIM ALPHA RESIZE PIXEL PERFECT REBUILD ORIGINAL
 * purpose: rebuild working/export images from the untouched source Blob using replayable operations
 * public-api: normalizeImageFormat, imageExportPolicy, renderImageLabProject, exportImageLabBlob, buildImageExportName
 * consumes: Image Lab project operations
 * state-owned: none; source Blob is read-only input and every result is a new Blob/canvas
 * online: N/A authoring derivative; future storage may persist source + derivative revisions
 * do-not: overwrite source files, claim JPEG artifacts are recoverable, publish assets or own runtime textures
 */
import {resolveImageLabOperations} from './image-lab-project.mjs';
const F=Object.freeze;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const MIME=F({png:'image/png',jpeg:'image/jpeg',jpg:'image/jpeg',webp:'image/webp'});
const EXT=F({png:'png',jpeg:'jpg',jpg:'jpg',webp:'webp'});

export function normalizeImageFormat(format='png'){
  const key=String(format||'png').trim().toLowerCase().replace(/^image\//,'');
  if(!MIME[key])throw new Error(`IMAGE_LAB_FORMAT_UNSUPPORTED:${key}`);
  return key==='jpg'?'jpeg':key;
}
export function imageExportPolicy(format='png'){
  const normalized=normalizeImageFormat(format);
  if(normalized==='png')return F({format:'png',mimeType:MIME.png,extension:'png',lossy:false,description:'PNG adds no new lossy compression to the decoded working pixels; it cannot restore detail already lost in a JPEG source.'});
  if(normalized==='jpeg')return F({format:'jpeg',mimeType:MIME.jpeg,extension:'jpg',lossy:true,description:'JPEG export is lossy and cannot preserve transparency.'});
  return F({format:'webp',mimeType:MIME.webp,extension:'webp',lossy:'encoder-dependent',description:'Browser WebP encoding depends on the browser encoder and quality setting.'});
}
function assertBlob(blob){if(!(blob instanceof Blob))throw new Error('IMAGE_LAB_SOURCE_BLOB_REQUIRED');}
function canvasFor(root,width,height){
  const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
  if(typeof root.OffscreenCanvas==='function')return new root.OffscreenCanvas(w,h);
  const canvas=root.document?.createElement?.('canvas');if(!canvas)throw new Error('IMAGE_LAB_CANVAS_UNAVAILABLE');canvas.width=w;canvas.height=h;return canvas;
}
async function bitmapFor(root,blob){
  if(typeof root.createImageBitmap==='function')return root.createImageBitmap(blob);
  if(!root.document||!root.URL?.createObjectURL||!root.Image)throw new Error('IMAGE_LAB_DECODE_UNAVAILABLE');
  const url=root.URL.createObjectURL(blob);
  try{return await new Promise((resolve,reject)=>{const image=new root.Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('IMAGE_LAB_IMAGE_INVALID'));image.src=url;});}
  finally{root.URL.revokeObjectURL(url);}
}
async function decodeSource(root,blob){
  assertBlob(blob);const bitmap=await bitmapFor(root,blob),width=bitmap.width||bitmap.naturalWidth,height=bitmap.height||bitmap.naturalHeight;if(!width||!height)throw new Error('IMAGE_LAB_IMAGE_INVALID');const canvas=canvasFor(root,width,height),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,width,height);ctx.drawImage(bitmap,0,0,width,height);bitmap.close?.();return canvas;
}
function alphaBounds(ctx,width,height,threshold=0){
  const data=ctx.getImageData(0,0,width,height).data;let minX=width,minY=height,maxX=-1,maxY=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){if(data[(y*width+x)*4+3]<=threshold)continue;if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y;}
  return maxX<0?null:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1};
}
function copyRegion(root,source,{x=0,y=0,width=source.width,height=source.height}={}){const out=canvasFor(root,width,height),ctx=out.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,width,height);ctx.drawImage(source,x,y,width,height,0,0,width,height);return out;}
function trimAlpha(root,source,params={}){
  const ctx=source.getContext('2d',{willReadFrequently:true}),threshold=clamp(Math.round(finite(params.threshold,0)),0,254),padding=Math.max(0,Math.round(finite(params.padding,0))),bounds=alphaBounds(ctx,source.width,source.height,threshold);if(!bounds)return copyRegion(root,source);
  const x=Math.max(0,bounds.x-padding),y=Math.max(0,bounds.y-padding),right=Math.min(source.width,bounds.x+bounds.width+padding),bottom=Math.min(source.height,bounds.y+bounds.height+padding);return copyRegion(root,source,{x,y,width:Math.max(1,right-x),height:Math.max(1,bottom-y)});
}
function alphaSnap(root,source,params={}){
  const out=copyRegion(root,source),ctx=out.getContext('2d',{willReadFrequently:true}),image=ctx.getImageData(0,0,out.width,out.height),low=clamp(Math.round(finite(params.transparentBelow,8)),0,254),high=clamp(Math.round(finite(params.opaqueAbove,248)),low+1,255);
  for(let i=3;i<image.data.length;i+=4){const a=image.data[i];if(a<=low)image.data[i]=0;else if(a>=high)image.data[i]=255;}ctx.putImageData(image,0,0);return out;
}
function resize(root,source,params={}){
  const scale=finite(params.scale,NaN),width=Math.max(1,Math.round(Number.isFinite(Number(params.width))?Number(params.width):Number.isFinite(scale)?source.width*scale:source.width)),height=Math.max(1,Math.round(Number.isFinite(Number(params.height))?Number(params.height):Number.isFinite(scale)?source.height*scale:source.height));
  const out=canvasFor(root,width,height),ctx=out.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=params.mode!=='pixel-perfect'&&params.smoothing!==false;if(ctx.imageSmoothingEnabled&&'imageSmoothingQuality'in ctx)ctx.imageSmoothingQuality=params.quality==='fast'?'low':params.quality==='high'?'high':'medium';ctx.clearRect(0,0,width,height);ctx.drawImage(source,0,0,width,height);return out;
}
function rotate(root,source,params={}){
  const quarter=((Math.round(finite(params.quarterTurns,0))%4)+4)%4;if(!quarter)return copyRegion(root,source);const swap=quarter%2===1,out=canvasFor(root,swap?source.height:source.width,swap?source.width:source.height),ctx=out.getContext('2d',{willReadFrequently:true});ctx.translate(out.width/2,out.height/2);ctx.rotate(quarter*Math.PI/2);ctx.drawImage(source,-source.width/2,-source.height/2);return out;
}
function flip(root,source,params={}){
  const horizontal=params.horizontal!==false,vertical=!!params.vertical,out=canvasFor(root,source.width,source.height),ctx=out.getContext('2d',{willReadFrequently:true});ctx.translate(horizontal?out.width:0,vertical?out.height:0);ctx.scale(horizontal?-1:1,vertical?-1:1);ctx.drawImage(source,0,0);return out;
}
function applyOperation(root,canvas,operation){
  const params=operation.params||{};
  if(operation.type==='trim-alpha')return trimAlpha(root,canvas,params);
  if(operation.type==='alpha-snap')return alphaSnap(root,canvas,params);
  if(operation.type==='resize')return resize(root,canvas,params);
  if(operation.type==='rotate')return rotate(root,canvas,params);
  if(operation.type==='flip')return flip(root,canvas,params);
  throw new Error(`IMAGE_LAB_OPERATION_UNSUPPORTED:${operation.type}`);
}
async function canvasBlob(canvas,mimeType,quality){
  if(typeof canvas.convertToBlob==='function')return canvas.convertToBlob({type:mimeType,quality});
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('IMAGE_LAB_ENCODE_FAILED')),mimeType,quality));
}

export async function renderImageLabProject(root,sourceBlob,project,{revisionId=null}={}){
  assertBlob(sourceBlob);let canvas=await decodeSource(root,sourceBlob);const operations=resolveImageLabOperations(project,{revisionId});for(const operation of operations)canvas=applyOperation(root,canvas,operation);return F({canvas,width:canvas.width,height:canvas.height,operationsApplied:operations.length,rebuiltFromSource:true,sourceUnmodified:true});
}
export async function exportImageLabBlob(root,sourceBlob,project,{format=project?.export?.format||'png',quality=project?.export?.quality??.92,revisionId=null}={}){
  const policy=imageExportPolicy(format),rendered=await renderImageLabProject(root,sourceBlob,project,{revisionId}),q=clamp(finite(quality,.92),0,1),blob=await canvasBlob(rendered.canvas,policy.mimeType,q);return F({...rendered,blob,format:policy.format,mimeType:policy.mimeType,extension:policy.extension,quality:q,lossPolicy:policy});
}
export function buildImageExportName(sourceName='image',format='png',{suffix=''}={}){
  const policy=imageExportPolicy(format),base=String(sourceName||'image').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9._ -]/g,'').trim()||'image',tail=String(suffix||'').trim().replace(/[^a-zA-Z0-9_-]/g,'');return `${base}${tail?`-${tail}`:''}.${policy.extension}`;
}
