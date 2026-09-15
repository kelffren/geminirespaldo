/* KELO-INDEX
 * area: CREATORS / ABILITY TOUCH TUNER V2
 * owner: Ability Creator direct manipulation UX
 * owns: direct arena handles for reach/size and touch timing sliders
 * does-not-own: ability schema, combat authority, persistence, runtime delivery or FX rendering
 */
import { createPatchAbilityDefinitionCommand } from './ability-commands.mjs';
import { abilityTimelineDuration } from './ability-document.mjs';

const STYLE_ID='kelo-ability-direct-tuner-v2';
const mounted=new WeakMap();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const snap=(v,step)=>Math.round((Number(v)||0)/step)*step;
const mix=(a,b,t)=>a+(b-a)*clamp(t,0,1);
const ratio=(v,a,b)=>b<=a?0:clamp((v-a)/(b-a),0,1);
const format=(v,step)=>step<1?Number(v).toFixed(step<=.01?2:1):String(Math.round(Number(v)||0));

function addStyle(doc){
  if(doc.getElementById(STYLE_ID))return;
  const s=doc.createElement('style');s.id=STYLE_ID;s.textContent=`
  .kadt{position:absolute;inset:0;z-index:74;pointer-events:none;font-family:Inter,system-ui}.kadt-line,.kadt-size{position:absolute;pointer-events:none}.kadt-line{height:2px;background:linear-gradient(90deg,rgba(231,197,106,.15),rgba(231,197,106,.95));box-shadow:0 0 12px rgba(231,197,106,.35)}.kadt-size.radius{border:2px dashed rgba(127,215,255,.78);border-radius:50%;background:rgba(127,215,255,.04)}.kadt-size.width{height:3px;background:rgba(127,215,255,.8)}
  .kadt-handle{position:absolute;width:46px;height:46px;margin:-23px 0 0 -23px;border:2px solid #f1d27a;border-radius:50%;background:radial-gradient(circle,#f5e1a4 0 18%,rgba(12,18,20,.97) 20%);box-shadow:0 0 0 5px rgba(231,197,106,.1),0 6px 20px rgba(0,0,0,.5);pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;color:#fff;font:950 8px system-ui;cursor:ew-resize}.kadt-handle.size{border-color:#7fd7ff;box-shadow:0 0 0 5px rgba(127,215,255,.1),0 6px 20px rgba(0,0,0,.5)}
  .kadt-bubble{position:absolute;transform:translate(-50%,-100%);margin-top:-27px;padding:5px 7px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(7,12,14,.96);color:#f3dda0;font:950 8px system-ui;white-space:nowrap;pointer-events:none}.kadt-bubble.size{color:#a9e6ff}
  .kadt-panel{position:absolute;z-index:82;left:8px;right:8px;bottom:max(8px,env(safe-area-inset-bottom));pointer-events:auto}.kadt-bar{height:40px;display:flex;align-items:center;gap:8px;padding:7px 8px 7px 10px;border:1px solid rgba(231,197,106,.27);border-radius:13px;background:rgba(7,12,14,.94);backdrop-filter:blur(12px)}.kadt-title{font:950 9px system-ui;letter-spacing:.09em;color:#efd98f}.kadt-sub{font:700 7px system-ui;color:#71847b}.kadt-toggle{margin-left:auto;width:34px;height:27px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:#131820;color:#eee;font-weight:900}.kadt-controls{display:none;margin-top:6px;padding:7px;border:1px solid rgba(231,197,106,.18);border-radius:13px;background:rgba(7,12,14,.95);backdrop-filter:blur(12px)}.kadt-panel.open .kadt-controls{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none}.kadt-card{flex:0 0 150px;padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.035)}.kadt-card header{display:flex;justify-content:space-between;gap:5px;color:#aebdb5;font:900 7px system-ui}.kadt-card output{color:#f3dda0;font-size:9px}.kadt-card input{width:100%;height:34px;accent-color:#e7c56a;touch-action:none}.kadt-card small{display:block;color:#64776e;font:700 6px system-ui}@media(max-width:760px){.kadt-handle{width:52px;height:52px;margin:-26px 0 0 -26px}.kadt-bubble{font-size:9px;margin-top:-30px}.kadt-bar{height:43px}.kadt-card{flex-basis:145px}.kadt-card input{height:40px}}
  `;doc.head.append(s);
}

function reachBinding(d){
  const t=d.delivery.type;
  if(t==='dash'||t==='blink')return{label:'REACH',value:d.delivery.distance,min:20,max:700,step:5,patch:v=>({delivery:{distance:v},telegraph:{range:v}})};
  if(d.targeting.type!=='self')return{label:'REACH',value:d.targeting.range,min:40,max:1200,step:10,patch:v=>t==='projectile'?({targeting:{range:v},telegraph:{range:v},delivery:{maxDistance:v}}):({targeting:{range:v},telegraph:{range:v}})};
  return{label:'REACH',value:d.telegraph.range,min:20,max:900,step:10,patch:v=>({telegraph:{range:v}})};
}
function sizeBinding(d){
  const t=d.delivery.type,s=d.telegraph.shape;
  if(t==='trap')return{label:'RADIUS',value:d.delivery.activationRadius,min:8,max:260,step:2,patch:v=>({delivery:{activationRadius:v},telegraph:{radius:v}})};
  if(['self_aoe','persistent_area','aura'].includes(t))return{label:'RADIUS',value:d.delivery.radius,min:8,max:320,step:2,patch:v=>({delivery:{radius:v},telegraph:{radius:v}})};
  if(t==='projectile')return{label:'RADIUS',value:d.delivery.radius,min:2,max:96,step:1,patch:v=>({delivery:{radius:v}})};
  if(t==='wall')return{label:'WIDTH',value:d.delivery.width,min:30,max:360,step:5,patch:v=>({delivery:{width:v},telegraph:{width:v}})};
  if(['line','dash','wall'].includes(s))return{label:'WIDTH',value:d.telegraph.width,min:4,max:120,step:2,patch:v=>({telegraph:{width:v}})};
  return{label:'RADIUS',value:d.telegraph.radius,min:8,max:320,step:2,patch:v=>({telegraph:{radius:v}})};
}
function timingBindings(d){return[
  {label:'WINDUP',value:d.action.windup,min:0,max:1.2,step:.01,patch:v=>({action:{windup:v}})},
  {label:'ACTIVE',value:d.action.active,min:.01,max:1.2,step:.01,patch:v=>({action:{active:v}})},
  {label:'RECOVERY',value:d.action.recovery,min:0,max:1.8,step:.01,patch:v=>({action:{recovery:v}})}
];}
function tracks(document){const d=document.definition,a=d.action,w=a.windup,x=w+a.active,total=abilityTimelineDuration(document);return[{id:'phases',label:'ACTION',items:[{id:'windup',label:'WINDUP',start:0,end:w},{id:'active',label:'ACTIVE',start:w,end:x},{id:'recovery',label:'RECOVERY',start:x,end:total}]},{id:'effects',label:'EFFECTS',items:(d.effects||[]).map((e,i)=>({id:e._id,label:`${i+1} · ${e.type}`,start:w,end:Math.max(w+.01,x)}))}];}
function syncInspector(shell,d){const values=new Map([['Target Range',d.targeting.range],['Telegraph Range',d.telegraph.range],['Telegraph Radius',d.telegraph.radius],['Telegraph Width',d.telegraph.width],['Windup',d.action.windup],['Active',d.action.active],['Recovery',d.action.recovery],['Max Distance',d.delivery.maxDistance],['Distance',d.delivery.distance],['Projectile Radius',d.delivery.radius],['AOE Radius',d.delivery.radius],['Area Radius',d.delivery.radius],['Trigger Radius',d.delivery.activationRadius],['Wall Width',d.delivery.width]]);for(const row of shell.left?.querySelectorAll?.('.ksw-field')||[]){const key=row.querySelector('label')?.textContent,el=row.querySelector('input');if(el&&values.has(key))el.value=String(values.get(key));}}

export function installAbilityTouchTuner(session,{root=globalThis}={}){
  if(!session?.kernel?.execute||!session?.shell?.viewport||!session?.autosave)return null;if(mounted.has(session))return mounted.get(session);
  const host=session.shell.viewport,doc=host.ownerDocument;addStyle(doc);
  const geo=doc.createElement('div');geo.className='kadt';geo.innerHTML='<div class="kadt-line"></div><div class="kadt-size"></div><div class="kadt-bubble reach"></div><div class="kadt-bubble size"></div><button class="kadt-handle reach" type="button">↔</button><button class="kadt-handle size" type="button">↔</button>';
  const panel=doc.createElement('section');panel.className='kadt-panel';panel.innerHTML='<div class="kadt-bar"><div class="kadt-title">✦ DIRECT TUNE</div><div class="kadt-sub">drag gold + blue handles</div><button class="kadt-toggle" type="button">⌃</button></div><div class="kadt-controls"></div>';host.append(geo,panel);
  const line=geo.querySelector('.kadt-line'),shape=geo.querySelector('.kadt-size'),reachHandle=geo.querySelector('.kadt-handle.reach'),sizeHandle=geo.querySelector('.kadt-handle.size'),reachBubble=geo.querySelector('.kadt-bubble.reach'),sizeBubble=geo.querySelector('.kadt-bubble.size'),controls=panel.querySelector('.kadt-controls'),toggle=panel.querySelector('.kadt-toggle');
  const mobile=root.matchMedia?.('(max-width:760px)')?.matches===true;let open=mobile,dead=false,queue=Promise.resolve();
  const setOpen=v=>{open=!!v;panel.classList.toggle('open',open);toggle.textContent=open?'⌄':'⌃';};setOpen(open);toggle.onclick=e=>{e.stopPropagation();setOpen(!open);};

  function points(){
    const hb=host.getBoundingClientRect(),pr=host.querySelector('.kat-player')?.getBoundingClientRect(),dr=host.querySelector('.kat-dummy')?.getBoundingClientRect(),fy=hb.height*(mobile ? 0.61 : 0.64);
    const point=(rect,x)=>rect?{x:rect.left-hb.left+rect.width/2,y:rect.top-hb.top+rect.height}:{x:hb.width*x,y:fy};
    return{player:point(pr,mobile ? 0.22 : 0.27),dummy:point(dr,mobile ? 0.78 : 0.73),w:hb.width,h:hb.height};
  }
  function center(d,p){return(d.targeting.type==='self'||d.delivery.type==='self_aoe'||d.delivery.type==='aura')?p.player:p.dummy;}
  function geom(value,binding,minPx,maxPx){return mix(minPx,maxPx,ratio(value,binding.min,binding.max));}
  function draw(reachValue=null,sizeValue=null){
    if(dead)return;const d=session.kernel.document.definition,p=points(),rb=reachBinding(d),sb=sizeBinding(d);if(reachValue!=null)rb.value=reachValue;if(sizeValue!=null)sb.value=sizeValue;
    const reachMax=Math.max(80,p.w-p.player.x-28),reachMin=Math.min(54,reachMax*.34),reachPx=geom(rb.value,rb,reachMin,reachMax),rx=clamp(p.player.x+reachPx,26,p.w-26),ry=p.player.y-24;Object.assign(line.style,{left:`${p.player.x}px`,top:`${ry}px`,width:`${Math.max(1,rx-p.player.x)}px`});Object.assign(reachHandle.style,{left:`${rx}px`,top:`${ry}px`});Object.assign(reachBubble.style,{left:`${rx}px`,top:`${ry}px`});reachBubble.textContent=`REACH ${format(rb.value,rb.step)}`;
    const c=center(d,p),sizeMax=Math.max(50,Math.min(150,p.w*.31,p.h*.27)),sizeMin=Math.min(24,sizeMax*.4),sizePx=geom(sb.value,sb,sizeMin,sizeMax),sx=clamp(c.x+sizePx,26,p.w-26),sy=c.y-24;shape.className=`kadt-size ${sb.label==='WIDTH'?'width':'radius'}`;if(sb.label==='WIDTH')Object.assign(shape.style,{left:`${c.x-sizePx}px`,top:`${sy}px`,width:`${sizePx*2}px`,height:'3px'});else Object.assign(shape.style,{left:`${c.x-sizePx}px`,top:`${sy-sizePx}px`,width:`${sizePx*2}px`,height:`${sizePx*2}px`});Object.assign(sizeHandle.style,{left:`${sx}px`,top:`${sy}px`});Object.assign(sizeBubble.style,{left:`${sx}px`,top:`${sy}px`});sizeBubble.textContent=`${sb.label} ${format(sb.value,sb.step)}`;
  }
  function renderControls(){
    controls.replaceChildren();for(const b of timingBindings(session.kernel.document.definition)){const card=doc.createElement('label');card.className='kadt-card';const header=doc.createElement('header'),name=doc.createElement('span'),out=doc.createElement('output');name.textContent=b.label;out.textContent=format(b.value,b.step);header.append(name,out);const slider=doc.createElement('input');slider.type='range';slider.min=String(b.min);slider.max=String(b.max);slider.step=String(b.step);slider.value=String(clamp(b.value,b.min,b.max));slider.oninput=()=>out.textContent=format(slider.value,b.step);slider.onchange=()=>void commit(b,slider.value);const small=doc.createElement('small');small.textContent='release → replay';card.append(header,slider,small);controls.append(card);}draw();
  }
  async function commit(binding,raw){
    const value=snap(clamp(raw,binding.min,binding.max),binding.step);queue=queue.catch(()=>{}).then(async()=>{await session.kernel.execute(createPatchAbilityDefinitionCommand(binding.patch(value)));session.autosave.markDirty();const d=session.kernel.document.definition;syncInspector(session.shell,d);const duration=abilityTimelineDuration(session.kernel.document);session.timeline?.set?.({duration,tracks:tracks(session.kernel.document),playhead:Math.min(session.timeline.playhead||0,duration),snapStep:1/60});try{await session.preview?.play?.(session.kernel.document);}catch(error){console.warn('[Ability Direct Tune] preview replay unavailable',error);}renderControls();});try{await queue;}catch(error){console.warn('[Ability Direct Tune] commit failed',error);}
  }
  function drag(kind,event){
    event.preventDefault();event.stopPropagation();const p=points(),binding=kind==='reach'?reachBinding(session.kernel.document.definition):sizeBinding(session.kernel.document.definition),origin=kind==='reach'?p.player:center(session.kernel.document.definition,p),maxPx=kind==='reach'?Math.max(80,p.w-p.player.x-28):Math.max(50,Math.min(150,p.w*.31,p.h*.27)),minPx=kind==='reach'?Math.min(54,maxPx*.34):Math.min(24,maxPx*.4),pointerId=event.pointerId;let value=binding.value;event.currentTarget.setPointerCapture?.(pointerId);
    const move=e=>{if(e.pointerId!==pointerId)return;e.preventDefault();const hb=host.getBoundingClientRect(),distance=clamp(e.clientX-hb.left-origin.x,minPx,maxPx),t=(distance-minPx)/Math.max(1,maxPx-minPx);value=snap(mix(binding.min,binding.max,t),binding.step);draw(kind==='reach'?value:null,kind==='size'?value:null);};
    const end=e=>{if(e.pointerId!==pointerId)return;e.preventDefault();root.removeEventListener?.('pointermove',move,true);root.removeEventListener?.('pointerup',end,true);root.removeEventListener?.('pointercancel',end,true);void commit(binding,value);};
    root.addEventListener?.('pointermove',move,{capture:true,passive:false});root.addEventListener?.('pointerup',end,{capture:true,passive:false});root.addEventListener?.('pointercancel',end,{capture:true,passive:false});
  }
  reachHandle.onpointerdown=e=>drag('reach',e);sizeHandle.onpointerdown=e=>drag('size',e);
  const onchange=e=>{if(panel.contains(e.target)||geo.contains(e.target))return;root.setTimeout?.(()=>renderControls(),80);};session.shell.root?.addEventListener?.('change',onchange,true);session.shell.root?.addEventListener?.('click',onchange,true);
  const resize=root.ResizeObserver?new root.ResizeObserver(()=>draw()):null;resize?.observe(host);const observer=root.MutationObserver?new root.MutationObserver(()=>{if(!session.shell.root?.isConnected)destroy();}):null;observer?.observe(doc.body,{childList:true,subtree:true});
  function destroy(){if(dead)return;dead=true;resize?.disconnect();observer?.disconnect();session.shell.root?.removeEventListener?.('change',onchange,true);session.shell.root?.removeEventListener?.('click',onchange,true);geo.remove();panel.remove();mounted.delete(session);}
  const api=Object.freeze({version:'ability-direct-tuner-v2.0.1',geometry:geo,panel,refresh:renderControls,destroy});mounted.set(session,api);renderControls();return api;
}
