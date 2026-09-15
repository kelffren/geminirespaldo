/* KELO-INDEX
 * area: CREATORS / SPRITE ABILITY EVENT LAB
 * owner: semantic event authoring + creator runtime test bridge
 * keys: TIMELINE EVENTS PREVIEW TEST IN GAME PREDICT SOURCE SPRITE PLAYBACK NO LEGACY ENGINE
 * purpose: add frame events and run generated Sprite Ability drafts through the real KeloAbilities visual-only runtime + sheet animation
 * does-not-own: combat authority, damage, cooldowns, networking, ability engine
 * lazy: imports Sprite Ability controller/document only while the workspace is active
 */
const STYLE_ID='kelo-sprite-ability-event-lab-v1-style';
const EVENT_TYPES=['CAST_START','PROJECTILE_SPAWN','DAMAGE','AOE_START','SFX','VFX','MOVEMENT','RECOVERY_START','ANIMATION_END'];
const EVENT_LABELS={CAST_START:'CAST',PROJECTILE_SPAWN:'PROJECTILE',IMPACT:'IMPACT',DAMAGE:'DAMAGE',AOE_START:'AOE',SFX:'SFX',VFX:'VFX',MOVEMENT:'MOVE',RECOVERY_START:'RECOVERY',ANIMATION_END:'END'};
const CSS=`
#kelo-studio-workspace .sab-event-lab{margin:9px 0 2px;padding:10px;border:1px solid rgba(73,173,255,.28);border-radius:14px;background:linear-gradient(145deg,rgba(5,22,32,.98),rgba(4,13,20,.98));pointer-events:auto}
.sab-event-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}.sab-event-head strong{color:#f6d67a;font:900 9px system-ui;letter-spacing:.12em}.sab-event-frame{padding:4px 8px;border:1px solid rgba(255,255,255,.1);border-radius:999px;color:#cde9f7;font:900 8px system-ui;background:rgba(255,255,255,.035)}
.sab-event-actions{display:flex;gap:5px;overflow-x:auto;padding:2px 0 7px;scrollbar-width:none}.sab-event-actions::-webkit-scrollbar{display:none}.sab-event-actions button{flex:0 0 auto;height:30px;padding:0 9px;border:1px solid rgba(112,188,231,.22);border-radius:8px;background:#091820;color:#cde6f3;font:850 7px system-ui}.sab-event-actions button:active{transform:translateY(1px)}
.sab-event-current{display:flex;gap:5px;min-height:28px;align-items:center;overflow-x:auto;padding:3px 0 8px;scrollbar-width:none}.sab-event-chip{display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;padding:5px 7px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(255,255,255,.04);color:#dcebf1;font:850 7px system-ui}.sab-event-chip.locked{border-color:rgba(255,197,78,.42);color:#ffe299}.sab-event-chip button{width:18px;height:18px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font-size:10px}
.sab-event-run{display:grid;grid-template-columns:1fr 1fr;gap:7px}.sab-event-run button{height:38px;border-radius:10px;border:1px solid rgba(50,166,255,.48);background:rgba(30,119,190,.12);color:#eaf7ff;font:900 8px system-ui;letter-spacing:.06em}.sab-event-run [data-sab-test-game]{border-color:rgba(241,198,83,.58);color:#ffe8a2;background:rgba(190,142,30,.08)}
.sab-event-note{margin:7px 1px 0;color:#6f8b98;font:700 6.5px/1.4 system-ui}.sab-frame .sab-event-dots{position:absolute;left:3px;right:3px;top:19px;display:flex;gap:2px;justify-content:center;z-index:4;pointer-events:none}.sab-event-dot{width:5px;height:5px;border-radius:50%;background:#48b9ff;box-shadow:0 0 5px rgba(72,185,255,.55)}.sab-event-dot[data-type="IMPACT"]{background:#ffd25a;box-shadow:0 0 5px rgba(255,210,90,.7)}.sab-event-dot[data-type="DAMAGE"]{background:#ff6573}.sab-event-dot[data-type="VFX"]{background:#b77cff}.sab-event-dot[data-type="SFX"]{background:#58e3b3}
body.sab-runtime-testing #kelo-studio-workspace{opacity:0!important;pointer-events:none!important;transition:opacity .12s ease}
#sab-runtime-test-badge{position:fixed;left:50%;top:max(12px,env(safe-area-inset-top));transform:translateX(-50%);z-index:2147483646;padding:8px 12px;border:1px solid rgba(242,202,95,.68);border-radius:999px;background:rgba(5,12,16,.9);color:#ffe7a0;font:900 9px system-ui;letter-spacing:.08em;pointer-events:none}
@media(min-width:761px){#kelo-studio-workspace .sab-event-lab{position:absolute;right:12px;bottom:12px;width:min(430px,38vw);z-index:14;box-shadow:0 14px 38px rgba(0,0,0,.38)}}
`;
let disposed=false,rootRef=null,observer=null,style=null,raf=0,lastFrame=null,lastProjectId=null,previewRunning=false,syncQueued=false;
let controllerModPromise=null,documentModPromise=null;
const getController=()=>controllerModPromise||(controllerModPromise=import('./sprite-ability-live-controller.mjs'));
const getDocument=()=>documentModPromise||(documentModPromise=import('./sprite-ability-document.mjs'));
function toast(root,msg){if(typeof root.showToast==='function')root.showToast(msg);else console.info('[Sprite Ability Event Lab]',msg);}
function make(doc,tag,cls,text=''){const n=doc.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;}
function ensureStyle(doc){if(doc.getElementById(STYLE_ID))return;style=make(doc,'style');style.id=STYLE_ID;style.textContent=CSS;doc.head.append(style);}
async function builder(){const mod=await getController();return mod.getSpriteAbilityBuilder?.()||null;}
function directionFromActor(actor){const face=String(actor?._face||actor?.face||'right').toLowerCase();if(face==='left')return{x:-1,y:0};if(face==='up')return{x:0,y:-1};if(face==='down')return{x:0,y:1};const vx=Number(actor?.vx)||0,vy=Number(actor?.vy)||0,l=Math.hypot(vx,vy);return l>.01?{x:vx/l,y:vy/l}:{x:1,y:0};}
function eventContext(root,draft){const actor=root.localPlayer||null,dir=directionFromActor(actor),origin={x:Number(actor?.x)||0,y:Number(actor?.y)||0},range=Number(draft?.combat?.range)||120;return{actor,actorId:String(actor?.id||actor?.playerKey||'creator-preview'),abilityId:1000,abilityKey:draft?.combat?.key||'sprite_ability',origin,target:{x:origin.x+dir.x*range,y:origin.y+dir.y*range},direction:dir,gameplay:{speed:420,range,radius:range},visual:{scale:1,seed:Date.now()>>>0},confirmed:true,visualPredicted:true};}
function impactFxId(draft){
  const d=String(draft?.combat?.deliveryType||'instant');
  const k=String(draft?.combat?.key||'');
  if(d==='self_aoe'||/ice|nova|frost/i.test(k))return'ice_nova_ground_ring';
  if(d==='dash'||/wind|dash/i.test(k))return'wind_dash_burst';
  if(/poison|trap/i.test(k))return'poison_trap_mark';
  return'fire_explosion_medium';
}
function emitEvent(root,event,draft){const ctx=eventContext(root,draft),payload=event?.payload&&typeof event.payload==='object'?event.payload:{};const visuals=root.KeloAbilityVisuals,bus=root.KeloVisualEventBus;try{switch(event.type){case'CAST_START':bus?.emit?.('CAST_CONFIRMED',ctx);bus?.emit?.('CAST_START',ctx);break;case'PROJECTILE_SPAWN':visuals?.playCue?.(1000,'projectile',ctx);bus?.emit?.('PROJECTILE_SPAWN',ctx);break;case'IMPACT':bus?.emit?.('ABILITY_IMPACT',ctx);bus?.emit?.('IMPACT',ctx);if(root.KeloFX)root.KeloFX.spawn?.(impactFxId(draft),{origin:ctx.origin,actor:ctx.actor});break;case'AOE_START':visuals?.playCue?.(1000,'area',ctx);bus?.emit?.('AOE_START',ctx);break;case'VFX':visuals?.playCue?.(1000,String(payload.cue||'impact'),ctx);break;case'MOVEMENT':if(draft?.combat?.deliveryType==='dash')bus?.emit?.('DASH_STARTED',ctx);break;case'RECOVERY_START':if(draft?.combat?.deliveryType==='dash')bus?.emit?.('DASH_ENDED',ctx);break;default:break;}}catch(error){console.warn('[Sprite Ability Event Lab] semantic preview event failed',event.type,error);}}
function renderFrameDots(workspace,draft){if(!workspace||!draft)return;for(const cell of workspace.querySelectorAll('.sab-frame')){cell.querySelector('.sab-event-dots')?.remove();const frame=Number(cell.dataset.frame),events=(draft.events||[]).filter(e=>Number(e.frame)===frame);if(!events.length)continue;const dots=make(workspace.ownerDocument,'span','sab-event-dots');for(const event of events.slice(0,6)){const dot=make(workspace.ownerDocument,'i','sab-event-dot');dot.dataset.type=event.type;dot.title=EVENT_LABELS[event.type]||event.type;dots.append(dot);}cell.append(dots);}}
async function mutateEvent(type,removeId=null){const b=await builder();if(!b)return;const mod=await getDocument(),current=b.draft;if(!current)return;const next=removeId?mod.removeAnimationEvent(current,removeId):mod.addAnimationEvent(current,type,b.frame);Object.assign(current,next);await b.save();scheduleSync();}
function currentEvents(draft,frame){return(draft?.events||[]).filter(e=>Number(e.frame)===Number(frame));}
export function getCrossedPreviewFrames(previous,current,startFrame,endFrame){
  const a=Math.max(0,Math.round(Number(startFrame)||0)),z=Math.max(0,Math.round(Number(endFrame)||0));
  const start=Math.min(a,z),end=Math.max(a,z),clampFrame=value=>Math.min(end,Math.max(start,Math.round(Number(value)||0)));
  const currentFrame=clampFrame(current);
  if(previous==null)return[currentFrame];
  const previousFrame=clampFrame(previous);
  if(currentFrame===previousFrame)return[];
  const crossed=[];
  if(currentFrame>previousFrame){for(let frame=previousFrame+1;frame<=currentFrame;frame+=1)crossed.push(frame);return crossed;}
  for(let frame=previousFrame+1;frame<=end;frame+=1)crossed.push(frame);
  for(let frame=start;frame<=currentFrame;frame+=1)crossed.push(frame);
  return crossed;
}
async function renderDock(workspace,b){const doc=workspace.ownerDocument,draft=b.draft;if(!draft)return;let dock=workspace.querySelector('.sab-event-lab');if(!dock){dock=make(doc,'section','sab-event-lab');const timeline=workspace.querySelector('.ksw-timeline');if(timeline?.parentElement)timeline.insertAdjacentElement('afterend',dock);else workspace.append(dock);}dock.replaceChildren();const head=make(doc,'div','sab-event-head'),title=make(doc,'strong','', 'EVENTOS DE ANIMACIÓN'),frameBadge=make(doc,'span','sab-event-frame',`FRAME ${b.frame}`);head.append(title,frameBadge);const actions=make(doc,'div','sab-event-actions');for(const type of EVENT_TYPES){const btn=make(doc,'button','',`+ ${EVENT_LABELS[type]||type}`);btn.dataset.eventType=type;btn.onclick=()=>void mutateEvent(type);actions.append(btn);}const chips=make(doc,'div','sab-event-current');const here=currentEvents(draft,b.frame);if(!here.length)chips.append(make(doc,'span','sab-event-chip','Sin eventos en este frame'));else for(const event of here){const chip=make(doc,'span',`sab-event-chip${event.type==='IMPACT'?' locked':''}`,EVENT_LABELS[event.type]||event.type);if(event.type!=='IMPACT'){const x=make(doc,'button','','×');x.title='Eliminar evento';x.onclick=()=>void mutateEvent(null,event.id);chip.append(x);}chips.append(chip);}const run=make(doc,'div','sab-event-run'),preview=make(doc,'button','','▶ PLAY FULL ABILITY'),test=make(doc,'button','','⚡ TEST IN GAME');preview.dataset.sabPreviewFull='';test.dataset.sabTestGame='';preview.onclick=()=>void previewFull(rootRef,b);test.onclick=()=>void testInGame(rootRef,b);run.append(preview,test);dock.append(head,actions,chips,run,make(doc,'p','sab-event-note','IMPACT sigue ligado al marcador HIT. TEST IN GAME reproduce la hoja en el actor, dispara eventos del frame y llama KeloAbilities.predictSource (visual-only).'));renderFrameDots(workspace,draft);}
async function previewFull(root,b){if(previewRunning)return;previewRunning=true;lastFrame=null;b.setFrame?.(b.draft.sheet.startFrame,{pause:true,center:true});const play=root.document.querySelector('#kelo-studio-workspace .ksw-timeline [data-sab-play]');if(play&&String(play.textContent||'').includes('▶'))play.click();toast(root,'Preview completo: sprite + eventos semánticos');root.setTimeout(()=>{previewRunning=false;},Math.max(450,Number((b.draft.sheet.endFrame-b.draft.sheet.startFrame+1)*1000/Math.max(1,b.draft.sheet.fps))+Number(b.draft.combat.hitstopMs||0)+200));}
function runtimeBadge(root,on,label){root.document.getElementById('sab-runtime-test-badge')?.remove();root.document.body.classList.toggle('sab-runtime-testing',!!on);if(on){const badge=make(root.document,'div','',label||'TEST IN GAME · VISUAL ONLY');badge.id='sab-runtime-test-badge';root.document.body.append(badge);}}
function playDraftSheet(root,draft,ctx,timing){
  if(!root.KeloAssetRegistry||!root.KeloFX||!draft?.sheet?.dataUrl)return false;
  const id='sab_lab_'+Date.now().toString(36);
  try{root.KeloAssetRegistry.register({id,type:'image',src:draft.sheet.dataUrl,preload:false,frameWidth:draft.sheet.frameWidth,frameHeight:draft.sheet.frameHeight,columns:draft.sheet.columns,rows:draft.sheet.rows,frames:Math.max(1,draft.sheet.endFrame-draft.sheet.startFrame+1)});}catch{}
  const duration=Math.max(.05,(timing?.animationMs||400)/1000);
  const spawn=()=>root.KeloFX.preview({
    id:'fx_'+id,type:'sprite_animation',assetId:id,
    frameWidth:draft.sheet.frameWidth,frameHeight:draft.sheet.frameHeight,
    columns:draft.sheet.columns,rows:draft.sheet.rows,
    frames:Math.max(1,draft.sheet.endFrame-draft.sheet.startFrame+1),fps:draft.sheet.fps||12,
    space:'ACTOR',layer:'actorFrontFX',socket:'center',
    duration,loop:draft.sheet.loop===true,
    width:(draft.sheet.frameWidth||64)*(draft.sheet.scale||1),
    height:(draft.sheet.frameHeight||64)*(draft.sheet.scale||1),alpha:1
  },{actor:ctx.actor,actorId:ctx.actorId,origin:ctx.origin,abilityKey:draft.combat.key},{duration,loop:draft.sheet.loop===true});
  try{if(root.KeloAssetRegistry.isReady?.(id))spawn();else root.KeloAssetRegistry.load?.(id)?.then?.(spawn);}catch{try{spawn();}catch{}}
  return true;
}
function scheduleFrameEvents(root,draft,timing){
  const start=Number(draft.sheet.startFrame)||0;
  const frameMs=Number(timing?.frameMs)||Math.max(16,1000/Math.max(1,draft.sheet.fps||12));
  (draft.events||[]).forEach(ev=>{
    const delay=Math.max(0,(Number(ev.frame)-start)*frameMs);
    root.setTimeout(()=>emitEvent(root,ev,draft),delay);
  });
}
async function testInGame(root,b){
  try{
    const mod=await getDocument();
    const draft=mod.normalizeSpriteAbilityDocument(b.draft);
    const timing=mod.spriteAbilityTiming(draft);
    const report=mod.validateSpriteAbilityDocument(draft);
    if(!report.ok)throw new Error(`SPRITE_ABILITY_INVALID:${report.errors.join(',')}`);
    await b.save?.();
    const ids=await b.generate();
    const built=mod.buildGeneratedDrafts(draft,{animationProjectId:ids?.animationProjectId||null,abilityProjectId:ids?.abilityProjectId||null});
    if(root.KeloAbilitiesLoader?.ensure)await root.KeloAbilitiesLoader.ensure();
    const runtime=root.KeloAbilities;
    const ctx=eventContext(root,draft);
    runtimeBadge(root,true,`TEST IN GAME · ${draft.combat.key} · IMPACT F${draft.combat.impactFrame}`);
    playDraftSheet(root,draft,ctx,timing);
    scheduleFrameEvents(root,draft,timing);
    if(runtime?.engine?.predictSource){
      runtime.wakeRuntime?.();
      const dir=ctx.direction;
      const result=runtime.engine.predictSource({
        sourceType:'creator',
        sourceId:`sprite-ability:${b.projectId}`,
        sourceSlot:'test-in-game',
        sourceFingerprint:`creator:${b.projectId}:${Date.now()}`,
        definition:built.ability.definition,
        request:{direction:dir,position:ctx.origin,sourceType:'creator'}
      });
      if(result?.valid===false)throw new Error(`TEST_IN_GAME_${result.reason||'FAILED'}`);
    }
    toast(root,`TEST IN GAME · sheet + ${ (draft.events||[]).length } events · visual-only`);
    root.setTimeout(()=>runtimeBadge(root,false),Math.max(1400,timing.animationMs+400));
  }catch(error){
    runtimeBadge(root,false);
    console.error('[Sprite Ability Event Lab] TEST IN GAME failed',error);
    toast(root,error?.message||String(error));
  }
}
async function syncNow(){if(disposed||!rootRef?.document?.body?.classList.contains('kelo-sprite-ability-builder-active'))return;const workspace=rootRef.document.getElementById('kelo-studio-workspace');if(!workspace)return;const b=await builder();if(!b)return;if(lastProjectId&&lastProjectId!==b.projectId)workspace.querySelector('.sab-event-lab')?.remove();lastProjectId=b.projectId;await renderDock(workspace,b);}
function scheduleSync(){if(syncQueued||disposed)return;syncQueued=true;queueMicrotask(async()=>{syncQueued=false;try{await syncNow();}catch(error){console.warn('[Sprite Ability Event Lab] sync failed',error);}});}
function frameLoop(){if(disposed)return;raf=rootRef.requestAnimationFrame(frameLoop);if(!rootRef.document.body.classList.contains('kelo-sprite-ability-builder-active')){lastFrame=null;return;}void builder().then(b=>{if(!b)return;const f=b.frame;if(f!==lastFrame){const previous=lastFrame;lastFrame=f;if(previewRunning){const crossed=getCrossedPreviewFrames(previous,f,b.draft.sheet.startFrame,b.draft.sheet.endFrame);for(const frame of crossed){for(const event of currentEvents(b.draft,frame))emitEvent(rootRef,event,b.draft);}if(previous!=null&&f<previous)previewRunning=false;}scheduleSync();}}).catch(()=>{});}
export function installSpriteAbilityEventLab({root=globalThis}={}){if(!root?.document)return()=>{};rootRef=root;disposed=false;ensureStyle(root.document);observer=new root.MutationObserver(scheduleSync);observer.observe(root.document.body,{attributes:true,attributeFilter:['class']});scheduleSync();raf=root.requestAnimationFrame(frameLoop);return()=>{disposed=true;observer?.disconnect();observer=null;if(raf)root.cancelAnimationFrame(raf);raf=0;runtimeBadge(root,false);root.document.querySelector('.sab-event-lab')?.remove();style?.remove();style=null;};}