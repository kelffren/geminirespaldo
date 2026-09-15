/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / WORLD ASSET PROFILE
 * owner: existing Sprite Compiler deterministic asset interpretation capability
 * keys: WORLD ASSET PIVOT FOOTPRINT COLLISION PORTAL VARIANT SCALE ALPHA PLACEMENT STYLE
 * purpose: turn one transparent/raw prop image into deterministic world-placement metadata without inventing pixels
 * public-api: snapAlphaPixels, findOpaqueBounds, inferGroundPivot, inferFootprint, inferPortalOpening, planWorldAssetScale, buildWorldAssetProfile
 * consumes: RGBA pixels only
 * state-owned: none; pure pixels/options -> cleaned pixels + metadata
 * extension-points: explicit user overrides for pivot, footprint, portal, size, variants and placement rules
 * online: N/A at authoring time; emitted stable metadata is persistence/server friendly
 * do-not: mutate runtime world state, publish assets, generate art, or pretend to infer semantic perspective from pixels
 */
const F=Object.freeze;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
function assertPixels(data,width,height){const raw=data?.data||data;if(!raw||raw.length<width*height*4)throw new Error('WORLD_ASSET_PIXELS_REQUIRED');return raw}
const px=(x,y,width)=>((y*width+x)*4);
const round=(n,d=4)=>Number(Number(n).toFixed(d));

export function snapAlphaPixels(sourceData,width,height,{transparentBelow=8,opaqueAbove=248}={}){
 const raw=assertPixels(sourceData,width,height),out=new Uint8ClampedArray(raw);let transparentSnaps=0,opaqueSnaps=0,fringePixels=0,visiblePixels=0;
 transparentBelow=clamp(Math.round(finite(transparentBelow,8)),0,254);opaqueAbove=clamp(Math.round(finite(opaqueAbove,248)),transparentBelow+1,255);
 for(let i=0;i<out.length;i+=4){const a=out[i+3];if(a===0)continue;if(a<=transparentBelow){out[i+3]=0;transparentSnaps++;continue;}visiblePixels++;if(a>=opaqueAbove&&a<255){out[i+3]=255;opaqueSnaps++;continue;}if(a<opaqueAbove)fringePixels++;}
 return F({data:out,transparentBelow,opaqueAbove,transparentSnaps,opaqueSnaps,fringePixels,visiblePixels,fringeRatio:visiblePixels?fringePixels/visiblePixels:0});
}

export function findOpaqueBounds(sourceData,width,height,{alphaThreshold=12}={}){
 const data=assertPixels(sourceData,width,height);let minX=width,minY=height,maxX=-1,maxY=-1,pixels=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){if(data[px(x,y,width)+3]<=alphaThreshold)continue;pixels++;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
 if(maxX<0)return null;return F({x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1,right:maxX,bottom:maxY,pixels,touchesCanvas:minX===0||minY===0||maxX===width-1||maxY===height-1});
}

function foregroundXs(data,width,y,x0,x1,alphaThreshold){const xs=[];for(let x=x0;x<=x1;x++)if(data[px(x,y,width)+3]>alphaThreshold)xs.push(x);return xs}
function quantile(sorted,q){if(!sorted.length)return null;const i=clamp((sorted.length-1)*q,0,sorted.length-1),lo=Math.floor(i),hi=Math.ceil(i),t=i-lo;return sorted[lo]*(1-t)+sorted[hi]*t}

export function inferGroundPivot(sourceData,width,height,{alphaThreshold=12,bounds=null,bandRatio=.16}={}){
 const data=assertPixels(sourceData,width,height),b=bounds||findOpaqueBounds(data,width,height,{alphaThreshold});if(!b)return F({x:.5,y:1,px:F({x:width/2,y:height-1}),confidence:0,reason:'empty'});
 const band=Math.max(2,Math.round(b.height*clamp(bandRatio,.04,.35))),start=Math.max(b.y,b.bottom-band+1),samples=[];
 for(let y=start;y<=b.bottom;y++){const row=foregroundXs(data,width,y,b.x,b.right,alphaThreshold);const weight=1+(y-start)/Math.max(1,b.bottom-start);for(const x of row)samples.push({x,y,w:weight});}
 let x=b.x+b.width/2;if(samples.length){const total=samples.reduce((s,p)=>s+p.w,0);x=samples.reduce((s,p)=>s+p.x*p.w,0)/Math.max(1,total);}
 const y=clamp(b.bottom+.5,0,height-1),support=Math.min(1,samples.length/Math.max(1,b.width*band*.35)),confidence=clamp(.55+support*.45,0,1);
 return F({x:round((x+.5)/width),y:round((y+.5)/height),px:F({x:round(x,2),y:round(y,2)}),confidence:round(confidence),reason:'lower-support-centroid'});
}

export function inferFootprint(sourceData,width,height,{alphaThreshold=12,bounds=null,bandRatio=.14,quantileInset=.06,depthRatio=.08}={}){
 const data=assertPixels(sourceData,width,height),b=bounds||findOpaqueBounds(data,width,height,{alphaThreshold});if(!b)return null;
 const band=Math.max(2,Math.round(b.height*clamp(bandRatio,.04,.35))),start=Math.max(b.y,b.bottom-band+1),xs=[];
 for(let y=start;y<=b.bottom;y++)for(let x=b.x;x<=b.right;x++)if(data[px(x,y,width)+3]>alphaThreshold)xs.push(x);
 xs.sort((a,b)=>a-b);const q=clamp(quantileInset,0,.24),left=quantile(xs,q)??b.x,right=quantile(xs,1-q)??b.right,x0=clamp(Math.floor(left),b.x,b.right),x1=clamp(Math.ceil(right),x0,b.right),depth=Math.max(2,Math.round(b.height*clamp(depthRatio,.025,.2))),y1=b.bottom,y0=Math.max(b.y,y1-depth+1),rect=F({x:x0,y:y0,width:x1-x0+1,height:y1-y0+1,right:x1,bottom:y1});
 const normalized=F({x:round(rect.x/width),y:round(rect.y/height),width:round(rect.width/width),height:round(rect.height/height)}),polygon=F([[rect.x,rect.bottom],[rect.right,rect.bottom],[rect.right,rect.y],[rect.x,rect.y]].map(([x,y])=>F({x,y})));
 return F({shape:'rect',rect,normalized,polygon,source:'lower-support-quantiles',confidence:round(clamp(xs.length/Math.max(1,band*b.width*.45),.35,1))});
}

function centralTransparentRun(data,width,y,x0,x1,center,alphaThreshold){let best=null,start=null;for(let x=x0;x<=x1+1;x++){const transparent=x<=x1&&data[px(x,y,width)+3]<=alphaThreshold;if(transparent&&start===null)start=x;if((!transparent||x===x1+1)&&start!==null){const end=x-1;if(start<=center&&end>=center){best={start,end,width:end-start+1};break;}start=null;}}return best}
function flankHasOpaque(data,width,y,x0,x1,alphaThreshold){if(x1<x0)return false;let opaque=0,total=0;for(let x=x0;x<=x1;x++){total++;if(data[px(x,y,width)+3]>alphaThreshold)opaque++;}return total>0&&opaque/total>=.12}

export function inferPortalOpening(sourceData,width,height,{alphaThreshold=12,bounds=null,minWidthRatio=.12,maxWidthRatio=.72,minHeightRatio=.18}={}){
 const data=assertPixels(sourceData,width,height),b=bounds||findOpaqueBounds(data,width,height,{alphaThreshold});if(!b)return F({enabled:false,walkThrough:false,confidence:0,reason:'empty'});
 const center=Math.round(b.x+(b.width-1)/2),scanTop=Math.round(b.y+b.height*.22),scanBottom=Math.round(b.y+b.height*.84),rows=[];
 for(let y=scanTop;y<=scanBottom;y++){const run=centralTransparentRun(data,width,y,b.x,b.right,center,alphaThreshold);if(!run)continue;const ratio=run.width/b.width;if(ratio<minWidthRatio||ratio>maxWidthRatio)continue;const left=flankHasOpaque(data,width,y,b.x,run.start-1,alphaThreshold),right=flankHasOpaque(data,width,y,run.end+1,b.right,alphaThreshold);if(left&&right)rows.push({y,...run});}
 if(!rows.length)return F({enabled:false,walkThrough:false,confidence:0,reason:'no-central-flanked-opening'});
 let best=[],current=[];for(const row of rows){if(!current.length||row.y===current[current.length-1].y+1)current.push(row);else{if(current.length>best.length)best=current;current=[row];}}if(current.length>best.length)best=current;
 const minHeight=Math.max(3,Math.round(b.height*minHeightRatio));if(best.length<minHeight)return F({enabled:false,walkThrough:false,confidence:round(best.length/Math.max(1,minHeight)),reason:'opening-too-short'});
 const starts=best.map(r=>r.start).sort((a,b)=>a-b),ends=best.map(r=>r.end).sort((a,b)=>a-b),x0=Math.round(quantile(starts,.55)),x1=Math.round(quantile(ends,.45)),y0=best[0].y,y1=best[best.length-1].y,rect=F({x:x0,y:y0,width:Math.max(1,x1-x0+1),height:y1-y0+1,right:x1,bottom:y1}),heightScore=clamp(rect.height/(b.height*.42),0,1),widthScore=clamp(1-Math.abs(rect.width/b.width-.34)/.34,0,1),confidence=clamp(.45+heightScore*.35+widthScore*.2,0,1);
 return F({enabled:confidence>=.62,walkThrough:confidence>=.62,confidence:round(confidence),openingType:'arch-or-gate',rect,normalized:F({x:round(rect.x/width),y:round(rect.y/height),width:round(rect.width/width),height:round(rect.height/height)}),reason:'central-transparent-run-with-solid-flanks'});
}

export function planWorldAssetScale(bounds,{tilePixels=64,nominalWidthTiles=null,targetPixelWidth=null,maxUpscale=2.5,minScale=.08}={}){
 if(!bounds)return F({scale:1,nominalWidthTiles:0,targetPixelWidth:0,sizeClass:'empty',widthClass:'empty'});
 const inferredTiles=clamp(Math.round((bounds.width/Math.max(1,bounds.height))*3*2)/2,.5,6),explicitTiles=nominalWidthTiles==null?NaN:Number(nominalWidthTiles),tiles=Math.max(.25,Number.isFinite(explicitTiles)?explicitTiles:inferredTiles),tile=Math.max(1,finite(tilePixels,64)),explicitTarget=targetPixelWidth==null?NaN:Number(targetPixelWidth),target=Math.max(1,Number.isFinite(explicitTarget)?explicitTarget:tiles*tile),scale=clamp(target/Math.max(1,bounds.width),minScale,maxUpscale);
 const sizeClass=tiles<=.75?'xs':tiles<=1.5?'small':tiles<=2.5?'medium':tiles<=4?'large':'landmark',widthClass=tiles<=1?'narrow':tiles<=2.5?'standard':tiles<=4?'wide':'monumental';
 return F({scale:round(scale),nominalWidthTiles:round(tiles,2),targetPixelWidth:round(target,2),sizeClass,widthClass,preserveAspectRatio:true});
}

function variantMetadata(assetId,{variantGroup=null,variantId=null,spawnWeight=1,variants=null}={}){const id=String(assetId||'world_asset').trim()||'world_asset',m=id.match(/(?:_|-)([A-Z])$/),autoVariant=m?.[1]||'A',group=variantGroup||id.replace(/(?:_|-)[A-Z]$/,'');const requested=Array.isArray(variants)&&variants.length?variants:[{id:autoVariant,spawnWeight}];return F({variantGroup:group,variantId:variantId||autoVariant,spawnWeight:Math.max(0,finite(spawnWeight,1)),variants:F(requested.map((item,index)=>F({id:String(item?.id||String.fromCharCode(65+index)),spawnWeight:Math.max(0,finite(item?.spawnWeight,1)),widthScale:round(clamp(finite(item?.widthScale,1),.65,1.2),3)})))});}
function placementDefaults(category){const c=String(category||'prop');if(/gate|portal|entrance/.test(c))return {nearPath:true,requiresFlatGround:true,minSpacing:8,allowOverlap:false,portalCandidate:true};if(/landmark|fountain|statue/.test(c))return {nearPath:true,requiresFlatGround:true,minSpacing:10,allowOverlap:false,portalCandidate:false};if(/tree|vegetation|garden/.test(c))return {nearPath:false,requiresFlatGround:true,minSpacing:1.5,allowOverlap:false,portalCandidate:false};return {nearPath:false,requiresFlatGround:true,minSpacing:2,allowOverlap:false,portalCandidate:false}}
function mergePlacement(category,override={}){const defaults=placementDefaults(category);return F({...defaults,...override,minSpacing:Math.max(0,finite(override?.minSpacing,defaults.minSpacing))})}

export function validateWorldAssetStyle({bounds,width,height,alphaCleanup,pivot,footprint,portal,expectedPortal=false}={}){
 const warnings=[];if(!bounds)warnings.push('EMPTY_ASSET');else{if(bounds.touchesCanvas)warnings.push('CANVAS_EDGE_CLIPPING_RISK');const centerOffset=Math.abs((bounds.x+bounds.width/2)/width-.5);if(centerOffset>.14)warnings.push('OFF_CENTER_ASSET');if(bounds.width/Math.max(1,bounds.height)>2.7)warnings.push('EXTREME_WIDE_ASPECT');if(bounds.height/Math.max(1,bounds.width)>4.8)warnings.push('EXTREME_TALL_ASPECT');}
 if((alphaCleanup?.fringeRatio||0)>.055)warnings.push('ALPHA_FRINGE_REVIEW');if(!pivot||pivot.confidence<.65)warnings.push('PIVOT_LOW_CONFIDENCE');if(!footprint||footprint.confidence<.55)warnings.push('FOOTPRINT_LOW_CONFIDENCE');if(expectedPortal&&!portal?.enabled)warnings.push('PORTAL_REVIEW_REQUIRED');
 return F({status:warnings.length?'NEEDS_REVIEW':'USABLE',warnings:F(warnings),pass:warnings.length===0,perspective:'not-inferred',note:'Perspective/style semantics require authored reference or human review; compiler validates measurable geometry only.'});
}

export function buildWorldAssetProfile(sourceData,width,height,{assetId='world_asset_A',category='prop',alpha={},pivot=null,footprint=null,portal='auto',nominalWidthTiles=null,targetPixelWidth=null,tilePixels=64,variantGroup=null,variantId=null,spawnWeight=1,variants=null,placementRules={},expectedPortal=null}={}){
 const raw=assertPixels(sourceData,width,height),clean=snapAlphaPixels(raw,width,height,alpha),bounds=findOpaqueBounds(clean.data,width,height),autoPivot=inferGroundPivot(clean.data,width,height,{bounds}),autoFootprint=inferFootprint(clean.data,width,height,{bounds}),autoPortal=inferPortalOpening(clean.data,width,height,{bounds}),categoryPortal=/gate|portal|entrance/.test(String(category)),wantsPortal=expectedPortal??categoryPortal,selectedPortal=portal==='auto'?autoPortal:portal===false?F({enabled:false,walkThrough:false,confidence:1,reason:'manual-disabled'}):F({...autoPortal,...portal,enabled:portal.enabled??true,walkThrough:portal.walkThrough??true,reason:'manual-override'}),selectedPivot=pivot?F({...autoPivot,...pivot,reason:'manual-override'}):autoPivot,selectedFootprint=footprint?F({...autoFootprint,...footprint,source:'manual-override'}):autoFootprint,scale=planWorldAssetScale(bounds,{tilePixels,nominalWidthTiles,targetPixelWidth}),variant=variantMetadata(assetId,{variantGroup,variantId,spawnWeight,variants}),placement=mergePlacement(category,placementRules),style=validateWorldAssetStyle({bounds,width,height,alphaCleanup:clean,pivot:selectedPivot,footprint:selectedFootprint,portal:selectedPortal,expectedPortal:wantsPortal});
 return F({schema:'kelo-world-asset-profile-v1',assetId:String(assetId),category:String(category),status:style.status,source:F({width,height,bounds}),alphaCleanup:F({transparentBelow:clean.transparentBelow,opaqueAbove:clean.opaqueAbove,transparentSnaps:clean.transparentSnaps,opaqueSnaps:clean.opaqueSnaps,fringePixels:clean.fringePixels,fringeRatio:round(clean.fringeRatio)}),pivot:selectedPivot,footprint:selectedFootprint,collision:F({mode:'footprint',shape:selectedFootprint?.shape||'none',solidBounds:selectedFootprint?.rect||null}),portal:selectedPortal,scale,variant,placementRules:placement,styleValidation:style,cleanedPixels:clean.data});
}
