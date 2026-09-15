/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / WORLD ASSET COMPILER
 * owner: existing Sprite Compiler authoring capability
 * keys: WORLD ASSET COMPILE PIVOT FOOTPRINT COLLISION PORTAL VARIANT SCALE ALPHA METADATA PIXEL GRAMMAR
 * purpose: promote deterministic single-asset analysis into production-ready cleaned PNG canvas + JSON-safe world metadata
 * public-api: compileWorldAssetPixels, compileWorldAssetImage, serializeWorldAssetMetadata
 * consumes: sprite-world-asset-profile.mjs, sprite-pixel-grammar.mjs
 * state-owned: none; pure authoring derivative
 * extension-points: profile options and explicit overrides
 * online: metadata is stable/id-based and can be persisted with future server-authoritative asset revisions
 * do-not: mutate world/runtime collision, publish revisions, or generate missing art
 */
import {buildWorldAssetProfile} from './sprite-world-asset-profile.mjs';
import {preparePixelArtPixels} from './sprite-pixel-grammar.mjs';
const F=Object.freeze;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

function buildCollisionProfile(footprint,portal){
 const rect=footprint?.rect;if(!rect)return F({mode:'none',shape:'none',passThrough:false,solidBounds:null,solidSegments:F([]),portalCutout:null});
 if(!portal?.enabled||!portal?.rect)return F({mode:'footprint',shape:footprint.shape||'rect',passThrough:false,solidBounds:rect,solidSegments:F([rect]),portalCutout:null});
 const cutX0=clamp(portal.rect.x,rect.x,rect.right),cutX1=clamp(portal.rect.right,rect.x,rect.right),segments=[];
 if(cutX0>rect.x)segments.push(F({x:rect.x,y:rect.y,width:cutX0-rect.x,height:rect.height,right:cutX0-1,bottom:rect.bottom}));
 if(cutX1<rect.right)segments.push(F({x:cutX1+1,y:rect.y,width:rect.right-cutX1,height:rect.height,right:rect.right,bottom:rect.bottom}));
 const portalCutout=F({x:cutX0,y:rect.y,width:Math.max(1,cutX1-cutX0+1),height:rect.height,right:cutX1,bottom:rect.bottom});
 return F({mode:'footprint-with-portal-cutout',shape:footprint.shape||'rect',passThrough:true,solidBounds:rect,solidSegments:F(segments),portalCutout});
}

export function serializeWorldAssetMetadata(profile){
 if(!profile)return null;const {cleanedPixels,...metadata}=profile;return F({...metadata,collision:buildCollisionProfile(profile.footprint,profile.portal)});
}

export function compileWorldAssetPixels(sourceData,width,height,options={}){
 const pixelArt=options.pixelArt!==false,prepared=pixelArt?preparePixelArtPixels(sourceData,width,height,{paletteMaxColors:options.paletteMaxColors??null,alpha:options.pixelAlpha||{},analysis:options.pixelAnalysis||{}}):F({data:sourceData?.data||sourceData,report:null});
 const base=buildWorldAssetProfile(prepared.data,width,height,options),collision=buildCollisionProfile(base.footprint,base.portal),profile=F({...base,pixelPreparation:prepared.report,collision});
 return F({profile,metadata:serializeWorldAssetMetadata(profile),cleanedPixels:profile.cleanedPixels});
}

export function compileWorldAssetImage(root,image,options={}){
 if(!root?.document)throw new Error('WORLD_ASSET_DOM_REQUIRED');const width=Math.max(1,Math.round(image?.naturalWidth||image?.width||0)),height=Math.max(1,Math.round(image?.naturalHeight||image?.height||0));if(!width||!height)throw new Error('WORLD_ASSET_IMAGE_DIMENSIONS_REQUIRED');
 const canvas=root.document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,width,height);ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0,width,height);const raw=ctx.getImageData(0,0,width,height),compiled=compileWorldAssetPixels(raw.data,width,height,options),cleaned=ctx.createImageData(width,height);cleaned.data.set(compiled.cleanedPixels);ctx.clearRect(0,0,width,height);ctx.putImageData(cleaned,0,0);
 return F({canvas,metadata:compiled.metadata,profile:compiled.profile,width,height});
}
