/* KELO-INDEX
 * area: CREATORS / VFX LIVE CONTROLLER
 * owner: VFX Creator session orchestration
 * owns: VFX workspace lifecycle, shared Studio shell/timeline wiring and private draft save
 * does-not-own: FX rendering/runtime, asset loading, gameplay, permissions, repository storage primitives or networking
 * reuse: StudioKernel/CommandBus/History, StudioWorkspaceShell, StudioTimeline, CreatorProjectRepository, KeloFX and KeloAssetRegistry
 */
import { createStudioKernel } from '../../studio/core/studio-kernel.mjs';
import { createStudioWorkspaceShell } from '../../studio/ui/studio-workspace-shell.mjs';
import { createStudioTimeline } from '../../studio/ui/studio-timeline.mjs';
import { createWorkspaceDraftAutosave } from '../core/workspace-draft-autosave.mjs';
import { vfxDocumentModel,normalizeVfxDocument,validateVfxDocument,VFX_TYPES,VFX_SPACES,VFX_LAYERS,VFX_SOCKETS } from './vfx-document.mjs';
import { createPatchVfxDefinitionCommand } from './vfx-commands.mjs';
import { createVfxPreviewAdapter } from './vfx-preview-adapter.mjs';
let active=null;
const actorId=root=>String(root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||'local_pioneer');
const toast=(root,msg)=>typeof root.showToast==='function'?root.showToast(msg):console.info('[VFX Creator]',msg);
const field=(doc,label,node)=>{const wrap=doc.createElement('div');wrap.className='ksw-field';const l=doc.createElement('label');l.textContent=label;wrap.append(l,node);return wrap;};
const button=(doc,text,fn)=>{const b=doc.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;return b;};
const input=(doc,type,value)=>{const el=doc.createElement('input');el.type=type;if(type==='checkbox')el.checked=value===true;else el.value=String(value??'');return el;};
const select=(doc,values,value)=>{const el=doc.createElement('select');for(const row of values){const item=typeof row==='string'?{value:row,label:row}:row,o=doc.createElement('option');o.value=item.value;o.textContent=item.label||item.value;el.append(o);}el.value=String(value??'');return el;};
function idFromName(name){return String(name||'vfx_effect').toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'')||'vfx_effect';}
const isSprite=type=>type==='static_sprite'||type==='sprite_animation';
const timelineTracks=document=>[{id:'lifetime',label:'LIFETIME',items:[{id:'effect-life',label:document.definition.id,start:0,end:document.definition.duration}]}];
export async function openVfxCreator({root=globalThis,projectId=null,projects}={}){
  if(active)return active;
  if(!root.document)throw new Error('VFX_CREATOR_DOM_REQUIRED');
  if(!projects?.get||!projects?.saveDraft)throw new Error('VFX_CREATOR_PROJECT_REPOSITORY_REQUIRED');
  if(!root.KeloInputLocks?.acquire||!root.KeloInputLocks?.release)throw new Error('VFX_CREATOR_INPUT_LOCKS_NOT_READY');
  const owner=actorId(root);let project=projectId?await projects.get(projectId):null;
  if(!project)project=await projects.create({type:'VFX',name:'New VFX',ownerId:owner});
  if(project.type!=='VFX')throw new Error('VFX_CREATOR_PROJECT_TYPE_MISMATCH');
  let draft=await projects.loadDraft(project.projectId);if(!draft)draft=normalizeVfxDocument({definition:{id:idFromName(project.name)}});
  const kernel=createStudioKernel({document:draft,documentModel:vfxDocumentModel}),preview=createVfxPreviewAdapter(root),doc=root.document;
  let lockToken=null,shell=null,timeline=null,onKey=null,previewScale=1;
  try{
    lockToken=root.KeloInputLocks.acquire('kelo-vfx-creator',{kind:'creator-workspace',projectId:project.projectId});
    doc.body.classList.add('kelo-vfx-creator-active');
    async function persistDraft(){const report=validateVfxDocument(kernel.document,{assetRegistry:root.KeloAssetRegistry});if(!report.ok)throw new Error(`VFX_VALIDATION_FAILED:${report.errors.join(',')}`);await projects.saveDraft(project.projectId,kernel.document);return report;}
    let autosave=null;
    function syncStatus(){const report=validateVfxDocument(kernel.document,{assetRegistry:root.KeloAssetRegistry}),def=kernel.document.definition;shell?.setHistory({canUndo:kernel.history.canUndo,canRedo:kernel.history.canRedo});shell?.setStatus(`${def.type.toUpperCase()} · ${def.duration.toFixed(2)}s · ${kernel.history.undoDepth} undo · ${autosave?.dirty||autosave?.saving?'AUTOSAVE…':report.ok?'VALID':report.errors[0]}`);}
    autosave=createWorkspaceDraftAutosave({save:persistDraft,onState:syncStatus});
    async function historyAction(kind){const value=kind==='undo'?await kernel.undo():await kernel.redo();autosave.markDirty();return value;}
    shell=createStudioWorkspaceShell({host:doc.body,title:`VFX · ${project.name}`,badge:'CREATOR V1',leftTitle:'EFFECT',rightTitle:'PROPERTIES',viewportHint:'Preview runs through the existing KeloFX runtime; draft definitions never register into LIVE',onUndo:()=>guarded(()=>historyAction('undo')),onRedo:()=>guarded(()=>historyAction('redo')),onSave:()=>guarded(save),onClose:()=>void closeVfxCreator({root})});
    timeline=createStudioTimeline({host:shell.timelineHost,duration:kernel.document.definition.duration,tracks:timelineTracks(kernel.document),snapStep:1/60,onScrub:at=>{timeline?.setPlayhead(at);syncStatus();},onSelect:({at})=>{timeline?.setPlayhead(at);syncStatus();}});
    async function guarded(fn){try{const value=await fn();render();return value;}catch(error){toast(root,error?.message||String(error));return null;}}
    async function execute(command){const value=await kernel.execute(command);autosave.markDirty();return value;}
    async function save(){const report=await persistDraft();autosave.cancel();toast(root,'VFX draft saved');syncStatus();return report;}
    function numberField(host,label,value,{min=null,max=null,step='1',key}={}){const el=input(doc,'number',value);if(min!=null)el.min=String(min);if(max!=null)el.max=String(max);el.step=String(step);el.onchange=()=>void guarded(()=>execute(createPatchVfxDefinitionCommand({[key]:Number(el.value)})));host.append(field(doc,label,el));return el;}
    function textPatch(host,label,value,key,type='text'){const el=input(doc,type,value);el.onchange=()=>void guarded(()=>execute(createPatchVfxDefinitionCommand({[key]:el.value})));host.append(field(doc,label,el));return el;}
    function boolPatch(host,label,value,key){const el=input(doc,'checkbox',value);el.onchange=()=>void guarded(()=>execute(createPatchVfxDefinitionCommand({[key]:el.checked})));host.append(field(doc,label,el));return el;}
    function choicePatch(host,label,values,value,key){const el=select(doc,values,value);el.onchange=()=>void guarded(()=>execute(createPatchVfxDefinitionCommand({[key]:el.value})));host.append(field(doc,label,el));return el;}
    function renderLeft(){const host=shell.left;host.replaceChildren();const d=kernel.document.definition;
      const id=input(doc,'text',d.id);id.onchange=()=>void guarded(()=>execute(createPatchVfxDefinitionCommand({id:idFromName(id.value)})));host.append(field(doc,'VFX ID',id));
      choicePatch(host,'Type',VFX_TYPES,d.type,'type');numberField(host,'Duration',d.duration,{min:.02,step:.01,key:'duration'});boolPatch(host,'Loop',d.loop,'loop');choicePatch(host,'Space',VFX_SPACES,d.space,'space');choicePatch(host,'Layer',VFX_LAYERS,d.layer,'layer');choicePatch(host,'Socket',VFX_SOCKETS,d.socket,'socket');
      const scale=input(doc,'number',previewScale);scale.min='.05';scale.max='8';scale.step='.05';scale.onchange=()=>{previewScale=Math.max(.05,Number(scale.value)||1);};host.append(field(doc,'Preview Scale',scale));
      const actions=doc.createElement('div');actions.className='ksw-actions';actions.append(button(doc,'▶ PLAY',()=>void guarded(()=>preview.play(kernel.document,{scale:previewScale}))),button(doc,'■ STOP',()=>preview.stop()));host.append(actions);
      const note=doc.createElement('p');note.className='ksw-note';note.textContent='Preview uses a transient KeloFX definition. Saving updates only the private Creator draft. Nothing is registered or published to LIVE.';host.append(note);
    }
    function renderRight(){const host=shell.right;host.replaceChildren();const d=kernel.document.definition;
      textPatch(host,'Color',d.color,'color');textPatch(host,'Accent',d.accent,'accent');numberField(host,'Alpha',d.alpha,{min:0,max:1,step:.05,key:'alpha'});numberField(host,'Radius',d.radius,{min:1,step:1,key:'radius'});
      if(d.type==='burst'||d.type==='lightning')numberField(host,'Rays',d.rays,{min:1,step:1,key:'rays'});
      if(d.type==='particle_emitter')numberField(host,'Particles',d.particleCount,{min:1,max:32,step:1,key:'particleCount'});
      if(isSprite(d.type)){
        const assets=(root.KeloAssetRegistry?.list?.()||[]).filter(row=>['image','sprite','spritesheet','atlas'].includes(row.type)).map(row=>({value:row.id,label:row.id}));choicePatch(host,'Asset',assets,d.assetId||'', 'assetId');
        if(d.type==='sprite_animation'){numberField(host,'Frames',d.frames,{min:1,step:1,key:'frames'});numberField(host,'FPS',d.fps,{min:.001,step:1,key:'fps'});numberField(host,'Frame W',d.frameWidth,{min:1,step:1,key:'frameWidth'});numberField(host,'Frame H',d.frameHeight,{min:1,step:1,key:'frameHeight'});numberField(host,'Columns',d.columns,{min:1,step:1,key:'columns'});numberField(host,'Rows',d.rows,{min:1,step:1,key:'rows'});}
        numberField(host,'Width',d.width,{min:1,step:1,key:'width'});numberField(host,'Height',d.height,{min:1,step:1,key:'height'});numberField(host,'Offset X',d.offsetX,{step:1,key:'offsetX'});numberField(host,'Offset Y',d.offsetY,{step:1,key:'offsetY'});boolPatch(host,'Fade Out',d.fadeOut,'fadeOut');
      }
      const hint=doc.createElement('p');hint.className='ksw-note';hint.textContent='VFX owns presentation only. Damage, hit validation, projectile truth, cooldowns and movement remain with gameplay authorities.';host.append(hint);
    }
    function render(){const d=kernel.document.definition;timeline.set({duration:d.duration,tracks:timelineTracks(kernel.document),playhead:Math.min(timeline.playhead,d.duration),snapStep:d.type==='sprite_animation'?1/Math.max(.001,d.fps):1/60});renderLeft();renderRight();syncStatus();}
    onKey=event=>{if(event.key==='Escape'){event.preventDefault();void closeVfxCreator({root});return;}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void guarded(save);return;}if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();void guarded(()=>historyAction(event.shiftKey?'redo':'undo'));}else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();void guarded(()=>historyAction('redo'));}};
    doc.addEventListener('keydown',onKey,true);render();
    active=Object.freeze({version:'vfx-creator-v1.0.0',projectId:project.projectId,project,kernel,shell,timeline,preview,autosave,lockToken,onKey,save,close:()=>closeVfxCreator({root})});return active;
  }catch(error){doc.body.classList.remove('kelo-vfx-creator-active');if(lockToken)try{root.KeloInputLocks.release(lockToken);}catch{}timeline?.destroy?.();shell?.destroy?.();if(onKey)doc.removeEventListener('keydown',onKey,true);throw error;}
}
export async function closeVfxCreator({root=globalThis}={}){
  if(!active)return false;const session=active;active=null;
  try{session.preview.stop();}catch{}
  try{await session.autosave.flush();}catch(error){console.warn('[VFX Creator] close autosave failed',error);}
  try{root.document?.removeEventListener?.('keydown',session.onKey,true);}catch{}
  try{session.timeline.destroy();}catch{}
  try{session.shell.destroy();}catch{}
  try{if(session.lockToken)root.KeloInputLocks?.release?.(session.lockToken);}catch{}
  try{root.document?.body?.classList?.remove?.('kelo-vfx-creator-active');}catch{}
  return true;
}
export function getVfxCreator(){return active;}
