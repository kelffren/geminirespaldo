/* KELO-INDEX
 * area: STUDIO / DIAGNOSTICS / WORLD SURGERY
 * owner: World Surgery Control
 * owns: pre-World kill switches, persistent flight recorder, heartbeat, presets and controlled-module bisect
 * does-not-own: Studio tools themselves; modules must explicitly consult KELO_WORLD_SURGERY before side effects
 * mobile: designed to exist before World opens so iPhone can change flags even when Studio freezes
 * safety: all switches default ON, preserving current production behavior until the user disables something
 */

const CONFIG_KEY='kelo.worldSurgery.config.v1';
const FLIGHT_KEY='kelo.worldSurgery.flight.v1';
const BISECT_KEY='kelo.worldSurgery.bisect.v1';
const PANEL_ID='kelo-world-surgery-panel';
const STYLE_ID='kelo-world-surgery-style';
const TRIGGER_ATTR='data-world-surgery-button';

const MODULES=Object.freeze([
  {key:'studioKernel',label:'Studio Kernel',group:'VITAL',wired:false},
  {key:'worldDocument',label:'World Document',group:'VITAL',wired:false},
  {key:'runtimeAdapter',label:'Runtime Adapter',group:'VITAL',wired:false},
  {key:'shell',label:'Studio Shell',group:'VITAL',wired:false},
  {key:'placement',label:'Placement Core',group:'VITAL',wired:false},

  {key:'currentWorldImporter',label:'Current World Importer',group:'AISLABLE',wired:false},
  {key:'indexedDbStore',label:'IndexedDB Store',group:'AISLABLE',wired:false},
  {key:'compiler',label:'World Compiler',group:'AISLABLE',wired:false},
  {key:'worker',label:'Compiler Worker',group:'AISLABLE',wired:false},
  {key:'assetPreview',label:'Asset Preview',group:'AISLABLE',wired:false},
  {key:'prefabSeeder',label:'Prefab / Catalog Seeder',group:'AISLABLE',wired:false},
  {key:'assetCatalog',label:'Asset Catalog',group:'AISLABLE',wired:false},
  {key:'treeCatalog',label:'Tree Catalog / Registration',group:'AISLABLE',wired:false},
  {key:'placementTouch',label:'Placement Touch',group:'AISLABLE',wired:false},
  {key:'explorerController',label:'Explorer Controller',group:'AISLABLE',wired:false},
  {key:'overlay',label:'Overlay',group:'AISLABLE',wired:false},
  {key:'authorityMirror',label:'Authority Mirror',group:'AISLABLE',wired:false},
  {key:'cameraController',label:'Camera Controller',group:'AISLABLE',wired:false},
  {key:'grid',label:'Grid',group:'AISLABLE',wired:false},
  {key:'draftHydration',label:'Draft Hydration',group:'AISLABLE',wired:false},
  {key:'snapshotLoading',label:'Snapshot Loading',group:'AISLABLE',wired:false},

  {key:'basicTools',label:'Basic / Build Tools',group:'OPCIONAL',wired:true},
  {key:'paintCopies',label:'Paint Copies',group:'OPCIONAL',wired:true,risk:'HISTORICAL REGRESSION c13cceaf → DOM mutation storm fix 51bd045'},
  {key:'quickBuild',label:'Quick Build',group:'OPCIONAL',wired:true},
  {key:'roomBuild',label:'Room Build',group:'OPCIONAL',wired:true},
  {key:'roomOpening',label:'Room Opening',group:'OPCIONAL',wired:true},
  {key:'roomMaterial',label:'Room Material',group:'OPCIONAL',wired:true},
  {key:'assetPalette',label:'Asset Palette',group:'OPCIONAL',wired:false},
  {key:'assetFavorites',label:'Asset Favorites',group:'OPCIONAL',wired:false},
  {key:'assetKeyboard',label:'Asset Keyboard',group:'OPCIONAL',wired:false},
  {key:'menuMinimizer',label:'Menu Minimizer',group:'OPCIONAL',wired:false},
  {key:'cleanWorkspace',label:'Clean Workspace',group:'OPCIONAL',wired:false},
  {key:'contextInspector',label:'Context Inspector',group:'OPCIONAL',wired:false},
  {key:'contextSnapChip',label:'Context Snap Chip',group:'OPCIONAL',wired:false},
  {key:'multiAlign',label:'Multi Align',group:'OPCIONAL',wired:false},
  {key:'historyHints',label:'History Hints',group:'OPCIONAL',wired:false},
  {key:'transformPresets',label:'Transform Presets',group:'OPCIONAL',wired:false},
  {key:'nudge',label:'Nudge',group:'OPCIONAL',wired:false},
  {key:'overlapCycle',label:'Overlap Cycle',group:'OPCIONAL',wired:false},
  {key:'precisionSnap',label:'Precision Snap',group:'OPCIONAL',wired:false},
  {key:'selectionHistory',label:'Selection History',group:'OPCIONAL',wired:false},
  {key:'focusShortcut',label:'Focus Shortcut',group:'OPCIONAL',wired:false},
  {key:'quickActions',label:'Quick Actions',group:'OPCIONAL',wired:false},
  {key:'keyboardDelete',label:'Keyboard Delete',group:'OPCIONAL',wired:false},
  {key:'keyboardDuplicate',label:'Keyboard Duplicate',group:'OPCIONAL',wired:false},
  {key:'keyboardHistory',label:'Keyboard History',group:'OPCIONAL',wired:false},
  {key:'keyboardClipboard',label:'Keyboard Clipboard',group:'OPCIONAL',wired:false},
  {key:'selectAll',label:'Select All',group:'OPCIONAL',wired:false},
  {key:'explorerReveal',label:'Explorer Reveal',group:'OPCIONAL',wired:false},
  {key:'propertyCommit',label:'Property Commit',group:'OPCIONAL',wired:false},
  {key:'snapCycle',label:'Snap Cycle',group:'OPCIONAL',wired:false},
  {key:'productivityExtras',label:'Productivity Extras Master',group:'OPCIONAL',wired:false}
]);

const MODULE_BY_KEY=new Map(MODULES.map(m=>[m.key,m]));
const defaultConfig=()=>Object.fromEntries(MODULES.map(m=>[m.key,true]));

function safeParse(value,fallback){try{return value?JSON.parse(value):fallback;}catch{return fallback;}}
function readStorage(root,key,fallback){try{return safeParse(root.localStorage?.getItem(key),fallback);}catch{return fallback;}}
function writeStorage(root,key,value){try{root.localStorage?.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
function nowIso(){return new Date().toISOString();}
function perfNow(root){try{return root.performance?.now?.()||Date.now();}catch{return Date.now();}}

function makeState(root){
  const config={...defaultConfig(),...readStorage(root,CONFIG_KEY,{})};
  const flight={
    version:1,bootId:null,startedAt:null,heartbeatAt:null,phase:'IDLE',currentModule:null,
    lastStarted:null,lastCompleted:null,suspect:null,result:null,statuses:{},events:[],
    ...(readStorage(root,FLIGHT_KEY,{})||{})
  };
  let bisect=readStorage(root,BISECT_KEY,null);
  let heartbeatTimer=0;

  const persistConfig=()=>writeStorage(root,CONFIG_KEY,config);
  const persistFlight=()=>writeStorage(root,FLIGHT_KEY,flight);
  const persistBisect=()=>writeStorage(root,BISECT_KEY,bisect);
  const event=(type,module,extra={})=>{
    flight.events.push({at:nowIso(),type,module:module||null,...extra});
    if(flight.events.length>100)flight.events.splice(0,flight.events.length-100);
  };

  function enabled(key){return config[key]!==false;}
  function setEnabled(key,value){if(!MODULE_BY_KEY.has(key))return false;config[key]=!!value;persistConfig();renderPanel(root);return true;}
  function snapshotFlags(){
    const on=[],off=[];
    for(const m of MODULES)(enabled(m.key)?on:off).push(m.key);
    return {on,off};
  }
  function moduleStart(key,phase='BOOT'){
    const started=perfNow(root);
    flight.phase=phase;flight.currentModule=key;flight.lastStarted=key;flight.statuses[key]='LOADING';
    event('START',key,{phase});persistFlight();renderPanel(root);
    return started;
  }
  function moduleDone(key,startedAt=null){
    const duration=startedAt==null?null:Math.max(0,Math.round(perfNow(root)-startedAt));
    flight.currentModule=flight.currentModule===key?null:flight.currentModule;
    flight.lastCompleted=key;flight.statuses[key]='DONE';event('DONE',key,{durationMs:duration});persistFlight();renderPanel(root);
  }
  function moduleDisabled(key,phase='BOOT'){
    flight.statuses[key]='DISABLED';event('DISABLED',key,{phase});persistFlight();renderPanel(root);
  }
  function moduleFailed(key,error){
    flight.currentModule=null;flight.suspect=key;flight.statuses[key]='FAILED';
    event('FAILED',key,{error:String(error?.message||error||'unknown')});persistFlight();renderPanel(root);
  }
  function endBoot(result='READY'){
    if(heartbeatTimer){(root.clearInterval||clearInterval)(heartbeatTimer);heartbeatTimer=0;}
    flight.result=result;flight.phase=result;flight.currentModule=null;flight.heartbeatAt=nowIso();
    if(result!=='READY'&&flight.lastStarted&&flight.lastStarted!==flight.lastCompleted)flight.suspect=flight.lastStarted;
    event('BOOT_'+result,null);persistFlight();renderPanel(root);
  }
  function beginBoot(source='world-card'){
    if(heartbeatTimer){(root.clearInterval||clearInterval)(heartbeatTimer);heartbeatTimer=0;}
    const startedMs=Date.now();
    flight.bootId=`world-${startedMs}`;flight.startedAt=nowIso();flight.heartbeatAt=flight.startedAt;
    flight.phase='BOOT';flight.currentModule=null;flight.lastStarted=null;flight.lastCompleted=null;flight.suspect=null;flight.result=null;flight.statuses={};
    event('BOOT_START',null,{source,flags:snapshotFlags()});persistFlight();renderPanel(root);
    heartbeatTimer=(root.setInterval||setInterval)(()=>{
      flight.heartbeatAt=nowIso();
      const live=root.document?.getElementById?.('kelo-studio-live');
      const ready=!!(live?.isConnected&&live.dataset?.keloWorldLoading!=='1'&&live.querySelector?.('.ks-status'));
      if(ready){endBoot('READY');return;}
      const elapsed=Date.now()-startedMs;
      if(elapsed>=30000){endBoot('TIMEOUT');return;}
      persistFlight();
    },400);
  }

  function applyPreset(name){
    const next=defaultConfig();
    if(name==='SAFE_CORE'||name==='NO_OPTIONAL'){
      for(const m of MODULES)if(m.group==='OPCIONAL')next[m.key]=false;
    }
    if(name==='NO_PAINT_COPIES')next.paintCopies=false;
    if(name==='NO_ASSETS')for(const k of ['assetPreview','prefabSeeder','assetCatalog','treeCatalog','assetPalette','assetFavorites'])next[k]=false;
    if(name==='NO_STORAGE')next.indexedDbStore=false;
    if(name==='NO_IMPORT_CURRENT')for(const k of ['currentWorldImporter','draftHydration','snapshotLoading'])next[k]=false;
    if(name==='NO_PRODUCTIVITY')for(const m of MODULES)if(m.group==='OPCIONAL'&&!['basicTools','paintCopies','quickBuild','roomBuild','roomOpening','roomMaterial'].includes(m.key))next[m.key]=false;
    Object.assign(config,next);persistConfig();
    event('PRESET',null,{name});persistFlight();renderPanel(root);
  }

  function controlledCandidates(){return MODULES.filter(m=>m.wired&&m.group!=='VITAL'&&m.key!=='basicTools').map(m=>m.key);}
  function applyBisectRound(){
    if(!bisect?.candidates?.length)return;
    const candidates=bisect.candidates.slice();
    const cut=Math.max(1,Math.ceil(candidates.length/2));
    const on=candidates.slice(0,cut),off=candidates.slice(cut);
    for(const key of controlledCandidates())config[key]=!candidates.includes(key);
    for(const key of on)config[key]=true;
    for(const key of off)config[key]=false;
    config.basicTools=true;
    bisect.round=(bisect.round||0)+1;bisect.on=on;bisect.off=off;bisect.result=null;bisect.primary=candidates.length===1?candidates[0]:null;
    persistConfig();persistBisect();renderPanel(root);
  }
  function startBisect(){
    bisect={version:1,round:0,candidates:controlledCandidates(),on:[],off:[],result:null,primary:null,history:[]};
    applyBisectRound();
  }
  function markBisect(result){
    if(!bisect?.candidates?.length||!bisect.on)return;
    const normalized=result==='FREEZE'?'FREEZE':'WORKS';
    bisect.history.push({round:bisect.round,on:[...bisect.on],off:[...bisect.off],result:normalized,at:nowIso()});
    bisect.candidates=(normalized==='FREEZE'?bisect.on:bisect.off).slice();
    if(bisect.candidates.length<=1){
      bisect.primary=bisect.candidates[0]||null;bisect.result='COMPLETE';persistBisect();renderPanel(root);return;
    }
    applyBisectRound();
  }

  const api=Object.freeze({
    version:'world-surgery-v1.0.0',modules:MODULES,
    enabled,setEnabled,applyPreset,beginBoot,endBoot,moduleStart,moduleDone,moduleDisabled,moduleFailed,
    startBisect,markBisect,
    get config(){return {...config};},
    get flight(){return JSON.parse(JSON.stringify(flight));},
    get bisect(){return bisect?JSON.parse(JSON.stringify(bisect)):null;},
    openPanel:()=>openPanel(root),
    resetFlight(){Object.assign(flight,{bootId:null,startedAt:null,heartbeatAt:null,phase:'IDLE',currentModule:null,lastStarted:null,lastCompleted:null,suspect:null,result:null,statuses:{},events:[]});persistFlight();renderPanel(root);}
  });
  return api;
}

function ensureStyle(root){
  const doc=root.document;if(!doc||doc.getElementById(STYLE_ID))return;
  const style=doc.createElement('style');style.id=STYLE_ID;
  style.textContent=`
  [${TRIGGER_ATTR}]{border:1px solid rgba(105,210,168,.55);background:rgba(18,92,67,.18);color:#bfffe0;border-radius:14px;padding:12px;font-weight:900;letter-spacing:.04em;cursor:pointer;min-height:52px}
  #${PANEL_ID}{position:fixed;inset:0;z-index:2147483500;background:rgba(5,7,9,.98);color:#f4f5f4;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:auto;padding:18px 14px 40px}
  #${PANEL_ID} *{box-sizing:border-box} .kws-head{display:flex;align-items:center;gap:10px;position:sticky;top:0;background:rgba(5,7,9,.96);padding:8px 0 12px;z-index:2}.kws-head h1{font-size:20px;margin:0}.kws-close{margin-left:auto;border:1px solid #42464b;background:#14171b;color:#fff;border-radius:12px;padding:9px 12px;font-weight:800}.kws-note{font-size:12px;color:#aeb6b2;margin:4px 0 14px}.kws-danger{color:#ffb49f}.kws-presets{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}.kws-presets button,.kws-bisect button{border:1px solid #39443f;background:#121916;color:#eafff3;border-radius:10px;padding:8px 10px;font-weight:800}.kws-group{margin:18px 0}.kws-group h2{font-size:12px;letter-spacing:.14em;color:#d6bb78}.kws-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;border:1px solid #242a27;border-radius:12px;padding:10px 11px;margin:7px 0;background:#0d100f}.kws-copy strong{display:block;font-size:14px}.kws-copy small{display:block;color:#8f9994;margin-top:3px;font-size:10px}.kws-copy .risk{color:#ffb49f}.kws-row input{width:24px;height:24px}.kws-flight{border:1px solid #27342e;border-radius:14px;padding:12px;background:#0a100d}.kws-flight code{display:block;white-space:pre-wrap;color:#bcf5d7;font-size:11px}.kws-bisect{border:1px solid #3d3320;border-radius:14px;padding:12px;margin-top:14px;background:#151108}.kws-bisect-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
  `;
  doc.head?.append(style);
}

function rowFor(root,m){
  const api=root.KELO_WORLD_SURGERY,doc=root.document;
  const row=doc.createElement('label');row.className='kws-row';
  const copy=doc.createElement('span');copy.className='kws-copy';
  const strong=doc.createElement('strong');strong.textContent=m.label;
  const small=doc.createElement('small');small.textContent=`${m.group} · ${m.wired?'CONTROLLED NOW':'PLANNED / NOT WIRED YET'} · ${api.flight.statuses?.[m.key]||'NOT LOADED'}`;
  copy.append(strong,small);
  if(m.risk){const risk=doc.createElement('small');risk.className='risk';risk.textContent=`⚠ ${m.risk}`;copy.append(risk);}
  const input=doc.createElement('input');input.type='checkbox';input.checked=api.enabled(m.key);input.disabled=!m.wired&&m.group==='VITAL';
  input.addEventListener('change',()=>api.setEnabled(m.key,input.checked));
  row.append(copy,input);return row;
}

function renderPanel(root){
  const panel=root.document?.getElementById?.(PANEL_ID);if(!panel)return;
  const api=root.KELO_WORLD_SURGERY;if(!api)return;
  const body=panel.querySelector('[data-kws-body]');if(!body)return;
  body.replaceChildren();
  const note=root.document.createElement('p');note.className='kws-note';note.textContent='Switch OFF = code remains in the repository but controlled modules skip creation/side effects. PLANNED switches are visible for the surgery map but are not wired yet.';body.append(note);
  const presets=root.document.createElement('div');presets.className='kws-presets';
  for(const name of ['ALL_CURRENT','SAFE_CORE','NO_OPTIONAL','NO_ASSETS','NO_STORAGE','NO_IMPORT_CURRENT','NO_PRODUCTIVITY','NO_PAINT_COPIES']){
    const b=root.document.createElement('button');b.type='button';b.textContent=name;b.onclick=()=>api.applyPreset(name);presets.append(b);
  }
  body.append(presets);
  for(const group of ['VITAL','AISLABLE','OPCIONAL']){
    const sec=root.document.createElement('section');sec.className='kws-group';
    const h=root.document.createElement('h2');h.textContent=group;sec.append(h);
    for(const m of MODULES.filter(x=>x.group===group))sec.append(rowFor(root,m));
    body.append(sec);
  }
  const flight=api.flight;
  const flightBox=root.document.createElement('section');flightBox.className='kws-flight';
  const fh=root.document.createElement('h2');fh.textContent='WORLD SURGERY FLIGHT RECORDER';
  const code=root.document.createElement('code');
  code.textContent=`PHASE: ${flight.phase||'IDLE'}\nRESULT: ${flight.result||'-'}\nLAST STARTED: ${flight.lastStarted||'-'}\nLAST COMPLETED: ${flight.lastCompleted||'-'}\nSUSPECT: ${flight.suspect||'-'}\nHEARTBEAT: ${flight.heartbeatAt||'-'}`;
  flightBox.append(fh,code);body.append(flightBox);
  const bisect=api.bisect;
  const bsec=root.document.createElement('section');bsec.className='kws-bisect';
  const bh=root.document.createElement('h2');bh.textContent='AUTO BISECT — CONTROLLED MODULES';bsec.append(bh);
  const summary=root.document.createElement('div');summary.className='kws-note';summary.textContent=bisect?.primary?`PRIMARY SUSPECT: ${bisect.primary}`:bisect?`ROUND ${bisect.round} · ON: ${(bisect.on||[]).join(', ')||'-'} · OFF: ${(bisect.off||[]).join(', ')||'-'}`:'Not started';bsec.append(summary);
  const actions=root.document.createElement('div');actions.className='kws-bisect-actions';
  const start=root.document.createElement('button');start.textContent='AUTO BISECT';start.onclick=()=>api.startBisect();actions.append(start);
  if(bisect&&!bisect.primary){const works=root.document.createElement('button');works.textContent='✅ FUNCIONA';works.onclick=()=>api.markBisect('WORKS');const freeze=root.document.createElement('button');freeze.textContent='💀 FREEZE';freeze.onclick=()=>api.markBisect('FREEZE');actions.append(works,freeze);}
  bsec.append(actions);body.append(bsec);
}

function openPanel(root){
  const doc=root.document;if(!doc)return null;ensureStyle(root);
  let panel=doc.getElementById(PANEL_ID);
  if(!panel){
    panel=doc.createElement('section');panel.id=PANEL_ID;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','World Surgery Control');
    const head=doc.createElement('header');head.className='kws-head';
    const title=doc.createElement('h1');title.textContent='🩺 WORLD SURGERY CONTROL';
    const close=doc.createElement('button');close.className='kws-close';close.textContent='CLOSE';close.onclick=()=>panel.remove();
    head.append(title,close);const body=doc.createElement('div');body.setAttribute('data-kws-body','');panel.append(head,body);doc.body.append(panel);
  }
  renderPanel(root);return panel;
}

function installTrigger(root){
  const doc=root.document;if(!doc)return ()=>{};ensureStyle(root);
  const sync=()=>{
    const world=doc.querySelector('#kelo-creators-hub [data-workspace="world"]');
    if(!world?.parentElement)return;
    if(world.parentElement.querySelector(`[${TRIGGER_ATTR}]`))return;
    const button=doc.createElement('button');button.type='button';button.setAttribute(TRIGGER_ATTR,'');button.textContent='🩺 CIRUGÍA';button.setAttribute('aria-label','Abrir World Surgery Control');
    button.addEventListener('pointerup',e=>{e.preventDefault();e.stopPropagation();openPanel(root);});
    world.insertAdjacentElement('afterend',button);
  };
  let scheduled=false;
  const schedule=()=>{if(scheduled)return;scheduled=true;(root.requestAnimationFrame||root.setTimeout||setTimeout)(()=>{scheduled=false;sync();});};
  const observer=new MutationObserver(schedule);observer.observe(doc.body,{childList:true,subtree:true});sync();
  const onWorld=e=>{
    const target=e.target?.closest?.('#kelo-creators-hub [data-workspace="world"]');
    if(!target)return;
    root.KELO_WORLD_SURGERY?.beginBoot?.('creator-hub-world');
  };
  doc.addEventListener('pointerup',onWorld,true);
  return ()=>{observer.disconnect();doc.removeEventListener('pointerup',onWorld,true);};
}

let installed=null;
export function installWorldSurgery({root=globalThis}={}){
  if(installed)return installed;
  const api=makeState(root);root.KELO_WORLD_SURGERY=api;
  const removeTrigger=installTrigger(root);
  installed=Object.freeze({api,destroy(){removeTrigger();root.document?.getElementById(PANEL_ID)?.remove();if(root.KELO_WORLD_SURGERY===api)delete root.KELO_WORLD_SURGERY;installed=null;}});
  return installed;
}

if(typeof window!=='undefined'&&window.document)installWorldSurgery({root:window});
