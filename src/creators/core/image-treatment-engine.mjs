/* KELO-INDEX
 * area: CREATORS / SHARED IMAGE TREATMENT
 * owner: Kelo Image Treatment Engine
 * keys: IMAGE DENOISE HALO ALPHA NOISE SPRITE PIXEL ART ILLUSTRATION UI
 * purpose: tratamiento determinista RGBA previo a compilación/optimización sin servicios externos
 * public-api: analyzeImagePixels, resolveImageTreatmentProfile, treatImagePixels, treatImageSource, treatImageFile
 * owns: análisis de ruido/bordes, saneo RGB invisible, reparación conservadora de halo y denoise edge-aware
 * does-not-own: PNG/WebP encoding, resize policy, sprite geometry, grid detection, publishing or gameplay authority
 */
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const pixelIndex=(x,y,width)=>(y*width+x)*4;
const colorDistance=(a,b,c,x,y,z)=>Math.hypot(a-x,b-y,c-z);
const luma=(r,g,b)=>r*.2126+g*.7152+b*.0722;
const assertPixels=(data,width,height)=>{
  width=Math.floor(finite(width));height=Math.floor(finite(height));
  if(width<1||height<1||!data||data.length<width*height*4)throw new Error('IMAGE_TREATMENT_PIXELS_REQUIRED');
  return{width,height};
};

const PROFILE_DEFAULTS=Object.freeze({
  sprite:Object.freeze({sanitizeTransparentRGB:true,repairHalos:true,haloThreshold:46,interiorAlpha:224,denoiseStrength:0,colorSigma:24,sharpenStrength:0}),
  'pixel-art':Object.freeze({sanitizeTransparentRGB:true,repairHalos:false,haloThreshold:64,interiorAlpha:240,denoiseStrength:0,colorSigma:18,sharpenStrength:0}),
  illustration:Object.freeze({sanitizeTransparentRGB:true,repairHalos:true,haloThreshold:34,interiorAlpha:208,denoiseStrength:.38,colorSigma:34,sharpenStrength:.08}),
  ui:Object.freeze({sanitizeTransparentRGB:true,repairHalos:true,haloThreshold:58,interiorAlpha:232,denoiseStrength:0,colorSigma:20,sharpenStrength:0})
});

function samplingStep(width,height,maxSamples=24000){return Math.max(1,Math.floor(Math.sqrt((width*height)/Math.max(1,maxSamples))));}

export function analyzeImagePixels(sourceData,width,height,{alphaThreshold=8,maxSamples=24000}={}){
  const raw=sourceData?.data||sourceData;({width,height}=assertPixels(raw,width,height));
  const step=samplingStep(width,height,maxSamples),buckets=new Set();let sampled=0,transparent=0,semi=0,opaque=0,edge=0,noise=0,comparisons=0;
  for(let y=0;y<height;y+=step){
    for(let x=0;x<width;x+=step){
      const i=pixelIndex(x,y,width),r=raw[i],g=raw[i+1],b=raw[i+2],a=raw[i+3];sampled++;
      if(a<=alphaThreshold)transparent++;else if(a<247)semi++;else opaque++;
      if(a>alphaThreshold)buckets.add(`${r>>4}:${g>>4}:${b>>4}:${a>>5}`);
      if(x+step<width&&a>alphaThreshold){
        const j=pixelIndex(x+step,y,width);if(raw[j+3]>alphaThreshold){const d=Math.abs(luma(r,g,b)-luma(raw[j],raw[j+1],raw[j+2]));comparisons++;if(d>34)edge++;else if(d>3&&d<18)noise+=d;}
      }
      if(y+step<height&&a>alphaThreshold){
        const j=pixelIndex(x,y+step,width);if(raw[j+3]>alphaThreshold){const d=Math.abs(luma(r,g,b)-luma(raw[j],raw[j+1],raw[j+2]));comparisons++;if(d>34)edge++;else if(d>3&&d<18)noise+=d;}
      }
    }
  }
  const total=Math.max(1,sampled),edgeRatio=edge/Math.max(1,comparisons),noiseScore=clamp((noise/Math.max(1,comparisons))/12,0,1),transparentRatio=transparent/total,semiRatio=semi/total,colorBuckets=buckets.size;
  let suggestedProfile='illustration';
  if(transparentRatio>.08&&(colorBuckets<420||edgeRatio>.22))suggestedProfile='sprite';
  if(transparentRatio>.12&&colorBuckets<96&&edgeRatio>.28)suggestedProfile='pixel-art';
  if(transparentRatio<.02&&colorBuckets<120&&edgeRatio>.32)suggestedProfile='ui';
  return Object.freeze({width,height,sampledPixels:sampled,sampleStep:step,transparentRatio,semiTransparentRatio:semiRatio,opaqueRatio:opaque/total,colorBuckets,edgeRatio,noiseScore,suggestedProfile});
}

export function resolveImageTreatmentProfile(profile='auto',analysis=null,overrides={}){
  const name=profile==='auto'?(analysis?.suggestedProfile||'illustration'):String(profile||'illustration').toLowerCase();
  const base=PROFILE_DEFAULTS[name]||PROFILE_DEFAULTS.illustration;
  return Object.freeze({name:PROFILE_DEFAULTS[name]?name:'illustration',...base,...overrides});
}

function sanitizeTransparentRGB(data){
  let changed=0;
  for(let i=0;i<data.length;i+=4){if(data[i+3]===0&&(data[i]||data[i+1]||data[i+2])){data[i]=0;data[i+1]=0;data[i+2]=0;changed++;}}
  return changed;
}

function repairHalos(input,width,height,{haloThreshold=42,interiorAlpha=220}={}){
  const out=new Uint8ClampedArray(input);let repaired=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=pixelIndex(x,y,width),a=input[i+3];if(a<=0||a>=interiorAlpha)continue;
    let sr=0,sg=0,sb=0,weight=0;
    for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
      if(!ox&&!oy)continue;const nx=x+ox,ny=y+oy;if(nx<0||ny<0||nx>=width||ny>=height)continue;
      const j=pixelIndex(nx,ny,width),na=input[j+3];if(na<interiorAlpha)continue;const w=na/255;sr+=input[j]*w;sg+=input[j+1]*w;sb+=input[j+2]*w;weight+=w;
    }
    if(weight<.9)continue;const r=Math.round(sr/weight),g=Math.round(sg/weight),b=Math.round(sb/weight);
    if(colorDistance(input[i],input[i+1],input[i+2],r,g,b)<haloThreshold)continue;
    out[i]=r;out[i+1]=g;out[i+2]=b;repaired++;
  }
  return{data:out,repaired};
}

function edgeAwareDenoise(input,width,height,{strength=.35,colorSigma=32,alphaFloor=16}={}){
  strength=clamp(finite(strength,.35),0,1);if(strength<=0)return{data:new Uint8ClampedArray(input),changed:0};
  const out=new Uint8ClampedArray(input),sigma=Math.max(1,finite(colorSigma,32)),sigma2=2*sigma*sigma;let changed=0;
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
    const i=pixelIndex(x,y,width),a=input[i+3];if(a<alphaFloor)continue;
    const cr=input[i],cg=input[i+1],cb=input[i+2];let sr=cr*1.8,sg=cg*1.8,sb=cb*1.8,sw=1.8;
    for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
      if(!ox&&!oy)continue;const j=pixelIndex(x+ox,y+oy,width),na=input[j+3];if(na<alphaFloor)continue;
      const dr=input[j]-cr,dg=input[j+1]-cg,db=input[j+2]-cb,d2=dr*dr+dg*dg+db*db;if(d2>sigma2*4)continue;
      const spatial=(ox&&oy)?.72:1,range=Math.exp(-d2/sigma2),w=spatial*range*(na/255);sr+=input[j]*w;sg+=input[j+1]*w;sb+=input[j+2]*w;sw+=w;
    }
    const nr=Math.round(cr+(sr/sw-cr)*strength),ng=Math.round(cg+(sg/sw-cg)*strength),nb=Math.round(cb+(sb/sw-cb)*strength);
    if(nr!==cr||ng!==cg||nb!==cb){out[i]=nr;out[i+1]=ng;out[i+2]=nb;changed++;}
  }
  return{data:out,changed};
}

function mildSharpen(input,width,height,{strength=.08,alphaFloor=16,maxDelta=10}={}){
  strength=clamp(finite(strength,.08),0,.35);if(strength<=0)return{data:new Uint8ClampedArray(input),changed:0};
  const out=new Uint8ClampedArray(input);let changed=0;
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
    const i=pixelIndex(x,y,width);if(input[i+3]<alphaFloor)continue;let localChanged=false;
    for(let c=0;c<3;c++){
      const center=input[i+c],avg=(input[pixelIndex(x-1,y,width)+c]+input[pixelIndex(x+1,y,width)+c]+input[pixelIndex(x,y-1,width)+c]+input[pixelIndex(x,y+1,width)+c])/4;
      const delta=clamp((center-avg)*strength,-maxDelta,maxDelta),next=clamp(Math.round(center+delta),0,255);if(next!==center){out[i+c]=next;localChanged=true;}
    }
    if(localChanged)changed++;
  }
  return{data:out,changed};
}

function diffMetrics(before,after){
  let changedPixels=0,visibleChangedPixels=0,maxChannelDelta=0,totalDelta=0,channels=0,alphaChanges=0;
  for(let i=0;i<before.length;i+=4){let changed=false;for(let c=0;c<4;c++){const d=Math.abs(before[i+c]-after[i+c]);if(d){changed=true;maxChannelDelta=Math.max(maxChannelDelta,d);totalDelta+=d;channels++;if(c===3)alphaChanges++;}}if(changed){changedPixels++;if(before[i+3]>0||after[i+3]>0)visibleChangedPixels++;}}
  return Object.freeze({changedPixels,visibleChangedPixels,maxChannelDelta,meanChangedChannelDelta:channels?totalDelta/channels:0,alphaChanges});
}

export function treatImagePixels(sourceData,width,height,{profile='auto',...overrides}={}){
  const raw=sourceData?.data||sourceData;({width,height}=assertPixels(raw,width,height));const original=new Uint8ClampedArray(raw),analysis=analyzeImagePixels(original,width,height),settings=resolveImageTreatmentProfile(profile,analysis,overrides);let current=new Uint8ClampedArray(original);
  const operations={transparentRgbSanitized:0,haloPixelsRepaired:0,denoisedPixels:0,sharpenedPixels:0};
  if(settings.sanitizeTransparentRGB)operations.transparentRgbSanitized=sanitizeTransparentRGB(current);
  if(settings.repairHalos){const halo=repairHalos(current,width,height,settings);current=halo.data;operations.haloPixelsRepaired=halo.repaired;}
  if(settings.denoiseStrength>0){const denoise=edgeAwareDenoise(current,width,height,settings);current=denoise.data;operations.denoisedPixels=denoise.changed;}
  if(settings.sharpenStrength>0){const sharp=mildSharpen(current,width,height,settings);current=sharp.data;operations.sharpenedPixels=sharp.changed;}
  const diff=diffMetrics(original,current),report=Object.freeze({version:'image-treatment-v1.0.0',profile:settings.name,width,height,analysis,settings,operations:Object.freeze(operations),...diff,changedRatio:diff.changedPixels/(width*height),visibleChangedRatio:diff.visibleChangedPixels/(width*height),alphaPreserved:diff.alphaChanges===0});
  return Object.freeze({data:current,report,analysis,profile:settings});
}

function canvasFromSource(root,source){
  if(!root?.document)throw new Error('IMAGE_TREATMENT_DOM_REQUIRED');const width=Math.max(1,Math.round(source?.naturalWidth||source?.videoWidth||source?.width||0)),height=Math.max(1,Math.round(source?.naturalHeight||source?.videoHeight||source?.height||0));if(!width||!height)throw new Error('IMAGE_TREATMENT_SOURCE_DIMENSIONS_REQUIRED');
  const canvas=root.document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('IMAGE_TREATMENT_CANVAS_2D_REQUIRED');ctx.clearRect(0,0,width,height);ctx.drawImage(source,0,0,width,height);return{canvas,ctx,width,height};
}

export function treatImageSource(root,source,options={}){
  const state=canvasFromSource(root,source),imageData=state.ctx.getImageData(0,0,state.width,state.height),treated=treatImagePixels(imageData.data,state.width,state.height,options),output=state.ctx.createImageData(state.width,state.height);output.data.set(treated.data);state.ctx.putImageData(output,0,0);
  return Object.freeze({canvas:state.canvas,width:state.width,height:state.height,report:treated.report,analysis:treated.analysis,profile:treated.profile});
}

function dataUrlFromFile(root,file){return new Promise((resolve,reject)=>{const reader=new root.FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(reader.error||new Error('IMAGE_TREATMENT_FILE_READ_FAILED'));reader.readAsDataURL(file);});}
function imageFromDataUrl(root,url){return new Promise((resolve,reject)=>{const img=new root.Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('IMAGE_TREATMENT_IMAGE_DECODE_FAILED'));img.src=url;});}
export async function treatImageFile(root,file,options={}){
  if(!file)throw new Error('IMAGE_TREATMENT_FILE_REQUIRED');const originalDataUrl=await dataUrlFromFile(root,file),image=await imageFromDataUrl(root,originalDataUrl),treated=treatImageSource(root,image,options),type=String(options.outputType||'image/png'),quality=options.quality;
  const dataUrl=Number.isFinite(quality)?treated.canvas.toDataURL(type,quality):treated.canvas.toDataURL(type);return Object.freeze({...treated,dataUrl,originalDataUrl,sourceBytes:finite(file.size,0),sourceType:String(file.type||'')});
}
