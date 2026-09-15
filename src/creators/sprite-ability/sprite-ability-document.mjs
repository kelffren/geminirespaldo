/* KELO-INDEX
 * area: CREATORS / SPRITE ABILITY
 * owner: Sprite Ability authoring document
 * keys: SPRITESHEET FRAMES AUTO FIT ABILITY PREVIEW IMPACT ACTIVE WINDOW HITBOX DAMAGE RANGE KNOCKBACK EXPORT EVENTS
 * purpose: define y normaliza el draft combinado usado por Sprite Ability Builder y genera drafts normales ANIMATION + ABILITY
 * does-not-own: runtime combat, damage authority, asset publishing or networking
 */
const copy=v=>v==null?v:(typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v)));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const key=v=>String(v||'sprite_ability').toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'')||'sprite_ability';
const EVENT_TYPES=Object.freeze(['CAST_START','PROJECTILE_SPAWN','IMPACT','DAMAGE','AOE_START','SFX','VFX','MOVEMENT','RECOVERY_START','ANIMATION_END']);
function normalizeEvent(raw,startFrame,endFrame){
  const type=EVENT_TYPES.includes(String(raw&&raw.type||'').toUpperCase())?String(raw.type).toUpperCase():'IMPACT';
  const frame=clamp(Math.round(finite(raw&&raw.frame,startFrame)),startFrame,endFrame);
  return Object.freeze({id:String(raw&&raw.id||`${type.toLowerCase()}_${frame}`),frame,type,payload:raw&&raw.payload&&typeof raw.payload==='object'?copy(raw.payload):{}});
}
export function syncAnimationEvents(events,combat,sheet){
  const start=clamp(Math.round(finite(sheet&&sheet.startFrame,0)),0,9999),end=Math.max(start,clamp(Math.round(finite(sheet&&sheet.endFrame,start)),start,9999));
  const impact=clamp(Math.round(finite(combat&&combat.impactFrame,start)),start,end);
  const list=(Array.isArray(events)?events:[]).map(e=>normalizeEvent(e,start,end)).filter(e=>e.type!=='IMPACT');
  list.push(normalizeEvent({id:'impact_hit',frame:impact,type:'IMPACT'},start,end));
  list.sort((a,b)=>a.frame-b.frame||a.type.localeCompare(b.type));
  return Object.freeze(list);
}
export function eventsAtFrame(document,index){
  const d=normalizeSpriteAbilityDocument(document);
  return d.events.filter(e=>e.frame===clamp(Math.round(finite(index,d.combat.impactFrame)),d.sheet.startFrame,d.sheet.endFrame));
}

export function normalizeSpriteAbilityDocument(input={}){
  const sheet=input.sheet||{},combat=input.combat||{},preview=input.preview||{},generated=input.generated||{},autoFit=sheet.autoFit||{};
  const frameWidth=Math.max(1,Math.round(finite(sheet.frameWidth,128))),frameHeight=Math.max(1,Math.round(finite(sheet.frameHeight,192)));
  const columns=Math.max(1,Math.round(finite(sheet.columns,4))),rows=Math.max(1,Math.round(finite(sheet.rows,4))),cells=columns*rows;
  const startFrame=clamp(Math.round(finite(sheet.startFrame,0)),0,Math.max(0,cells-1)),endFrame=clamp(Math.round(finite(sheet.endFrame,cells-1)),startFrame,Math.max(startFrame,cells-1));
  const frameCount=Math.max(1,endFrame-startFrame+1),fps=Math.max(1,finite(sheet.fps,16)),impactFrame=clamp(Math.round(finite(combat.impactFrame,startFrame+Math.min(2,frameCount-1))),startFrame,endFrame);
  const activeStartFrame=clamp(Math.round(finite(combat.activeStartFrame,impactFrame)),startFrame,impactFrame),activeEndFrame=clamp(Math.round(finite(combat.activeEndFrame,impactFrame)),impactFrame,endFrame);
  const range=Math.max(1,finite(combat.range,120)),defaultHitboxHeight=Math.max(24,range*.55);
  return {
    schema:1,documentType:'SPRITE_ABILITY',documentId:String(input.documentId||`sprite-ability:${Date.now().toString(36)}`),
    name:String(input.name||'Sprite Ability'),
    sheet:{
      assetId:key(sheet.assetId||'sprite_ability_sheet'),fileName:String(sheet.fileName||''),dataUrl:String(sheet.dataUrl||''),
      imageWidth:Math.max(0,Math.round(finite(sheet.imageWidth,0))),imageHeight:Math.max(0,Math.round(finite(sheet.imageHeight,0))),
      frameWidth,frameHeight,columns,rows,startFrame,endFrame,fps,loop:sheet.loop===true,
      scale:clamp(finite(sheet.scale,1),.1,6),offsetX:finite(sheet.offsetX,0),offsetY:finite(sheet.offsetY,0),
      spacingX:Math.max(0,Math.round(finite(sheet.spacingX,0))),spacingY:Math.max(0,Math.round(finite(sheet.spacingY,0))),
      originX:clamp(finite(sheet.originX,.5),0,1),originY:clamp(finite(sheet.originY,1),0,1),
      autoFit:{
        applied:autoFit.applied===true,
        sourceWidth:Math.max(0,Math.round(finite(autoFit.sourceWidth,0))),sourceHeight:Math.max(0,Math.round(finite(autoFit.sourceHeight,0))),
        confidence:clamp(finite(autoFit.confidence,0),0,1),score:clamp(finite(autoFit.score,0),0,1),
        backgroundMode:String(autoFit.backgroundMode||''),backgroundRemoved:autoFit.backgroundRemoved===true
      }
    },
    combat:{
      key:key(combat.key||input.name||'sprite_ability'),name:String(combat.name||input.name||'Sprite Ability'),impactFrame,activeStartFrame,activeEndFrame,
      damage:Math.max(0,finite(combat.damage,18)),range,arcDeg:clamp(finite(combat.arcDeg,92),1,360),knockback:Math.max(0,finite(combat.knockback,18)),
      hitstopMs:clamp(finite(combat.hitstopMs,45),0,250),cooldownMs:Math.max(0,finite(combat.cooldownMs,350)),lunge:Math.max(0,finite(combat.lunge,12)),
      cancelWindowMs:Math.max(0,finite(combat.cancelWindowMs,80)),recoveryMs:Math.max(0,finite(combat.recoveryMs,180)),movementScale:clamp(finite(combat.movementScale,.72),0,1.5),
      hitboxX:finite(combat.hitboxX,0),hitboxY:finite(combat.hitboxY,-frameHeight*.45),hitboxWidth:Math.max(8,finite(combat.hitboxWidth,range)),hitboxHeight:Math.max(8,finite(combat.hitboxHeight,defaultHitboxHeight)),
      deliveryType:['instant','dash','self_aoe','projectile'].includes(String(combat.deliveryType))?String(combat.deliveryType):'instant'
    },
    events:syncAnimationEvents(input.events, {impactFrame}, {startFrame,endFrame}),
    preview:{
      mode:['sheet','ability','dummy'].includes(String(preview.mode))?String(preview.mode):'dummy',playing:preview.playing!==false,
      playbackRate:clamp(finite(preview.playbackRate,1),.1,2),showHitbox:preview.showHitbox!==false,onionSkin:preview.onionSkin===true,
      background:['checker','dark','light','game'].includes(String(preview.background))?String(preview.background):'checker',
      zoom:clamp(finite(preview.zoom,1),.25,4)
    },
    generated:{animationProjectId:generated.animationProjectId==null?null:String(generated.animationProjectId),abilityProjectId:generated.abilityProjectId==null?null:String(generated.abilityProjectId)},
    meta:{createdAt:finite(input.meta?.createdAt,Date.now()),updatedAt:Date.now()}
  };
}

export function frameRect(document,index){
  const d=normalizeSpriteAbilityDocument(document),i=clamp(Math.round(finite(index,d.sheet.startFrame)),0,d.sheet.columns*d.sheet.rows-1);
  const col=i%d.sheet.columns,row=Math.floor(i/d.sheet.columns);
  return Object.freeze({
    sx:col*(d.sheet.frameWidth+d.sheet.spacingX),
    sy:row*(d.sheet.frameHeight+d.sheet.spacingY),
    sw:d.sheet.frameWidth,sh:d.sheet.frameHeight
  });
}

export function addAnimationEvent(document,type,frame,payload){
  const d=normalizeSpriteAbilityDocument(document);
  const next=normalizeEvent({type,frame:frame==null?d.combat.impactFrame:frame,payload},d.sheet.startFrame,d.sheet.endFrame);
  if(next.type==='IMPACT')return normalizeSpriteAbilityDocument({...d,combat:{...d.combat,impactFrame:next.frame}});
  const events=d.events.filter(e=>!(e.type===next.type&&e.frame===next.frame)).concat(next);
  return normalizeSpriteAbilityDocument({...d,events});
}

export function removeAnimationEvent(document,id){
  const d=normalizeSpriteAbilityDocument(document);
  return normalizeSpriteAbilityDocument({...d,events:d.events.filter(e=>e.id!==id||e.type==='IMPACT')});
}

export function spriteAbilityTiming(document){
  const d=normalizeSpriteAbilityDocument(document),count=d.sheet.endFrame-d.sheet.startFrame+1,frameMs=1000/d.sheet.fps,impactIndex=d.combat.impactFrame-d.sheet.startFrame;
  const activeStartIndex=d.combat.activeStartFrame-d.sheet.startFrame,activeEndIndex=d.combat.activeEndFrame-d.sheet.startFrame;
  const impactMs=impactIndex*frameMs,animationMs=count*frameMs,activeStartMs=activeStartIndex*frameMs,activeEndMs=(activeEndIndex+1)*frameMs;
  const windupMs=Math.max(0,activeStartMs),activeMs=Math.max(frameMs,activeEndMs-activeStartMs),recoveryMs=Math.max(d.combat.recoveryMs,animationMs-activeEndMs);
  return Object.freeze({frameMs,impactMs,animationMs,activeStartMs,activeEndMs,windupMs,activeMs,recoveryMs,totalMs:windupMs+activeMs+recoveryMs});
}

export function validateSpriteAbilityDocument(document,{maxEmbeddedBytes=7_000_000}={}){
  const d=normalizeSpriteAbilityDocument(document),errors=[],warnings=[];
  if(!d.sheet.dataUrl)errors.push('SPRITESHEET_REQUIRED');
  if(d.sheet.dataUrl.length>maxEmbeddedBytes)errors.push('SPRITESHEET_EMBED_TOO_LARGE');
  const gridW=d.sheet.frameWidth*d.sheet.columns+d.sheet.spacingX*Math.max(0,d.sheet.columns-1);
  const gridH=d.sheet.frameHeight*d.sheet.rows+d.sheet.spacingY*Math.max(0,d.sheet.rows-1);
  if(d.sheet.imageWidth&&gridW>d.sheet.imageWidth)errors.push('GRID_W_EXCEEDS_IMAGE');
  if(d.sheet.imageHeight&&gridH>d.sheet.imageHeight)errors.push('GRID_H_EXCEEDS_IMAGE');
  if(d.combat.impactFrame<d.sheet.startFrame||d.combat.impactFrame>d.sheet.endFrame)errors.push('IMPACT_FRAME_OUT_OF_RANGE');
  if(d.combat.activeStartFrame>d.combat.impactFrame||d.combat.activeEndFrame<d.combat.impactFrame)errors.push('ACTIVE_WINDOW_MUST_INCLUDE_IMPACT');
  if(d.combat.hitstopMs>100)warnings.push('HITSTOP_HIGH');
  if(d.combat.arcDeg>180)warnings.push('ARC_WIDE');
  if(d.combat.activeEndFrame-d.combat.activeStartFrame>=5)warnings.push('ACTIVE_WINDOW_LONG');
  if(d.sheet.autoFit.applied&&d.sheet.autoFit.confidence<.45)warnings.push('AUTO_FIT_LOW_CONFIDENCE');
  return Object.freeze({ok:errors.length===0,errors:Object.freeze(errors),warnings:Object.freeze(warnings)});
}

export function buildGeneratedDrafts(document,{animationProjectId=null,abilityProjectId=null}={}){
  const d=normalizeSpriteAbilityDocument(document),timing=spriteAbilityTiming(d),frames=d.sheet.endFrame-d.sheet.startFrame+1,sequence=Array.from({length:frames},(_,i)=>d.sheet.startFrame+i),assetId=d.sheet.assetId||`${d.combat.key}_sheet`,duration=Math.max(.05,timing.animationMs/1000);
  const animationEvents=d.events.map(e=>({id:e.id,start:(e.frame-d.sheet.startFrame)*timing.frameMs/1000,end:(e.frame-d.sheet.startFrame)*timing.frameMs/1000,label:e.type.toLowerCase(),payload:{frame:e.frame,type:e.type,...(e.payload||{})}}));
  const animation={schema:2,documentType:'ANIMATION',clip:{id:`anim_${d.combat.key}`,type:'spritesheet',channel:'action',priority:45,duration,loop:d.sheet.loop===true,interruptible:true,directions:['up','down','left','right'],mirrorLeftFromRight:false,markers:{impact:timing.impactMs/1000,recover:timing.activeEndMs/1000},assetId,frames:d.sheet.columns*d.sheet.rows,fps:d.sheet.fps,frameWidth:d.sheet.frameWidth,frameHeight:d.sheet.frameHeight,frameSequence:sequence,anchor:{x:.5,y:1}},tracks:{hitbox:[{id:'hit-main',start:timing.activeStartMs/1000,end:timing.activeEndMs/1000,label:'hit',payload:{box:{x:d.combat.hitboxX,y:d.combat.hitboxY,width:d.combat.hitboxWidth,height:d.combat.hitboxHeight}}}],hurtbox:[],movement:d.combat.lunge?[{id:'lunge',start:0,end:Math.max(timing.frameMs,timing.impactMs)/1000,label:'lunge',payload:{distance:d.combat.lunge}}]:[],sound:[],vfx:[],event:[{id:'hitstop',start:timing.impactMs/1000,end:timing.impactMs/1000,label:'hitstop',payload:{ms:d.combat.hitstopMs}},...animationEvents],projectile:[],invulnerability:[]},assetSource:{kind:'data_url',dataUrl:d.sheet.dataUrl,fileName:d.sheet.fileName,width:d.sheet.imageWidth,height:d.sheet.imageHeight},authoring:{autoFit:copy(d.sheet.autoFit),activeWindow:{startFrame:d.combat.activeStartFrame,endFrame:d.combat.activeEndFrame},hitbox:{x:d.combat.hitboxX,y:d.combat.hitboxY,width:d.combat.hitboxWidth,height:d.combat.hitboxHeight},animationEvents:copy(d.events)}};
  const delivery=d.combat.deliveryType==='dash'?{type:'dash',distance:Math.max(1,d.combat.lunge||80),duration:Math.max(.05,timing.windupMs/1000)}:d.combat.deliveryType==='self_aoe'?{type:'self_aoe',radius:d.combat.range}:d.combat.deliveryType==='projectile'?{type:'projectile',speed:420,radius:16,maxDistance:d.combat.range}:{type:'instant'};
  const ability={schema:1,documentType:'ABILITY',definition:{id:1000,key:d.combat.key,name:d.combat.name,icon:'⚔️',slotType:'normal',role:d.combat.deliveryType==='dash'?'mobility':'burst',recipe:['wind',d.combat.deliveryType==='dash'?'dash':'projectile'],targeting:{type:d.combat.deliveryType==='self_aoe'?'self':'direction',range:d.combat.range},resource:{type:'mana',cost:0},cooldown:d.combat.cooldownMs/1000,input:{mode:'instant'},action:{windup:timing.windupMs/1000,active:timing.activeMs/1000,recovery:timing.recoveryMs/1000,movementScale:d.combat.movementScale},telegraph:{shape:d.combat.deliveryType==='self_aoe'?'circle':'line',range:d.combat.range,radius:d.combat.range,width:Math.max(24,d.combat.range*.3)},delivery,effects:[{type:'damage',damageType:'physical',amount:d.combat.damage},{type:'status',status:'knockback',duration:.01,magnitude:d.combat.knockback}],visualProfileId:null,visuals:{color:'#f2d27e',accent:'#ffffff',fx:d.combat.key}},links:{animationProjectId:animationProjectId||null,castVfxProjectId:null,impactVfxProjectId:null},authoring:{spriteAbilityProjectId:d.documentId,arcDeg:d.combat.arcDeg,hitstopMs:d.combat.hitstopMs,cancelWindowMs:d.combat.cancelWindowMs,lunge:d.combat.lunge,activeStartFrame:d.combat.activeStartFrame,activeEndFrame:d.combat.activeEndFrame,hitbox:{x:d.combat.hitboxX,y:d.combat.hitboxY,width:d.combat.hitboxWidth,height:d.combat.hitboxHeight},spriteAutoFit:copy(d.sheet.autoFit)}};
  return Object.freeze({animation:copy(animation),ability:copy(ability),animationProjectId,abilityProjectId,timing});
}
