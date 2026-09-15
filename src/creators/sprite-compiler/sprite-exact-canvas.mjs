/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / EXACT CANVAS
 * owner: exact runtime frame sizing after canonical sprite compilation
 * keys: SPRITE EXACT CANVAS FRAME SIZE CONTAIN COVER STRETCH PIXEL ART ATLAS EXTRUDE
 * purpose: guarantee every runtime frame is exactly the requested pixel dimensions without mutating source art
 * public-api: normalizeExactCanvasConfig, exactCanvasPlacement, reframeCompiledRuntimeExact, verifyExactRuntime
 * online: N/A
 * do-not: detect sprites, infer rigs, mutate source PNG or silently crop/distort artwork
 */
import {finalizeRuntimeAtlasPixels} from './sprite-atlas-finalizer.mjs';
const F=Object.freeze;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const MODES=F(['contain','cover','stretch']);

export function normalizeExactCanvasConfig(input={}){
  const enabled=!!input?.enabled;
  const width=Math.max(8,Math.min(1024,Math.round(Number(input?.width)||64)));
  const height=Math.max(8,Math.min(1024,Math.round(Number(input?.height)||64)));
  const mode=MODES.includes(String(input?.mode||'').toLowerCase())?String(input.mode).toLowerCase():'contain';
  return F({enabled,width,height,mode,anchorX:clamp(input?.anchorX??.5,0,1),anchorY:clamp(input?.anchorY??1,0,1),pixelArt:input?.pixelArt!==false,allowCrop:!!input?.allowCrop,allowDistort:!!input?.allowDistort,edgeExtrude:input?.edgeExtrude!==false,edgeExtrudeRadius:Math.max(1,Math.min(4,Math.round(Number(input?.edgeExtrudeRadius)||2)))});
}

export function exactCanvasPlacement(sourceWidth,sourceHeight,targetWidth,targetHeight,{mode='contain',anchorX=.5,anchorY=1}={}){
  sourceWidth=Math.max(1,Number(sourceWidth)||1);sourceHeight=Math.max(1,Number(sourceHeight)||1);
  targetWidth=Math.max(1,Number(targetWidth)||1);targetHeight=Math.max(1,Number(targetHeight)||1);
  if(mode==='stretch')return F({x:0,y:0,width:targetWidth,height:targetHeight,scaleX:targetWidth/sourceWidth,scaleY:targetHeight/sourceHeight,crops:false,distorts:Math.abs(targetWidth/sourceWidth-targetHeight/sourceHeight)>1e-9});
  const scale=(mode==='cover'?Math.max:Math.min)(targetWidth/sourceWidth,targetHeight/sourceHeight);
  const width=sourceWidth*scale,height=sourceHeight*scale;
  const x=(targetWidth-width)*clamp(anchorX,0,1),y=(targetHeight-height)*clamp(anchorY,0,1);
  return F({x,y,width,height,scaleX:scale,scaleY:scale,crops:mode==='cover'&&(width>targetWidth+.01||height>targetHeight+.01),distorts:false});
}

function makeCanvas(root,width,height){const canvas=root.document?.createElement?.('canvas');if(!canvas)throw new Error('EXACT_CANVAS_UNAVAILABLE');canvas.width=width;canvas.height=height;return canvas}
function canvasBlob(canvas,type='image/png',quality=.96){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('EXACT_CANVAS_ENCODE_FAILED')),type,quality))}

export function verifyExactRuntime(runtime,config){const c=normalizeExactCanvasConfig(config);if(!c.enabled)return F({ok:true,enabled:false});const expectedWidth=c.width*Math.max(1,Number(runtime?.columns)||1),expectedHeight=c.height*Math.max(1,Number(runtime?.rows)||1);const checks=F({frameWidth:Number(runtime?.frameWidth)===c.width,frameHeight:Number(runtime?.frameHeight)===c.height,atlasWidth:Number(runtime?.width)===expectedWidth,atlasHeight:Number(runtime?.height)===expectedHeight,canvasWidth:Number(runtime?.canvas?.width)===expectedWidth,canvasHeight:Number(runtime?.canvas?.height)===expectedHeight});return F({ok:Object.values(checks).every(Boolean),enabled:true,expected:F({frameWidth:c.width,frameHeight:c.height,width:expectedWidth,height:expectedHeight}),actual:F({frameWidth:runtime?.frameWidth,frameHeight:runtime?.frameHeight,width:runtime?.width,height:runtime?.height,canvasWidth:runtime?.canvas?.width,canvasHeight:runtime?.canvas?.height}),checks})}

export async function reframeCompiledRuntimeExact(root,compiled,input={}){
  const config=normalizeExactCanvasConfig(input);if(!config.enabled)return compiled;
  if(!compiled?.canvas||!compiled?.columns||!compiled?.rows||!compiled?.frameWidth||!compiled?.frameHeight)throw new Error('EXACT_CANVAS_COMPILED_RUNTIME_REQUIRED');
  if(config.mode==='cover'&&!config.allowCrop)throw new Error('EXACT_CANVAS_CROP_REQUIRES_CONFIRMATION');
  if(config.mode==='stretch'&&!config.allowDistort)throw new Error('EXACT_CANVAS_DISTORT_REQUIRES_CONFIRMATION');
  const columns=compiled.columns,rows=compiled.rows,output=makeCanvas(root,config.width*columns,config.height*rows),ctx=output.getContext('2d',{willReadFrequently:true});
  ctx.clearRect(0,0,output.width,output.height);ctx.imageSmoothingEnabled=!config.pixelArt;
  const placement=exactCanvasPlacement(compiled.frameWidth,compiled.frameHeight,config.width,config.height,config);
  for(let row=0;row<rows;row++){
    const count=Math.max(0,Math.min(columns,Number(compiled.frameCounts?.[row]??columns)||0));
    for(let col=0;col<count;col++){
      ctx.drawImage(compiled.canvas,col*compiled.frameWidth,row*compiled.frameHeight,compiled.frameWidth,compiled.frameHeight,col*config.width+placement.x,row*config.height+placement.y,placement.width,placement.height);
    }
  }
  let atlasFinalization=null;
  if(config.pixelArt&&config.edgeExtrude){const image=ctx.getImageData(0,0,output.width,output.height),finalized=finalizeRuntimeAtlasPixels(image.data,output.width,output.height,{columns,rows,frameWidth:config.width,frameHeight:config.height,frameCounts:compiled.frameCounts,radius:config.edgeExtrudeRadius});image.data.set(finalized.data);ctx.putImageData(image,0,0);atlasFinalization=finalized.report;}
  const blob=await canvasBlob(output,'image/png');
  const exact=F({...config,sourceFrameWidth:compiled.frameWidth,sourceFrameHeight:compiled.frameHeight,placement,atlasWidth:output.width,atlasHeight:output.height,guarantee:`${config.width}x${config.height}`,atlasFinalization});
  const next={...compiled,canvas:output,blob,type:'image/png',width:output.width,height:output.height,frameWidth:config.width,frameHeight:config.height,exactCanvas:exact,atlasFinalization,audit:F({...compiled.audit,exactCanvas:exact,atlasFinalization})};
  const verification=verifyExactRuntime(next,config);if(!verification.ok)throw new Error(`EXACT_CANVAS_VERIFICATION_FAILED:${JSON.stringify(verification)}`);
  return F({...next,exactCanvasVerification:verification});
}

export const __exactCanvasInternals=F({MODES});
