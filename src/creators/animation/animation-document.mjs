/* KELO-INDEX
 * area: CREATORS / ANIMATION DOCUMENT
 * owner: Animation workspace document schema
 * owns: editable AnimationClip authoring data and gameplay-track metadata
 * does-not-own: animation playback, combat hit validation, asset loading, persistence or networking
 * reuse: StudioKernel documentModel + KeloAnimation/KeloAssetRegistry adapters
 */

const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
const uid=prefix=>`${prefix}:${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const ANIMATION_TRACK_TYPES=Object.freeze(['hitbox','hurtbox','movement','sound','vfx','event','projectile','invulnerability']);

function normalizeKeyframe(row={},index=0){
  return {id:String(row.id||uid(`keyframe-${index}`)),t:clamp(finite(row.t,index?1:0),0,1),scaleX:finite(row.scaleX,1),scaleY:finite(row.scaleY,1),rotation:finite(row.rotation,0),offsetX:finite(row.offsetX,0),offsetY:finite(row.offsetY,0)};
}
function normalizeBox(value){if(!value||typeof value!=='object')return null;return{x:finite(value.x,0),y:finite(value.y,0),width:Math.max(1,finite(value.width,32)),height:Math.max(1,finite(value.height,32))};}
function normalizeTrackEvent(row={},track='event',index=0,duration=1){const start=clamp(finite(row.start??row.at,0),0,duration),end=clamp(finite(row.end,start),start,duration),payload=copy(row.payload||{});if(track==='hitbox'||track==='hurtbox'){const box=normalizeBox(payload.box||row.box);if(box)payload.box=box;}return{id:String(row.id||uid(`${track}-${index}`)),start,end,label:String(row.label||row.ref||track),ref:row.ref==null?null:String(row.ref),payload};}
function normalizeFrameSequence(value,frames){const fallback=Array.from({length:Math.max(1,frames)},(_,index)=>index);if(!Array.isArray(value)||!value.length)return fallback;const rows=value.map(row=>Math.max(0,Math.round(finite(row,-1)))).filter(row=>row>=0);return rows.length?rows:fallback;}
function normalizeAssetSource(value){if(!value||typeof value!=='object')return null;const dataUrl=String(value.dataUrl||'');if(!dataUrl)return null;return{kind:'data_url',dataUrl,fileName:String(value.fileName||''),width:Math.max(0,Math.round(finite(value.width,0))),height:Math.max(0,Math.round(finite(value.height,0)))};}
export function parseFrameSequence(value){if(Array.isArray(value))return value.map(row=>Math.max(0,Math.round(finite(row,0))));return String(value??'').split(/[\s,;]+/).map(row=>row.trim()).filter(Boolean).map(row=>Math.max(0,Math.round(finite(row,0))));}
export function normalizeAnimationDocument(input={}){
  const source=input.clip||input,rawType=String(source.type||'transform').toLowerCase(),type=rawType==='spritesheet'?'spritesheet':'transform',duration=Math.max(.05,finite(source.duration,.42)),markers={};
  for(const [name,value] of Object.entries(source.markers||{})){const key=String(name||'').trim();if(key)markers[key]=clamp(finite(value,0),0,duration);}
  let keyframes=(Array.isArray(source.keyframes)?source.keyframes:[]).map(normalizeKeyframe).sort((a,b)=>a.t-b.t);if(type==='transform'&&!keyframes.length)keyframes=[normalizeKeyframe({id:'start',t:0},0),normalizeKeyframe({id:'end',t:1},1)];
  const frames=Math.max(1,Math.round(finite(source.frames,4))),tracks={};for(const track of ANIMATION_TRACK_TYPES)tracks[track]=(Array.isArray(input.tracks?.[track])?input.tracks[track]:[]).map((row,index)=>normalizeTrackEvent(row,track,index,duration)).sort((a,b)=>a.start-b.start);
  return{schema:2,documentType:'ANIMATION',documentId:String(input.documentId||uid('animation-document')),clip:{id:String(source.id||'animation_clip'),type,channel:String(source.channel||'action'),priority:finite(source.priority,40),duration,loop:source.loop===true,interruptible:source.interruptible!==false,directions:Array.isArray(source.directions)&&source.directions.length?source.directions.map(String):['up','down','left','right'],mirrorLeftFromRight:source.mirrorLeftFromRight===true,markerMode:'seconds',markers,keyframes,assetId:source.assetId==null?'hero_default_sheet':String(source.assetId),frames,fps:Math.max(1,finite(source.fps,12)),frameWidth:Math.max(1,Math.round(finite(source.frameWidth,256))),frameHeight:Math.max(1,Math.round(finite(source.frameHeight,384))),frameSequence:normalizeFrameSequence(source.frameSequence,frames),anchor:{x:clamp(finite(source.anchor?.x,.5),0,1),y:clamp(finite(source.anchor?.y,1),0,1)}},tracks,assetSource:normalizeAssetSource(input.assetSource),meta:{createdAt:finite(input.meta?.createdAt,Date.now()),updatedAt:finite(input.meta?.updatedAt,Date.now())}};
}
export const animationDocumentModel=Object.freeze({id:'animation',normalize:normalizeAnimationDocument,chunkSize:()=>512,rebuildSpatial(){},syncCommand(){}});
export function animationClipFromDocument(document){const doc=normalizeAnimationDocument(document),clip=copy(doc.clip);if(clip.type==='transform'){delete clip.assetId;delete clip.frames;delete clip.fps;delete clip.frameWidth;delete clip.frameHeight;delete clip.frameSequence;delete clip.anchor;}else delete clip.keyframes;return Object.freeze({...clip,gameplayTracks:copy(doc.tracks)});}
export function validateAnimationDocument(document,{assetRegistry=null}={}){
  const doc=normalizeAnimationDocument(document),errors=[],warnings=[];if(!doc.clip.id.trim())errors.push('CLIP_ID_REQUIRED');if(doc.clip.duration<=0)errors.push('DURATION_INVALID');if(doc.clip.type==='spritesheet'){if(!doc.clip.assetId)errors.push('SPRITESHEET_ASSET_REQUIRED');else if(assetRegistry?.get&&!assetRegistry.get(doc.clip.assetId)&&!doc.assetSource?.dataUrl)errors.push(`ASSET_NOT_FOUND:${doc.clip.assetId}`);if(doc.clip.frames<1||doc.clip.fps<1)errors.push('SPRITESHEET_TIMING_INVALID');if(!doc.clip.frameSequence.length)errors.push('FRAME_SEQUENCE_REQUIRED');if(doc.clip.frameSequence.some(frame=>!Number.isInteger(frame)||frame<0))errors.push('FRAME_SEQUENCE_INVALID');}
  for(const [name,time] of Object.entries(doc.clip.markers))if(time<0||time>doc.clip.duration)errors.push(`MARKER_OUT_OF_RANGE:${name}`);for(const track of ANIMATION_TRACK_TYPES)for(const row of doc.tracks[track]){if(row.end<row.start||row.end>doc.clip.duration)errors.push(`TRACK_RANGE_INVALID:${track}:${row.id}`);if((track==='hitbox'||track==='hurtbox')&&row.payload?.box&&(row.payload.box.width<=0||row.payload.box.height<=0))errors.push(`TRACK_BOX_INVALID:${track}:${row.id}`);}if(doc.clip.type==='transform'&&doc.clip.keyframes.length<2)warnings.push('TRANSFORM_KEYFRAMES_LOW');if(doc.assetSource?.dataUrl&&doc.assetSource.dataUrl.length>7_000_000)warnings.push('EMBEDDED_ASSET_LARGE');return Object.freeze({ok:errors.length===0,errors:Object.freeze(errors),warnings:Object.freeze(warnings)});
}
