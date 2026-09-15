/* KELO-INDEX
 * area: CORE / INPUT
 * owner: KeloInput
 * keys: INPUT PIPELINE LOCK HOOK COMBAT INTENT BUFFER GAMEPAD DEADZONE AIM FOUNDATION ZERO-GARBAGE
 * purpose: único pipeline alrededor del processInput legacy; normaliza intención de movimiento/combate sin crear otro input manager
 * public-api: KeloInput.before/after/unregister/snapshot/isLocked + combat.* + radialAxis/pollGamepad
 * consumes: processInput legacy, KeloInputLocks, input, localPlayer, Gamepad API opcional
 * state-owned: hooks + estado normalizado/cola efímera de input; NO posee gameplay/cooldowns/HP
 * extension-points: before/after + combat.push/setAxes/configure/read
 * reuse: PvP, habilidades, mounts y futuros control schemes consumen el mismo contrato semántico
 * legacy: bridge temporal mientras parser físico base siga en engine-a.js
 * do-not: NO meter hit detection, abilities, UI, cámara ni render aquí; la única excepción temporal es enlazar la vista legacy de obstáculos antes de instalar KeloInput
 */
(function(root){
  'use strict';
  if(root.KeloInput)return;
  const VERSION='kelo-input-v2.1.0-zero-copy-read';

  try{
    if(root.KELO_COLLISION&&typeof root.KELO_COLLISION.attachLegacyObstacleArray==='function'&&typeof obstacles!=='undefined'&&Array.isArray(obstacles)){
      root.KELO_COLLISION.attachLegacyObstacleArray(obstacles,{adoptExistingOwner:'core-static'});
    }
  }catch(error){
    root.KELO_INPUT_COLLISION_BOOT_ERROR=String(error?.message||error);
  }

  if(typeof processInput!=='function'){
    root.KELO_INPUT_SYSTEM_AUDIT=Object.freeze({version:VERSION,installed:false,reason:'processInput-missing'});
    return;
  }
  const originalProcessInput=processInput;
  const hooks={before:[],after:[]};
  const active={before:[],after:[]};
  const DEFAULTS=Object.freeze({bufferMs:125,moveDeadzone:.14,aimDeadzone:.18,gamepadMoveCurve:1.2,gamepadAimCurve:1.12,maxBuffered:32});
  const tuning=Object.assign({},DEFAULTS);
  const queue=[];
  const combat={
    sequence:1,
    move:{x:0,y:0,magnitude:0,source:'legacy'},
    aim:{x:1,y:0,magnitude:0,source:'default'},
    rawAim:{x:1,y:0,magnitude:0,source:'default'},
    basic:{pressed:false,held:false,released:false,pressedAt:0,releasedAt:0},
    special:{pressed:false,held:false,released:false,pressedAt:0,releasedAt:0},
    lastSource:'legacy',
    gamepadIndex:-1
  };
  const combatReadView={};
  Object.defineProperties(combatReadView,{
    move:{enumerable:true,get:()=>combat.move},
    aim:{enumerable:true,get:()=>combat.aim},
    rawAim:{enumerable:true,get:()=>combat.rawAim},
    basic:{enumerable:true,get:()=>combat.basic},
    special:{enumerable:true,get:()=>combat.special},
    buffered:{enumerable:true,get:()=>queue},
    lastSource:{enumerable:true,get:()=>combat.lastSource},
    gamepadIndex:{enumerable:true,get:()=>combat.gamepadIndex},
    tuning:{enumerable:true,get:()=>tuning}
  });
  Object.freeze(combatReadView);
  let sequence=1;

  function perfNow(){return root.performance&&typeof root.performance.now==='function'?root.performance.now():Date.now();}
  function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
  function normalize(x,y,fallback){
    x=Number(x);y=Number(y);
    if(!Number.isFinite(x)||!Number.isFinite(y)||Math.hypot(x,y)<1e-7){x=fallback&&Number(fallback.x)||1;y=fallback&&Number(fallback.y)||0;}
    const l=Math.hypot(x,y)||1;return{x:x/l,y:y/l};
  }
  function radialAxis(x,y,deadzone,curve){
    x=Number(x)||0;y=Number(y)||0;deadzone=clamp(Number(deadzone)||0,0,.95);curve=Math.max(.25,Number(curve)||1);
    const len=Math.min(1,Math.hypot(x,y));
    if(len<=deadzone||len<1e-7)return Object.freeze({x:0,y:0,magnitude:0,rawMagnitude:len});
    const normalized=(len-deadzone)/(1-deadzone),mag=Math.pow(clamp(normalized,0,1),curve),dir=normalize(x,y);
    return Object.freeze({x:dir.x*mag,y:dir.y*mag,magnitude:mag,rawMagnitude:len});
  }
  function configureCombat(values){
    const v=values&&typeof values==='object'?values:{};
    if(Number.isFinite(Number(v.bufferMs)))tuning.bufferMs=clamp(Number(v.bufferMs),40,500);
    if(Number.isFinite(Number(v.moveDeadzone)))tuning.moveDeadzone=clamp(Number(v.moveDeadzone),0,.6);
    if(Number.isFinite(Number(v.aimDeadzone)))tuning.aimDeadzone=clamp(Number(v.aimDeadzone),0,.6);
    if(Number.isFinite(Number(v.gamepadMoveCurve)))tuning.gamepadMoveCurve=clamp(Number(v.gamepadMoveCurve),.25,3);
    if(Number.isFinite(Number(v.gamepadAimCurve)))tuning.gamepadAimCurve=clamp(Number(v.gamepadAimCurve),.25,3);
    if(Number.isFinite(Number(v.maxBuffered)))tuning.maxBuffered=Math.max(4,Math.min(128,Math.floor(Number(v.maxBuffered))));
    return combatSnapshot();
  }
  function setAxes(next){
    const n=next&&typeof next==='object'?next:{};
    if(n.move){const m=radialAxis(n.move.x,n.move.y,Number.isFinite(Number(n.move.deadzone))?Number(n.move.deadzone):0,Number(n.move.curve)||1);combat.move={x:m.x,y:m.y,magnitude:m.magnitude,source:String(n.move.source||n.source||combat.move.source||'unknown')};}
    if(n.rawAim){const raw=normalize(n.rawAim.x,n.rawAim.y,combat.rawAim);combat.rawAim={x:raw.x,y:raw.y,magnitude:Number.isFinite(Number(n.rawAim.magnitude))?clamp(Number(n.rawAim.magnitude),0,1):1,source:String(n.rawAim.source||n.source||'unknown')};}
    if(n.aim){const a=normalize(n.aim.x,n.aim.y,combat.aim);combat.aim={x:a.x,y:a.y,magnitude:Number.isFinite(Number(n.aim.magnitude))?clamp(Number(n.aim.magnitude),0,1):1,source:String(n.aim.source||n.source||combat.aim.source||'unknown')};if(!n.rawAim)combat.rawAim={x:a.x,y:a.y,magnitude:combat.aim.magnitude,source:combat.aim.source};}
    combat.lastSource=String(n.source||combat.aim.source||combat.move.source||combat.lastSource);
    return combatSnapshot();
  }
  function lifecycle(type,at){
    const t=String(type||''),time=Number.isFinite(Number(at))?Number(at):perfNow();
    const isBasic=t.indexOf('BASIC_')===0,isSpecial=t.indexOf('SPECIAL_')===0,target=isBasic?combat.basic:isSpecial?combat.special:null;
    if(!target)return;
    if(t.endsWith('_PRESS')){target.pressed=true;target.released=false;target.held=true;target.pressedAt=time;}
    else if(t.endsWith('_HOLD')){target.held=true;target.pressed=false;target.released=false;}
    else if(t.endsWith('_RELEASE')){target.released=true;target.pressed=false;target.held=false;target.releasedAt=time;}
    else if(t==='CANCEL_CAST'){target.pressed=false;target.released=false;target.held=false;}
  }
  function pushCombatIntent(type,payload,at){
    const key=String(type||'').trim();if(!key)return null;
    const time=Number.isFinite(Number(at))?Number(at):perfNow(),entry=Object.freeze({id:'combat-intent-'+(combat.sequence++).toString(36),sequence:combat.sequence-1,type:key,payload:payload&&typeof payload==='object'?Object.freeze(Object.assign({},payload)):Object.freeze({}),at:time,expiresAt:time+tuning.bufferMs});
    lifecycle(key,time);queue.push(entry);while(queue.length>tuning.maxBuffered)queue.shift();return entry;
  }
  function expireCombatIntents(now){now=Number.isFinite(Number(now))?Number(now):perfNow();let removed=0;for(let i=queue.length-1;i>=0;i--)if(queue[i].expiresAt<now){queue.splice(i,1);removed++;}return removed;}
  function peekCombatIntent(type,now,maxAgeMs){
    now=Number.isFinite(Number(now))?Number(now):perfNow();expireCombatIntents(now);const key=type==null?null:String(type),age=Number.isFinite(Number(maxAgeMs))?Math.max(0,Number(maxAgeMs)):tuning.bufferMs;
    for(let i=0;i<queue.length;i++){const q=queue[i];if(key&&q.type!==key)continue;if(now-q.at<=age)return q;}return null;
  }
  function consumeCombatIntent(type,now,maxAgeMs){
    now=Number.isFinite(Number(now))?Number(now):perfNow();expireCombatIntents(now);const key=type==null?null:String(type),age=Number.isFinite(Number(maxAgeMs))?Math.max(0,Number(maxAgeMs)):tuning.bufferMs;
    for(let i=0;i<queue.length;i++){const q=queue[i];if(key&&q.type!==key)continue;if(now-q.at>age)continue;queue.splice(i,1);return q;}return null;
  }
  function clearCombatIntents(){queue.length=0;combat.basic.pressed=combat.basic.released=combat.basic.held=false;combat.special.pressed=combat.special.released=combat.special.held=false;}

  function pollGamepad(){
    if(!root.navigator||typeof root.navigator.getGamepads!=='function')return null;
    const pads=root.navigator.getGamepads();let pad=null;
    for(let i=0;i<pads.length;i++)if(pads[i]&&pads[i].connected){pad=pads[i];break;}
    if(!pad){combat.gamepadIndex=-1;return null;}
    combat.gamepadIndex=pad.index;
    const move=radialAxis(pad.axes&&pad.axes[0],pad.axes&&pad.axes[1],tuning.moveDeadzone,tuning.gamepadMoveCurve);
    const aim=radialAxis(pad.axes&&pad.axes[2],pad.axes&&pad.axes[3],tuning.aimDeadzone,tuning.gamepadAimCurve);
    if(move.magnitude>0){combat.move={x:move.x,y:move.y,magnitude:move.magnitude,source:'gamepad'};combat.lastSource='gamepad';if(typeof input!=='undefined'&&input){input.normX=move.x;input.normY=move.y;}}
    if(aim.magnitude>0){const d=normalize(aim.x,aim.y,combat.aim);combat.rawAim={x:d.x,y:d.y,magnitude:aim.magnitude,source:'gamepad'};combat.aim={x:d.x,y:d.y,magnitude:aim.magnitude,source:'gamepad'};combat.lastSource='gamepad';}
    return Object.freeze({index:pad.index,move,aim,buttons:pad.buttons||[]});
  }

  function rebuild(phase){active[phase]=hooks[phase].slice();}
  function add(phase,owner,fn,priority){
    if(typeof fn!=='function')throw new TypeError('input hook must be a function');
    const entry={id:'input-hook-'+sequence++,owner:String(owner||'anonymous'),fn:fn,priority:Number(priority)||0};
    hooks[phase].push(entry);hooks[phase].sort(function(a,b){return a.priority-b.priority||a.id.localeCompare(b.id);});rebuild(phase);return entry.id;
  }
  function unregister(id){let removed=false;['before','after'].forEach(function(phase){const i=hooks[phase].findIndex(function(h){return h.id===id;});if(i>=0){hooks[phase].splice(i,1);rebuild(phase);removed=true;}});return removed;}
  function run(phase,ctx){const list=active[phase];for(let i=0;i<list.length;i++)list[i].fn(ctx);}
  function isLocked(){const locks=root.KeloInputLocks;return !!(locks&&typeof locks.isLocked==='function'&&locks.isLocked());}
  function clearIntent(){
    if(typeof input!=='undefined'&&input){input.normX=0;input.normY=0;input.touchActive=false;input.touchId=null;const keys=input.keys||{};Object.keys(keys).forEach(function(key){keys[key]=false;});}
    if(typeof localPlayer!=='undefined'&&localPlayer){localPlayer.vx=0;localPlayer.vy=0;}
    combat.move={x:0,y:0,magnitude:0,source:'locked'};clearCombatIntents();
  }
  function publicList(phase){return Object.freeze(hooks[phase].map(function(h){return Object.freeze({id:h.id,owner:h.owner,priority:h.priority});}));}
  function combatSnapshot(){return Object.freeze({tuning:Object.freeze(Object.assign({},tuning)),move:Object.freeze(Object.assign({},combat.move)),aim:Object.freeze(Object.assign({},combat.aim)),rawAim:Object.freeze(Object.assign({},combat.rawAim)),basic:Object.freeze(Object.assign({},combat.basic)),special:Object.freeze(Object.assign({},combat.special)),buffered:Object.freeze(queue.slice()),lastSource:combat.lastSource,gamepadIndex:combat.gamepadIndex});}
  function combatRead(){return combatReadView;}
  function snapshot(){return Object.freeze({version:VERSION,locked:isLocked(),before:publicList('before'),after:publicList('after'),combat:combatSnapshot()});}

  processInput=function(){
    if(isLocked()){clearIntent();return;}
    const ctx={input:typeof input!=='undefined'?input:null,player:typeof localPlayer!=='undefined'?localPlayer:null,combat:combat};
    run('before',ctx);
    const result=originalProcessInput.apply(this,arguments);
    pollGamepad();
    if(typeof input!=='undefined'&&input&&combat.lastSource!=='gamepad'){
      const m=radialAxis(input.normX,input.normY,0,1);combat.move={x:m.x,y:m.y,magnitude:m.magnitude,source:'legacy'};
    }
    expireCombatIntents(perfNow());
    run('after',ctx);
    return result;
  };

  const combatApi=Object.freeze({
    configure:configureCombat,setAxes:setAxes,push:pushCombatIntent,peek:peekCombatIntent,consume:consumeCombatIntent,expire:expireCombatIntents,clear:clearCombatIntents,
    snapshot:combatSnapshot,read:combatRead,
    get bufferMs(){return tuning.bufferMs;}
  });
  root.KeloInput=Object.freeze({
    version:VERSION,
    before:function(owner,fn,priority){return add('before',owner,fn,priority);},
    after:function(owner,fn,priority){return add('after',owner,fn,priority);},
    unregister:unregister,isLocked:isLocked,snapshot:snapshot,
    radialAxis:radialAxis,pollGamepad:pollGamepad,combat:combatApi
  });
  root.KELO_INPUT_SYSTEM_AUDIT=Object.freeze({version:VERSION,installed:true,owner:true,singleLegacyWrapper:true,usesKeloInputLocks:true,beforeAfterHooks:true,activeListCached:true,perFrameHookCopies:false,zeroCopyCombatRead:true,combatIntentContract:true,inputBuffer:true,radialDeadzone:true,gamepadReady:true,timers:0,uiRules:false,collisionLegacyAttached:!!root.KELO_COLLISION?.ownerSnapshot?.().legacyAttached});
  root.KELO_INPUT_GATE_AUDIT=Object.freeze({version:VERSION,installed:true,retiredInto:'KeloInput',owner:'KeloInput',lockOwner:'KeloInputLocks',bridge:true,processInputWrapperOwner:'KeloInput',timers:0});
})(typeof globalThis!=='undefined'?globalThis:window);
