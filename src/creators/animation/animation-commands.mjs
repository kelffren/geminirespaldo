/* KELO-INDEX
 * area: CREATORS / ANIMATION COMMANDS
 * owner: Animation workspace command definitions
 * owns: reversible document mutations only
 * does-not-own: UI, persistence, animation playback, combat or networking
 * reuse: every mutation executes through the existing Studio CommandBus/History
 */
import { normalizeAnimationDocument,ANIMATION_TRACK_TYPES } from './animation-document.mjs';
const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
const uid=prefix=>`${prefix}:${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
function replace(target,next){for(const key of Object.keys(target))delete target[key];Object.assign(target,copy(next));}
function command(type,label,mutate,serialized){
  let before=null;
  return {type,label,async execute({document}){before=copy(document);const draft=copy(document);mutate(draft);replace(document,normalizeAnimationDocument(draft));},async undo({document}){if(before)replace(document,before);},serialize(){return{type,...copy(serialized||{})};},affectedRects(){return[];}};
}
export function createPatchAnimationClipCommand(patch={}){
  return command('animation.clip.patch','Patch Animation Clip',draft=>{draft.clip={...draft.clip,...copy(patch),anchor:patch.anchor?{...(draft.clip?.anchor||{}),...copy(patch.anchor)}:draft.clip?.anchor};draft.meta={...(draft.meta||{}),updatedAt:Date.now()};},{patch});
}
export function createUpsertAnimationMarkerCommand(name,time){
  name=String(name||'').trim();if(!name)throw new Error('ANIMATION_MARKER_NAME_REQUIRED');
  return command('animation.marker.upsert','Upsert Animation Marker',draft=>{draft.clip.markers={...(draft.clip.markers||{}),[name]:Number(time)||0};draft.meta={...(draft.meta||{}),updatedAt:Date.now()};},{name,time:Number(time)||0});
}
export function createRemoveAnimationMarkerCommand(name){
  name=String(name||'').trim();return command('animation.marker.remove','Remove Animation Marker',draft=>{const markers={...(draft.clip.markers||{})};delete markers[name];draft.clip.markers=markers;draft.meta={...(draft.meta||{}),updatedAt:Date.now()};},{name});
}
export function createUpsertAnimationKeyframeCommand(frame={}){
  const row={id:String(frame.id||uid('keyframe')),...copy(frame)};row.id=String(row.id);
  return command('animation.keyframe.upsert','Upsert Animation Keyframe',draft=>{const rows=[...(draft.clip.keyframes||[])],index=rows.findIndex(x=>String(x.id)===row.id);if(index>=0)rows[index]={...rows[index],...copy(row)};else rows.push(copy(row));draft.clip.keyframes=rows;draft.meta={...(draft.meta||{}),updatedAt:Date.now()};},{frame:row});
}
export function createRemoveAnimationKeyframeCommand(id){
  id=String(id||'');return command('animation.keyframe.remove','Remove Animation Keyframe',draft=>{draft.clip.keyframes=(draft.clip.keyframes||[]).filter(row=>String(row.id)!==id);draft.meta={...(draft.meta||{}),updatedAt:Date.now()};},{id});
}
export function createUpsertAnimationTrackEventCommand(track,event={}){
  track=String(track||'').toLowerCase();if(!ANIMATION_TRACK_TYPES.includes(track))throw new Error(`ANIMATION_TRACK_INVALID:${track}`);
  const row={id:String(event.id||uid(track)),...copy(event)};row.id=String(row.id);
  return command('animation.track.upsert','Upsert Animation Track Event',draft=>{const rows=[...(draft.tracks?.[track]||[])],index=rows.findIndex(x=>String(x.id)===row.id);if(index>=0)rows[index]={...rows[index],...copy(row)};else rows.push(copy(row));draft.tracks={...(draft.tracks||{}),[track]:rows};draft.meta={...(draft.meta||{}),updatedAt:Date.now()};},{track,event:row});
}
export function createRemoveAnimationTrackEventCommand(track,id){
  track=String(track||'').toLowerCase();id=String(id||'');if(!ANIMATION_TRACK_TYPES.includes(track))throw new Error(`ANIMATION_TRACK_INVALID:${track}`);
  return command('animation.track.remove','Remove Animation Track Event',draft=>{draft.tracks={...(draft.tracks||{}),[track]:(draft.tracks?.[track]||[]).filter(row=>String(row.id)!==id)};draft.meta={...(draft.meta||{}),updatedAt:Date.now()};},{track,id});
}
