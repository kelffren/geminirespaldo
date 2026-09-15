/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / PIXEL GRAMMAR
 * owner: deterministic pixel-art hygiene before geometry/rig compilation
 * keys: PIXEL ART PALETTE ALPHA HALO FRINGE DECONTAMINATE QUANTIZE SINGLETON
 * purpose: remove AI/background contamination without inventing structure and expose measurable pixel-art QA
 * public-api: analyzePixelGrammar, decontaminateAlphaFringe, quantizePixelPalette, preparePixelArtPixels
 * state-owned: none; pure RGBA -> RGBA/report
 * online: N/A
 * do-not: generate missing anatomy, blur edges, change geometry or silently destroy palette detail
 */
const F=Object.freeze;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const rawPixels=data=>data?.data||data;
function assertPixels(data,width,height){const raw=rawPixels(data);if(!raw||raw.length<width*height*4)throw new Error('SPRITE_PIXEL_GRAMMAR_PIXELS_REQUIRED');return raw;}
const idx=(x,y,w)=>(y*w+x)*4;
const rgbKey=(r,g,b)=>`${r},${g},${b}`;
const colorDistanceSq=(r,g,b,c)=>{const dr=r-c.r,dg=g-c.g,db=b-c.b;return dr*dr+dg*dg+db*db;};

export function analyzePixelGrammar(sourceData,width,height,{alphaThreshold=12,opaqueThreshold=248,maxPaletteColors=64}={}){
  const data=assertPixels(sourceData,width,height),palette=new Map();
  let visible=0,opaque=0,semiTransparent=0,hiddenRgb=0,singletons=0,edgeFringe=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=idx(x,y,width),a=data[i+3],hasRgb=data[i]||data[i+1]||data[i+2];
    if(a<=alphaThreshold){if(hasRgb)hiddenRgb++;continue;}
    visible++;
    if(a>=opaqueThreshold){opaque++;const key=rgbKey(data[i],data[i+1],data[i+2]);palette.set(key,(palette.get(key)||0)+1);}else semiTransparent++;
    let neighbors=0,opaqueNeighbor=false;
    for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
      if(!ox&&!oy)continue;const nx=x+ox,ny=y+oy;if(nx<0||ny<0||nx>=width||ny>=height)continue;
      const na=data[idx(nx,ny,width)+3];if(na>alphaThreshold)neighbors++;if(na>=opaqueThreshold)opaqueNeighbor=true;
    }
    if(!neighbors)singletons++;
    if(a<opaqueThreshold&&opaqueNeighbor)edgeFringe++;
  }
  const colors=[...palette.entries()].map(([key,count])=>{const [r,g,b]=key.split(',').map(Number);return {r,g,b,count};}).sort((a,b)=>b.count-a.count);
  const paletteSize=colors.length,semiTransparentRatio=visible?semiTransparent/visible:0,singletonRatio=visible?singletons/visible:0,hiddenRgbRatio=(width*height)?hiddenRgb/(width*height):0;
  const warnings=[];
  if(paletteSize>maxPaletteColors)warnings.push('PALETTE_TOO_LARGE');
  if(semiTransparentRatio>.08)warnings.push('ANTI_ALIAS_OR_ALPHA_FRINGE');
  if(singletonRatio>.025)warnings.push('ISOLATED_PIXEL_NOISE');
  if(hiddenRgbRatio>.04)warnings.push('HIDDEN_RGB_CONTAMINATION');
  return F({
    visiblePixels:visible,opaquePixels:opaque,semiTransparentPixels:semiTransparent,semiTransparentRatio:Number(semiTransparentRatio.toFixed(5)),
    edgeFringePixels:edgeFringe,hiddenRgbPixels:hiddenRgb,hiddenRgbRatio:Number(hiddenRgbRatio.toFixed(5)),singletons,singletonRatio:Number(singletonRatio.toFixed(5)),
    paletteSize,maxPaletteColors,dominantColors:F(colors.slice(0,16).map(c=>F(c))),warnings:F(warnings),status:warnings.length?'REVIEW':'CLEAN',
    likelyPixelArt:paletteSize<=maxPaletteColors&&semiTransparentRatio<=.12
  });
}

function nearestOpaqueColor(data,width,height,x,y,{opaqueThreshold=248,radius=3}={}){
  let best=null,bestScore=Infinity;
  for(let oy=-radius;oy<=radius;oy++)for(let ox=-radius;ox<=radius;ox++){
    if(!ox&&!oy)continue;const nx=x+ox,ny=y+oy;if(nx<0||ny<0||nx>=width||ny>=height)continue;
    const i=idx(nx,ny,width),a=data[i+3];if(a<opaqueThreshold)continue;
    const score=ox*ox+oy*oy;if(score<bestScore){bestScore=score;best={r:data[i],g:data[i+1],b:data[i+2]};}
  }
  return best;
}

export function decontaminateAlphaFringe(sourceData,width,height,{transparentBelow=8,opaqueAbove=248,neighborOpaque=240,radius=3,clearHiddenRgb=true}={}){
  const raw=assertPixels(sourceData,width,height),out=new Uint8ClampedArray(raw);let transparentSnaps=0,opaqueSnaps=0,recoloredFringe=0,clearedHiddenRgb=0,unresolvedFringe=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=idx(x,y,width),a=raw[i+3];
    if(a<=transparentBelow){
      if(a!==0)transparentSnaps++;out[i+3]=0;
      if(clearHiddenRgb&&(out[i]||out[i+1]||out[i+2])){out[i]=0;out[i+1]=0;out[i+2]=0;clearedHiddenRgb++;}
      continue;
    }
    if(a>=opaqueAbove){if(a!==255)opaqueSnaps++;out[i+3]=255;continue;}
    const donor=nearestOpaqueColor(raw,width,height,x,y,{opaqueThreshold:neighborOpaque,radius});
    if(donor){out[i]=donor.r;out[i+1]=donor.g;out[i+2]=donor.b;recoloredFringe++;}else unresolvedFringe++;
  }
  return F({data:out,report:F({transparentSnaps,opaqueSnaps,recoloredFringe,clearedHiddenRgb,unresolvedFringe,radius,transparentBelow,opaqueAbove})});
}

export function quantizePixelPalette(sourceData,width,height,{maxColors=32,alphaThreshold=12}={}){
  const raw=assertPixels(sourceData,width,height),limit=Math.max(2,Math.min(256,Math.floor(Number(maxColors)||32))),freq=new Map();
  for(let i=0;i<raw.length;i+=4){if(raw[i+3]<=alphaThreshold)continue;const key=rgbKey(raw[i],raw[i+1],raw[i+2]);freq.set(key,(freq.get(key)||0)+1);}
  const palette=[...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([key,count])=>{const [r,g,b]=key.split(',').map(Number);return F({r,g,b,count});});
  const out=new Uint8ClampedArray(raw);let changed=0;
  if(!palette.length)return F({data:out,palette:F([]),changed:0});
  for(let i=0;i<out.length;i+=4){if(out[i+3]<=alphaThreshold)continue;let best=palette[0],score=Infinity;for(const c of palette){const d=colorDistanceSq(out[i],out[i+1],out[i+2],c);if(d<score){score=d;best=c;if(!d)break;}}if(out[i]!==best.r||out[i+1]!==best.g||out[i+2]!==best.b){out[i]=best.r;out[i+1]=best.g;out[i+2]=best.b;changed++;}}
  return F({data:out,palette:F(palette),changed});
}

export function preparePixelArtPixels(sourceData,width,height,{paletteMaxColors=null,alpha={},analysis={}}={}){
  const before=analyzePixelGrammar(sourceData,width,height,analysis),decontaminated=decontaminateAlphaFringe(sourceData,width,height,alpha);
  let data=decontaminated.data,quantization=null;
  if(Number.isFinite(Number(paletteMaxColors))&&Number(paletteMaxColors)>=2){quantization=quantizePixelPalette(data,width,height,{maxColors:Number(paletteMaxColors),alphaThreshold:analysis.alphaThreshold??12});data=quantization.data;}
  const after=analyzePixelGrammar(data,width,height,{...analysis,maxPaletteColors:Number.isFinite(Number(paletteMaxColors))?Number(paletteMaxColors):(analysis.maxPaletteColors??64)});
  return F({data,report:F({schema:'kelo-pixel-grammar-v1',before,after,alpha:decontaminated.report,quantization:quantization?F({changed:quantization.changed,paletteSize:quantization.palette.length}):null,pass:after.status==='CLEAN'})});
}
