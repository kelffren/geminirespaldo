import { cleanFlatBackgroundPixels,alphaBounds,analyzeAlphaQuality } from '../src/creators/sprite-ability/sprite-ability-loose-import.mjs';
const width=64,height=64,data=new Uint8ClampedArray(width*height*4);
for(let i=0;i<data.length;i+=4){data[i]=255;data[i+1]=255;data[i+2]=255;data[i+3]=255;}
for(let y=14;y<58;y++)for(let x=18;x<47;x++){const i=(y*width+x)*4;data[i]=35;data[i+1]=120;data[i+2]=230;data[i+3]=255;}
const cleaned=cleanFlatBackgroundPixels(data,width,height,{tolerance:30,feather:20});
if(cleaned.removed<1000)throw new Error(`LOOSE_BACKGROUND_NOT_REMOVED:${cleaned.removed}`);
const bounds=alphaBounds(cleaned.data,width,height);
if(bounds.x>18||bounds.y>14||bounds.x+bounds.width<47||bounds.y+bounds.height<58)throw new Error(`LOOSE_BOUNDS_WRONG:${JSON.stringify(bounds)}`);
const q=analyzeAlphaQuality(cleaned.data,width,height);
if(q.clipped)throw new Error('LOOSE_FALSE_CLIP_WARNING');
const clippedData=new Uint8ClampedArray(32*32*4);for(let y=4;y<28;y++)for(let x=0;x<12;x++){const i=(y*32+x)*4;clippedData[i+3]=255;}
if(!analyzeAlphaQuality(clippedData,32,32).clipped)throw new Error('LOOSE_CLIP_NOT_DETECTED');
console.log('SPRITE ABILITY LOOSE IMPORT AUDIT: PASS');
console.log(JSON.stringify({removed:cleaned.removed,background:cleaned.background,confidence:cleaned.confidence,bounds,quality:q},null,2));
