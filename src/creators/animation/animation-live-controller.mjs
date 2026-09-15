/* KELO-INDEX
 * area: CREATORS / ANIMATION LIVE CONTROLLER
 * owner: Animation Creator session orchestration
 * owns: Animation workspace lifecycle, generic Studio shell/timeline wiring and project draft save
 * does-not-own: animation runtime, assets, combat, permissions, repository storage primitives or networking
 * reuse: StudioKernel/CommandBus/History, StudioWorkspaceShell, StudioTimeline, KeloAnimation and KeloAssetRegistry
 */
import { createStudioKernel } from '../../studio/core/studio-kernel.mjs';
import { createStudioWorkspaceShell } from '../../studio/ui/studio-workspace-shell.mjs';
import { createStudioTimeline } from '../../studio/ui/studio-timeline.mjs';
import { animationDocumentModel,normalizeAnimationDocument,validateAnimationDocument,ANIMATION_TRACK_TYPES,parseFrameSequence } from './animation-document.mjs';
import { createPatchAnimationClipCommand,createUpsertAnimationMarkerCommand,createRemoveAnimationMarkerCommand,createUpsertAnimationKeyframeCommand,createUpsertAnimationTrackEventCommand,createRemoveAnimationTrackEventCommand } from './animation-commands.mjs';
import { createAnimationPreviewAdapter } from './animation-preview-adapter.mjs';
let active=null;
const actorId=root=>String(root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||'local_pioneer');
const toast=(root,msg)=>typeof root.showToast==='function'?root.showToast(msg):console.info('[Animation Creator]',msg);
const field=(doc,label,node)=>{const wrap=doc.createElement('div');wrap.className='ksw-field';const l=doc.createElement('label');l.textContent=label;wrap.append(l,node);return wrap;};
const button=(doc,text,fn)=>{const b=doc.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;return b;};
const input=(doc,type,value)=>{const el=doc.createElement('input');el.type=type;if(type==='checkbox')el.checked=value===true;else el.value=String(value??'');return el;};
const select=(doc,values,value)=>{const el=doc.createElement('select');for(const row of values){const item=typeof row==='string'?{value:row,label:row}:row,o=doc.createElement('option');o.value=item.value;o.textContent=item.label||item.value;el.append(o);}el.value=String(value??'');return el;};
function clipIdFromName(name){return String(name||'animation_clip').toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'')||'animation_clip';}
function timelineTracks(document){const clip=document.clip,duration=clip.duration,tracks=[];if(clip.type==='transform')tracks.push({id:'keyframes',label:'KEYFRAMES',items:(clip.keyframes||[]).map(row=>({id:row.id,label:row.id,at:(Number(row.t)||0)*duration}))});tracks.push({id:'markers',label:'MARKERS',items:Object.entries(clip.markers||{}).map(([name,at])=>({id:name,label:name,at}))});for(const name of ANIMATION_TRACK_TYPES)tracks.push({id:name,label:name.toUpperCase(),items:(document.tracks?.[name]||[]).map(row=>({id:row.id,label:row.label,start:row.start,end:row.end}))});return tracks;}
export async function openAnimationCreator({root=globalThis,projectId=null,projects}={}){
  if(active)return active;
  if(!root.document)throw new Error('ANIMATION_CREATOR_DOM_REQUIRED');
  if(!projects?.get||!projects?.saveDraft)throw new Error('ANIMATION_CREATOR_PROJECT_REPOSITORY_REQUIRED');
  if(!root.KeloInputLocks?.acquire||!root.KeloInputLocks?.release)throw new Error('ANIMATION_CREATOR_INPUT_LOCKS_NOT_READY');
  const owner=actorId(root);let project=projectId?await projects.get(projectId):null;
  if(!project)project=await projects.create({type:'ANIMATION',name:'New Animation',ownerId:owner});
  if(project.type!=='ANIMATION')throw new Error('ANIMATION_CREATOR_PROJECT_TYPE_MISMATCH');
  let draft=await projects.loadDraft(project.projectId);if(!draft)draft=normalizeAnimationDocument({clip:{id:clipIdFromName(project.name)}});
  const kernel=createStudioKernel({document:draft,documentModel:animationDocumentModel}),preview=createAnimationPreviewAdapter(root),doc=root.document;
  let lockToken=null,shell=null,timeline=null,direction='down',speed=1,markerName='release',trackType='hitbox',trackLabel='hit',trackWindow=.1,onKey=null,autosaveTimer=null,dirty=false;
  let box={x:0,y:-24,width:48,height:48};
  try{
    lockToken=root.KeloInputLocks.acquire('kelo-animation-creator',{kind:'creator-workspace',projectId:project.projectId});
    doc.body.classList.add('kelo-animation-creator-active');
    shell=createStudioWorkspaceShell({host:doc.body,title:`ANIMATION · ${project.name}`,badge:'CREATOR V1.5',leftTitle:'CLIP',rightTitle:'MARKERS / GAMEPLAY TRACKS',viewportHint:'Live preview uses KeloAnimation + your current avatar',onUndo:()=>guarded(()=>kernel.undo()),onRedo:()=>guarded(()=>kernel.redo()),onSave:()=>guarded(()=>save(false)),onClose:()=>void closeAnimationCreator({root})});
    timeline=createStudioTimeline({host:shell.timelineHost,duration:kernel.document.clip.duration,tracks:timelineTracks(kernel.document),snapStep:1/60,onScrub:at=>{timeline?.setPlayhead(at);syncStatus();},onSelect:({at})=>{timeline?.setPlayhead(at);syncStatus();}});
    async function guarded(fn){try{const value=await fn();render();return value;}catch(error){toast(root,error?.message||String(error));return null;}}
    function scheduleAutosave(){dirty=true;if(autosaveTimer)clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>void save(true).catch(error=>console.warn('[Animation Creator] autosave failed',error)),650);}
    async function execute(command){const value=await kernel.execute(command);scheduleAutosave();return value;}
    async function save(quiet=false){const report=validateAnimationDocument(kernel.document,{assetRegistry:root.KeloAssetRegistry});if(!report.ok)throw new Error(`ANIMATION_VALIDATION_FAILED:${report.errors.join(',')}`);if(autosaveTimer){clearTimeout(autosaveTimer);autosaveTimer=null;}await projects.saveDraft(project.projectId,kernel.document);dirty=false;if(!quiet)toast(root,'Animation draft saved');syncStatus();return report;}
    async function flushAutosave(){if(autosaveTimer){clearTimeout(autosaveTimer);autosaveTimer=null;}if(dirty)await save(true);}
    function addMarker(){const name=String(markerName||'').trim();if(!name)return;void guarded(()=>execute(createUpsertAnimationMarkerCommand(name,timeline.playhead)));}
    function addKeyframe(){if(kernel.document.clip.type!=='transform')return;const t=kernel.document.clip.duration?timeline.playhead/kernel.document.clip.duration:0;void guarded(()=>execute(createUpsertAnimationKeyframeCommand({t,scaleX:1,scaleY:1,rotation:0,offsetX:0,offsetY:0})));}
    function addTrack(){const start=timeline.playhead,end=Math.min(kernel.document.clip.duration,start+Math.max(0,Number(trackWindow)||0)),payload=(trackType==='hitbox'||trackType==='hurtbox')?{box:{...box}}:{};void guarded(()=>execute(createUpsertAnimationTrackEventCommand(trackType,{start,end,label:trackLabel||trackType,ref:trackLabel||null,payload})));}
    function numberField(host,label,value,{min=null,max=null,step='1',onchange}={}){const el=input(doc,'number',value);if(min!=null)el.min=String(min);if(max!=null)el.max=String(max);el.step=String(step);el.onchange=()=>onchange?.(Number(el.value));host.append(field(doc,label,el));return el;}
    function renderLeft(){const host=shell.left;host.replaceChildren();const c=kernel.document.clip;
      const id=input(doc,'text',c.id);id.onchange=()=>void guarded(()=>execute(createPatchAnimationClipCommand({id:clipIdFromName(id.value)})));host.append(field(doc,'Clip ID',id));
      const type=select(doc,['transform','spritesheet'],c.type);type.onchange=()=>void guarded(()=>execute(createPatchAnimationClipCommand({type:type.value})));host.append(field(doc,'Type',type));
      const channel=select(doc,['locomotion','overlay','action','reaction'],c.channel);channel.onchange=()=>void guarded(()=>execute(createPatchAnimationClipCommand({channel:channel.value})));host.append(field(doc,'Channel',channel));
      numberField(host,'Duration',c.duration,{min:.05,step:.01,onchange:value=>void guarded(()=>execute(createPatchAnimationClipCommand({duration:value})))});
      numberField(host,'Priority',c.priority,{step:1,onchange:value=>void guarded(()=>execute(createPatchAnimationClipCommand({priority:value})))});
      const loop=input(doc,'checkbox',c.loop);loop.onchange=()=>void guarded(()=>execute(createPatchAnimationClipCommand({loop:loop.checked})));host.append(field(doc,'Loop',loop));
      const interruptible=input(doc,'checkbox',c.interruptible);interruptible.onchange=()=>void guarded(()=>execute(createPatchAnimationClipCommand({interruptible:interruptible.checked})));host.append(field(doc,'Interruptible',interruptible));
      if(c.type==='spritesheet'){
        const assets=(root.KeloAssetRegistry?.list?.()||[]).filter(row=>['image','sprite','spritesheet','atlas'].includes(row.type)).map(row=>({value:row.id,label:row.id})),asset=select(doc,assets,c.assetId);asset.onchange=()=>void guarded(()=>execute(createPatchAnimationClipCommand({assetId:asset.value})));host.append(field(doc,'Asset',asset));
        numberField(host,'Frames',c.frames,{min:1,step:1,onchange:value=>void guarded(()=>execute(createPatchAnimationClipCommand({frames:value})))});
        numberField(host,'FPS',c.fps,{min:1,step:1,onchange:value=>void guarded(()=>execute(createPatchAnimationClipCommand({fps:value})))});
        numberField(host,'Frame W',c.frameWidth,{min:1,step:1,onchange:value=>void guarded(()=>execute(createPatchAnimationClipCommand({frameWidth:value})))});
        numberField(host,'Frame H',c.frameHeight,{min:1,step:1,onchange:value=>void guarded(()=>execute(createPatchAnimationClipCommand({frameHeight:value})))});
        const seq=input(doc,'text',(c.frameSequence||[]).join(','));seq.setAttribute('aria-label','Frame Sequence');seq.onchange=()=>void guarded(()=>execute(createPatchAnimationClipCommand({frameSequence:parseFrameSequence(seq.value)})));host.append(field(doc,'Frame Sequence',seq));
        const seqActions=doc.createElement('div');seqActions.className='ksw-actions';seqActions.append(button(doc,'RESET 0…N',()=>void guarded(()=>execute(createPatchAnimationClipCommand({frameSequence:Array.from({length:Math.max(1,c.frames)},(_,i)=>i)})))));host.append(seqActions);
        numberField(host,'Anchor X',c.anchor.x,{min:0,max:1,step:.01,onchange:value=>void guarded(()=>execute(createPatchAnimationClipCommand({anchor:{x:value}})))});
        numberField(host,'Anchor Y',c.anchor.y,{min:0,max:1,step:.01,onchange:value=>void guarded(()=>execute(createPatchAnimationClipCommand({anchor:{y:value}})))});
      }
      const dir=select(doc,['down','right','up','left'],direction);dir.onchange=()=>{direction=dir.value;};host.append(field(doc,'Direction',dir));
      const speedInput=input(doc,'number',speed);speedInput.min='.1';speedInput.max='4';speedInput.step='.1';speedInput.onchange=()=>{speed=Math.max(.1,Number(speedInput.value)||1);};host.append(field(doc,'Preview x',speedInput));
      const actions=doc.createElement('div');actions.className='ksw-actions';actions.append(button(doc,'▶ PLAY',()=>void guarded(()=>preview.play(kernel.document,{direction,speed}))),button(doc,'■ STOP',()=>preview.stop(kernel.document)));if(c.type==='transform')actions.append(button(doc,'+ KEYFRAME @ PLAYHEAD',addKeyframe));host.append(actions);
      const note=doc.createElement('p');note.className='ksw-note';note.textContent='Frame Sequence lets you reorder/repeat sprite cells without a new runtime. Draft changes autosave through CreatorProjectRepository; Save is still explicit and Publish remains separate.';host.append(note);
    }
    function renderRight(){const host=shell.right;host.replaceChildren();
      const marker=input(doc,'text',markerName);marker.oninput=()=>{markerName=marker.value;};host.append(field(doc,'Marker',marker));
      const markerActions=doc.createElement('div');markerActions.className='ksw-actions';markerActions.append(button(doc,'+ MARKER @ PLAYHEAD',addMarker));host.append(markerActions);
      const markerList=doc.createElement('div');markerList.className='ksw-list';for(const [name,at] of Object.entries(kernel.document.clip.markers||{})){const open=button(doc,`${name} · ${Number(at).toFixed(3)}s`,()=>timeline.setPlayhead(Number(at)||0)),del=button(doc,'DELETE',()=>void guarded(()=>execute(createRemoveAnimationMarkerCommand(name)))),wrap=doc.createElement('div');wrap.style.display='grid';wrap.style.gridTemplateColumns='1fr auto';wrap.style.gap='4px';wrap.append(open,del);markerList.append(wrap);}host.append(markerList);
      const divider=doc.createElement('p');divider.className='ksw-note';divider.textContent='Gameplay tracks remain declarative metadata. Hitbox/hurtbox rectangles are authoring geometry only; combat authority still decides real hits.';host.append(divider);
      const type=select(doc,ANIMATION_TRACK_TYPES,trackType);type.onchange=()=>{trackType=type.value;renderRight();};host.append(field(doc,'Track',type));
      const label=input(doc,'text',trackLabel);label.oninput=()=>{trackLabel=label.value;};host.append(field(doc,'Label / Ref',label));
      const windowInput=input(doc,'number',trackWindow);windowInput.min='0';windowInput.step='.01';windowInput.onchange=()=>{trackWindow=Math.max(0,Number(windowInput.value)||0);};host.append(field(doc,'Window s',windowInput));
      if(trackType==='hitbox'||trackType==='hurtbox'){
        for(const [label,key,min] of [['Box X','x',null],['Box Y','y',null],['Box W','width',1],['Box H','height',1]])numberField(host,label,box[key],{min,step:1,onchange:value=>{box={...box,[key]:key==='width'||key==='height'?Math.max(1,value):value};}});
      }
      const add=doc.createElement('div');add.className='ksw-actions';add.append(button(doc,'+ EVENT @ PLAYHEAD',addTrack));host.append(add);
      const rows=doc.createElement('div');rows.className='ksw-list';for(const row of kernel.document.tracks?.[trackType]||[]){const dims=row.payload?.box?` · ${row.payload.box.width}×${row.payload.box.height}`:'',open=button(doc,`${row.label} · ${row.start.toFixed(3)}-${row.end.toFixed(3)}s${dims}`,()=>timeline.setPlayhead(row.start)),del=button(doc,'DELETE',()=>void guarded(()=>execute(createRemoveAnimationTrackEventCommand(trackType,row.id)))),wrap=doc.createElement('div');wrap.style.display='grid';wrap.style.gridTemplateColumns='1fr auto';wrap.style.gap='4px';wrap.append(open,del);rows.append(wrap);}host.append(rows);
    }
    function syncStatus(){const validation=validateAnimationDocument(kernel.document,{assetRegistry:root.KeloAssetRegistry}),c=kernel.document.clip;shell.setHistory({canUndo:kernel.history.canUndo,canRedo:kernel.history.canRedo});shell.setStatus(`${c.type.toUpperCase()} · ${c.duration.toFixed(2)}s · ${Object.keys(c.markers).length} markers · ${kernel.history.undoDepth} undo · ${dirty?'AUTOSAVE…':validation.ok?'VALID':validation.errors[0]}`);}
    function render(){const c=kernel.document.clip;timeline.set({duration:c.duration,tracks:timelineTracks(kernel.document),playhead:Math.min(timeline.playhead,c.duration),snapStep:c.type==='spritesheet'?1/Math.max(1,c.fps):1/60});renderLeft();renderRight();syncStatus();}
    onKey=event=>{if(event.key==='Escape'){event.preventDefault();void closeAnimationCreator({root});return;}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void guarded(()=>save(false));return;}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();void guarded(async()=>{const result=event.shiftKey?await kernel.redo():await kernel.undo();scheduleAutosave();return result;});}else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();void guarded(async()=>{const result=await kernel.redo();scheduleAutosave();return result;});}};
    doc.addEventListener('keydown',onKey,true);render();
    active=Object.freeze({version:'animation-creator-v1.5.0',projectId:project.projectId,project,kernel,shell,timeline,preview,lockToken,onKey,save,flushAutosave,close:()=>closeAnimationCreator({root})});return active;
  }catch(error){doc.body.classList.remove('kelo-animation-creator-active');if(autosaveTimer)clearTimeout(autosaveTimer);if(lockToken)try{root.KeloInputLocks.release(lockToken);}catch{}timeline?.destroy?.();shell?.destroy?.();if(onKey)doc.removeEventListener('keydown',onKey,true);throw error;}
}
export async function closeAnimationCreator({root=globalThis}={}){
  if(!active)return false;const session=active;active=null;
  try{await session.flushAutosave?.();}catch(error){console.warn('[Animation Creator] close autosave failed',error);}
  try{session.preview.stop(session.kernel.document);}catch{}
  try{root.document?.removeEventListener?.('keydown',session.onKey,true);}catch{}
  try{session.timeline.destroy();}catch{}
  try{session.shell.destroy();}catch{}
  try{if(session.lockToken)root.KeloInputLocks?.release?.(session.lockToken);}catch{}
  try{root.document?.body?.classList?.remove?.('kelo-animation-creator-active');}catch{}
  return true;
}
export function getAnimationCreator(){return active;}
