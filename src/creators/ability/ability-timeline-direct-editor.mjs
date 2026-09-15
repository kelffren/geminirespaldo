/* KELO-INDEX
 * area: CREATORS / ABILITY TIMELINE DIRECT EDITOR
 * owner: Ability Creator timing direct-manipulation UX
 * owns: draggable WINDUP|ACTIVE|RECOVERY boundaries in Studio timeline
 * does-not-own: timeline core, ability schema, combat authority, persistence or networking
 * reuse: Ability Studio kernel/history + autosave + safe preview arena
 */
import { createPatchAbilityDefinitionCommand } from './ability-commands.mjs';
import { abilityTimelineDuration } from './ability-document.mjs';

const STYLE_ID='kelo-ability-timeline-direct-v1';
const mounted=new WeakMap();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const snap=(v,step=1/60)=>Math.round((Number(v)||0)/step)*step;

function addStyle(doc){
  if(doc.getElementById(STYLE_ID))return;
  const s=doc.createElement('style');s.id=STYLE_ID;s.textContent=`
  .katl-handle{position:absolute;z-index:12;top:-9px;right:-16px;width:32px;height:31px;border:0;background:transparent;cursor:ew-resize;touch-action:none;padding:0}
  .katl-handle:before{content:'';position:absolute;left:14px;top:4px;width:4px;height:23px;border-radius:99px;background:#f2d47f;box-shadow:0 0 0 4px rgba(242,212,127,.12),0 0 10px rgba(242,212,127,.55)}
  .katl-handle:after{content:'↔';position:absolute;left:50%;top:-15px;transform:translateX(-50%);padding:3px 5px;border:1px solid rgba(231,197,106,.32);border-radius:999px;background:rgba(7,12,14,.96);color:#f2d47f;font:900 8px/1 system-ui;opacity:.72}
  .katl-handle.dragging:before{background:#fff0b2;box-shadow:0 0 0 6px rgba(242,212,127,.16),0 0 16px rgba(242,212,127,.75)}
  .katl-readout{position:fixed;z-index:2147483650;pointer-events:none;transform:translate(-50%,-115%);padding:7px 9px;border:1px solid rgba(231,197,106,.35);border-radius:10px;background:rgba(7,12,14,.97);color:#f5e3a8;font:900 9px/1.25 Inter,system-ui;white-space:nowrap;box-shadow:0 10px 28px rgba(0,0,0,.45)}
  .katl-range-live{outline:1px solid rgba(242,212,127,.42);box-shadow:0 0 12px rgba(242,212,127,.18)}
  @media(max-width:760px){.katl-handle{top:-13px;right:-22px;width:44px;height:39px}.katl-handle:before{left:20px;top:5px;height:29px}.katl-handle:after{top:-17px;font-size:9px;padding:4px 6px}.katl-readout{font-size:10px;padding:8px 10px}}
  `;doc.head.append(s);
}

function timelineTracks(document){
  const d=document.definition,a=d.action,w=a.windup,x=w+a.active,total=abilityTimelineDuration(document);
  return [
    {id:'phases',label:'ACTION',items:[
      {id:'windup',label:'WINDUP',start:0,end:w},
      {id:'active',label:'ACTIVE',start:w,end:x},
      {id:'recovery',label:'RECOVERY',start:x,end:total}
    ]},
    {id:'effects',label:'EFFECTS',items:(d.effects||[]).map((effect,index)=>({id:effect._id,label:`${index+1} · ${effect.type}`,start:w,end:Math.max(w+.01,x)}))}
  ];
}

function syncTimingInspector(shell,d){
  const values=new Map([['Windup',d.action.windup],['Active',d.action.active],['Recovery',d.action.recovery]]);
  for(const row of shell.left?.querySelectorAll?.('.ksw-field')||[]){const key=row.querySelector('label')?.textContent,input=row.querySelector('input');if(input&&values.has(key))input.value=String(values.get(key));}
}

export function installAbilityTimelineDirectEditor(session,{root=globalThis}={}){
  if(!session?.kernel?.execute||!session?.timeline?.root||!session?.autosave)return null;if(mounted.has(session))return mounted.get(session);
  const timelineRoot=session.timeline.root,doc=timelineRoot.ownerDocument;addStyle(doc);let dead=false,queue=Promise.resolve(),readout=null,renderQueued=false;

  function phaseLane(){return timelineRoot.querySelector('.kst-row[data-track="phases"] .kst-lane');}
  function phaseItems(){const lane=phaseLane();return lane?{lane,windup:lane.querySelector('[data-item="windup"]'),active:lane.querySelector('[data-item="active"]'),recovery:lane.querySelector('[data-item="recovery"]')}:null;}
  function percent(value,total){return `${clamp(total>0?value/total:0,0,1)*100}%`;}
  function drawDraft(values){
    const refs=phaseItems();if(!refs)return;const total=Math.max(.001,values.windup+values.active+values.recovery),w=values.windup,x=w+values.active;
    Object.assign(refs.windup.style,{left:'0%',width:percent(w,total)});Object.assign(refs.active.style,{left:percent(w,total),width:percent(values.active,total)});Object.assign(refs.recovery.style,{left:percent(x,total),width:percent(values.recovery,total)});
  }
  function showReadout(event,values,label){
    if(!readout){readout=doc.createElement('div');readout.className='katl-readout';doc.body.append(readout);}readout.textContent=`${label} · W ${values.windup.toFixed(2)}s · A ${values.active.toFixed(2)}s · R ${values.recovery.toFixed(2)}s`;readout.style.left=`${event.clientX}px`;readout.style.top=`${event.clientY}px`;
  }
  function hideReadout(){readout?.remove();readout=null;}
  async function commit(values){
    queue=queue.catch(()=>{}).then(async()=>{
      await session.kernel.execute(createPatchAbilityDefinitionCommand({action:{windup:values.windup,active:values.active,recovery:values.recovery}}));session.autosave.markDirty();syncTimingInspector(session.shell,session.kernel.document.definition);
      const duration=abilityTimelineDuration(session.kernel.document);session.timeline.set({duration,tracks:timelineTracks(session.kernel.document),playhead:Math.min(session.timeline.playhead||0,duration),snapStep:1/60});
      try{await session.preview?.play?.(session.kernel.document);}catch(error){console.warn('[Ability Timeline Direct] preview replay unavailable',error);}installHandles();
    });
    try{await queue;}catch(error){console.warn('[Ability Timeline Direct] commit failed',error);}
  }
  function startDrag(boundary,event){
    event.preventDefault();event.stopPropagation();const refs=phaseItems();if(!refs)return;const d=session.kernel.document.definition,a=d.action,total=Math.max(.05,a.windup+a.active+a.recovery),base={windup:a.windup,active:a.active,recovery:a.recovery},laneBox=refs.lane.getBoundingClientRect(),pointerId=event.pointerId,button=event.currentTarget;let draft={...base};button.classList.add('dragging');button.setPointerCapture?.(pointerId);refs.windup.classList.add('katl-range-live');refs.active.classList.add('katl-range-live');refs.recovery.classList.add('katl-range-live');
    const move=e=>{if(e.pointerId!==pointerId)return;e.preventDefault();const x=clamp(e.clientX-laneBox.left,0,laneBox.width),at=snap((laneBox.width?x/laneBox.width:0)*total,1/60);
      if(boundary==='windup'){const pair=Math.max(.01,base.windup+base.active),w=clamp(at,0,pair-.01);draft={windup:w,active:pair-w,recovery:base.recovery};}
      else{const pair=Math.max(.01,base.active+base.recovery),relative=clamp(at-base.windup,.01,pair),active=clamp(relative,.01,pair);draft={windup:base.windup,active,recovery:Math.max(0,pair-active)};}
      drawDraft(draft);showReadout(e,draft,boundary==='windup'?'WINDUP ↔ ACTIVE':'ACTIVE ↔ RECOVERY');
    };
    const end=e=>{if(e.pointerId!==pointerId)return;e.preventDefault();root.removeEventListener?.('pointermove',move,true);root.removeEventListener?.('pointerup',end,true);root.removeEventListener?.('pointercancel',end,true);button.classList.remove('dragging');refs.windup.classList.remove('katl-range-live');refs.active.classList.remove('katl-range-live');refs.recovery.classList.remove('katl-range-live');hideReadout();void commit(draft);};
    root.addEventListener?.('pointermove',move,{capture:true,passive:false});root.addEventListener?.('pointerup',end,{capture:true,passive:false});root.addEventListener?.('pointercancel',end,{capture:true,passive:false});
  }
  function addHandle(item,boundary,label){if(!item||item.querySelector(`.katl-handle[data-boundary="${boundary}"]`))return;item.style.overflow='visible';const h=doc.createElement('button');h.type='button';h.className='katl-handle';h.dataset.boundary=boundary;h.setAttribute('aria-label',label);h.title=label;h.onpointerdown=e=>startDrag(boundary,e);h.onclick=e=>{e.preventDefault();e.stopPropagation();};item.append(h);}
  function installHandles(){if(dead)return;const refs=phaseItems();if(!refs)return;addHandle(refs.windup,'windup','Drag WINDUP / ACTIVE boundary');addHandle(refs.active,'active','Drag ACTIVE / RECOVERY boundary');}
  function scheduleInstall(){if(renderQueued)return;renderQueued=true;root.requestAnimationFrame?.(()=>{renderQueued=false;installHandles();});}
  const observer=root.MutationObserver?new root.MutationObserver(()=>{if(!timelineRoot.isConnected){destroy();return;}scheduleInstall();}):null;observer?.observe(timelineRoot,{childList:true,subtree:true});
  function destroy(){if(dead)return;dead=true;observer?.disconnect();hideReadout();for(const h of timelineRoot.querySelectorAll('.katl-handle'))h.remove();mounted.delete(session);}
  const api=Object.freeze({version:'ability-timeline-direct-editor-v1.0.0',installHandles,destroy});mounted.set(session,api);installHandles();return api;
}
